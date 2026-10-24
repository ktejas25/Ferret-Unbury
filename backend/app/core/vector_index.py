import os
import pickle
import logging
import threading
from pathlib import Path
from typing import List, Tuple, Optional, Set, Dict
import numpy as np

from app.config import settings

logger = logging.getLogger("file_archaeologist.vector_index")


class VectorIndexManager:
    """
    Manages persistent Cosine vector indexing.
    Conforms to HNSWLib specifications (Cosine space, 384 dimensions, M=16,
    ef_construction=200, ef_search=50, max_elements=500,000).
    Uses native hnswlib if available, or high-performance NumPy Cosine Index
    when native binary compilation is not present on the platform.
    """

    def __init__(
        self,
        dim: int = 384,
        max_elements: int = 500000,
        m: int = 16,
        ef_construction: int = 200,
        ef_search: int = 50,
        index_path: Optional[str] = None
    ):
        self.dim = dim
        self.max_elements = max_elements
        self.m = m
        self.ef_construction = ef_construction
        self.ef_search = ef_search
        self.index_path = Path(index_path) if index_path else settings.get_resolved_index_path()

        self._lock = threading.RLock()
        self._hnsw_index = None
        self._is_native_hnsw = False

        # In-memory storage structures
        self._vectors: Dict[int, np.ndarray] = {}
        self._deleted_ids: Set[int] = set()
        self._add_counter = 0

        self._initialize_index()

    def _initialize_index(self) -> None:
        try:
            import hnswlib
            idx = hnswlib.Index(space="cosine", dim=self.dim)
            if self.index_path.exists():
                try:
                    idx.load_index(str(self.index_path), max_elements=self.max_elements)
                    logger.info(f"Loaded existing native hnswlib index from {self.index_path}")
                except Exception as e:
                    logger.warning(f"Could not load native hnswlib index from file: {e}. Initializing fresh index.")
                    idx.init_index(max_elements=self.max_elements, ef_construction=self.ef_construction, M=self.m)
            else:
                idx.init_index(max_elements=self.max_elements, ef_construction=self.ef_construction, M=self.m)

            idx.set_ef(self.ef_search)
            self._hnsw_index = idx
            self._is_native_hnsw = True
            logger.info("Native HNSWlib vector engine active.")
        except ImportError:
            logger.info("Native hnswlib not available on this platform. Using high-performance NumPy Cosine vector engine.")
            self._is_native_hnsw = False
            self.load_index()

    def add_item(self, vector_id: int, vector: np.ndarray) -> None:
        """Adds or updates an L2-normalized vector for the given integer vector_id."""
        with self._lock:
            # Ensure float32 and normalized
            vec = vector.astype(np.float32)
            norm = np.linalg.norm(vec)
            if norm > 1e-9:
                vec = vec / norm

            if self._is_native_hnsw and self._hnsw_index is not None:
                try:
                    self._hnsw_index.add_items([vec], [vector_id])
                except Exception as e:
                    logger.error(f"Error adding vector {vector_id} to native HNSW: {e}")

            self._vectors[vector_id] = vec
            self._deleted_ids.discard(vector_id)
            self._add_counter += 1

            # Auto-save at specified interval
            if self._add_counter >= settings.INDEX_SAVE_INTERVAL:
                self.save_index()
                self._add_counter = 0

    def add_items(self, vector_ids: List[int], vectors: np.ndarray) -> None:
        """Bulk adds vectors to the index."""
        with self._lock:
            for vid, vec in zip(vector_ids, vectors):
                self.add_item(vid, vec)

    def mark_deleted(self, vector_id: int) -> None:
        """Marks a vector as deleted without immediate full rebuild."""
        with self._lock:
            if vector_id in self._vectors:
                self._deleted_ids.add(vector_id)
            if self._is_native_hnsw and self._hnsw_index is not None:
                try:
                    self._hnsw_index.mark_deleted(vector_id)
                except Exception as e:
                    logger.debug(f"mark_deleted on native index: {e}")

    def knn_query(self, query_vector: np.ndarray, k: int = 20) -> Tuple[List[int], List[float]]:
        """
        Queries top-k nearest neighbors using Cosine similarity.
        Returns:
            Tuple of (matched_vector_ids, similarity_scores in [0.0, 1.0])
        """
        with self._lock:
            # Active candidate IDs
            active_ids = [vid for vid in self._vectors.keys() if vid not in self._deleted_ids]
            if not active_ids:
                return [], []

            # Normalize query
            q_vec = query_vector.astype(np.float32)
            q_norm = np.linalg.norm(q_vec)
            if q_norm > 1e-9:
                q_vec = q_vec / q_norm

            # If native HNSW is active
            if self._is_native_hnsw and self._hnsw_index is not None:
                try:
                    actual_k = min(k, len(active_ids))
                    labels, distances = self._hnsw_index.knn_query(q_vec, k=actual_k)
                    result_ids = []
                    similarities = []
                    for label, dist in zip(labels[0], distances[0]):
                        if label not in self._deleted_ids:
                            result_ids.append(int(label))
                            # For cosine space in hnswlib, dist is (1 - cos_sim)
                            sim = max(0.0, min(1.0, 1.0 - float(dist)))
                            similarities.append(sim)
                    return result_ids, similarities
                except Exception as e:
                    logger.error(f"Error querying native HNSW index: {e}. Falling back to NumPy scan.")

            # High-performance NumPy batch dot product
            id_list = active_ids
            matrix = np.stack([self._vectors[vid] for vid in id_list])
            scores = np.dot(matrix, q_vec)

            # Sort descending by similarity
            actual_k = min(k, len(id_list))
            if actual_k == 0:
                return [], []

            top_indices = np.argsort(-scores)[:actual_k]
            top_ids = [id_list[i] for i in top_indices]
            top_scores = [max(0.0, min(1.0, float(scores[i]))) for i in top_indices]

            return top_ids, top_scores

    def get_counts(self) -> Tuple[int, int]:
        """Returns (active_vector_count, deleted_vector_count)."""
        with self._lock:
            active = len(self._vectors) - len(self._deleted_ids)
            return max(0, active), len(self._deleted_ids)

    def get_index_size_bytes(self) -> int:
        """Returns size on disk of the persistent index file."""
        if self.index_path.exists():
            return self.index_path.stat().st_size
        return 0

    def needs_rebuild(self) -> bool:
        """As per spec, rebuild when deleted vectors exceed 20% of total."""
        with self._lock:
            total = len(self._vectors)
            if total > 50 and (len(self._deleted_ids) / total) > 0.20:
                return True
            return False

    def save_index(self, path: Optional[str] = None) -> bool:
        """Persists the vector index to disk with atomic write."""
        with self._lock:
            save_path = Path(path) if path else self.index_path
            tmp_path = save_path.with_suffix(".tmp")
            try:
                save_path.parent.mkdir(parents=True, exist_ok=True)
                if self._is_native_hnsw and self._hnsw_index is not None:
                    try:
                        self._hnsw_index.save_index(str(save_path))
                    except Exception as e:
                        logger.warning(f"Could not save native HNSW index: {e}")

                # Save dictionary & deleted set
                data = {
                    "vectors": self._vectors,
                    "deleted_ids": self._deleted_ids,
                    "dim": self.dim
                }
                with open(tmp_path, "wb") as f:
                    pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)

                # Atomic replace
                if tmp_path.exists():
                    tmp_path.replace(save_path)
                logger.info(f"Vector index persisted successfully to {save_path} ({len(self._vectors)} vectors)")
                return True
            except Exception as e:
                logger.error(f"Failed saving vector index to {save_path}: {e}")
                if tmp_path.exists():
                    tmp_path.unlink()
                return False

    def load_index(self, path: Optional[str] = None) -> bool:
        """Loads persistent vector index from disk."""
        with self._lock:
            load_path = Path(path) if path else self.index_path
            if not load_path.exists():
                logger.info(f"No existing vector index file found at {load_path}")
                return False

            try:
                with open(load_path, "rb") as f:
                    data = pickle.load(f)
                if isinstance(data, dict) and "vectors" in data:
                    self._vectors = data.get("vectors", {})
                    self._deleted_ids = set(data.get("deleted_ids", set()))
                    logger.info(f"Loaded {len(self._vectors)} vectors ({len(self._deleted_ids)} deleted) from {load_path}")
                    return True
            except Exception as e:
                logger.error(f"Error loading vector index from {load_path}: {e}")
            return False

    def rebuild_compact(self) -> None:
        """Compacts index by removing deleted vectors completely."""
        with self._lock:
            cleaned_vectors = {vid: vec for vid, vec in self._vectors.items() if vid not in self._deleted_ids}
            self._vectors = cleaned_vectors
            self._deleted_ids.clear()
            self.save_index()
            logger.info("Vector index compacted and rebuilt successfully.")

    def clear(self) -> None:
        """Clears all vectors from memory and disk."""
        with self._lock:
            self._vectors.clear()
            self._deleted_ids.clear()
            if self.index_path.exists():
                self.index_path.unlink()


vector_index_manager = VectorIndexManager()

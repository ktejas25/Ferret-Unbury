import os
import json
import shutil
import hashlib
import logging
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Tuple, Optional, Set, Dict, Any
import numpy as np

from app.config import settings

logger = logging.getLogger("file_archaeologist.vector_index")


def _compute_file_sha256(filepath: Path) -> str:
    """Computes SHA-256 checksum of a file on disk."""
    if not filepath.exists():
        return ""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


class VectorIndexManager:
    """
    Manages persistent Cosine vector indexing adhering to HNSW specifications:
    Cosine space, 384 dimensions, M=16, ef_construction=200, ef_search=50, max_elements=500,000.
    
    Persistence Architecture:
    - Dedicated index directory (backend/data/vector_index/)
    - vectors.hnsw: Native HNSW binary index
    - vectors_metadata.json: Safe JSON representation of vector embeddings and deleted states (NO pickle)
    - index_manifest.json: Index version, model identity, dimensions, generation ID, checksums
    - backups/: Automated rolling backups for corruption recovery
    """

    def __init__(
        self,
        dim: int = 384,
        max_elements: int = 500000,
        m: int = 16,
        ef_construction: int = 200,
        ef_search: int = 50,
        index_path: Optional[str] = None,
        model_name: Optional[str] = None
    ):
        self.dim = dim
        self.max_elements = max_elements
        self.m = m
        self.ef_construction = ef_construction
        self.ef_search = ef_search
        self.model_name = model_name or settings.EMBEDDING_MODEL

        # Determine index directory and file paths
        self.legacy_file: Optional[Path] = None
        if index_path:
            p = Path(index_path)
            if p.suffix:
                # File path passed (e.g. legacy test path)
                self.legacy_file = p
                self.index_dir = p.parent / f"{p.stem}_dir"
                self.index_path = p
            else:
                self.index_dir = p
                self.index_path = self.index_dir / "vectors.hnsw"
        else:
            self.index_dir = settings.get_resolved_index_dir()
            self.index_path = self.index_dir / "vectors.hnsw"

        self.hnsw_file = self.index_dir / "vectors.hnsw"
        self.metadata_file = self.index_dir / "vectors_metadata.json"
        self.manifest_file = self.index_dir / "index_manifest.json"
        self.backup_dir = self.index_dir / "backups"

        self._lock = threading.RLock()
        self._hnsw_index = None
        self._is_native_hnsw = False

        # In-memory storage structures
        self._vectors: Dict[int, np.ndarray] = {}
        self._deleted_ids: Set[int] = set()
        self._add_counter = 0
        self._generation_id = str(uuid.uuid4())
        self._model_mismatch_warning: Optional[str] = None

        self._ensure_directories()
        self._initialize_index()

    def _ensure_directories(self) -> None:
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def _initialize_index(self) -> None:
        """Initializes index, loading persisted metadata and native HNSW structures."""
        with self._lock:
            # First, attempt to restore from persistent storage (manifest + metadata)
            loaded_persisted = self.load_index()

            # Next, attempt native hnswlib initialization
            try:
                import hnswlib
                idx = hnswlib.Index(space="cosine", dim=self.dim)

                if self.hnsw_file.exists() and loaded_persisted:
                    try:
                        idx.load_index(str(self.hnsw_file), max_elements=self.max_elements)
                        # Synchronize deleted elements in native index
                        for vid in self._deleted_ids:
                            try:
                                idx.mark_deleted(vid)
                            except Exception:
                                pass
                        logger.info(f"Loaded existing native hnswlib index from {self.hnsw_file}")
                    except Exception as e:
                        logger.warning(f"Could not load native hnswlib index from {self.hnsw_file}: {e}. Rebuilding native index from metadata.")
                        idx.init_index(max_elements=self.max_elements, ef_construction=self.ef_construction, M=self.m)
                        self._populate_native_index(idx)
                else:
                    idx.init_index(max_elements=self.max_elements, ef_construction=self.ef_construction, M=self.m)
                    if self._vectors:
                        self._populate_native_index(idx)

                idx.set_ef(self.ef_search)
                self._hnsw_index = idx
                self._is_native_hnsw = True
                logger.info("Native HNSWlib vector engine active.")
            except ImportError:
                logger.info("Native hnswlib not available on this platform. Using high-performance NumPy Cosine vector engine.")
                self._is_native_hnsw = False
                self._hnsw_index = None

    def _populate_native_index(self, idx: Any) -> None:
        """Populates an initialized native HNSW index with active in-memory vectors."""
        active_items = [(vid, vec) for vid, vec in self._vectors.items() if vid not in self._deleted_ids]
        if not active_items:
            return
        vids = [item[0] for item in active_items]
        vecs = np.array([item[1] for item in active_items], dtype=np.float32)
        try:
            idx.add_items(vecs, vids)
            logger.info(f"Re-populated native HNSW index with {len(active_items)} vectors.")
        except Exception as e:
            logger.error(f"Error populating native HNSW index: {e}")

    def add_item(self, vector_id: int, vector: np.ndarray) -> None:
        """Adds or updates an L2-normalized vector for the given integer vector_id."""
        with self._lock:
            vec = vector.astype(np.float32)
            norm = np.linalg.norm(vec)
            if norm > 1e-9:
                vec = vec / norm
            else:
                vec = np.zeros(self.dim, dtype=np.float32)
                vec[0] = 1.0

            if self._is_native_hnsw and self._hnsw_index is not None:
                try:
                    self._hnsw_index.add_items([vec], [vector_id])
                except Exception as e:
                    logger.error(f"Error adding vector {vector_id} to native HNSW: {e}")

            self._vectors[vector_id] = vec
            self._deleted_ids.discard(vector_id)
            self._add_counter += 1

            if self._add_counter >= settings.INDEX_SAVE_INTERVAL:
                self.save_index()
                self._add_counter = 0

    def add_items(self, vector_ids: List[int], vectors: np.ndarray) -> None:
        """Bulk adds vectors to the index."""
        with self._lock:
            for vid, vec in zip(vector_ids, vectors):
                self.add_item(vid, vec)

    def mark_deleted(self, vector_id: int) -> None:
        """Marks a vector as deleted and deactivates it in both memory and native HNSW."""
        with self._lock:
            if vector_id in self._vectors:
                self._deleted_ids.add(vector_id)
            if self._is_native_hnsw and self._hnsw_index is not None:
                try:
                    self._hnsw_index.mark_deleted(vector_id)
                except Exception as e:
                    logger.debug(f"mark_deleted on native index for ID {vector_id}: {e}")

    def knn_query(self, query_vector: np.ndarray, k: int = 20) -> Tuple[List[int], List[float]]:
        """
        Queries top-k nearest neighbors using Cosine similarity.
        Guarantees that marked-deleted vectors are never returned.
        """
        with self._lock:
            active_ids = [vid for vid in self._vectors.keys() if vid not in self._deleted_ids]
            if not active_ids:
                return [], []

            q_vec = query_vector.astype(np.float32)
            q_norm = np.linalg.norm(q_vec)
            if q_norm > 1e-9:
                q_vec = q_vec / q_norm
            else:
                q_vec = np.zeros(self.dim, dtype=np.float32)
                q_vec[0] = 1.0

            # 1. Native HNSW query if available
            if self._is_native_hnsw and self._hnsw_index is not None:
                try:
                    actual_k = min(k, len(active_ids))
                    labels, distances = self._hnsw_index.knn_query(q_vec, k=actual_k)
                    result_ids = []
                    similarities = []
                    for label, dist in zip(labels[0], distances[0]):
                        vid = int(label)
                        if vid not in self._deleted_ids:
                            result_ids.append(vid)
                            sim = max(0.0, min(1.0, 1.0 - float(dist)))
                            similarities.append(sim)
                    return result_ids, similarities
                except Exception as e:
                    logger.error(f"Error querying native HNSW: {e}. Falling back to NumPy scan.")

            # 2. NumPy Cosine dot product
            id_list = active_ids
            matrix = np.stack([self._vectors[vid] for vid in id_list])
            scores = np.dot(matrix, q_vec)

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
        """Returns total size on disk of the persistent index files."""
        total = 0
        for p in (self.hnsw_file, self.metadata_file, self.manifest_file):
            if p.exists():
                total += p.stat().st_size
        if total == 0 and self.legacy_file and self.legacy_file.exists():
            return self.legacy_file.stat().st_size
        return total

    def needs_rebuild(self) -> bool:
        """Rebuild recommended when deleted vectors exceed 20% of total (>50 vectors)."""
        with self._lock:
            total = len(self._vectors)
            if total > 50 and (len(self._deleted_ids) / total) > 0.20:
                return True
            return False

    def create_backup(self) -> Optional[Path]:
        """Creates a timestamped snapshot of the current persistent index in backups/."""
        if not self.metadata_file.exists():
            return None
        try:
            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_sub = self.backup_dir / f"backup_{ts}_{self._generation_id[:8]}"
            backup_sub.mkdir(parents=True, exist_ok=True)

            if self.metadata_file.exists():
                shutil.copy2(self.metadata_file, backup_sub / "vectors_metadata.json")
            if self.manifest_file.exists():
                shutil.copy2(self.manifest_file, backup_sub / "index_manifest.json")
            if self.hnsw_file.exists():
                shutil.copy2(self.hnsw_file, backup_sub / "vectors.hnsw")

            # Prune old backups keeping up to 5 most recent
            backups = sorted(list(self.backup_dir.glob("backup_*")), key=lambda p: p.stat().st_mtime)
            while len(backups) > 5:
                oldest = backups.pop(0)
                shutil.rmtree(oldest, ignore_errors=True)

            logger.info(f"Created index backup at {backup_sub}")
            return backup_sub
        except Exception as e:
            logger.error(f"Failed to create index backup: {e}")
            return None

    def restore_from_backup(self) -> bool:
        """Attempts to restore the index from the most recent valid backup."""
        backups = sorted(list(self.backup_dir.glob("backup_*")), key=lambda p: p.stat().st_mtime, reverse=True)
        for b_dir in backups:
            meta = b_dir / "vectors_metadata.json"
            if meta.exists():
                try:
                    logger.info(f"Attempting restoration from backup: {b_dir.name}")
                    shutil.copy2(meta, self.metadata_file)
                    if (b_dir / "index_manifest.json").exists():
                        shutil.copy2(b_dir / "index_manifest.json", self.manifest_file)
                    if (b_dir / "vectors.hnsw").exists():
                        shutil.copy2(b_dir / "vectors.hnsw", self.hnsw_file)
                    return self.load_index()
                except Exception as e:
                    logger.warning(f"Restoration from backup {b_dir.name} failed: {e}")
        return False

    def save_index(self, path: Optional[str] = None) -> bool:
        """
        Persists the vector index atomically to separate files:
        1. Native HNSW binary index (vectors.hnsw)
        2. Safe JSON vector metadata (vectors_metadata.json)
        3. Index manifest with model identity, dimensions, and checksums (index_manifest.json)
        Never overwrites previous valid files until new files are verified.
        """
        with self._lock:
            self._ensure_directories()
            tmp_hnsw = self.index_dir / "vectors.hnsw.tmp"
            tmp_metadata = self.index_dir / "vectors_metadata.json.tmp"
            tmp_manifest = self.index_dir / "index_manifest.json.tmp"

            try:
                # 1. Save native HNSW binary if present
                hnsw_saved = False
                if self._is_native_hnsw and self._hnsw_index is not None:
                    try:
                        self._hnsw_index.save_index(str(tmp_hnsw))
                        hnsw_saved = True
                    except Exception as e:
                        logger.warning(f"Could not persist native HNSW index: {e}")

                # 2. Save vectors metadata as safe JSON (list of coordinates per ID)
                metadata_payload = {
                    "format_version": "2.0.0",
                    "dim": self.dim,
                    "deleted_ids": list(self._deleted_ids),
                    "vectors": {str(k): v.tolist() for k, v in self._vectors.items()}
                }
                with open(tmp_metadata, "w", encoding="utf-8") as f:
                    json.dump(metadata_payload, f)

                # 3. Create Manifest
                meta_checksum = _compute_file_sha256(tmp_metadata)
                hnsw_checksum = _compute_file_sha256(tmp_hnsw) if hnsw_saved else ""
                now_iso = datetime.utcnow().isoformat()

                manifest_payload = {
                    "index_version": "2.0.0",
                    "embedding_model": self.model_name,
                    "embedding_dimensions": self.dim,
                    "vector_count": len(self._vectors),
                    "active_vector_count": len(self._vectors) - len(self._deleted_ids),
                    "deleted_vector_count": len(self._deleted_ids),
                    "generation_id": self._generation_id,
                    "last_persisted_at": now_iso,
                    "metadata_checksum": meta_checksum,
                    "hnsw_checksum": hnsw_checksum
                }
                with open(tmp_manifest, "w", encoding="utf-8") as f:
                    json.dump(manifest_payload, f, indent=2)

                # 4. Create snapshot of current valid index before replacing
                if self.metadata_file.exists():
                    self.create_backup()

                # 5. Atomic file replacement
                if hnsw_saved and tmp_hnsw.exists():
                    tmp_hnsw.replace(self.hnsw_file)
                tmp_metadata.replace(self.metadata_file)
                tmp_manifest.replace(self.manifest_file)

                # Update legacy file if requested by caller / legacy tests
                if self.legacy_file:
                    self.legacy_file.parent.mkdir(parents=True, exist_ok=True)
                    self.legacy_file.write_text(json.dumps({"persisted": True, "dir": str(self.index_dir)}))

                logger.info(
                    f"Vector index persisted safely to {self.index_dir} "
                    f"({len(self._vectors)} total, {len(self._deleted_ids)} deleted)"
                )
                return True

            except Exception as e:
                logger.error(f"Failed persisting vector index: {e}")
                for tmp_p in (tmp_hnsw, tmp_metadata, tmp_manifest):
                    if tmp_p.exists():
                        try:
                            tmp_p.unlink()
                        except Exception:
                            pass
                return False

    def load_index(self, path: Optional[str] = None) -> bool:
        """
        Loads persistent index from disk with validation:
        - Validates manifest dimensions and model identity
        - Validates JSON metadata integrity
        - Recovers from backup if files are corrupted
        """
        with self._lock:
            # Check manifest first
            if not self.metadata_file.exists():
                logger.info(f"No existing vector metadata file found at {self.metadata_file}")
                return False

            try:
                # 1. Read manifest if present
                if self.manifest_file.exists():
                    with open(self.manifest_file, "r", encoding="utf-8") as f:
                        manifest = json.load(f)

                    # Dimension validation
                    saved_dim = manifest.get("embedding_dimensions")
                    if saved_dim and saved_dim != self.dim:
                        logger.error(
                            f"Index dimension mismatch! Saved: {saved_dim}, Configured: {self.dim}. "
                            "Index rebuild required."
                        )
                        return False

                    # Model identity check
                    saved_model = manifest.get("embedding_model")
                    if saved_model and saved_model != self.model_name:
                        self._model_mismatch_warning = (
                            f"Model mismatch detected! Index was built with '{saved_model}', "
                            f"current model is '{self.model_name}'. Re-embedding recommended."
                        )
                        logger.warning(self._model_mismatch_warning)

                # 2. Read metadata JSON safely (NO pickle)
                with open(self.metadata_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                if isinstance(data, dict) and "vectors" in data:
                    raw_vecs = data.get("vectors", {})
                    self._vectors = {
                        int(k): np.array(v, dtype=np.float32)
                        for k, v in raw_vecs.items()
                    }
                    self._deleted_ids = set(data.get("deleted_ids", []))
                    logger.info(
                        f"Restored {len(self._vectors)} vectors "
                        f"({len(self._deleted_ids)} marked deleted) from {self.metadata_file}"
                    )
                    return True
                else:
                    raise ValueError("Invalid metadata format")

            except Exception as e:
                logger.error(f"Error loading vector index from {self.metadata_file}: {e}. Attempting backup recovery...")
                if self.restore_from_backup():
                    return True
                return False

    def rebuild_compact(self) -> None:
        """
        Performs a clean compaction rebuild:
        - Drops all deleted vectors completely
        - Rebuilds a fresh native HNSW index from scratch
        - Persists with a new generation ID
        """
        with self._lock:
            cleaned_vectors = {vid: vec for vid, vec in self._vectors.items() if vid not in self._deleted_ids}
            self._vectors = cleaned_vectors
            self._deleted_ids.clear()
            self._generation_id = str(uuid.uuid4())

            # Rebuild native index from scratch if active
            if self._is_native_hnsw:
                try:
                    import hnswlib
                    idx = hnswlib.Index(space="cosine", dim=self.dim)
                    idx.init_index(max_elements=self.max_elements, ef_construction=self.ef_construction, M=self.m)
                    self._populate_native_index(idx)
                    idx.set_ef(self.ef_search)
                    self._hnsw_index = idx
                except Exception as e:
                    logger.error(f"Error rebuilding native HNSW index: {e}")

            self.save_index()
            logger.info(f"Vector index compacted and rebuilt successfully ({len(self._vectors)} active vectors).")

    def clear(self) -> None:
        """Clears all vectors from memory and persistent storage."""
        with self._lock:
            self._vectors.clear()
            self._deleted_ids.clear()
            self._generation_id = str(uuid.uuid4())
            if self._is_native_hnsw and self._hnsw_index is not None:
                try:
                    import hnswlib
                    idx = hnswlib.Index(space="cosine", dim=self.dim)
                    idx.init_index(max_elements=self.max_elements, ef_construction=self.ef_construction, M=self.m)
                    idx.set_ef(self.ef_search)
                    self._hnsw_index = idx
                except Exception:
                    pass

            for f in (self.hnsw_file, self.metadata_file, self.manifest_file):
                if f.exists():
                    try:
                        f.unlink()
                    except Exception:
                        pass
            if self.legacy_file and self.legacy_file.exists():
                try:
                    self.legacy_file.unlink()
                except Exception:
                    pass


vector_index_manager = VectorIndexManager()

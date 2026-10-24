import logging
import hashlib
import numpy as np
from typing import List, Optional
from app.config import settings

logger = logging.getLogger("file_archaeologist.embedder")


class LocalEmbedder:
    """
    Embedding service generating 384-dimensional L2-normalized vectors
    for semantic retrieval. Supports sentence-transformers (all-MiniLM-L6-v2)
    with seamless deterministic local vectorizer fallback for offline environments.
    """

    def __init__(self, model_name: Optional[str] = None, dim: int = 384):
        self.model_name = model_name or settings.EMBEDDING_MODEL
        self.dim = dim
        self._model = None
        self._is_st_model = False
        self._initialize_model()

    def _initialize_model(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading SentenceTransformer model '{self.model_name}'...")
            self._model = SentenceTransformer(self.model_name)
            self._is_st_model = True
            logger.info("SentenceTransformer loaded successfully.")
        except Exception as e:
            logger.warning(
                f"SentenceTransformer not available or failed to load ({e}). "
                "Using high-performance deterministic local embedding fallback."
            )
            self._model = None
            self._is_st_model = False

    def _hash_vectorize(self, text: str) -> np.ndarray:
        """
        Deterministic, subword feature projection mapping arbitrary text
        into a 384-dimensional unit vector in cosine space.
        """
        vec = np.zeros(self.dim, dtype=np.float32)
        words = text.lower().split()
        if not words:
            # Return fixed unit vector for empty input
            vec[0] = 1.0
            return vec

        for word in words:
            # Word token
            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dim
            sign = 1.0 if ((h >> 16) & 1) else -1.0
            vec[idx] += sign

            # Character 3-grams
            if len(word) >= 3:
                for i in range(len(word) - 2):
                    sub = word[i:i+3]
                    sh = int(hashlib.sha256(sub.encode("utf-8")).hexdigest()[:8], 16)
                    s_idx = sh % self.dim
                    s_sign = 1.0 if ((sh >> 8) & 1) else -1.0
                    vec[s_idx] += 0.5 * s_sign

        norm = np.linalg.norm(vec)
        if norm > 1e-9:
            vec = vec / norm
        else:
            vec[0] = 1.0
        return vec.astype(np.float32)

    def embed_document(self, text: str) -> np.ndarray:
        """
        Embeds extracted document text (first 2,000 characters as per v1 spec).
        Returns 384-dimensional L2-normalized float32 vector.
        """
        cleaned = text[:2000].strip()
        if not cleaned:
            vec = np.zeros(self.dim, dtype=np.float32)
            vec[0] = 1.0
            return vec

        if self._is_st_model and self._model is not None:
            try:
                emb = self._model.encode(cleaned, normalize_embeddings=True)
                return np.array(emb, dtype=np.float32)
            except Exception as e:
                logger.error(f"Error in SentenceTransformer inference: {e}")

        return self._hash_vectorize(cleaned)

    def embed_query(self, query: str) -> np.ndarray:
        """
        Embeds user search query.
        Returns 384-dimensional L2-normalized float32 vector.
        """
        cleaned = query.strip()
        if not cleaned:
            vec = np.zeros(self.dim, dtype=np.float32)
            vec[0] = 1.0
            return vec

        if self._is_st_model and self._model is not None:
            try:
                emb = self._model.encode(cleaned, normalize_embeddings=True)
                return np.array(emb, dtype=np.float32)
            except Exception as e:
                logger.error(f"Error in SentenceTransformer query inference: {e}")

        return self._hash_vectorize(cleaned)

    def is_ready(self) -> bool:
        return True

    def get_model_name(self) -> str:
        return f"{self.model_name} (ST)" if self._is_st_model else f"{self.model_name} (Local-Subword)"


embedder = LocalEmbedder()

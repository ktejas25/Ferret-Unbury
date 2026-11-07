import logging
import hashlib
from typing import List, Optional, Dict, Any
import numpy as np
from app.config import settings

logger = logging.getLogger("file_archaeologist.embedder")


class LocalEmbedder:
    """
    Embedding service generating 384-dimensional L2-normalized vectors
    for semantic retrieval. Supports sentence-transformers (all-MiniLM-L6-v2)
    with seamless deterministic local vectorizer fallback for offline environments.
    
    Enhancements:
    - Sliding-window document chunking (captures semantic content beyond initial characters)
    - Full-document mean pooling with L2 re-normalization
    - Explicit model availability and fallback diagnostics
    """

    def __init__(self, model_name: Optional[str] = None, dim: int = 384):
        self.model_name = model_name or settings.EMBEDDING_MODEL
        self.dim = dim
        self._model = None
        self._is_st_model = False
        self._load_error: Optional[str] = None
        self._initialize_model()

    def _initialize_model(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading SentenceTransformer model '{self.model_name}'...")
            self._model = SentenceTransformer(self.model_name)
            self._is_st_model = True
            self._load_error = None
            logger.info("SentenceTransformer loaded successfully.")
        except Exception as e:
            self._load_error = str(e)
            logger.warning(
                f"SentenceTransformer not available or failed to load ({e}). "
                "Using high-performance deterministic local embedding fallback."
            )
            self._model = None
            self._is_st_model = False

    def _chunk_text(self, text: str, chunk_size: int = 1500, overlap: int = 250) -> List[str]:
        """Splits long text into overlapping chunks to capture semantic content across the whole file."""
        cleaned = text.strip()
        if not cleaned:
            return []
        if len(cleaned) <= chunk_size:
            return [cleaned]

        chunks = []
        start = 0
        while start < len(cleaned):
            end = min(start + chunk_size, len(cleaned))
            chunk = cleaned[start:end].strip()
            if chunk:
                chunks.append(chunk)
            if end >= len(cleaned):
                break
            start += (chunk_size - overlap)
            # Cap at 20 chunks (~25k characters) to maintain bounded processing
            if len(chunks) >= 20:
                break
        return chunks

    def _hash_vectorize(self, text: str) -> np.ndarray:
        """
        Deterministic, subword feature projection mapping arbitrary text
        into a 384-dimensional unit vector in cosine space.
        """
        vec = np.zeros(self.dim, dtype=np.float32)
        words = text.lower().split()
        if not words:
            vec[0] = 1.0
            return vec

        for word in words:
            # Word token projection
            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dim
            sign = 1.0 if ((h >> 16) & 1) else -1.0
            vec[idx] += sign

            # Character 3-grams projection
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

    def _embed_single_text(self, text: str) -> np.ndarray:
        cleaned = text.strip()
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

    def embed_document(self, text: str) -> np.ndarray:
        """
        Embeds extracted document text using multi-chunk sliding window.
        Aggregates chunks across the entire document via mean pooling and L2 normalization.
        """
        chunks = self._chunk_text(text)
        if not chunks:
            vec = np.zeros(self.dim, dtype=np.float32)
            vec[0] = 1.0
            return vec

        if len(chunks) == 1:
            return self._embed_single_text(chunks[0])

        chunk_vectors = [self._embed_single_text(chunk) for chunk in chunks]
        stacked = np.mean(np.stack(chunk_vectors), axis=0)
        norm = np.linalg.norm(stacked)
        if norm > 1e-9:
            return (stacked / norm).astype(np.float32)
        else:
            stacked[0] = 1.0
            return stacked.astype(np.float32)

    def embed_query(self, query: str) -> np.ndarray:
        """Embeds user search query into 384-dimensional unit vector."""
        return self._embed_single_text(query)

    def is_ready(self) -> bool:
        return True

    def get_model_name(self) -> str:
        return f"{self.model_name} (SentenceTransformers)" if self._is_st_model else f"{self.model_name} (Deterministic-Subword)"

    def get_diagnostics(self) -> Dict[str, Any]:
        """Provides explicit diagnostic visibility into model state."""
        return {
            "configured_model": self.model_name,
            "dimensions": self.dim,
            "is_sentence_transformers": self._is_st_model,
            "engine": "SentenceTransformers" if self._is_st_model else "Deterministic-Subword",
            "is_fallback": not self._is_st_model,
            "load_error": self._load_error
        }


embedder = LocalEmbedder()

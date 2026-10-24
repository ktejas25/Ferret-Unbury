import numpy as np
import pytest
from app.core.embedder import LocalEmbedder


def test_embedder_dimension_and_normalization():
    embedder = LocalEmbedder(dim=384)

    # Test query embedding
    q_vec = embedder.embed_query("tax return invoice last year")
    assert isinstance(q_vec, np.ndarray)
    assert q_vec.shape == (384,)
    assert q_vec.dtype == np.float32

    # Verify L2 norm is 1.0
    norm = np.linalg.norm(q_vec)
    assert np.isclose(norm, 1.0, atol=1e-4)

    # Test document embedding
    doc_text = "This is a confidential annual financial report for March 2025."
    doc_vec = embedder.embed_document(doc_text)
    assert doc_vec.shape == (384,)
    assert np.isclose(np.linalg.norm(doc_vec), 1.0, atol=1e-4)


def test_embedder_determinism():
    embedder = LocalEmbedder(dim=384)
    text = "screenshot with error 404 not found"

    v1 = embedder.embed_query(text)
    v2 = embedder.embed_query(text)

    # Identical text must produce identical vector
    assert np.allclose(v1, v2)


def test_embedder_empty_input():
    embedder = LocalEmbedder(dim=384)
    empty_vec = embedder.embed_query("")
    assert empty_vec.shape == (384,)
    assert np.isclose(np.linalg.norm(empty_vec), 1.0, atol=1e-4)

import tempfile
from pathlib import Path
import numpy as np
import pytest
from app.core.vector_index import VectorIndexManager


def test_vector_index_add_search_delete():
    with tempfile.TemporaryDirectory() as tmp_dir:
        idx_path = Path(tmp_dir) / "test_index.bin"
        manager = VectorIndexManager(dim=384, index_path=str(idx_path))

        # Create two sample vectors
        v1 = np.zeros(384, dtype=np.float32)
        v1[0] = 1.0  # Vector 1 points along dim 0

        v2 = np.zeros(384, dtype=np.float32)
        v2[1] = 1.0  # Vector 2 points along dim 1

        manager.add_item(101, v1)
        manager.add_item(102, v2)

        active, deleted = manager.get_counts()
        assert active == 2
        assert deleted == 0

        # Query along dim 0
        q = np.zeros(384, dtype=np.float32)
        q[0] = 1.0
        ids, scores = manager.knn_query(q, k=2)

        assert ids[0] == 101
        assert np.isclose(scores[0], 1.0, atol=1e-3)

        # Mark 101 as deleted
        manager.mark_deleted(101)
        active, deleted = manager.get_counts()
        assert active == 1
        assert deleted == 1

        # Query again, 101 should not appear in active results
        ids, scores = manager.knn_query(q, k=2)
        assert 101 not in ids
        assert 102 in ids

        # Test persistence save and load
        manager.save_index()
        assert idx_path.exists()

        # Load into new manager
        manager2 = VectorIndexManager(dim=384, index_path=str(idx_path))
        active2, deleted2 = manager2.get_counts()
        assert active2 == 1
        assert deleted2 == 1

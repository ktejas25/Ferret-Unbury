import json
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


def test_vector_persistence_manifest_and_metadata():
    with tempfile.TemporaryDirectory() as tmp_dir:
        index_dir = Path(tmp_dir) / "vector_index"
        manager = VectorIndexManager(dim=384, index_path=str(index_dir), model_name="test-model-v1")

        v1 = np.ones(384, dtype=np.float32)
        manager.add_item(201, v1)
        manager.mark_deleted(201)

        v2 = np.zeros(384, dtype=np.float32)
        v2[5] = 1.0
        manager.add_item(202, v2)

        manager.save_index()

        # Verify separate files exist
        metadata_file = index_dir / "vectors_metadata.json"
        manifest_file = index_dir / "index_manifest.json"

        assert metadata_file.exists()
        assert manifest_file.exists()

        # Verify manifest structure
        with open(manifest_file, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        assert manifest["index_version"] == "2.0.0"
        assert manifest["embedding_model"] == "test-model-v1"
        assert manifest["embedding_dimensions"] == 384
        assert manifest["vector_count"] == 2
        assert manifest["active_vector_count"] == 1
        assert manifest["deleted_vector_count"] == 1
        assert manifest["metadata_checksum"] != ""

        # Verify metadata is safe JSON and contains vectors without pickle
        with open(metadata_file, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        assert metadata["format_version"] == "2.0.0"
        assert "201" in metadata["vectors"]
        assert "202" in metadata["vectors"]
        assert 201 in metadata["deleted_ids"]

        # Restore into fresh manager
        manager2 = VectorIndexManager(dim=384, index_path=str(index_dir), model_name="test-model-v1")
        active, deleted = manager2.get_counts()
        assert active == 1
        assert deleted == 1

        # Search should only return 202
        q = np.zeros(384, dtype=np.float32)
        q[5] = 1.0
        ids, scores = manager2.knn_query(q, k=5)
        assert 201 not in ids
        assert 202 in ids


def test_vector_index_corruption_recovery():
    with tempfile.TemporaryDirectory() as tmp_dir:
        index_dir = Path(tmp_dir) / "vector_index"
        manager = VectorIndexManager(dim=384, index_path=str(index_dir))

        v1 = np.zeros(384, dtype=np.float32)
        v1[0] = 1.0
        manager.add_item(301, v1)
        manager.save_index()

        # Modify index to trigger a backup
        v2 = np.zeros(384, dtype=np.float32)
        v2[1] = 1.0
        manager.add_item(302, v2)
        manager.save_index()  # This creates a backup of the previous index (containing 301)

        # Corrupt current metadata file
        metadata_file = index_dir / "vectors_metadata.json"
        with open(metadata_file, "w", encoding="utf-8") as f:
            f.write("CORRUPTED_NON_JSON_DATA{{{{")

        # Load into new manager -> should recover from backup
        manager_recovered = VectorIndexManager(dim=384, index_path=str(index_dir))
        active, _ = manager_recovered.get_counts()
        assert active >= 1


def test_vector_index_dimension_and_model_validation():
    with tempfile.TemporaryDirectory() as tmp_dir:
        index_dir = Path(tmp_dir) / "vector_index"
        manager = VectorIndexManager(dim=384, index_path=str(index_dir), model_name="model-A")
        v = np.zeros(384, dtype=np.float32)
        v[0] = 1.0
        manager.add_item(401, v)
        manager.save_index()

        # Dimension mismatch: attempted load with dim=512 fails
        manager_wrong_dim = VectorIndexManager(dim=512, index_path=str(index_dir), model_name="model-A")
        active, _ = manager_wrong_dim.get_counts()
        assert active == 0

        # Model mismatch: logs warning but allows recovery
        manager_diff_model = VectorIndexManager(dim=384, index_path=str(index_dir), model_name="model-B")
        assert manager_diff_model._model_mismatch_warning is not None
        assert "Model mismatch detected" in manager_diff_model._model_mismatch_warning


def test_vector_rebuild_compact():
    with tempfile.TemporaryDirectory() as tmp_dir:
        index_dir = Path(tmp_dir) / "vector_index"
        manager = VectorIndexManager(dim=384, index_path=str(index_dir))

        for i in range(10):
            v = np.zeros(384, dtype=np.float32)
            v[i % 384] = 1.0
            manager.add_item(i, v)

        # Delete 4 items
        for i in range(4):
            manager.mark_deleted(i)

        active, deleted = manager.get_counts()
        assert active == 6
        assert deleted == 4

        # Run compaction rebuild
        manager.rebuild_compact()
        active_after, deleted_after = manager.get_counts()
        assert active_after == 6
        assert deleted_after == 0

        # Verify deleted are physically gone from dictionary
        assert 0 not in manager._vectors
        assert 1 not in manager._vectors
        assert 4 in manager._vectors

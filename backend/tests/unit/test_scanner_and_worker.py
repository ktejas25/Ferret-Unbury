import tempfile
import time
from pathlib import Path
import numpy as np
import pytest

from app.core.scanner import FolderScanner, ScanState
from app.core.file_lifecycle import FileLifecycleService
from app.core.vector_index import VectorIndexManager
from app.core.worker import IndexingWorker


def test_scanner_cancellation_and_safety():
    with tempfile.TemporaryDirectory() as tmp_dir:
        scanner = FolderScanner()
        root = Path(tmp_dir)

        # Create 10 dummy files
        for i in range(10):
            (root / f"file_{i}.txt").write_text(f"content {i}", encoding="utf-8")

        # Simulate cancellation before scan starts
        scanner.cancel_scan(999)
        metrics = scanner.scan_folder(999, str(root))

        assert metrics.state == ScanState.CANCELLED
        # No deleted files reconciled on cancelled scan
        assert metrics.reconciled_deleted_files == 0


def test_file_lifecycle_deletion_synchronization():
    with tempfile.TemporaryDirectory() as tmp_dir:
        idx_dir = Path(tmp_dir) / "idx"
        v_manager = VectorIndexManager(dim=384, index_path=str(idx_dir))
        lifecycle = FileLifecycleService()

        # Add a vector for file_id=501
        vec = np.zeros(384, dtype=np.float32)
        vec[0] = 1.0
        v_manager.add_item(501, vec)

        active, deleted = v_manager.get_counts()
        assert active == 1
        assert deleted == 0

        # Mark deleted via vector manager
        v_manager.mark_deleted(501)
        active, deleted = v_manager.get_counts()
        assert active == 0
        assert deleted == 1

        # Query should return nothing
        q = np.zeros(384, dtype=np.float32)
        q[0] = 1.0
        ids, _ = v_manager.knn_query(q, k=5)
        assert 501 not in ids


def test_worker_operational_states():
    worker = IndexingWorker(concurrency=1)

    # Initial state
    assert not worker.is_paused()
    assert not worker.is_indexing()
    assert worker.get_status_label() == "idle"

    # Pause worker
    worker.pause()
    assert worker.is_paused()
    assert worker.get_status_label() == "paused"

    # Resume worker
    worker.resume()
    assert not worker.is_paused()
    assert worker.get_status_label() == "idle"


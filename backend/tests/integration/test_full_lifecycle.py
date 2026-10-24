import time
import tempfile
import shutil
from pathlib import Path
import pytest

from app.core.metadata_store import metadata_store
from app.core.scanner import folder_scanner
from app.core.worker import indexing_worker
from app.core.vector_index import vector_index_manager
from app.services.search_service import search_service
from app.services.index_service import index_service
from app.models.schemas import SearchRequest
from app.db.connection import check_database_health


@pytest.fixture(autouse=True)
def check_db():
    if not check_database_health():
        pytest.skip("MySQL database not accessible")


def test_complete_end_to_end_lifecycle():
    # Pause the background worker so this test can deterministically step through
    indexing_worker.pause()

    temp_dir = tempfile.mkdtemp(prefix="file_archaeologist_test_")
    test_folder = Path(temp_dir)

    try:
        # 1. Create sample documents
        file1 = test_folder / "invoice_march_2025.txt"
        file1.write_text(
            "Acme Corp Invoice number 90210. Total due: $4,500.00 for consulting services rendered in March 2025.",
            encoding="utf-8"
        )

        file2 = test_folder / "project_notes.md"
        file2.write_text(
            "# Architecture Notes\n\nWe decided to adopt a local-first search strategy using cosine similarity.",
            encoding="utf-8"
        )

        # 2. Register the folder in metadata store directly (avoiding background scanner race)
        from app.core.scanner import compute_path_hash
        p_hash = compute_path_hash(str(test_folder))
        folder_rec = metadata_store.add_folder(str(test_folder), p_hash)
        folder_id = folder_rec["id"]
        assert folder_id > 0

        # 3. Run scanner
        count = folder_scanner.scan_folder(folder_id, str(test_folder))
        assert count == 2

        # 4. Fetch and process pending files
        pending = metadata_store.fetch_pending_files(limit=10)
        assert len(pending) >= 2

        for item in pending:
            indexing_worker._process_single_file(item)

        # 5. Confirm metadata in MySQL is 'done' and has vector_id
        db_files = metadata_store.get_files_for_folder(folder_id)
        done_files = [f for f in db_files if not f.get("is_deleted")]
        assert len(done_files) >= 2
        for f in done_files:
            assert f["id"] is not None

        # 6. Verify vectors are in vector index
        active_vecs, _ = vector_index_manager.get_counts()
        assert active_vecs >= 2

        # 7. Perform semantic search for "consulting invoice March"
        req = SearchRequest(query="consulting invoice March", top_k=5)
        res = search_service.search(req)

        assert res.total > 0
        filenames = [r.filename for r in res.results]
        assert "invoice_march_2025.txt" in filenames
        top_match = next(r for r in res.results if r.filename == "invoice_march_2025.txt")
        assert top_match.score > 0.0

        # 8. Test file type filter
        req_pdf = SearchRequest(query="consulting invoice", top_k=5, file_types=["pdf"])
        res_pdf = search_service.search(req_pdf)
        assert not any(r.filename.endswith(".txt") for r in res_pdf.results)

        # 9. Modify file and reconcile
        file1.write_text(
            "Acme Corp UPDATED Invoice number 90210. Revised amount: $6,000.00 for April 2025.",
            encoding="utf-8"
        )
        folder_scanner.scan_folder(folder_id, str(test_folder))

        pending_after_edit = metadata_store.fetch_pending_files(limit=10)
        for item in pending_after_edit:
            indexing_worker._process_single_file(item)

        # 10. Delete file on disk and reconcile
        file1.unlink()
        folder_scanner.scan_folder(folder_id, str(test_folder))

        # Stale results are purged / soft deleted
        updated_db_files = metadata_store.get_files_for_folder(folder_id)
        deleted_records = [f for f in updated_db_files if f.get("is_deleted")]
        assert len(deleted_records) > 0

        # Search should not return deleted file
        req_after_del = SearchRequest(query="consulting invoice March", top_k=5)
        res_after_del = search_service.search(req_after_del)
        assert not any(r.filename == "invoice_march_2025.txt" for r in res_after_del.results)

        # 11. Cleanup folder
        index_service.remove_folder(folder_id)

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
        indexing_worker.resume()

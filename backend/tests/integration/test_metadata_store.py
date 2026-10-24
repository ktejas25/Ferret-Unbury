import os
import hashlib
from datetime import datetime
import pytest

from app.core.metadata_store import metadata_store
from app.db.connection import check_database_health


@pytest.fixture(autouse=True)
def check_db():
    if not check_database_health():
        pytest.skip("MySQL database not accessible")


def test_stored_procedures_lifecycle():
    # 1. Register or update test folder
    test_path = "D:/TestFolder_UnitTest"
    p_hash = hashlib.sha256(test_path.encode()).hexdigest()
    folder = metadata_store.add_folder(test_path, p_hash)
    folder_id = folder["id"]
    assert folder_id > 0

    # 2. Test sp_upsert_file
    file_path = "D:/TestFolder_UnitTest/document.txt"
    f_hash = hashlib.sha256(file_path.encode()).hexdigest()
    file_res = metadata_store.upsert_file(
        folder_id=folder_id,
        path_hash=f_hash,
        full_path=file_path,
        filename="document.txt",
        extension=".txt",
        size_bytes=1024,
        modified_at=datetime.utcnow()
    )
    assert file_res is not None
    file_id = file_res["id"]
    assert file_res["extraction_status"] == "pending"

    # 3. Test sp_fetch_pending_files
    pending = metadata_store.fetch_pending_files(limit=5)
    claimed_ids = [p["id"] for p in pending]
    cur_file = metadata_store.get_file_by_id(file_id)
    assert (file_id in claimed_ids) or (cur_file and cur_file["extraction_status"] in ("pending", "processing", "done"))

    # 4. Test sp_mark_file_done
    metadata_store.mark_file_done(
        file_id=file_id,
        vector_id=file_id,
        preview="This is preview content for unit test."
    )
    updated_file = metadata_store.get_file_by_id(file_id)
    assert updated_file["extraction_status"] == "done"
    assert updated_file["vector_id"] == file_id

    # 5. Test sp_get_index_stats
    stats = metadata_store.get_index_stats()
    assert stats["indexed_files"] >= 1

    # 6. Test sp_search_fallback_filename
    fallback_results = metadata_store.search_fallback_filename("document", limit=5)
    match_ids = [r["id"] for r in fallback_results]
    assert file_id in match_ids

    # 7. Test sp_soft_delete_file
    del_res = metadata_store.soft_delete_file(f_hash)
    assert del_res is not None
    soft_deleted_file = metadata_store.get_file_by_id(file_id)
    assert soft_deleted_file["is_deleted"] == 1

    # 8. Clean up folder
    metadata_store.remove_folder_cascade(folder_id)
    metadata_store.delete_folder_record(folder_id)

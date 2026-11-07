import os
import gc
import tempfile
import pytest
from unittest.mock import patch, MagicMock
from backend.app.core.sync_service import SyncService, compute_file_sha256
from backend.app.models.sync import SyncStatus


@pytest.fixture
def temp_sync_env():
    tmpdir = tempfile.mkdtemp()
    db_path = os.path.join(tmpdir, "test_sync.db")
    service = SyncService(db_path=db_path)
    try:
        yield service, tmpdir
    finally:
        del service
        gc.collect()
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_sync_initial_state(temp_sync_env):
    service, _ = temp_sync_env
    settings = service.get_settings()
    assert settings.is_connected is False
    assert settings.is_paused is False
    assert settings.sync_folders == []
    assert ".tmp" in settings.excluded_extensions

    stats = service.get_stats()
    assert stats.is_connected is False
    assert stats.synced_count == 0


def test_sync_settings_update(temp_sync_env):
    service, _ = temp_sync_env
    updated = service.update_settings(
        excluded_extensions=[".bak", ".xyz"],
        max_file_size_bytes=1048576,
        retry_limit=5
    )
    assert ".xyz" in updated.excluded_extensions
    assert updated.max_file_size_bytes == 1048576
    assert updated.retry_limit == 5


def test_sync_connect_and_disconnect(temp_sync_env):
    service, _ = temp_sync_env

    # Test rejection of bad URL
    ok, err = service.connect_cloud("ftp://not-http")
    assert ok is False

    # Test successful connect with mocked /api/health
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"ok": True, "service": "file-archaeologist-edge"}

    with patch("httpx.Client.get", return_value=mock_resp):
        ok, msg = service.connect_cloud("https://archaeologist.edge.workers.dev", api_key="secret123", workspace_id="ws_1")
        assert ok is True
        assert "Connected successfully" in msg

    settings = service.get_settings()
    assert settings.is_connected is True
    assert settings.cloud_url == "https://archaeologist.edge.workers.dev"
    assert settings.api_key == "secret123"

    # Test disconnect
    service.disconnect_cloud()
    assert service.get_settings().is_connected is False


def test_sync_folder_selection_security(temp_sync_env):
    service, tmpdir = temp_sync_env

    # 1. Test rejecting dangerous root path
    if os.name == "nt":
        ok, err = service.add_sync_folder("C:\\")
    else:
        ok, err = service.add_sync_folder("/")
    assert ok is False
    assert "access denied" in err.lower() or "system-critical" in err.lower() or "root" in err.lower()

    # 2. Test adding valid safe temp folder
    subfolder = os.path.join(tmpdir, "docs")
    os.makedirs(subfolder, exist_ok=True)

    ok, msg = service.add_sync_folder(subfolder)
    assert ok is True
    assert subfolder in service.get_settings().sync_folders

    # 3. Test removing sync folder
    ok, msg = service.remove_sync_folder(subfolder)
    assert ok is True
    assert subfolder not in service.get_settings().sync_folders
    # Ensure local directory was NOT touched or deleted
    assert os.path.exists(subfolder)


def test_sync_cycle_and_cloud_removal(temp_sync_env):
    service, tmpdir = temp_sync_env

    # Create test folder and document
    sync_dir = os.path.join(tmpdir, "my_work")
    os.makedirs(sync_dir, exist_ok=True)
    test_file = os.path.join(sync_dir, "report.txt")
    with open(test_file, "w", encoding="utf-8") as f:
        f.write("Important quarterly document content")

    # Connect mock cloud
    mock_health = MagicMock(status_code=200)
    mock_health.json.return_value = {"ok": True}
    with patch("httpx.Client.get", return_value=mock_health):
        service.connect_cloud("https://archaeologist.edge.workers.dev", api_key="k1", workspace_id="default")

    service.add_sync_folder(sync_dir)

    # Mock cloud upload endpoint /api/upload
    mock_upload = MagicMock(status_code=200)
    mock_upload.json.return_value = {"file_id": "cloud_doc_999", "status": "uploaded"}

    with patch("httpx.Client.post", return_value=mock_upload):
        res = service.run_sync_cycle()
        assert res["status"] == "completed"
        assert res["synced"] == 1

    # Verify item status is SYNCED
    items = service.get_items()
    assert len(items) == 1
    assert items[0]["status"] == SyncStatus.SYNCED.value
    assert items[0]["cloud_file_id"] == "cloud_doc_999"

    # Verify audit history logged
    history = service.get_history()
    assert len(history) >= 2
    assert any(h["status"] == "synced" for h in history)

    # Test removing cloud copy
    mock_del = MagicMock(status_code=200)
    with patch("httpx.Client.delete", return_value=mock_del):
        ok, msg = service.remove_cloud_copy(test_file)
        assert ok is True

    # Crucial safety check: local file must still exist untouched
    assert os.path.exists(test_file)
    with open(test_file, "r", encoding="utf-8") as f:
        assert f.read() == "Important quarterly document content"


def test_sync_pause_resume(temp_sync_env):
    service, _ = temp_sync_env

    mock_health = MagicMock(status_code=200)
    mock_health.json.return_value = {"ok": True}
    with patch("httpx.Client.get", return_value=mock_health):
        service.connect_cloud("https://archaeologist.edge.workers.dev", api_key="k1", workspace_id="default")

    service.pause_sync()
    assert service.get_settings().is_paused is True

    # Cycle while paused should immediately return paused
    res = service.run_sync_cycle()
    assert res["status"] == "paused"

    service.resume_sync()
    assert service.get_settings().is_paused is False


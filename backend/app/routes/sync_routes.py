import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from backend.app.core.security import verify_api_authorization
from backend.app.core.sync_service import sync_service
from backend.app.models.sync import (
    SyncConnectRequest,
    SyncFolderRequest,
    SyncSettingsUpdate,
    SyncSettings,
    SyncStats,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.get("/status", response_model=SyncStats)
def get_sync_status():
    """Get current synchronization statistics, connection state, and paused state."""
    return sync_service.get_stats()


@router.get("/settings", response_model=SyncSettings)
def get_sync_settings():
    """Get current synchronization configuration."""
    return sync_service.get_settings()


@router.post("/settings", response_model=SyncSettings)
def update_sync_settings(
    settings_update: SyncSettingsUpdate,
    _: bool = Depends(verify_api_authorization),
):
    """Update synchronization rules (excluded folders, extensions, max file size, retry limit)."""
    return sync_service.update_settings(
        excluded_folders=settings_update.excluded_folders,
        excluded_extensions=settings_update.excluded_extensions,
        max_file_size_bytes=settings_update.max_file_size_bytes,
        retry_limit=settings_update.retry_limit,
    )


@router.post("/connect")
def connect_cloud(
    req: SyncConnectRequest,
    _: bool = Depends(verify_api_authorization),
):
    """Authenticate and connect desktop application to a Cloudflare Worker workspace."""
    success, message = sync_service.connect_cloud(
        cloud_url=req.cloud_url,
        api_key=req.api_key,
        workspace_id=req.workspace_id,
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"ok": True, "message": message}


@router.post("/disconnect")
def disconnect_cloud(_: bool = Depends(verify_api_authorization)):
    """Disconnect cloud synchronization without modifying or deleting local documents."""
    sync_service.disconnect_cloud()
    return {"ok": True, "message": "Cloud synchronization disconnected"}


@router.post("/pause")
def pause_sync(_: bool = Depends(verify_api_authorization)):
    """Pause ongoing and scheduled synchronization."""
    sync_service.pause_sync()
    return {"ok": True, "message": "Synchronization paused"}


@router.post("/resume")
def resume_sync(_: bool = Depends(verify_api_authorization)):
    """Resume synchronization."""
    sync_service.resume_sync()
    return {"ok": True, "message": "Synchronization resumed"}


@router.post("/trigger")
def trigger_sync(background_tasks: BackgroundTasks, _: bool = Depends(verify_api_authorization)):
    """Trigger an incremental synchronization cycle in the background."""
    cfg = sync_service.get_settings()
    if not cfg.is_connected:
        raise HTTPException(status_code=400, detail="Cannot trigger sync: Cloud account is not connected")
    if cfg.is_paused:
        raise HTTPException(status_code=400, detail="Cannot trigger sync: Synchronization is currently paused")

    background_tasks.add_task(sync_service.run_sync_cycle)
    return {"ok": True, "message": "Synchronization cycle triggered"}


@router.post("/folders")
def add_sync_folder(
    req: SyncFolderRequest,
    _: bool = Depends(verify_api_authorization),
):
    """Add a local directory to the cloud synchronization list."""
    success, message = sync_service.add_sync_folder(req.folder_path)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"ok": True, "message": message}


@router.delete("/folders")
def remove_sync_folder(
    folder_path: str = Query(..., description="Absolute path of the folder to remove from sync"),
    _: bool = Depends(verify_api_authorization),
):
    """Remove a folder from synchronization. Original local files and cloud files are kept safe."""
    success, message = sync_service.remove_sync_folder(folder_path)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"ok": True, "message": message}


@router.post("/retry")
def retry_failed_sync(_: bool = Depends(verify_api_authorization)):
    """Reset all failed and conflicted items to pending status for retry."""
    count = sync_service.retry_failed()
    return {"ok": True, "reset_count": count, "message": f"Reset {count} items for retry"}


@router.delete("/cloud-copy")
def remove_cloud_copy(
    local_path: str = Query(..., description="Local path whose cloud copy should be deleted"),
    _: bool = Depends(verify_api_authorization),
):
    """Explicitly delete the synchronized cloud copy of a document. Local original remains untouched."""
    success, message = sync_service.remove_cloud_copy(local_path)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"ok": True, "message": message}


@router.get("/items")
def get_sync_items(
    limit: int = Query(default=100, ge=1, le=500),
    status: Optional[str] = Query(default=None),
):
    """List tracked synchronization items."""
    return sync_service.get_items(limit=limit, status=status)


@router.get("/history")
def get_sync_history(limit: int = Query(default=50, ge=1, le=200)):
    """Get audit trail of synchronization events."""
    return sync_service.get_history(limit=limit)


from typing import List
from fastapi import APIRouter, HTTPException, Path
from app.models.schemas import (
    IndexStatusResponse, FolderItem, AddFolderRequest,
    RebuildIndexRequest, GenericSuccessResponse
)
from app.services.index_service import index_service

router = APIRouter(prefix="/api/index", tags=["Index Management"])


@router.get("/status", response_model=IndexStatusResponse)
def get_index_status():
    """Returns database and vector index statistics, queue counts, and worker status."""
    return index_service.get_status()


@router.get("/folders", response_model=List[FolderItem])
def list_folders():
    """Lists all monitored folders with scan status, file counts, and timestamps."""
    return index_service.list_folders()


@router.post("/folders", response_model=FolderItem)
def add_folder(req: AddFolderRequest):
    """Registers a new folder for monitoring, validates path, and initiates initial scan."""
    success, msg, item = index_service.add_folder(req.path)
    if not success:
        if "already monitored" in msg:
            raise HTTPException(status_code=409, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
    return item


@router.delete("/folders/{folder_id}", response_model=GenericSuccessResponse)
def remove_folder(folder_id: int = Path(..., ge=1)):
    """Removes a folder from monitoring and safely cleans up associated vectors."""
    success, msg = index_service.remove_folder(folder_id)
    if not success:
        raise HTTPException(status_code=404, detail=msg)
    return GenericSuccessResponse(success=True, message=msg)


@router.post("/rebuild", response_model=GenericSuccessResponse)
def rebuild_index(req: RebuildIndexRequest):
    """Resets the vector index and database state to trigger a full re-indexing of all monitored files."""
    if not req.confirm:
        raise HTTPException(status_code=400, detail="Rebuild must be explicitly confirmed")
    success, msg = index_service.rebuild_index()
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return GenericSuccessResponse(success=True, message=msg)


@router.post("/pause", response_model=GenericSuccessResponse)
def pause_worker():
    """Pauses background indexing workers without stopping search or API services."""
    success, msg = index_service.pause_worker()
    return GenericSuccessResponse(success=success, message=msg)


@router.post("/resume", response_model=GenericSuccessResponse)
def resume_worker():
    """Resumes paused background indexing workers."""
    success, msg = index_service.resume_worker()
    return GenericSuccessResponse(success=success, message=msg)

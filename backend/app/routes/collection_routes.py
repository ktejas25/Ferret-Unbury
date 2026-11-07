from typing import List
from fastapi import APIRouter, HTTPException, Path, Depends
from app.models.schemas import (
    CollectionItem, CreateCollectionRequest, UpdateCollectionRequest,
    CollectionFileActionRequest, TagItem, CreateTagRequest, GenericSuccessResponse
)
from app.services.document_service import document_service
from app.core.security import verify_api_authorization

router = APIRouter(prefix="/api", tags=["Collections and Tags"])


# ---------------- Tags Endpoints ----------------
@router.get("/tags", response_model=List[TagItem])
def list_tags():
    """Returns all custom tags."""
    return document_service.list_tags()


@router.post("/tags", response_model=TagItem, dependencies=[Depends(verify_api_authorization)])
def create_tag(req: CreateTagRequest):
    """Creates a new custom tag."""
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Tag name cannot be empty")
    return document_service.create_tag(req.name, req.color)


@router.delete("/tags/{tag_id}", response_model=GenericSuccessResponse, dependencies=[Depends(verify_api_authorization)])
def delete_tag(tag_id: int = Path(..., ge=1)):
    """Deletes a custom tag."""
    success = document_service.delete_tag(tag_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Tag {tag_id} not found")
    return GenericSuccessResponse(success=True, message="Tag deleted successfully")


# ---------------- Collections Endpoints ----------------
@router.get("/collections", response_model=List[CollectionItem])
def list_collections():
    """Lists all manual and smart collections with item counts."""
    return document_service.list_collections()


@router.post("/collections", response_model=CollectionItem, dependencies=[Depends(verify_api_authorization)])
def create_collection(req: CreateCollectionRequest):
    """Creates a new manual or smart collection."""
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Collection name cannot be empty")
    return document_service.create_collection(
        name=req.name,
        description=req.description,
        is_smart=req.is_smart,
        rules_json=req.rules_json,
        color=req.color
    )


@router.put("/collections/{collection_id}", response_model=CollectionItem, dependencies=[Depends(verify_api_authorization)])
def update_collection(collection_id: int = Path(..., ge=1), req: UpdateCollectionRequest = None):
    """Updates an existing collection."""
    if not req:
        raise HTTPException(status_code=400, detail="Update payload required")
    updated = document_service.update_collection(
        collection_id=collection_id,
        name=req.name,
        description=req.description,
        is_smart=req.is_smart,
        rules_json=req.rules_json,
        color=req.color
    )
    if not updated:
        raise HTTPException(status_code=404, detail=f"Collection {collection_id} not found")
    return updated


@router.delete("/collections/{collection_id}", response_model=GenericSuccessResponse, dependencies=[Depends(verify_api_authorization)])
def delete_collection(collection_id: int = Path(..., ge=1)):
    """Deletes a collection. Associated files remain untouched."""
    success = document_service.delete_collection(collection_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Collection {collection_id} not found")
    return GenericSuccessResponse(success=True, message="Collection deleted successfully")


@router.post("/collections/{collection_id}/add", response_model=GenericSuccessResponse, dependencies=[Depends(verify_api_authorization)])
def add_files_to_collection(collection_id: int = Path(..., ge=1), req: CollectionFileActionRequest = None):
    """Adds files to a collection."""
    if not req or not req.file_ids:
        raise HTTPException(status_code=400, detail="file_ids list cannot be empty")
    count = document_service.add_files_to_collection(collection_id, req.file_ids)
    return GenericSuccessResponse(success=True, message=f"Added {count} file(s) to collection")


@router.post("/collections/{collection_id}/remove", response_model=GenericSuccessResponse, dependencies=[Depends(verify_api_authorization)])
def remove_files_from_collection(collection_id: int = Path(..., ge=1), req: CollectionFileActionRequest = None):
    """Removes files from a collection."""
    if not req or not req.file_ids:
        raise HTTPException(status_code=400, detail="file_ids list cannot be empty")
    count = document_service.remove_files_from_collection(collection_id, req.file_ids)
    return GenericSuccessResponse(success=True, message=f"Removed {count} file(s) from collection")


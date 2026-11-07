from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Path, Depends
from app.models.schemas import (
    DocumentListResponse, DocumentDetailResponse, DocumentPreviewResponse,
    ToggleFavoriteRequest, ClassifyDocumentRequest, AssignTagsRequest,
    GenericSuccessResponse
)
from app.services.document_service import document_service
from app.core.security import verify_api_authorization

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.get("", response_model=DocumentListResponse)
def list_documents(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100),
    sort_by: str = Query(default="modified_at"),
    sort_order: str = Query(default="desc"),
    category: Optional[str] = Query(default=None),
    extension: Optional[str] = Query(default=None),
    folder_id: Optional[int] = Query(default=None),
    is_favorite: Optional[bool] = Query(default=None),
    status: Optional[str] = Query(default=None),
    tag_id: Optional[int] = Query(default=None),
    collection_id: Optional[int] = Query(default=None),
    search: Optional[str] = Query(default=None),
):
    """Lists indexed files with multi-facet filtering, sorting, and pagination."""
    items, total = document_service.list_documents(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        category=category,
        extension=extension,
        folder_id=folder_id,
        is_favorite=is_favorite,
        status=status,
        tag_id=tag_id,
        collection_id=collection_id,
        search=search,
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return DocumentListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{file_id}", response_model=DocumentDetailResponse)
def get_document_details(file_id: int = Path(..., ge=1)):
    """Retrieves full metadata, tags, collections, extractions, and entities for a file."""
    details = document_service.get_document_details(file_id)
    if not details:
        raise HTTPException(status_code=404, detail=f"Document {file_id} not found")
    return DocumentDetailResponse(
        document=details["document"],
        extractions=details["extractions"],
        entities=details["entities"],
        related_documents=[]
    )


@router.get("/{file_id}/preview", response_model=DocumentPreviewResponse)
def get_document_preview(file_id: int = Path(..., ge=1)):
    """Extracts preview text, pseudo-pages, summary, and key points for a document."""
    try:
        preview = document_service.get_document_preview(file_id)
        if not preview:
            raise HTTPException(status_code=404, detail=f"Document {file_id} not found")
        return DocumentPreviewResponse(**preview)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview error: {e}")


@router.post("/{file_id}/favorite", response_model=GenericSuccessResponse)
def toggle_favorite(file_id: int = Path(..., ge=1), req: ToggleFavoriteRequest = None):
    """Stars or unstars a document as a favorite."""
    is_fav = req.is_favorite if req else True
    success = document_service.toggle_favorite(file_id, is_fav)
    if not success:
        raise HTTPException(status_code=404, detail=f"Document {file_id} not found")
    return GenericSuccessResponse(success=True, message=f"Favorite updated to {is_fav}")


@router.post("/{file_id}/classify", response_model=GenericSuccessResponse, dependencies=[Depends(verify_api_authorization)])
def classify_document(file_id: int = Path(..., ge=1), req: ClassifyDocumentRequest = None):
    """Manually overrides or updates the category classification of a document."""
    if not req or not req.category:
        raise HTTPException(status_code=400, detail="Category is required")
    try:
        document_service.classify_document(file_id, req.category)
        return GenericSuccessResponse(success=True, message=f"Document classified as {req.category}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{file_id}/tags", response_model=GenericSuccessResponse, dependencies=[Depends(verify_api_authorization)])
def assign_tags(file_id: int = Path(..., ge=1), req: AssignTagsRequest = None):
    """Assigns custom tags to a document."""
    tag_ids = req.tag_ids if req else []
    document_service.assign_tags(file_id, tag_ids)
    return GenericSuccessResponse(success=True, message="Tags updated successfully")


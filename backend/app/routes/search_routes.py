from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import SearchRequest, SearchResponse, OpenFileRequest, SearchSuggestionResponse, GenericSuccessResponse
from app.services.search_service import search_service

router = APIRouter(prefix="/api/search", tags=["Search"])


@router.post("", response_model=SearchResponse)
def perform_search(request: SearchRequest):
    """
    Searches indexed files using natural-language semantic query,
    falling back to filename and metadata matching if semantic results are empty.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    return search_service.search(request)


@router.post("/open", response_model=GenericSuccessResponse)
def open_file(request: OpenFileRequest):
    """
    Safely opens a selected file or its containing folder with the OS default application
    after verifying that the path resides within an actively monitored root.
    """
    success, msg = search_service.open_file(
        file_id=request.file_id,
        path=request.path,
        open_folder=request.open_containing_folder
    )
    if not success:
        if "Access denied" in msg:
            raise HTTPException(status_code=403, detail=msg)
        raise HTTPException(status_code=404, detail=msg)
    return GenericSuccessResponse(success=True, message=msg)


@router.get("/suggest", response_model=SearchSuggestionResponse)
def get_suggestions(q: str = Query(..., min_length=1, max_length=100)):
    """Returns autocomplete suggestions from recent queries and indexed filenames."""
    suggestions = search_service.get_suggestions(q)
    return SearchSuggestionResponse(query=q, suggestions=suggestions)

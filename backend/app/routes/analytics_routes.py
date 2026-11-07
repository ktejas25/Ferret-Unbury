from typing import List
from fastapi import APIRouter, HTTPException, Path, Depends
from app.models.schemas import (
    DashboardOverviewResponse, AdvancedSearchRequest, SearchResponse,
    SavedSearchItem, CreateSavedSearchRequest, GenericSuccessResponse
)
from app.services.analytics_service import analytics_service
from app.services.search_service import search_service
from app.core.security import verify_api_authorization

router = APIRouter(prefix="/api", tags=["Analytics and Advanced Search"])


# ---------------- Dashboard & Diagnostics ----------------
@router.get("/analytics/dashboard", response_model=DashboardOverviewResponse)
def get_dashboard_overview():
    """Provides real-time document counts, storage analytics, category distribution, and recent activity."""
    return analytics_service.get_comprehensive_analytics()["metrics"]


@router.get("/analytics/telemetry")
def get_comprehensive_telemetry():
    """Returns in-depth health telemetry and diagnostic metrics for all platform components."""
    return analytics_service.get_comprehensive_analytics()


# ---------------- Advanced Search ----------------
@router.post("/search/advanced", response_model=SearchResponse)
def perform_advanced_search(req: AdvancedSearchRequest):
    """Executes multi-mode search (semantic, keyword, exact, natural-language, similar) with deep multi-facet filters."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    return search_service.advanced_search(
        query=req.query,
        search_mode=req.search_mode,
        top_k=req.top_k,
        file_types=req.file_types,
        categories=req.categories,
        folder_id=req.folder_id,
        date_from=req.date_from,
        date_to=req.date_to,
        min_size_bytes=req.min_size_bytes,
        max_size_bytes=req.max_size_bytes,
        min_score=req.min_score,
        similar_file_id=req.similar_file_id
    )


# ---------------- Saved Searches ----------------
@router.get("/search/saved", response_model=List[SavedSearchItem])
def list_saved_searches():
    """Lists saved search queries and filter presets."""
    return search_service.list_saved_searches()


@router.post("/search/saved", response_model=SavedSearchItem, dependencies=[Depends(verify_api_authorization)])
def create_saved_search(req: CreateSavedSearchRequest):
    """Saves a search query and filter preset for quick re-use."""
    if not req.name.strip() or not req.query_text.strip():
        raise HTTPException(status_code=400, detail="Search preset name and query are required")
    return search_service.create_saved_search(req.name, req.query_text, req.filters_json)


@router.delete("/search/saved/{search_id}", response_model=GenericSuccessResponse, dependencies=[Depends(verify_api_authorization)])
def delete_saved_search(search_id: int = Path(..., ge=1)):
    """Deletes a saved search preset."""
    success = search_service.delete_saved_search(search_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Saved search {search_id} not found")
    return GenericSuccessResponse(success=True, message="Saved search deleted successfully")


from fastapi import APIRouter, Query
from app.models.schemas import HistoryResponse, GenericSuccessResponse
from app.services.history_service import history_service

router = APIRouter(prefix="/api/history", tags=["Search History"])


@router.get("", response_model=HistoryResponse)
def get_history(limit: int = Query(default=50, ge=1, le=500)):
    """Returns recent user queries with result counts and timestamps."""
    return history_service.get_history(limit=limit)


@router.delete("", response_model=GenericSuccessResponse)
def clear_history():
    """Clears all local search history entries."""
    history_service.clear_history()
    return GenericSuccessResponse(success=True, message="Search history cleared successfully")


@router.get("/failed", response_model=HistoryResponse)
def get_zero_result_queries(limit: int = Query(default=50, ge=1, le=500)):
    """
    Returns queries that yielded zero results as an insight for discoverability,
    distinct from technical system failures.
    """
    return history_service.get_zero_result_queries(limit=limit)

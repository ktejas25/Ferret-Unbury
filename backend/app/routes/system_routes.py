from fastapi import APIRouter, Depends
from app.models.schemas import HealthStatus, SettingsResponse, UpdateSettingsRequest
from app.db.connection import check_database_health
from app.core.embedder import embedder
from app.core.vector_index import vector_index_manager
from app.core.worker import indexing_worker
from app.core.watcher import watcher_manager
from app.core.security import verify_api_authorization
from app.services.settings_service import settings_service

router = APIRouter(prefix="/api", tags=["System"])


@router.get("/health", response_model=HealthStatus)
def get_system_health():
    """
    Returns operational health status for every core dependency:
    API, database, embedding model, vector index, worker, and filesystem watcher.
    """
    db_ok = check_database_health()
    model_ok = embedder.is_ready()
    active_vecs, _ = vector_index_manager.get_counts()

    overall = "healthy" if db_ok and model_ok else "degraded"

    diag = embedder.get_diagnostics()
    return HealthStatus(
        status=overall,
        database="connected" if db_ok else "unreachable",
        model=f"ready ({embedder.get_model_name()})" if model_ok else "unavailable",
        vector_index=f"ready ({active_vecs} active vectors)",
        worker=indexing_worker.get_status_label(),
        watcher="active" if watcher_manager.is_running() else "inactive",
        details={
            "needs_rebuild": vector_index_manager.needs_rebuild(),
            "current_task": indexing_worker.get_current_task(),
            "embedder": diag
        }
    )


@router.get("/settings", response_model=SettingsResponse)
def get_settings():
    """Returns non-secret persistent application settings."""
    return SettingsResponse(settings=settings_service.get_settings())


@router.put("/settings", response_model=SettingsResponse, dependencies=[Depends(verify_api_authorization)])
def update_settings(req: UpdateSettingsRequest):
    """Updates and persists configurable application settings."""
    updated = settings_service.update_settings(req.settings)
    return SettingsResponse(settings=updated)

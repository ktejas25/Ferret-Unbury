import logging
from typing import Dict, Any
from app.core.metadata_store import metadata_store
from app.core.vector_index import vector_index_manager
from app.core.embedder import embedder
from app.core.worker import indexing_worker
from app.core.watcher import watcher_manager
from app.db.connection import check_database_health
from app.core.sync_service import sync_service

logger = logging.getLogger("file_archaeologist.analytics")


class AnalyticsService:
    def get_comprehensive_analytics(self) -> Dict[str, Any]:
        """Provides in-depth health telemetry and diagnostic metrics for the platform."""
        metrics = metadata_store.get_dashboard_metrics()
        idx_status = metadata_store.get_index_stats()
        db_healthy = check_database_health()
        model_ready = embedder.is_ready()
        active_vecs, deleted_vecs = vector_index_manager.get_counts()
        sync_stats = sync_service.get_stats()

        # Popular queries
        history = metadata_store.get_recent_history(limit=100)
        query_counts: Dict[str, int] = {}
        for h in history:
            q = h.get("query_text", "").strip().lower()
            if q:
                query_counts[q] = query_counts.get(q, 0) + 1

        popular = sorted(
            [{"query": q, "count": cnt} for q, cnt in query_counts.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:8]

        # Zero-result queries
        zero_res = metadata_store.get_zero_result_queries(limit=10)

        # Diagnostics block
        diagnostics = {
            "database": {
                "status": "connected" if db_healthy else "unreachable",
                "pool_size": 25,
                "multi_statement_support": True
            },
            "vector_index": {
                "active_vectors": active_vecs,
                "deleted_vectors": deleted_vecs,
                "needs_rebuild": vector_index_manager.needs_rebuild(),
                "file_path": str(vector_index_manager.index_dir),
                "is_locked": False
            },
            "embedder": embedder.get_diagnostics(),
            "worker": {
                "status": indexing_worker.get_status_label(),
                "current_task": indexing_worker.get_current_task(),
                "concurrency": 1
            },
            "watcher": {
                "status": "active" if watcher_manager.is_running() else "inactive",
                "monitored_paths": metadata_store.get_active_folder_paths()
            },
            "synchronization": {
                "is_connected": sync_stats.is_connected,
                "is_paused": sync_stats.is_paused,
                "synced_count": sync_stats.synced_count,
                "pending_count": sync_stats.pending_count,
                "failed_count": sync_stats.failed_count
            }
        }

        return {
            "metrics": metrics,
            "index_status": idx_status,
            "popular_searches": popular,
            "zero_result_queries": zero_res,
            "diagnostics": diagnostics
        }


analytics_service = AnalyticsService()

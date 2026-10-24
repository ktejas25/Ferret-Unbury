import logging
from typing import List, Dict, Any
from app.core.metadata_store import metadata_store
from app.models.schemas import HistoryItem, HistoryResponse

logger = logging.getLogger("file_archaeologist.history_service")


class HistoryService:
    """Manages local search history retrieval, bounded retention, and zero-result insights."""

    def get_history(self, limit: int = 50) -> HistoryResponse:
        records = metadata_store.get_recent_history(limit=limit)
        items = [
            HistoryItem(
                id=r["id"],
                query_text=r["query_text"],
                result_count=r["result_count"],
                searched_at=r["searched_at"]
            )
            for r in records
        ]
        return HistoryResponse(items=items, total=len(items))

    def get_zero_result_queries(self, limit: int = 50) -> HistoryResponse:
        records = metadata_store.get_zero_result_queries(limit=limit)
        items = [
            HistoryItem(
                id=r["id"],
                query_text=r["query_text"],
                result_count=0,
                searched_at=r["searched_at"]
            )
            for r in records
        ]
        return HistoryResponse(items=items, total=len(items))

    def clear_history(self) -> None:
        metadata_store.clear_search_history()


history_service = HistoryService()

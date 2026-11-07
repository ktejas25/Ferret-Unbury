from app.routes.search_routes import router as search_router
from app.routes.index_routes import router as index_router
from app.routes.history_routes import router as history_router
from app.routes.system_routes import router as system_router
from app.routes.sync_routes import router as sync_router
from app.routes.document_routes import router as document_router
from app.routes.collection_routes import router as collection_router
from app.routes.assistant_routes import router as assistant_router
from app.routes.discovery_routes import router as discovery_router
from app.routes.analytics_routes import router as analytics_router

__all__ = [
    "search_router",
    "index_router",
    "history_router",
    "system_router",
    "sync_router",
    "document_router",
    "collection_router",
    "assistant_router",
    "discovery_router",
    "analytics_router"
]

from app.routes.search_routes import router as search_router
from app.routes.index_routes import router as index_router
from app.routes.history_routes import router as history_router
from app.routes.system_routes import router as system_router

__all__ = ["search_router", "index_router", "history_router", "system_router"]

import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.db.connection import init_database
from app.core.metadata_store import metadata_store
from app.core.vector_index import vector_index_manager
from app.core.watcher import watcher_manager
from app.core.worker import indexing_worker
from app.routes import search_router, index_router, history_router, system_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("file_archaeologist")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle startup and shutdown manager."""
    logger.info("Initializing File Archaeologist backend...")

    # 1. Ensure persistent directories exist
    settings.get_resolved_data_dir()

    # 2. Initialize database schema and stored procedures
    try:
        init_database()
    except Exception as e:
        logger.error(f"Database initialization warning: {e}")

    # 3. Schedule existing active folders into Watcher
    try:
        active_folders = [f for f in metadata_store.list_folders() if f.get("is_active")]
        watcher_manager.start()
        for f in active_folders:
            watcher_manager.add_folder(f["id"], f["path"])
        logger.info(f"Scheduled {len(active_folders)} active folders into Watcher.")
    except Exception as e:
        logger.warning(f"Could not initialize folder watchers: {e}")

    # 4. Start background indexing worker
    indexing_worker.start()

    logger.info(f"File Archaeologist backend ready on http://{settings.API_HOST}:{settings.API_PORT}")
    yield

    # Shutdown sequence
    logger.info("Shutting down File Archaeologist backend...")
    indexing_worker.stop()
    watcher_manager.stop()
    vector_index_manager.save_index()
    logger.info("Shutdown complete.")


app = FastAPI(
    title="File Archaeologist API",
    version="1.0.0",
    description="Local-first desktop application for semantic and filename discovery of personal files",
    lifespan=lifespan
)

# CORS configuration restricted to local origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8420",
        "http://127.0.0.1:8420",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(search_router)
app.include_router(index_router)
app.include_router(history_router)
app.include_router(system_router)

# Serve built frontend static assets if available
static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)

if (static_dir / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = static_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(static_dir / "index.html"))
else:
    @app.get("/")
    async def root_fallback():
        return {
            "application": "File Archaeologist API",
            "version": "1.0.0",
            "status": "online",
            "docs": "/docs",
            "health": "/api/health"
        }

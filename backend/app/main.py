import os
import sys
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
def get_static_dir() -> Path:
    candidates = []
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).parent
        meipass = Path(getattr(sys, "_MEIPASS", exe_dir))
        candidates.extend([
            meipass / "app" / "static",
            meipass / "static",
            exe_dir / "_internal" / "app" / "static",
            exe_dir / "app" / "static",
            exe_dir / "static",
        ])
    candidates.extend([
        Path(__file__).resolve().parent / "static",
        Path(__file__).resolve().parent.parent / "app" / "static",
        Path.cwd() / "app" / "static",
        Path.cwd() / "backend" / "app" / "static",
    ])
    for c in candidates:
        if (c / "index.html").exists():
            return c
    return Path(__file__).resolve().parent / "static"

static_dir = get_static_dir()
index_file = static_dir / "index.html"

if index_file.exists():
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/")
    async def serve_root():
        return FileResponse(str(index_file))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = static_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(index_file))
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
if __name__ == "__main__":
    import uvicorn
    import webbrowser
    import threading
    import time

    url = f"http://{settings.API_HOST}:{settings.API_PORT}/"
    print(f"Starting File Archaeologist on {url}...")

    def open_browser():
        time.sleep(1.2)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)

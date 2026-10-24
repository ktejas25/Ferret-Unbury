"""
File Archaeologist Desktop Application Runner.
Launches the FastAPI backend serving the React SPA and opens the desktop browser/window on port 8420.
"""

import os
import sys
import time
import webbrowser
import logging
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

import uvicorn
from app.config import settings
from app.db.connection import check_database_health

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("file_archaeologist.desktop")


def main():
    print("=" * 65)
    print("     FILE ARCHAEOLOGIST - DESKTOP APPLICATION RUNNER")
    print("=" * 65)

    # 1. Check database connectivity
    print(f"\n[1/3] Verifying MySQL connection on {settings.MYSQL_HOST}:{settings.MYSQL_PORT}...")
    if not check_database_health():
        print(f"[!] Warning: Could not connect to MySQL database '{settings.MYSQL_DATABASE}'.")
        print("    Please ensure MySQL Server 8.0 is running and credentials in backend/.env are correct.")
    else:
        print("    MySQL Database connection verified.")

    # 2. Check frontend build
    static_index = backend_dir / "app" / "static" / "index.html"
    print(f"\n[2/3] Checking frontend assets in {static_index.parent}...")
    if not static_index.exists():
        print("    Frontend assets not yet built. Please run 'npm run build' inside frontend/")
    else:
        print("    Frontend SPA bundle loaded.")

    # 3. Launch desktop URL
    url = f"http://{settings.API_HOST}:{settings.API_PORT}/"
    print(f"\n[3/3] Starting File Archaeologist on {url}")
    print("    Press Ctrl+C in this terminal to shut down cleanly.\n")

    def open_browser():
        time.sleep(1.5)
        webbrowser.open(url)

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    # 4. Start Uvicorn server on canonical port 8420
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        log_level="info",
        reload=False
    )


if __name__ == "__main__":
    main()

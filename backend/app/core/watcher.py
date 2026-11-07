import os
import time
import logging
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Set
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent

from app.core.scanner import compute_path_hash, EXCLUDED_DIRS
from app.core.metadata_store import metadata_store
from app.core.file_lifecycle import file_lifecycle
from app.config import settings

logger = logging.getLogger("file_archaeologist.watcher")


class FileChangeHandler(FileSystemEventHandler):
    """
    Debounced watchdog handler capturing filesystem events.
    Translates filesystem changes into idempotent MySQL metadata updates.
    """

    def __init__(self, folder_id: int, folder_path: str):
        super().__init__()
        self.folder_id = folder_id
        self.folder_path = folder_path
        self._debounce_lock = threading.Lock()
        self._last_events: Dict[str, float] = {}
        self.debounce_window = 1.0  # seconds

    def _is_ignored(self, path: str) -> bool:
        p = Path(path)
        # Check directories in path
        for part in p.parts:
            if part.lower() in EXCLUDED_DIRS or (part.startswith(".") and part != "."):
                return True
        ext = p.suffix.lower()
        if ext in settings.ignored_extension_set:
            return True
        if p.name.startswith("~$") or p.name.startswith("."):
            return True
        return False

    def _should_debounce(self, path: str) -> bool:
        now = time.time()
        with self._debounce_lock:
            last = self._last_events.get(path, 0)
            if now - last < self.debounce_window:
                return True
            self._last_events[path] = now
            return False

    def on_created(self, event: FileSystemEvent) -> None:
        if event.is_directory or self._is_ignored(event.src_path):
            return
        if self._should_debounce(event.src_path):
            return
        file_lifecycle.handle_file_created_or_modified(self.folder_id, event.src_path)

    def on_modified(self, event: FileSystemEvent) -> None:
        if event.is_directory or self._is_ignored(event.src_path):
            return
        if self._should_debounce(event.src_path):
            return
        file_lifecycle.handle_file_created_or_modified(self.folder_id, event.src_path)

    def on_deleted(self, event: FileSystemEvent) -> None:
        if event.is_directory or self._is_ignored(event.src_path):
            return
        logger.info(f"File deleted event: {event.src_path}")
        file_lifecycle.handle_file_deleted(event.src_path)

    def on_moved(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        file_lifecycle.handle_file_moved(event.src_path, event.dest_path, self.folder_id)


class WatcherManager:
    """Manages active filesystem observers for all monitored folders."""

    def __init__(self):
        self._observer: Optional[Observer] = None
        self._watches: Dict[int, Any] = {}
        self._lock = threading.Lock()

    def start(self) -> None:
        with self._lock:
            if self._observer is None:
                self._observer = Observer()
                self._observer.daemon = True
                self._observer.start()
                logger.info("Watchdog observer service started.")

    def stop(self) -> None:
        with self._lock:
            if self._observer is not None:
                self._observer.stop()
                self._observer.join(timeout=3)
                self._observer = None
                self._watches.clear()
                logger.info("Watchdog observer service stopped.")

    def add_folder(self, folder_id: int, folder_path: str) -> None:
        with self._lock:
            if self._observer is None:
                self.start()

            if folder_id in self._watches:
                return

            if not os.path.exists(folder_path):
                return

            handler = FileChangeHandler(folder_id, folder_path)
            try:
                watch = self._observer.schedule(handler, folder_path, recursive=True)
                self._watches[folder_id] = watch
                logger.info(f"Started monitoring folder ID {folder_id}: {folder_path}")
            except Exception as e:
                logger.error(f"Failed to schedule watch on '{folder_path}': {e}")

    def remove_folder(self, folder_id: int) -> None:
        with self._lock:
            if folder_id in self._watches and self._observer is not None:
                watch = self._watches.pop(folder_id)
                try:
                    self._observer.unschedule(watch)
                    logger.info(f"Unscheduled watch for folder ID {folder_id}")
                except Exception as e:
                    logger.warning(f"Error unscheduling watch: {e}")

    def is_running(self) -> bool:
        return self._observer is not None and self._observer.is_alive()


watcher_manager = WatcherManager()

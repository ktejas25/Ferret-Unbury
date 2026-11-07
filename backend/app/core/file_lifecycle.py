import os
import hashlib
import logging
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

from app.core.metadata_store import metadata_store
from app.core.vector_index import vector_index_manager
from app.config import settings

logger = logging.getLogger("file_archaeologist.file_lifecycle")


def compute_path_hash(path: str) -> str:
    """Computes SHA-256 of normalized absolute path."""
    normalized = os.path.normcase(os.path.abspath(path))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class FileLifecycleService:
    """
    Centralized file lifecycle coordinator.
    Ensures complete synchronization across:
    - MySQL metadata (files, indexed_folders)
    - Vector index (adding, updating, deactivating vectors)
    - Search visibility and cache invalidation
    """

    def __init__(self):
        self._lock = threading.RLock()

    def handle_file_created_or_modified(
        self,
        folder_id: int,
        file_path: str
    ) -> Optional[Dict[str, Any]]:
        """
        Coordinates creation or modification:
        - Validates file stat and compute hash
        - Upserts into MySQL as pending
        - If previously indexed vector existed and content changed, keeps status pending for re-indexing
        """
        with self._lock:
            p = Path(file_path)
            if not p.exists() or not p.is_file():
                return None

            try:
                stat = p.stat()
                size_bytes = stat.st_size
                modified_at = datetime.fromtimestamp(stat.st_mtime)
                path_hash = compute_path_hash(file_path)
                ext = p.suffix.lower()

                # Idempotent upsert in MySQL
                file_row = metadata_store.upsert_file(
                    folder_id=folder_id,
                    path_hash=path_hash,
                    full_path=str(p.resolve()),
                    filename=p.name,
                    extension=ext,
                    size_bytes=size_bytes,
                    modified_at=modified_at
                )
                logger.info(f"FileLifecycle: Upserted {p.name} (status={file_row.get('extraction_status') if file_row else 'unknown'})")
                return file_row
            except Exception as e:
                logger.error(f"FileLifecycle error upserting file {file_path}: {e}")
                return None

    def handle_file_deleted(self, file_path: str, path_hash: Optional[str] = None) -> bool:
        """
        Coordinates safe file deletion:
        1. Soft-deletes file in MySQL (setting is_deleted = 1)
        2. Retrieves associated vector_id
        3. Deactivates vector in VectorIndexManager (CRITICAL: prevents ghost results)
        """
        with self._lock:
            p_hash = path_hash or compute_path_hash(file_path)
            logger.info(f"FileLifecycle: Soft-deleting file {file_path} (hash={p_hash[:12]})")

            try:
                # 1. Soft delete in DB
                deleted_info = metadata_store.soft_delete_file(p_hash)
                if not deleted_info:
                    db_file = metadata_store.get_file_by_path_hash(p_hash)
                    if db_file:
                        deleted_info = {"file_id": db_file["id"], "vector_id": db_file.get("vector_id")}

                if deleted_info:
                    vid = deleted_info.get("vector_id")
                    # 2. Deactivate in Vector Index
                    if vid is not None:
                        vector_index_manager.mark_deleted(int(vid))
                        logger.info(f"FileLifecycle: Deactivated vector ID {vid} for deleted file {file_path}")

                return True
            except Exception as e:
                logger.error(f"FileLifecycle: Error handling file deletion for {file_path}: {e}")
                return False

    def handle_file_moved(
        self,
        src_path: str,
        dest_path: str,
        folder_id: int
    ) -> bool:
        """
        Coordinates file movement / rename:
        1. Deletes previous file identity and vector
        2. Upserts new file identity as pending
        """
        with self._lock:
            logger.info(f"FileLifecycle: Moving {src_path} -> {dest_path}")
            self.handle_file_deleted(src_path)
            dest_row = self.handle_file_created_or_modified(folder_id, dest_path)
            return dest_row is not None


file_lifecycle = FileLifecycleService()


import os
import logging
import threading
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

from app.core.metadata_store import metadata_store
from app.core.scanner import folder_scanner, compute_path_hash
from app.core.watcher import watcher_manager
from app.core.worker import indexing_worker
from app.core.vector_index import vector_index_manager
from app.models.schemas import FolderItem, IndexStatusResponse

logger = logging.getLogger("file_archaeologist.index_service")


class IndexService:
    """
    Manages monitored folders, manual and periodic scans, pause/resume,
    index statistics aggregation, and rebuild recovery workflows.
    """

    def add_folder(self, raw_path: str) -> Tuple[bool, str, Optional[FolderItem]]:
        path_obj = Path(raw_path).resolve()
        if not path_obj.exists():
            return False, f"Folder path '{raw_path}' does not exist on disk", None
        if not path_obj.is_dir():
            return False, f"Path '{raw_path}' is not a directory", None

        normalized_path = str(path_obj)
        path_hash = compute_path_hash(normalized_path)

        # Check existing folder
        existing = metadata_store.get_folder_by_path_hash(path_hash)
        if existing and existing.get("is_active"):
            return False, f"Folder '{normalized_path}' is already monitored", None

        # Add or reactivate in database
        folder_record = metadata_store.add_folder(normalized_path, path_hash)
        folder_id = folder_record["id"]

        # Schedule watchdog monitoring
        watcher_manager.add_folder(folder_id, normalized_path)

        # Launch initial asynchronous scan
        scan_thread = threading.Thread(
            target=folder_scanner.scan_folder,
            args=(folder_id, normalized_path),
            name=f"ScanThread-Folder-{folder_id}",
            daemon=True
        )
        scan_thread.start()

        folder_item = FolderItem(
            id=folder_id,
            path=folder_record["path"],
            path_hash=folder_record["path_hash"],
            is_active=bool(folder_record["is_active"]),
            scan_status=folder_record["scan_status"],
            file_count=folder_record.get("file_count", 0),
            created_at=folder_record["created_at"],
            last_scanned_at=folder_record.get("last_scanned_at"),
            last_scan_error=folder_record.get("last_scan_error")
        )
        return True, "Folder added and scan initiated successfully", folder_item

    def remove_folder(self, folder_id: int) -> Tuple[bool, str]:
        folder = metadata_store.get_folder_by_id(folder_id)
        if not folder:
            return False, f"Folder with ID {folder_id} does not exist"

        # 1. Unschedule watcher
        watcher_manager.remove_folder(folder_id)

        # 2. Coordinate removal and cascade in MySQL
        affected_files = metadata_store.remove_folder_cascade(folder_id)

        # 3. Mark vectors deleted in vector index
        for f in affected_files:
            vid = f.get("vector_id")
            if vid is not None:
                vector_index_manager.mark_deleted(vid)
                # Purge file metadata row once vector cleanup is confirmed
                metadata_store.purge_deleted_file(f["file_id"])

        # 4. Save vector index
        vector_index_manager.save_index()

        # 5. Permanently remove folder record
        metadata_store.delete_folder_record(folder_id)

        metadata_store.log_operation("folder_remove", folder_id, "completed", {"folder_id": folder_id})
        logger.info(f"Folder {folder_id} and associated metadata removed successfully.")
        return True, "Folder removed and vector index cleaned up safely"

    def list_folders(self) -> List[FolderItem]:
        records = metadata_store.list_folders()
        result = []
        for r in records:
            result.append(
                FolderItem(
                    id=r["id"],
                    path=r["path"],
                    path_hash=r["path_hash"],
                    is_active=bool(r["is_active"]),
                    scan_status=r["scan_status"],
                    file_count=r.get("file_count", 0),
                    created_at=r["created_at"],
                    last_scanned_at=r.get("last_scanned_at"),
                    last_scan_error=r.get("last_scan_error")
                )
            )
        return result

    def get_status(self) -> IndexStatusResponse:
        db_stats = metadata_store.get_index_stats()
        active_vecs, del_vecs = vector_index_manager.get_counts()
        idx_size = vector_index_manager.get_index_size_bytes()

        return IndexStatusResponse(
            total_files=db_stats.get("total_files", 0),
            active_files=db_stats.get("active_files", 0),
            indexed_files=db_stats.get("indexed_files", 0),
            pending_files=db_stats.get("pending_files", 0),
            processing_files=db_stats.get("processing_files", 0),
            failed_files=db_stats.get("failed_files", 0),
            skipped_files=db_stats.get("skipped_files", 0),
            files_with_vectors=db_stats.get("files_with_vectors", 0),
            soft_deleted_files=db_stats.get("soft_deleted_files", 0),
            vector_count=active_vecs,
            deleted_vector_count=del_vecs,
            index_size_bytes=idx_size,
            is_indexing=indexing_worker.is_indexing(),
            current_task=indexing_worker.get_current_task(),
            last_scan_error=None,
            last_scanned_at=None
        )

    def rebuild_index(self) -> Tuple[bool, str]:
        """Performs controlled full index rebuild."""
        logger.info("Initiating full index rebuild...")
        try:
            # 1. Pause worker
            indexing_worker.pause()

            # 2. Reset database records to pending
            metadata_store.reset_all_for_rebuild()

            # 3. Clear vector index
            vector_index_manager.clear()

            # 4. Trigger rescan on all active monitored folders
            active_folders = [f for f in metadata_store.list_folders() if f.get("is_active")]
            for f in active_folders:
                folder_scanner.scan_folder(f["id"], f["path"])

            # 5. Resume worker
            indexing_worker.resume()

            metadata_store.log_operation("index_rebuild", None, "completed", {})
            return True, "Index reset and rebuild started successfully"
        except Exception as e:
            logger.error(f"Error during index rebuild: {e}")
            indexing_worker.resume()
            metadata_store.log_operation("index_rebuild", None, "failed", {"error": str(e)})
            return False, f"Rebuild failed: {e}"

    def pause_worker(self) -> Tuple[bool, str]:
        indexing_worker.pause()
        return True, "Worker paused"

    def resume_worker(self) -> Tuple[bool, str]:
        indexing_worker.resume()
        return True, "Worker resumed"


index_service = IndexService()

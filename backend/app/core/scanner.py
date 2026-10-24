import os
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import Set, List, Dict, Any, Optional

from app.core.metadata_store import metadata_store
from app.config import settings

logger = logging.getLogger("file_archaeologist.scanner")

EXCLUDED_DIRS = {
    ".git", ".svn", ".hg", "node_modules", "__pycache__", ".vscode",
    ".idea", "venv", ".env", "env", "bin", "obj", "$recycle.bin",
    "system volume information", ".tmp"
}


def compute_path_hash(path: str) -> str:
    """Computes SHA-256 of normalized absolute path."""
    normalized = os.path.normcase(os.path.abspath(path))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class FolderScanner:
    """
    Performs recursive directory discovery and periodic reconciliation.
    Identifies new, modified, and deleted files, updating database state idempotently.
    """

    def scan_folder(self, folder_id: int, folder_path: str) -> int:
        """
        Recursively scans the folder, upserting files into MySQL as 'pending'.
        Performs reconciliation against existing database records for this folder.
        """
        root = Path(folder_path)
        if not root.exists() or not root.is_dir():
            metadata_store.update_folder_scan_status(folder_id, "failed", "Directory does not exist or is not accessible")
            return 0

        metadata_store.update_folder_scan_status(folder_id, "running")
        metadata_store.log_operation("folder_scan", folder_id, "started", {"path": folder_path})

        discovered_hashes: Set[str] = set()
        count = 0

        try:
            for dirpath, dirnames, filenames in os.walk(folder_path):
                # Filter out excluded directories in-place
                dirnames[:] = [d for d in dirnames if d.lower() not in EXCLUDED_DIRS and not d.startswith(".")]

                for fname in filenames:
                    # Skip hidden or temporary files
                    if fname.startswith("~$") or fname.startswith("."):
                        continue

                    full_path = os.path.join(dirpath, fname)
                    ext = os.path.splitext(fname)[1].lower()
                    if ext in settings.ignored_extension_set:
                        continue

                    try:
                        stat = os.stat(full_path)
                        size_bytes = stat.st_size
                        modified_at = datetime.fromtimestamp(stat.st_mtime)
                        p_hash = compute_path_hash(full_path)
                        discovered_hashes.add(p_hash)

                        # Idempotently upsert file
                        metadata_store.upsert_file(
                            folder_id=folder_id,
                            path_hash=p_hash,
                            full_path=full_path,
                            filename=fname,
                            extension=ext,
                            size_bytes=size_bytes,
                            modified_at=modified_at
                        )
                        count += 1
                    except (PermissionError, FileNotFoundError, OSError) as e:
                        logger.warning(f"Could not stat file '{full_path}': {e}")
                        continue

            # Reconciliation: soft-delete files in DB that no longer exist on disk
            db_files = metadata_store.get_files_for_folder(folder_id)
            for db_f in db_files:
                if not db_f.get("is_deleted") and db_f.get("path_hash") not in discovered_hashes:
                    logger.info(f"Reconciling missing file: {db_f.get('full_path')}")
                    metadata_store.soft_delete_file(db_f["path_hash"])

            # Refresh folder count and mark completed
            metadata_store.refresh_folder_count(folder_id)
            metadata_store.update_folder_scan_status(folder_id, "completed")
            metadata_store.log_operation("folder_scan", folder_id, "completed", {"discovered_count": count})
            return count

        except Exception as e:
            logger.error(f"Error scanning folder '{folder_path}': {e}")
            metadata_store.update_folder_scan_status(folder_id, "failed", str(e)[:1024])
            metadata_store.log_operation("folder_scan", folder_id, "failed", {"error": str(e)})
            return count


folder_scanner = FolderScanner()

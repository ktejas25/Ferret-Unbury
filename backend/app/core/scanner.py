import os
import time
import hashlib
import logging
from enum import Enum
from datetime import datetime
from pathlib import Path
from typing import Set, List, Dict, Any, Optional
from dataclasses import dataclass, field

from app.core.metadata_store import metadata_store
from app.core.file_lifecycle import file_lifecycle, compute_path_hash
from app.config import settings

logger = logging.getLogger("file_archaeologist.scanner")

EXCLUDED_DIRS = {
    ".git", ".svn", ".hg", "node_modules", "__pycache__", ".vscode",
    ".idea", "venv", ".env", "env", "bin", "obj", "$recycle.bin",
    "system volume information", ".tmp",
    # Windows OS system roots and caches
    "windows", "program files", "program files (x86)", "programdata",
    "appdata", "recovery", "boot", "perflogs", "msocache", "config.msi",
    "$windows.~bt", "$windows.~ws"
}


class ScanState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ScanMetrics:
    folder_id: int
    folder_path: str
    state: ScanState = ScanState.PENDING
    discovered_files: int = 0
    successfully_scanned: int = 0
    failed_files: int = 0
    inaccessible_files: int = 0
    skipped_files: int = 0
    reconciled_deleted_files: int = 0
    start_time: float = field(default_factory=time.perf_counter)
    duration_sec: float = 0.0
    error_message: Optional[str] = None

    def __int__(self) -> int:
        return self.successfully_scanned

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, int):
            return self.successfully_scanned == other
        if isinstance(other, ScanMetrics):
            return self.folder_id == other.folder_id and self.state == other.state
        return False


# compute_path_hash is imported from app.core.file_lifecycle


class FolderScanner:
    """
    Performs recursive directory discovery and periodic reconciliation.
    Identifies new, modified, and deleted files, updating database state idempotently.
    Enforces strict safety: NEVER performs deletion reconciliation after a partial or failed scan.
    """

    def __init__(self):
        self._cancel_flags: Dict[int, bool] = {}

    def cancel_scan(self, folder_id: int) -> None:
        """Signals cancellation for a running folder scan."""
        self._cancel_flags[folder_id] = True

    def scan_folder(self, folder_id: int, folder_path: str) -> ScanMetrics:
        """
        Recursively scans the folder, upserting files into MySQL as 'pending'.
        Performs reconciliation against existing database records ONLY if scan is fully completed.
        """
        metrics = ScanMetrics(folder_id=folder_id, folder_path=folder_path)

        if self._cancel_flags.get(folder_id, False):
            metrics.state = ScanState.CANCELLED
            metrics.error_message = "Scan cancelled before start"
            return metrics

        self._cancel_flags[folder_id] = False

        root = Path(folder_path)
        if not root.exists() or not root.is_dir():
            metrics.state = ScanState.FAILED
            metrics.error_message = "Directory does not exist or is not accessible"
            try:
                metadata_store.update_folder_scan_status(folder_id, ScanState.FAILED.value, metrics.error_message)
            except Exception:
                pass
            return metrics

        metrics.state = ScanState.RUNNING
        metadata_store.update_folder_scan_status(folder_id, ScanState.RUNNING.value)
        metadata_store.log_operation("folder_scan", folder_id, "started", {"path": folder_path})

        discovered_hashes: Set[str] = set()
        had_inaccessible_subdirs = False

        try:
            for dirpath, dirnames, filenames in os.walk(folder_path, onerror=self._on_walk_error):
                if self._cancel_flags.get(folder_id, False):
                    metrics.state = ScanState.CANCELLED
                    metrics.error_message = "Scan cancelled by user"
                    break

                # Filter out excluded directories in-place
                clean_dirnames = []
                for d in dirnames:
                    d_lower = d.lower()
                    if d_lower in EXCLUDED_DIRS or d.startswith("."):
                        continue
                    clean_dirnames.append(d)
                dirnames[:] = clean_dirnames

                for fname in filenames:
                    if self._cancel_flags.get(folder_id, False):
                        metrics.state = ScanState.CANCELLED
                        metrics.error_message = "Scan cancelled by user"
                        break

                    metrics.discovered_files += 1

                    # Skip temporary office lock files or hidden files
                    if fname.startswith("~$") or fname.startswith("."):
                        metrics.skipped_files += 1
                        continue

                    full_path = os.path.join(dirpath, fname)
                    ext = os.path.splitext(fname)[1].lower()
                    if ext in settings.ignored_extension_set:
                        metrics.skipped_files += 1
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
                        metrics.successfully_scanned += 1
                    except PermissionError:
                        metrics.inaccessible_files += 1
                        had_inaccessible_subdirs = True
                        logger.warning(f"Permission denied accessing file: {full_path}")
                    except (FileNotFoundError, OSError) as e:
                        metrics.failed_files += 1
                        logger.warning(f"OS error reading file '{full_path}': {e}")

            metrics.duration_sec = round(time.perf_counter() - metrics.start_time, 2)

            # Determine final scan state
            if metrics.state == ScanState.CANCELLED:
                metadata_store.update_folder_scan_status(folder_id, ScanState.CANCELLED.value, metrics.error_message)
                logger.info(f"Scan cancelled for folder ID {folder_id} ({folder_path})")
                return metrics

            if had_inaccessible_subdirs:
                metrics.state = ScanState.PARTIAL
                logger.warning(f"Scan partial for folder ID {folder_id} due to inaccessible files or directories.")
            else:
                metrics.state = ScanState.COMPLETED

            # CRITICAL SAFETY RULE:
            # Never perform deletion reconciliation after a partial, cancelled, or failed scan!
            # Only a verified complete scan may determine that previously indexed files have disappeared.
            if metrics.state == ScanState.COMPLETED:
                db_files = metadata_store.get_files_for_folder(folder_id)
                for db_f in db_files:
                    if not db_f.get("is_deleted") and db_f.get("path_hash") not in discovered_hashes:
                        logger.info(f"Complete scan verified missing file: {db_f.get('full_path')}")
                        file_lifecycle.handle_file_deleted(db_f["full_path"], path_hash=db_f.get("path_hash"))
                        metrics.reconciled_deleted_files += 1
            else:
                logger.info(
                    f"Scan ended in state '{metrics.state.value}'. "
                    "Skipping deletion reconciliation to safeguard existing files."
                )

            # Refresh folder count and mark final status
            metadata_store.refresh_folder_count(folder_id)
            metadata_store.update_folder_scan_status(
                folder_id,
                metrics.state.value,
                metrics.error_message
            )
            metadata_store.log_operation(
                "folder_scan",
                folder_id,
                metrics.state.value,
                {
                    "discovered": metrics.discovered_files,
                    "scanned": metrics.successfully_scanned,
                    "inaccessible": metrics.inaccessible_files,
                    "failed": metrics.failed_files,
                    "skipped": metrics.skipped_files,
                    "reconciled_deleted": metrics.reconciled_deleted_files,
                    "duration_sec": metrics.duration_sec
                }
            )
            return metrics

        except Exception as e:
            metrics.duration_sec = round(time.perf_counter() - metrics.start_time, 2)
            metrics.state = ScanState.FAILED
            metrics.error_message = str(e)[:1024]
            logger.error(f"Error scanning folder '{folder_path}': {e}")
            metadata_store.update_folder_scan_status(folder_id, ScanState.FAILED.value, metrics.error_message)
            metadata_store.log_operation("folder_scan", folder_id, "failed", {"error": str(e)})
            return metrics

    def _on_walk_error(self, err: OSError) -> None:
        logger.warning(f"Filesystem walk error on path '{err.filename}': {err}")


folder_scanner = FolderScanner()

import os
import hashlib
import json
import sqlite3
import threading
import logging
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import httpx

from backend.app.config import settings
from backend.app.core.security import validate_safe_folder_path, validate_path_within_roots
from backend.app.models.sync import (
    SyncStatus,
    SyncSettings,
    SyncItem,
    SyncHistoryEntry,
    SyncStats,
)

logger = logging.getLogger(__name__)


def compute_file_sha256(filepath: str, block_size: int = 65536) -> str:
    """Computes SHA-256 hash of a local file."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(block_size), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


class SyncService:
    """
    Desktop-to-Cloud Synchronization Subsystem.
    - Local-first & user-controlled: Disabled by default.
    - Non-destructive: Never modifies or deletes local files.
    - Folder-selective: Never syncs entire drive or root paths.
    - Isolated persistence: Uses a dedicated SQLite database in DATA_DIR.
    """

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            data_dir = getattr(settings, "DATA_DIR", "data")
            os.makedirs(data_dir, exist_ok=True)
            db_path = os.path.join(data_dir, "sync.db")

        self.db_path = db_path
        self._lock = threading.RLock()
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self):
        with self._lock, self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sync_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sync_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    local_path TEXT UNIQUE NOT NULL,
                    filename TEXT NOT NULL,
                    folder_path TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    cloud_file_id TEXT,
                    bytes_transferred INTEGER DEFAULT 0,
                    error_message TEXT,
                    retry_count INTEGER DEFAULT 0,
                    last_sync_attempt TEXT,
                    updated_at TEXT NOT NULL
                );
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_sync_items_status ON sync_items(status);
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_sync_items_folder ON sync_items(folder_path);
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sync_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_path TEXT NOT NULL,
                    cloud_file_id TEXT,
                    status TEXT NOT NULL,
                    bytes_transferred INTEGER DEFAULT 0,
                    error_message TEXT,
                    timestamp TEXT NOT NULL,
                    action_taken TEXT NOT NULL
                );
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_sync_history_time ON sync_history(timestamp);
                """
            )
            conn.commit()

    # ---------------------------------------------------------
    # Settings Management
    # ---------------------------------------------------------

    def get_settings(self) -> SyncSettings:
        with self._lock, self._get_connection() as conn:
            cursor = conn.execute("SELECT key, value FROM sync_settings")
            rows = dict(cursor.fetchall())

        try:
            sync_folders = json.loads(rows.get("sync_folders", "[]"))
        except Exception:
            sync_folders = []

        try:
            excluded_folders = json.loads(rows.get("excluded_folders", "[]"))
        except Exception:
            excluded_folders = []

        default_exts = [".tmp", ".log", ".bak", ".exe", ".dll", ".bin", ".iso", ".dmg", ".pyc"]
        raw_exts = rows.get("excluded_extensions")
        if raw_exts:
            try:
                excluded_extensions = json.loads(raw_exts)
            except Exception:
                excluded_extensions = default_exts
        else:
            excluded_extensions = default_exts

        return SyncSettings(
            cloud_url=rows.get("cloud_url", ""),
            api_key=rows.get("api_key", ""),
            workspace_id=rows.get("workspace_id", "default"),
            is_connected=rows.get("is_connected", "false").lower() == "true",
            is_paused=rows.get("is_paused", "false").lower() == "true",
            sync_folders=sync_folders,
            excluded_folders=excluded_folders,
            excluded_extensions=excluded_extensions,
            max_file_size_bytes=int(rows.get("max_file_size_bytes", str(settings.MAX_FILE_SIZE_BYTES))),
            retry_limit=int(rows.get("retry_limit", "3")),
        )

    def _save_setting(self, key: str, value: str):
        with self._lock, self._get_connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO sync_settings (key, value) VALUES (?, ?)",
                (key, value),
            )
            conn.commit()

    def update_settings(
        self,
        excluded_folders: Optional[List[str]] = None,
        excluded_extensions: Optional[List[str]] = None,
        max_file_size_bytes: Optional[int] = None,
        retry_limit: Optional[int] = None,
    ) -> SyncSettings:
        with self._lock:
            current = self.get_settings()
            if excluded_folders is not None:
                self._save_setting("excluded_folders", json.dumps(excluded_folders))
            if excluded_extensions is not None:
                self._save_setting("excluded_extensions", json.dumps([ext.lower() for ext in excluded_extensions]))
            if max_file_size_bytes is not None:
                self._save_setting("max_file_size_bytes", str(max(1024, max_file_size_bytes)))
            if retry_limit is not None:
                self._save_setting("retry_limit", str(max(1, retry_limit)))

            return self.get_settings()

    # ---------------------------------------------------------
    # Connection Management
    # ---------------------------------------------------------

    def connect_cloud(self, cloud_url: str, api_key: Optional[str] = None, workspace_id: Optional[str] = "default") -> Tuple[bool, str]:
        """Validates credentials against Cloudflare Worker and saves connection settings."""
        cloud_url = cloud_url.strip().rstrip("/")
        if not cloud_url.startswith(("http://", "https://")):
            return False, "Invalid cloud URL. Must begin with http:// or https://"

        workspace_id = (workspace_id or "default").strip()
        api_key = (api_key or "").strip()

        # Validate cloud connectivity by pinging /api/health
        headers = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
            headers["X-API-Key"] = api_key

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{cloud_url}/api/health", headers=headers)
                if resp.status_code >= 400:
                    return False, f"Cloud connection rejected with HTTP {resp.status_code}: {resp.text[:200]}"
                data = resp.json()
                if not data.get("ok"):
                    return False, f"Cloud service reported unhealthy: {data}"
        except Exception as e:
            logger.warning(f"Failed to connect to cloud endpoint {cloud_url}: {e}")
            return False, f"Unable to reach cloud endpoint: {str(e)}"

        with self._lock:
            self._save_setting("cloud_url", cloud_url)
            self._save_setting("api_key", api_key)
            self._save_setting("workspace_id", workspace_id)
            self._save_setting("is_connected", "true")

            self._record_history(
                source_path="[system]",
                cloud_file_id=None,
                status="connected",
                bytes_transferred=0,
                error_message=None,
                action_taken=f"Connected to Cloudflare Worker at {cloud_url} (workspace: {workspace_id})",
            )

        logger.info(f"Successfully connected to Cloudflare Worker at {cloud_url}")
        return True, "Connected successfully"

    def disconnect_cloud(self) -> bool:
        """Disconnects cloud synchronization cleanly. Does not delete any documents."""
        with self._lock:
            self._save_setting("is_connected", "false")
            self._record_history(
                source_path="[system]",
                cloud_file_id=None,
                status="disconnected",
                bytes_transferred=0,
                error_message=None,
                action_taken="Disconnected cloud synchronization",
            )
        logger.info("Cloud synchronization disconnected")
        return True

    def pause_sync(self) -> bool:
        with self._lock:
            self._save_setting("is_paused", "true")
            self._record_history(
                source_path="[system]",
                cloud_file_id=None,
                status="paused",
                bytes_transferred=0,
                error_message=None,
                action_taken="Paused synchronization",
            )
        return True

    def resume_sync(self) -> bool:
        with self._lock:
            self._save_setting("is_paused", "false")
            self._record_history(
                source_path="[system]",
                cloud_file_id=None,
                status="resumed",
                bytes_transferred=0,
                error_message=None,
                action_taken="Resumed synchronization",
            )
        return True

    # ---------------------------------------------------------
    # Folder Selection
    # ---------------------------------------------------------

    def add_sync_folder(self, folder_path: str) -> Tuple[bool, str]:
        """Adds a local folder to the sync list after strict security checks."""
        # 1. Path safety check (blocks root / or C:\ and system dirs)
        is_safe, reason, resolved_path = validate_safe_folder_path(folder_path)
        if not is_safe:
            return False, reason

        norm_path = str(resolved_path) if resolved_path else os.path.abspath(os.path.normpath(folder_path))
        if not os.path.exists(norm_path) or not os.path.isdir(norm_path):
            return False, f"Directory does not exist: {norm_path}"

        with self._lock:
            cfg = self.get_settings()
            if norm_path not in cfg.sync_folders:
                cfg.sync_folders.append(norm_path)
                self._save_setting("sync_folders", json.dumps(cfg.sync_folders))
                self._record_history(
                    source_path=norm_path,
                    cloud_file_id=None,
                    status="folder_added",
                    bytes_transferred=0,
                    error_message=None,
                    action_taken=f"Added folder to sync list: {norm_path}",
                )

        return True, "Folder added to synchronization list"

    def remove_sync_folder(self, folder_path: str) -> Tuple[bool, str]:
        """Removes a local folder from sync list without modifying files."""
        norm_path = os.path.abspath(os.path.normpath(folder_path))
        with self._lock:
            cfg = self.get_settings()
            if norm_path in cfg.sync_folders:
                cfg.sync_folders.remove(norm_path)
                self._save_setting("sync_folders", json.dumps(cfg.sync_folders))

                with self._get_connection() as conn:
                    conn.execute(
                        "UPDATE sync_items SET status = ? WHERE folder_path = ?",
                        (SyncStatus.NOT_SELECTED.value, norm_path),
                    )
                    conn.commit()

                self._record_history(
                    source_path=norm_path,
                    cloud_file_id=None,
                    status="folder_removed",
                    bytes_transferred=0,
                    error_message=None,
                    action_taken=f"Removed folder from sync list: {norm_path} (local files untouched)",
                )

        return True, "Folder removed from synchronization list"

    # ---------------------------------------------------------
    # Core Synchronization Engine
    # ---------------------------------------------------------

    def discover_eligible_files(self) -> List[Dict[str, Any]]:
        """Scans enabled sync folders and identifies files eligible for sync."""
        cfg = self.get_settings()
        if not cfg.sync_folders:
            return []

        eligible = []
        excluded_exts = set(ext.lower() for ext in cfg.excluded_extensions)
        excluded_dirs = set(os.path.abspath(os.path.normpath(p)) for p in cfg.excluded_folders)

        for root_folder in cfg.sync_folders:
            if not os.path.exists(root_folder) or not os.path.isdir(root_folder):
                continue

            for dirpath, dirnames, filenames in os.walk(root_folder):
                current_dir = os.path.abspath(dirpath)
                # Skip excluded folders
                if any(current_dir == ex or current_dir.startswith(ex + os.sep) for ex in excluded_dirs):
                    continue

                for fn in filenames:
                    ext = os.path.splitext(fn)[1].lower()
                    if ext in excluded_exts:
                        continue

                    fp = os.path.join(dirpath, fn)
                    try:
                        stat = os.stat(fp)
                        if stat.st_size > cfg.max_file_size_bytes or stat.st_size == 0:
                            continue

                        eligible.append({
                            "local_path": fp,
                            "filename": fn,
                            "folder_path": root_folder,
                            "size_bytes": stat.st_size,
                            "modified_at": datetime.fromtimestamp(stat.st_mtime),
                        })
                    except (OSError, PermissionError):
                        continue

        return eligible

    def run_sync_cycle(self) -> Dict[str, Any]:
        """
        Executes one full sync cycle:
        1. Discover eligible files.
        2. Hash files and detect changes.
        3. Upload pending/updated files to Cloudflare Worker.
        4. Record status, metrics, and history.
        """
        cfg = self.get_settings()
        if not cfg.is_connected:
            return {"status": "skipped", "reason": "Cloud not connected"}
        if cfg.is_paused:
            return {"status": "paused", "reason": "Sync is paused"}

        eligible_files = self.discover_eligible_files()
        uploaded_count = 0
        skipped_count = 0
        failed_count = 0
        conflict_count = 0
        total_bytes = 0

        now_iso = datetime.utcnow().isoformat()

        # Step 1: Ingest and update sync_items
        with self._lock, self._get_connection() as conn:
            for item in eligible_files:
                path = item["local_path"]
                try:
                    content_hash = compute_file_sha256(path)
                except Exception as e:
                    logger.warning(f"Could not hash {path}: {e}")
                    continue

                cur = conn.execute(
                    "SELECT content_hash, status, retry_count FROM sync_items WHERE local_path = ?",
                    (path,),
                )
                existing = cur.fetchone()

                if existing is None:
                    # New item to be synced
                    conn.execute(
                        """
                        INSERT INTO sync_items (
                            local_path, filename, folder_path, content_hash, size_bytes,
                            status, bytes_transferred, retry_count, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)
                        """,
                        (path, item["filename"], item["folder_path"], content_hash, item["size_bytes"],
                         SyncStatus.PENDING.value, now_iso),
                    )
                else:
                    if existing["content_hash"] != content_hash:
                        # File modified locally -> mark pending for re-upload
                        conn.execute(
                            """
                            UPDATE sync_items SET
                                content_hash = ?, size_bytes = ?, status = ?,
                                retry_count = 0, error_message = NULL, updated_at = ?
                            WHERE local_path = ?
                            """,
                            (content_hash, item["size_bytes"], SyncStatus.PENDING.value, now_iso, path),
                        )
                    # If same content_hash and already SYNCED, leave as is
            conn.commit()

        # Step 2: Process pending uploads
        with self._lock, self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT id, local_path, filename, folder_path, content_hash, size_bytes, retry_count
                FROM sync_items
                WHERE status = ? AND retry_count < ?
                LIMIT 50
                """,
                (SyncStatus.PENDING.value, cfg.retry_limit),
            )
            pending_items = cur.fetchall()

        if not pending_items:
            return {
                "status": "completed",
                "synced": 0,
                "skipped": len(eligible_files),
                "failed": 0,
                "bytes": 0,
            }

        headers = {}
        if cfg.api_key:
            headers["Authorization"] = f"Bearer {cfg.api_key}"
            headers["X-API-Key"] = cfg.api_key

        upload_url = f"{cfg.cloud_url}/api/upload"

        for row in pending_items:
            item_id = row["id"]
            local_path = row["local_path"]
            filename = row["filename"]
            content_hash = row["content_hash"]
            size_bytes = row["size_bytes"]
            retry_count = row["retry_count"]

            if not os.path.exists(local_path):
                continue

            # Update status to UPLOADING
            with self._lock, self._get_connection() as conn:
                conn.execute(
                    "UPDATE sync_items SET status = ?, updated_at = ? WHERE id = ?",
                    (SyncStatus.UPLOADING.value, datetime.utcnow().isoformat(), item_id),
                )
                conn.commit()

            try:
                with open(local_path, "rb") as f:
                    file_content = f.read()

                files = {"file": (filename, file_content)}
                data = {
                    "workspace_id": cfg.workspace_id,
                    "content_hash": content_hash,
                    "source_path": local_path,
                }

                with httpx.Client(timeout=60.0) as client:
                    resp = client.post(upload_url, headers=headers, files=files, data=data)

                if resp.status_code in (200, 201):
                    res_json = resp.json()
                    cloud_file_id = str(res_json.get("file_id") or res_json.get("id") or "")

                    with self._lock, self._get_connection() as conn:
                        conn.execute(
                            """
                            UPDATE sync_items SET
                                status = ?, cloud_file_id = ?, bytes_transferred = ?,
                                error_message = NULL, last_sync_attempt = ?, updated_at = ?
                            WHERE id = ?
                            """,
                            (SyncStatus.SYNCED.value, cloud_file_id, size_bytes,
                             datetime.utcnow().isoformat(), datetime.utcnow().isoformat(), item_id),
                        )
                        conn.commit()

                    self._record_history(
                        source_path=local_path,
                        cloud_file_id=cloud_file_id,
                        status="synced",
                        bytes_transferred=size_bytes,
                        error_message=None,
                        action_taken=f"Uploaded to Cloudflare (ID: {cloud_file_id})",
                    )
                    uploaded_count += 1
                    total_bytes += size_bytes

                elif resp.status_code == 409:
                    # Remote conflict detected
                    with self._lock, self._get_connection() as conn:
                        conn.execute(
                            """
                            UPDATE sync_items SET
                                status = ?, error_message = 'Conflict: Remote file exists with different content',
                                last_sync_attempt = ?, updated_at = ?
                            WHERE id = ?
                            """,
                            (SyncStatus.CONFLICT.value, datetime.utcnow().isoformat(), datetime.utcnow().isoformat(), item_id),
                        )
                        conn.commit()

                    self._record_history(
                        source_path=local_path,
                        cloud_file_id=None,
                        status="conflict",
                        bytes_transferred=0,
                        error_message="Remote conflict",
                        action_taken="Flagged conflict (local file kept untouched)",
                    )
                    conflict_count += 1

                else:
                    err_msg = f"Cloud upload failed with status {resp.status_code}: {resp.text[:150]}"
                    new_retry = retry_count + 1
                    new_status = SyncStatus.FAILED.value if new_retry >= cfg.retry_limit else SyncStatus.PENDING.value

                    with self._lock, self._get_connection() as conn:
                        conn.execute(
                            """
                            UPDATE sync_items SET
                                status = ?, retry_count = ?, error_message = ?,
                                last_sync_attempt = ?, updated_at = ?
                            WHERE id = ?
                            """,
                            (new_status, new_retry, err_msg, datetime.utcnow().isoformat(), datetime.utcnow().isoformat(), item_id),
                        )
                        conn.commit()

                    self._record_history(
                        source_path=local_path,
                        cloud_file_id=None,
                        status="failed" if new_status == SyncStatus.FAILED.value else "retry_pending",
                        bytes_transferred=0,
                        error_message=err_msg,
                        action_taken=f"Upload attempt {new_retry} failed",
                    )
                    failed_count += 1

            except Exception as e:
                err_msg = f"Network or upload error: {str(e)}"
                new_retry = retry_count + 1
                new_status = SyncStatus.FAILED.value if new_retry >= cfg.retry_limit else SyncStatus.PENDING.value

                with self._lock, self._get_connection() as conn:
                    conn.execute(
                        """
                        UPDATE sync_items SET
                            status = ?, retry_count = ?, error_message = ?,
                            last_sync_attempt = ?, updated_at = ?
                            WHERE id = ?
                        """,
                        (new_status, new_retry, err_msg, datetime.utcnow().isoformat(), datetime.utcnow().isoformat(), item_id),
                    )
                    conn.commit()

                self._record_history(
                    source_path=local_path,
                    cloud_file_id=None,
                    status="failed" if new_status == SyncStatus.FAILED.value else "retry_pending",
                    bytes_transferred=0,
                    error_message=err_msg,
                    action_taken=f"Upload error: {str(e)[:100]}",
                )
                failed_count += 1

        return {
            "status": "completed",
            "synced": uploaded_count,
            "failed": failed_count,
            "conflict": conflict_count,
            "bytes": total_bytes,
        }

    def retry_failed(self) -> int:
        """Resets failed and conflict items to PENDING with retry_count=0."""
        with self._lock, self._get_connection() as conn:
            cursor = conn.execute(
                """
                UPDATE sync_items SET
                    status = ?, retry_count = 0, error_message = NULL, updated_at = ?
                WHERE status IN (?, ?)
                """,
                (SyncStatus.PENDING.value, datetime.utcnow().isoformat(), SyncStatus.FAILED.value, SyncStatus.CONFLICT.value),
            )
            count = cursor.rowcount
            conn.commit()

            if count > 0:
                self._record_history(
                    source_path="[system]",
                    cloud_file_id=None,
                    status="retry_initiated",
                    bytes_transferred=0,
                    error_message=None,
                    action_taken=f"Reset {count} failed items for retry",
                )

        return count

    def remove_cloud_copy(self, local_path: str) -> Tuple[bool, str]:
        """
        Deletes the corresponding file from Cloudflare R2 / D1.
        Crucial: Local original file remains untouched!
        """
        cfg = self.get_settings()
        if not cfg.is_connected:
            return False, "Cloud not connected"

        with self._lock, self._get_connection() as conn:
            cur = conn.execute(
                "SELECT id, cloud_file_id FROM sync_items WHERE local_path = ?",
                (local_path,),
            )
            row = cur.fetchone()

        if not row or not row["cloud_file_id"]:
            return False, "File is not registered in cloud sync"

        cloud_id = row["cloud_file_id"]
        headers = {}
        if cfg.api_key:
            headers["Authorization"] = f"Bearer {cfg.api_key}"
            headers["X-API-Key"] = cfg.api_key

        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.delete(f"{cfg.cloud_url}/api/files/{cloud_id}", headers=headers)
                if resp.status_code not in (200, 204, 404):
                    return False, f"Cloud deletion failed with HTTP {resp.status_code}: {resp.text[:150]}"
        except Exception as e:
            return False, f"Cloud deletion request failed: {str(e)}"

        with self._lock, self._get_connection() as conn:
            conn.execute(
                """
                UPDATE sync_items SET
                    status = ?, cloud_file_id = NULL, bytes_transferred = 0, updated_at = ?
                WHERE id = ?
                """,
                (SyncStatus.NOT_SELECTED.value, datetime.utcnow().isoformat(), row["id"]),
            )
            conn.commit()

            self._record_history(
                source_path=local_path,
                cloud_file_id=cloud_id,
                status="cloud_copy_removed",
                bytes_transferred=0,
                error_message=None,
                action_taken="Removed cloud copy (local file kept untouched)",
            )

        return True, "Cloud copy removed successfully"

    # ---------------------------------------------------------
    # Diagnostics & History
    # ---------------------------------------------------------

    def get_stats(self) -> SyncStats:
        cfg = self.get_settings()
        with self._lock, self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'synced' THEN 1 ELSE 0 END) as synced,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'uploading' THEN 1 ELSE 0 END) as uploading,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status = 'conflict' THEN 1 ELSE 0 END) as conflict,
                    SUM(CASE WHEN status = 'synced' THEN bytes_transferred ELSE 0 END) as total_bytes
                FROM sync_items
                """
            )
            row = cur.fetchone()

        total = row["total"] or 0
        synced = row["synced"] or 0
        pending = row["pending"] or 0
        uploading = row["uploading"] or 0
        failed = row["failed"] or 0
        conflict = row["conflict"] or 0
        bytes_synced = row["total_bytes"] or 0

        return SyncStats(
            is_connected=cfg.is_connected,
            is_paused=cfg.is_paused,
            total_eligible=total,
            synced_count=synced,
            pending_count=pending,
            uploading_count=uploading,
            failed_count=failed,
            conflict_count=conflict,
            bytes_synced=bytes_synced,
            cloud_url=cfg.cloud_url if cfg.is_connected else None,
            workspace_id=cfg.workspace_id if cfg.is_connected else None,
        )

    def get_items(self, limit: int = 100, status: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._lock, self._get_connection() as conn:
            if status:
                cur = conn.execute(
                    """
                    SELECT id, local_path, filename, folder_path, content_hash, size_bytes,
                           status, cloud_file_id, bytes_transferred, error_message, retry_count,
                           last_sync_attempt, updated_at
                    FROM sync_items
                    WHERE status = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    (status, limit),
                )
            else:
                cur = conn.execute(
                    """
                    SELECT id, local_path, filename, folder_path, content_hash, size_bytes,
                           status, cloud_file_id, bytes_transferred, error_message, retry_count,
                           last_sync_attempt, updated_at
                    FROM sync_items
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                )
            rows = [dict(r) for r in cur.fetchall()]
        return rows

    def get_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock, self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT id, source_path, cloud_file_id, status, bytes_transferred,
                       error_message, timestamp, action_taken
                FROM sync_history
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = [dict(r) for r in cur.fetchall()]
        return rows

    def _record_history(
        self,
        source_path: str,
        cloud_file_id: Optional[str],
        status: str,
        bytes_transferred: int,
        error_message: Optional[str],
        action_taken: str,
    ):
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO sync_history (
                    source_path, cloud_file_id, status, bytes_transferred,
                    error_message, timestamp, action_taken
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    source_path,
                    cloud_file_id,
                    status,
                    bytes_transferred,
                    error_message,
                    datetime.utcnow().isoformat(),
                    action_taken,
                ),
            )
            conn.commit()


# Global Singleton Instance
sync_service = SyncService()


import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import pymysql

from app.db.connection import get_raw_connection
from app.config import settings

logger = logging.getLogger("file_archaeologist.metadata_store")


class MetadataStore:
    """
    Encapsulates all SQL and Stored Procedure interactions with MySQL 8.
    Ensures safe parameter binding and maintains consistency between
    files, folders, search history, settings, and vector state.
    """

    def __init__(self):
        pass

    def upsert_file(
        self,
        folder_id: int,
        path_hash: str,
        full_path: str,
        filename: str,
        extension: str,
        size_bytes: int,
        modified_at: datetime
    ) -> Optional[Dict[str, Any]]:
        """Invokes sp_upsert_file. Returns dict with {id, extraction_status, vector_id}."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc(
                    "sp_upsert_file",
                    (folder_id, path_hash, full_path, filename, extension, size_bytes, modified_at)
                )
                row = cur.fetchone()
                return row
        except Exception as e:
            logger.error(f"Error in upsert_file: {e}")
            raise
        finally:
            conn.close()

    def fetch_pending_files(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Atomically claims up to `limit` pending files and marks them processing."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc("sp_fetch_pending_files", (limit,))
                rows = cur.fetchall()
                return list(rows) if rows else []
        except Exception as e:
            logger.error(f"Error claiming pending files: {e}")
            return []
        finally:
            conn.close()

    def mark_file_done(self, file_id: int, vector_id: int, preview: Optional[str]) -> None:
        """Invokes sp_mark_file_done."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc("sp_mark_file_done", (file_id, vector_id, preview))
        except Exception as e:
            logger.error(f"Error in mark_file_done for file_id {file_id}: {e}")
            raise
        finally:
            conn.close()

    def mark_file_failed(
        self,
        file_id: int,
        error_type: str,
        error_message: str,
        max_retries: int = 3
    ) -> None:
        """Invokes sp_mark_file_failed."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc("sp_mark_file_failed", (file_id, error_type, error_message, max_retries))
        except Exception as e:
            logger.error(f"Error in mark_file_failed for file_id {file_id}: {e}")
            raise
        finally:
            conn.close()

    def mark_file_skipped(self, file_id: int, reason: str) -> None:
        """Marks a file as skipped (e.g. empty, unsupported, or low-information content)."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                sql = """
                UPDATE files
                SET extraction_status = 'skipped',
                    error_message = %s
                WHERE id = %s AND is_deleted = 0;
                """
                cur.execute(sql, (reason[:1024], file_id))
        except Exception as e:
            logger.error(f"Error in mark_file_skipped for file_id {file_id}: {e}")
        finally:
            conn.close()

    def soft_delete_file(self, path_hash: str) -> Optional[Dict[str, Any]]:
        """Invokes sp_soft_delete_file. Returns dict with {file_id, vector_id}."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc("sp_soft_delete_file", (path_hash,))
                row = cur.fetchone()
                return row
        except Exception as e:
            logger.error(f"Error in soft_delete_file for path_hash {path_hash}: {e}")
            return None
        finally:
            conn.close()

    def purge_deleted_file(self, file_id: int) -> None:
        """Invokes sp_purge_deleted_file after vector cleanup is verified."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc("sp_purge_deleted_file", (file_id,))
        except Exception as e:
            logger.error(f"Error in purge_deleted_file for file_id {file_id}: {e}")
        finally:
            conn.close()

    def get_files_by_vector_ids(self, vector_ids: List[int]) -> List[Dict[str, Any]]:
        """Invokes sp_get_files_by_vector_ids with JSON array."""
        if not vector_ids:
            return []
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc("sp_get_files_by_vector_ids", (json.dumps(vector_ids),))
                rows = cur.fetchall()
                return list(rows) if rows else []
        except Exception as e:
            logger.error(f"Error in get_files_by_vector_ids: {e}")
            return []
        finally:
            conn.close()

    def search_fallback_filename(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Invokes sp_search_fallback_filename with escaped query."""
        safe_query = query.replace("%", "\\%").replace("_", "\\_")
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc("sp_search_fallback_filename", (safe_query, limit))
                rows = cur.fetchall()
                return list(rows) if rows else []
        except Exception as e:
            logger.error(f"Error in search_fallback_filename: {e}")
            return []
        finally:
            conn.close()

    def get_index_stats(self) -> Dict[str, Any]:
        """Invokes sp_get_index_stats."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc("sp_get_index_stats")
                row = cur.fetchone()
                if row:
                    return {k: int(v) if v is not None else 0 for k, v in row.items()}
                return {}
        except Exception as e:
            logger.error(f"Error in get_index_stats: {e}")
            return {}
        finally:
            conn.close()

    def refresh_folder_count(self, folder_id: int) -> None:
        """Invokes sp_refresh_folder_count."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc("sp_refresh_folder_count", (folder_id,))
        except Exception as e:
            logger.error(f"Error refreshing folder count for {folder_id}: {e}")
        finally:
            conn.close()

    def remove_folder_cascade(self, folder_id: int) -> List[Dict[str, Any]]:
        """Invokes sp_remove_folder_cascade. Returns affected file records with vector_ids."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc("sp_remove_folder_cascade", (folder_id,))
                rows = cur.fetchall()
                return list(rows) if rows else []
        except Exception as e:
            logger.error(f"Error in remove_folder_cascade for folder {folder_id}: {e}")
            return []
        finally:
            conn.close()

    def delete_folder_record(self, folder_id: int) -> None:
        """Permanently deletes the folder record after vector cleanup is completed."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM indexed_folders WHERE id = %s", (folder_id,))
        except Exception as e:
            logger.error(f"Error deleting folder record {folder_id}: {e}")
        finally:
            conn.close()

    def log_operation(
        self,
        operation: str,
        folder_id: Optional[int],
        status: str,
        details: Optional[Dict[str, Any]] = None
    ) -> Optional[int]:
        """Invokes sp_log_operation."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                details_json = json.dumps(details) if details is not None else None
                cur.callproc("sp_log_operation", (operation, folder_id, status, details_json))
                row = cur.fetchone()
                return row.get("operation_id") if row else None
        except Exception as e:
            logger.error(f"Error in log_operation: {e}")
            return None
        finally:
            conn.close()

    def purge_old_history(self, keep: int = 500) -> int:
        """Invokes sp_purge_old_history."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc("sp_purge_old_history", (keep,))
                row = cur.fetchone()
                return row.get("deleted_rows", 0) if row else 0
        except Exception as e:
            logger.error(f"Error in purge_old_history: {e}")
            return 0
        finally:
            conn.close()

    def reset_all_for_rebuild(self) -> None:
        """Invokes sp_reset_all_for_rebuild."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.callproc("sp_reset_all_for_rebuild")
        except Exception as e:
            logger.error(f"Error in reset_all_for_rebuild: {e}")
            raise
        finally:
            conn.close()

    # ---------------- Additional Operations ----------------

    def add_folder(self, path: str, path_hash: str) -> Dict[str, Any]:
        """Registers a monitored folder or reactivates it."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                sql = """
                INSERT INTO indexed_folders (path, path_hash, is_active, scan_status)
                VALUES (%s, %s, 1, 'running')
                ON DUPLICATE KEY UPDATE
                    id = LAST_INSERT_ID(id),
                    is_active = 1,
                    scan_status = 'running',
                    last_scan_error = NULL;
                """
                cur.execute(sql, (path, path_hash))
                folder_id = cur.lastrowid
                cur.execute("SELECT * FROM indexed_folders WHERE id = %s", (folder_id,))
                return cur.fetchone()
        finally:
            conn.close()

    def list_folders(self) -> List[Dict[str, Any]]:
        """Returns all configured folders."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM indexed_folders ORDER BY created_at ASC")
                return list(cur.fetchall())
        finally:
            conn.close()

    def get_folder_by_id(self, folder_id: int) -> Optional[Dict[str, Any]]:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM indexed_folders WHERE id = %s", (folder_id,))
                return cur.fetchone()
        finally:
            conn.close()

    def get_folder_by_path_hash(self, path_hash: str) -> Optional[Dict[str, Any]]:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM indexed_folders WHERE path_hash = %s", (path_hash,))
                return cur.fetchone()
        finally:
            conn.close()

    def update_folder_scan_status(
        self,
        folder_id: int,
        scan_status: str,
        error_message: Optional[str] = None
    ) -> None:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                sql = """
                UPDATE indexed_folders
                SET scan_status = %s,
                    last_scanned_at = CURRENT_TIMESTAMP,
                    last_scan_error = %s
                WHERE id = %s;
                """
                cur.execute(sql, (scan_status, error_message, folder_id))
        finally:
            conn.close()

    def get_active_folder_paths(self) -> List[str]:
        """Returns list of normalized root paths for all active folders."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT path FROM indexed_folders WHERE is_active = 1")
                rows = cur.fetchall()
                return [r["path"] for r in rows]
        finally:
            conn.close()

    def get_file_by_id(self, file_id: int) -> Optional[Dict[str, Any]]:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM files WHERE id = %s", (file_id,))
                return cur.fetchone()
        finally:
            conn.close()

    def get_file_by_path_hash(self, path_hash: str) -> Optional[Dict[str, Any]]:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM files WHERE path_hash = %s", (path_hash,))
                return cur.fetchone()
        finally:
            conn.close()

    def get_files_for_folder(self, folder_id: int) -> List[Dict[str, Any]]:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id, path_hash, full_path, size_bytes, modified_at, is_deleted FROM files WHERE folder_id = %s", (folder_id,))
                return list(cur.fetchall())
        finally:
            conn.close()

    def recover_orphaned_processing_jobs(self) -> int:
        """Resets processing rows to pending on startup recovery."""
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                sql = """
                UPDATE files
                SET extraction_status = 'pending'
                WHERE extraction_status = 'processing'
                  AND is_deleted = 0;
                """
                cur.execute(sql)
                return cur.rowcount
        finally:
            conn.close()

    def record_search_history(self, query_text: str, result_count: int) -> None:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO search_history (query_text, result_count, searched_at) VALUES (%s, %s, CURRENT_TIMESTAMP)",
                    (query_text[:1024], result_count)
                )
        finally:
            conn.close()

    def get_recent_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, query_text, result_count, searched_at FROM search_history ORDER BY searched_at DESC LIMIT %s",
                    (limit,)
                )
                return list(cur.fetchall())
        finally:
            conn.close()

    def get_zero_result_queries(self, limit: int = 50) -> List[Dict[str, Any]]:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, query_text, result_count, searched_at FROM search_history WHERE result_count = 0 ORDER BY searched_at DESC LIMIT %s",
                    (limit,)
                )
                return list(cur.fetchall())
        finally:
            conn.close()

    def clear_search_history(self) -> None:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM search_history")
        finally:
            conn.close()

    def get_app_settings(self) -> Dict[str, str]:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT setting_key, setting_value FROM app_settings")
                rows = cur.fetchall()
                return {r["setting_key"]: r["setting_value"] for r in rows}
        finally:
            conn.close()

    def set_app_setting(self, key: str, value: str) -> None:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                sql = """
                INSERT INTO app_settings (setting_key, setting_value)
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
                """
                cur.execute(sql, (key, value))
        finally:
            conn.close()

    def get_matching_filenames(self, prefix: str, limit: int = 8) -> List[str]:
        """Provides filename suggestions for search bar autocomplete."""
        safe_prefix = prefix.replace("%", "\\%").replace("_", "\\_")
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                sql = """
                SELECT DISTINCT filename
                FROM files
                WHERE is_deleted = 0
                  AND filename LIKE CONCAT(%s, '%')
                ORDER BY filename ASC
                LIMIT %s;
                """
                cur.execute(sql, (safe_prefix, limit))
                rows = cur.fetchall()
                return [r["filename"] for r in rows]
        finally:
            conn.close()


metadata_store = MetadataStore()

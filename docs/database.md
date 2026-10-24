# Database Design & Stored Procedures

## 1. Tables Overview
1. `indexed_folders`: Monitored folders, paths, path hashes, status (`never`, `running`, `completed`, `failed`, `paused`), file count.
2. `files`: File metadata, path hash, filename, size, modified date, vector ID, extraction status (`pending`, `processing`, `done`, `failed`, `skipped`), soft deletion flag (`is_deleted`).
3. `search_history`: Search query logs, result counts, timestamps.
4. `app_settings`: Persistent key-value configuration.
5. `failed_extractions`: Log of errors, error types, error messages.
6. `operation_logs`: Auditable logs of administrative operations (scans, rebuilds, removals).

## 2. 14 Canonical Stored Procedures
| Procedure | Responsibility | Called By |
| :--- | :--- | :--- |
| `sp_upsert_file` | Idempotent insert or update; resets to pending if attributes changed | Scanner, Watcher |
| `sp_fetch_pending_files` | Atomically claims pending jobs with `FOR UPDATE SKIP LOCKED` | Worker |
| `sp_mark_file_done` | Records vector ID, text preview, and timestamp | Worker |
| `sp_mark_file_failed` | Increments retry count; records failure | Worker |
| `sp_soft_delete_file` | Soft deletes file while preserving vector ID | Watcher, Scanner |
| `sp_purge_deleted_file` | Hard deletes metadata row only after vector cleanup | Cleanup |
| `sp_get_files_by_vector_ids` | Bulk-fetches metadata for vector candidates via `JSON_TABLE` | Search Service |
| `sp_search_fallback_filename` | Searches files by filename when vector index is empty | Search Service |
| `sp_get_index_stats` | Returns comprehensive database counts | Index Service |
| `sp_refresh_folder_count` | Refreshes denormalized active file count for folder | Scanner, Service |
| `sp_remove_folder_cascade` | Soft-deletes files and returns vector IDs for cleanup | Index Service |
| `sp_log_operation` | Creates operation audit log record | Services |
| `sp_purge_old_history` | Retains newest N search history records | Maintenance |
| `sp_reset_all_for_rebuild` | Resets all active file states to pending for full rebuild | Index Service |

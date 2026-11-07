# Database Architecture & Relational Schema Reference

File Archaeologist maintains strict separation between its two relational data stores:
- **Desktop Edition**: MySQL 8.0+ (Local ACID relational database with InnoDB stored procedures)
- **Cloud Edition**: Cloudflare D1 (Distributed edge SQLite database with multi-tenant workspace isolation)

---

## 1. Desktop Schema (MySQL 8.0+)

Located at `database/schema.sql`.

### 1.1 `indexed_folders` Table
Stores root local folders explicitly configured for monitoring and background indexing.

| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `AUTO_INCREMENT PRIMARY KEY` | Unique folder ID |
| `path` | `VARCHAR(4096)` | `NOT NULL` | Absolute folder path |
| `path_hash` | `CHAR(64)` | `NOT NULL UNIQUE` | SHA-256 hash of normalized path |
| `is_active` | `TINYINT(1)` | `DEFAULT 1` | Active monitoring status |
| `scan_status` | `ENUM` | `'never','running','completed','failed','paused'` | Current scan state |
| `file_count` | `BIGINT UNSIGNED`| `DEFAULT 0` | Discovered file count |
| `created_at` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` | Registration timestamp |
| `last_scanned_at`| `DATETIME` | `NULL` | Completion of last scan |
| `last_scan_error`| `VARCHAR(1024)` | `NULL` | Error details if scan failed |

### 1.2 `files` Table
Canonical metadata for discovered, indexed, and soft-deleted files.

| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `AUTO_INCREMENT PRIMARY KEY` | Unique file ID |
| `folder_id` | `INT UNSIGNED` | `NOT NULL, FK -> indexed_folders(id) ON DELETE CASCADE` | Parent folder |
| `path_hash` | `CHAR(64)` | `NOT NULL UNIQUE` | SHA-256 of absolute path |
| `full_path` | `TEXT` | `NOT NULL` | Full file path on disk |
| `filename` | `VARCHAR(512)` | `NOT NULL` | File name with extension |
| `extension` | `VARCHAR(20)` | `NOT NULL DEFAULT ''` | File extension (e.g. `.pdf`) |
| `size_bytes` | `BIGINT UNSIGNED` | `NOT NULL DEFAULT 0` | File size on disk |
| `modified_at` | `DATETIME` | `NOT NULL` | Filesystem modification time |
| `discovered_at`| `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` | First discovery timestamp |
| `indexed_at` | `DATETIME` | `NULL` | Last successful extraction time |
| `content_hash` | `CHAR(64)` | `NULL` | SHA-256 content hash |
| `vector_id` | `BIGINT` | `NULL` | Mapping ID in HNSW index |
| `content_preview`| `TEXT` | `NULL` | Cleaned text snippet for UI preview |
| `extraction_status`| `ENUM` | `'pending','processing','done','failed','skipped'` | Extraction state |
| `retry_count` | `TINYINT UNSIGNED`| `DEFAULT 0` | Exponential retry tracker |
| `is_deleted` | `TINYINT(1)` | `DEFAULT 0` | Soft-deletion flag |
| `deleted_at` | `DATETIME` | `NULL` | Timestamp of deletion |
| `error_message`| `VARCHAR(1024)` | `NULL` | Last extraction failure message |

### 1.3 Supporting MySQL Tables
- `search_history`: Stores query strings, result counts, and timestamps.
- `app_settings`: Persistent key-value store for application settings (OCR, ignore lists).
- `failed_extractions`: Detailed failure audit log with error types and stack snippets.
- `operation_logs`: System operation log tracking scan and worker lifecycle executions.

---

## 2. Desktop Stored Procedures (MySQL 8.0+)

Located at `database/stored_procedures.sql`.

### 2.1 `sp_fetch_pending_files(IN p_limit INT)`
Concurrency-safe procedure for background indexing workers:
```sql
CREATE PROCEDURE sp_fetch_pending_files(IN p_limit INT)
BEGIN
    START TRANSACTION;
    
    DROP TEMPORARY TABLE IF EXISTS tmp_claimed_files;
    CREATE TEMPORARY TABLE tmp_claimed_files (id BIGINT UNSIGNED PRIMARY KEY);
    
    INSERT INTO tmp_claimed_files (id)
    SELECT f.id
    FROM files f
    JOIN indexed_folders folder ON f.folder_id = folder.id
    WHERE f.extraction_status = 'pending'
      AND f.is_deleted = 0
      AND folder.is_active = 1
    ORDER BY f.retry_count ASC, f.discovered_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED;
    
    UPDATE files f
    JOIN tmp_claimed_files t ON f.id = t.id
    SET f.extraction_status = 'processing';
    
    SELECT 
        f.id, f.folder_id, f.path_hash, f.full_path, f.filename,
        f.extension, f.size_bytes, f.modified_at, f.retry_count
    FROM files f
    JOIN tmp_claimed_files t ON f.id = t.id;
    
    DROP TEMPORARY TABLE tmp_claimed_files;
    COMMIT;
END;
```

### 2.2 Other Key Procedures
- `sp_mark_file_indexed`: Updates status to `'done'`, stores `content_hash`, `vector_id`, `content_preview`, and resets retry count.
- `sp_mark_file_failed`: Updates status to `'failed'`, increments retry count, and logs error.
- `sp_mark_file_skipped`: Updates status to `'skipped'` with explicit skip reason.
- `sp_get_indexing_status`: Returns atomic statistics across total, active, indexed, pending, processing, failed, and skipped files.
- `sp_reconcile_deleted_files`: Compares discovered path hashes with database records upon scan completion and flags missing files as soft-deleted.

---

## 3. Cloud Schema (Cloudflare D1)

Located at `database/d1_schema.sql`.

### 3.1 Multi-Tenant Core Tables
- `users`: Edge users with email, password hash, role (`admin`, `member`, `viewer`), and active status.
- `workspaces`: Multi-tenant boundary grouping documents, sources, and access rights.
- `workspace_members`: User membership and roles per workspace.
- `monitored_sources`: Cloud-connected storage sources or API ingest targets.
- `files`: Master document table containing `workspace_id`, `r2_key`, `content_hash`, and indexing status.
- `file_versions`: Immutable version history for document revisions.
- `file_chunks`: Chunk-level embeddings mapping chunks to Vectorize vector IDs.
- `indexing_jobs`: Background Queue processing state machine.
- `search_history` & `search_insights`: Per-workspace search tracking and zero-result query analysis.
- `audit_logs`: Detailed immutable security and operational audit trail.

### 3.2 Cloud Synchronization Manifest Tables
- `sync_connections`: Tracks connected desktop devices, client IDs, and authorization tokens.
- `sync_sources`: Registered desktop folders mapped to cloud workspaces.
- `sync_items`: Per-file synchronization tracking (hashes, sizes, sync state).
- `sync_jobs`: Batch transfer status and metrics.
- `sync_versions`: Content hash versioning to detect remote modifications.
- `sync_events`: Audit log of sync activities (connect, disconnect, upload, delete).


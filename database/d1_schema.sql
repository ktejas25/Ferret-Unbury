-- =====================================================================
-- FILE ARCHAEOLOGIST - CLOUDFLARE D1 (SQLITE) CANONICAL MULTI-TENANT SCHEMA
-- =====================================================================

-- 1. Users and Workspaces (Cloud Multi-Tenancy & Authorization)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (workspace_id, user_id)
);

-- 2. Monitored Sources / Folders
CREATE TABLE IF NOT EXISTS monitored_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL DEFAULT 'upload', -- upload, r2_prefix, s3, sync
    path_or_prefix TEXT NOT NULL,
    path_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    scan_status TEXT NOT NULL DEFAULT 'completed', -- pending, running, completed, partial, failed, cancelled
    file_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_scanned_at TEXT,
    last_scan_error TEXT,
    UNIQUE(workspace_id, path_hash)
);
CREATE INDEX IF NOT EXISTS idx_sources_ws_active ON monitored_sources(workspace_id, is_active);

-- Legacy compatibility view for indexed_folders
CREATE VIEW IF NOT EXISTS indexed_folders AS
SELECT id, path_or_prefix AS path, path_hash, is_active, scan_status, file_count, created_at, last_scanned_at, last_scan_error
FROM monitored_sources;

-- 3. Files Metadata (Cloud Stored in R2)
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    folder_id INTEGER REFERENCES monitored_sources(id) ON DELETE CASCADE,
    path_hash TEXT NOT NULL,
    full_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    extension TEXT NOT NULL DEFAULT '',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    storage_key TEXT, -- R2 object key
    content_hash TEXT, -- SHA-256 content checksum
    vector_id TEXT, -- Vectorize index vector ID
    content_preview TEXT,
    vector_json TEXT,
    extraction_status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, done, skipped, failed
    retry_count INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    error_message TEXT,
    modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
    indexed_at TEXT,
    UNIQUE(workspace_id, path_hash)
);
CREATE INDEX IF NOT EXISTS idx_files_ws_status ON files(workspace_id, extraction_status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
CREATE INDEX IF NOT EXISTS idx_files_modified ON files(modified_at);
CREATE INDEX IF NOT EXISTS idx_files_storage ON files(storage_key);

-- 4. File Versions & Chunks
CREATE TABLE IF NOT EXISTS file_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    storage_key TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS file_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    vector_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON file_chunks(file_id);

-- 5. Indexing Jobs (Cloud Queue Tracking)
CREATE TABLE IF NOT EXISTS indexing_jobs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
    stage TEXT NOT NULL DEFAULT 'upload', -- upload, extraction, embedding, indexing
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_type TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON indexing_jobs(workspace_id, status);

-- 6. Search History and Insights
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL DEFAULT 'default_workspace',
    query_text TEXT NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    searched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_search_history_ws ON search_history(workspace_id, searched_at);

CREATE TABLE IF NOT EXISTS search_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL DEFAULT 'default_workspace',
    query_text TEXT NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 1,
    zero_result_count INTEGER NOT NULL DEFAULT 0,
    last_searched_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(workspace_id, query_text)
);

-- 7. Application Settings
CREATE TABLE IF NOT EXISTS app_settings (
    workspace_id TEXT NOT NULL DEFAULT 'default_workspace',
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(workspace_id, setting_key)
);

-- 8. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ws ON audit_logs(workspace_id, created_at);

-- 9. Synchronization Subsystem (Stage 6 Infrastructure)
CREATE TABLE IF NOT EXISTS sync_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    auth_token_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'connected', -- connected, disconnected, paused
    last_sync_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id TEXT NOT NULL REFERENCES sync_connections(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    local_path TEXT NOT NULL,
    cloud_prefix TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'idle', -- idle, syncing, paused, error
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_source_id INTEGER NOT NULL REFERENCES sync_sources(id) ON DELETE CASCADE,
    local_path_hash TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, uploading, uploaded, indexing, synced, failed, conflict
    cloud_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
    last_synced_at TEXT,
    UNIQUE(sync_source_id, local_path_hash)
);

CREATE TABLE IF NOT EXISTS sync_jobs (
    id TEXT PRIMARY KEY,
    sync_source_id INTEGER NOT NULL REFERENCES sync_sources(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL, -- upload, reconcile, purge
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    files_count INTEGER NOT NULL DEFAULT 0,
    bytes_transferred INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_item_id INTEGER NOT NULL REFERENCES sync_items(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_item_id INTEGER REFERENCES sync_items(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================================
-- DEFAULT WORKSPACE & SETTINGS SEED (NO MOCK FILES)
-- =====================================================================
INSERT OR IGNORE INTO users (id, email, display_name) VALUES
('default_user', 'local@filearchaeologist.app', 'Default User');

INSERT OR IGNORE INTO workspaces (id, name, owner_id) VALUES
('default_workspace', 'Default Workspace', 'default_user');

INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES
('default_workspace', 'default_user', 'owner');

INSERT OR IGNORE INTO app_settings (workspace_id, setting_key, setting_value) VALUES
('default_workspace', 'theme', 'dark'),
('default_workspace', 'search_mode', 'hybrid'),
('default_workspace', 'min_similarity', '0.25'),
('default_workspace', 'top_k', '20'),
('default_workspace', 'max_file_size_mb', '50'),
('default_workspace', 'dark_mode', 'true'),
('default_workspace', 'auto_start_worker', 'true'),
('default_workspace', 'worker_paused', 'false'),
('default_workspace', 'debounce_seconds', '2');

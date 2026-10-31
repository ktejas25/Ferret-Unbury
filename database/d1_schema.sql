-- =====================================================================
-- FILE ARCHAEOLOGIST - CLOUDFLARE D1 (SQLITE) CANONICAL SCHEMA & SEED
-- =====================================================================

-- 1. Monitored folders table
CREATE TABLE IF NOT EXISTS indexed_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    path_hash TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    scan_status TEXT NOT NULL DEFAULT 'completed',
    file_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_scanned_at TEXT DEFAULT (datetime('now')),
    last_scan_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_folder_active ON indexed_folders (is_active);

-- 2. Files metadata table
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER NOT NULL REFERENCES indexed_folders(id) ON DELETE CASCADE,
    path_hash TEXT NOT NULL UNIQUE,
    full_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    extension TEXT NOT NULL DEFAULT '',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    modified_at TEXT NOT NULL,
    discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
    indexed_at TEXT DEFAULT (datetime('now')),
    content_hash TEXT,
    vector_id INTEGER,
    content_preview TEXT,
    vector_json TEXT,
    extraction_status TEXT NOT NULL DEFAULT 'done',
    retry_count INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_files_folder_status ON files (folder_id, extraction_status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_extension ON files (extension);
CREATE INDEX IF NOT EXISTS idx_files_modified ON files (modified_at);
CREATE INDEX IF NOT EXISTS idx_files_deleted ON files (is_deleted, deleted_at);

-- 3. Search history table
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text TEXT NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    searched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_searched_at ON search_history (searched_at);

-- 4. Application settings table
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Failed extractions table
CREATE TABLE IF NOT EXISTS failed_extractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Operation audit logs table
CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation TEXT NOT NULL,
    folder_id INTEGER REFERENCES indexed_folders(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

-- =====================================================================
-- INITIAL APPLICATION SETTINGS SEED
-- =====================================================================
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES
('theme', 'dark'),
('search_mode', 'hybrid'),
('min_similarity', '0.25'),
('top_k', '20'),
('max_file_size_mb', '50'),
('dark_mode', 'true'),
('auto_start_worker', 'true'),
('debounce_seconds', '2');

-- =====================================================================
-- SEED MONITORED COLLECTIONS & VERIFICATION DATA
-- =====================================================================
INSERT OR IGNORE INTO indexed_folders (id, path, path_hash, is_active, scan_status, file_count, created_at, last_scanned_at) VALUES
(1, 'docs/financial', 'hash_docs_financial', 1, 'completed', 4, datetime('now', '-7 days'), datetime('now', '-1 hours')),
(2, 'projects/ferret/docs', 'hash_ferret_docs', 1, 'completed', 3, datetime('now', '-14 days'), datetime('now', '-2 hours')),
(3, 'archives/invoices_2026', 'hash_archives_invoices', 1, 'completed', 2, datetime('now', '-30 days'), datetime('now', '-5 hours'));

-- Seed verified documents across PDF, DOCX, Code, Text, OCR categories
INSERT OR IGNORE INTO files (id, folder_id, path_hash, full_path, filename, extension, size_bytes, modified_at, content_preview, extraction_status, vector_id) VALUES
(1, 1, 'hash_inv_q1', 'docs/financial/Q1_Annual_Tax_Invoice_2026.pdf', 'Q1_Annual_Tax_Invoice_2026.pdf', '.pdf', 154200, '2026-03-28 14:22:00', 'Annual consolidated corporate tax invoice and balance sheet summary for March 2026 with payment confirmation.', 'done', 1),
(2, 1, 'hash_acct_recon', 'docs/financial/Account_Reconciliation_Report.docx', 'Account_Reconciliation_Report.docx', '.docx', 84120, '2026-03-15 09:30:00', 'Quarterly account reconciliation, bank transaction discrepancies, vendor invoices, and cash flow audit.', 'done', 2),
(3, 2, 'hash_arch_spec', 'projects/ferret/docs/Architecture_Specification.md', 'Architecture_Specification.md', '.md', 45100, '2026-04-10 11:15:00', 'Cloudflare deployment architecture specification, Workers Static Assets, D1 relational store, and vector embeddings.', 'done', 3),
(4, 2, 'hash_db_schema', 'projects/ferret/docs/Database_Schema_Guide.pdf', 'Database_Schema_Guide.pdf', '.pdf', 210400, '2026-04-12 16:40:00', 'MySQL 8.0 to Cloudflare D1 SQLite database migration schema with atomic transactions and indexing.', 'done', 4),
(5, 3, 'hash_receipt_scan', 'archives/invoices_2026/Hardware_Purchase_Receipt_OCR.png', 'Hardware_Purchase_Receipt_OCR.png', '.png', 320400, '2026-03-04 18:05:00', 'Scanned OCR hardware receipt from Micro Center for development workstations and NVMe SSD storage.', 'done', 5),
(6, 2, 'hash_api_spec', 'projects/ferret/docs/REST_API_Endpoints.json', 'REST_API_Endpoints.json', '.json', 12300, '2026-04-18 10:00:00', 'Complete OpenAPI specification for Search, Index Management, History, and System Health endpoints.', 'done', 6);

-- Seed search history
INSERT OR IGNORE INTO search_history (id, query_text, result_count, searched_at) VALUES
(1, 'annual invoice March', 1, datetime('now', '-2 hours')),
(2, 'database schema migration', 2, datetime('now', '-1 days')),
(3, 'hardware receipt OCR', 1, datetime('now', '-2 days')),
(4, 'quarterly tax report', 2, datetime('now', '-3 days'));


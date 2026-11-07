# Changelog – File Archaeologist

All notable fixes, architectural improvements, and security enhancements are recorded below.

---

## [2.0.0] - 2026-11-07 (Complete Code Audit & Dual-Platform Real Implementation)

### Security & Access Control
- **Fixed Path Traversal & Symlink Escapes**: Created `backend/app/core/security.py` using `os.path.realpath` to validate that all opened documents remain within explicitly authorized root paths.
- **Root Directory & System Path Protection**: Added strict checks preventing accidental or malicious selection of root drives (`/`, `C:\`) or operating system directories (`C:\Windows`, `C:\Program Files`, `/bin`, `/etc`).
- **Removed Unsafe Pickle Deserialization**: Completely replaced Python pickle file serialization in the native HNSW vector index with safe, standardized JSON metadata (`vectors_metadata.json`) and standalone binary vector graphs (`vectors.hnsw`).
- **Administrative Endpoint Authorization**: Secured all sensitive administrative actions (rebuild, worker pause/resume, folder deletion, settings updates) with `verify_api_authorization` dependency.

### Vector Index Persistence & Compaction
- **Resolved Persistence File Overwrite Conflict**: Fixed bug where native HNSW binary and vector metadata were written to the same filename, causing native loading failures.
- **Integrity Manifest**: Added `index_manifest.json` tracking schema version (`2.0.0`), embedding model identifier, vector dimensions (`384`), generation UUID, timestamps, and SHA-256 checksums.
- **Atomic File Operations**: Implemented `.tmp` temporary file writes and atomic replacements to guarantee persistence durability across crashes.
- **Automated Backups & Compaction**: Added rolling backup retention under `data/vector_index/backups/` and compact rebuild (`rebuild_compact`) that purges soft-deleted vectors without full re-indexing.

### Scanner, Watcher & Worker Reliability
- **Scan State Machine**: Refactored `FolderScanner` with explicit states (`PENDING`, `RUNNING`, `COMPLETED`, `PARTIAL`, `FAILED`, `CANCELLED`) and fine-grained metrics tracking.
- **Fixed Premature Deletion Reconciliation**: Restricted deletion reconciliation strictly to verified `COMPLETED` scans, preventing files from being erroneously purged during aborted or cancelled scans.
- **Watcher Vector Synchronization**: Integrated `FileLifecycleService` to immediately deactivate vector embeddings upon file deletion so deleted documents never linger in search results.
- **Concurrency-Safe MySQL Stored Procedures**: Wrapped `sp_fetch_pending_files` in explicit `START TRANSACTION ... COMMIT` blocks around `SELECT ... FOR UPDATE SKIP LOCKED` and added missing `f.path_hash` to output columns.
- **Worker Operational State Clarity**: Decoupled `is_paused()` from `is_indexing()`, exposing explicit labels (`paused`, `indexing`, `idle`).

### Embedding & Ranking Improvements
- **Sliding-Window Document Chunking**: Implemented 1,500 character chunks with 250 character overlap and mean pooling with L2 re-normalization, enabling search discoverability beyond the previous 2,000 character limit.
- **Reciprocal Rank Fusion (RRF)**: Implemented multi-signal search ranking combining semantic vector similarity with lexical filename matching and token overlap.
- **Fixed Date Filtering**: Corrected offset-aware vs offset-naive datetime comparisons in `SearchService`.

### Cloud Edition (Real Cloudflare Implementation)
- **Eliminated Mock In-Memory Edge Handlers**: Replaced in-memory demo constants (`DEFAULT_FILES`) with authentic Cloudflare D1 SQL queries, R2 bucket storage operations, and Queue dispatches.
- **Multi-Tenant Schema**: Updated `database/d1_schema.sql` with multi-tenant tables (`users`, `workspaces`, `workspace_members`, `monitored_sources`, `files`, `file_chunks`, `sync_items`, `sync_events`).
- **Configured Wrangler Bindings**: Configured D1, R2, Queues, and Vectorize bindings in `wrangler.jsonc` and validated types via `npx wrangler types`.
- **Upload API Endpoint**: Added multipart file upload endpoint (`POST /api/upload`) storing binaries directly into Cloudflare R2 and registering metadata in D1.

### Desktop-to-Cloud Synchronization
- **Engineered Isolated Sync Subsystem**: Created `backend/app/core/sync_service.py` backed by a dedicated local SQLite database (`data/sync.db`), guaranteeing zero dependencies on cloud availability.
- **Non-Destructive Guarantee**: Enforced strict policy that synchronization is additive-only and never modifies or deletes original local files.
- **Lifecycle State Machine**: Supported `Not Selected`, `Pending`, `Uploading`, `Uploaded`, `Indexing`, `Synced`, `Failed`, `Paused`, `Conflict`.

### Frontend Refinements
- **Fixed Search Filter Closure Bug**: In `SearchPage.tsx`, updated filter button and date dropdown handlers to pass updated values directly to `executeSearch(query, newType, newDate)` instead of relying on stale React state closures.
- **Fixed Worker Toggle Button**: In `StatusPage.tsx`, updated button to check `status?.is_paused` rather than equating `!status?.is_indexing` with paused. Added real-time worker status badge (`Paused`, `Indexing`, `Idle`).
- **Enhanced Settings Modal**: Added model diagnostics display (SentenceTransformers active vs fallback) and a dedicated Cloud Synchronization tab with connection controls and transfer statistics.
- **Navigation Mode Indicator**: Added an active mode pill in `Navbar.tsx` distinguishing between "Offline Local" mode and "Sync Active" mode.

### File Extraction Improvements
- **Safe Legacy `.doc` Extraction**: Created `LegacyDocExtractor` to scan binary Word 97-2003 OLE streams for UTF-16LE and ASCII text without invoking `python-docx` or Word automation, preventing crashes.
- **Format Differentiation**: Removed `.doc` routing to `DocxExtractor`, which now strictly handles `.docx` Open XML packages.
- **Encoding & Binary File Heuristics**: Enhanced `TextExtractor` to detect multi-byte encodings (UTF-8, UTF-16, Latin-1, CP1252) and reject binary files masquerading as plaintext.
- **Graceful OCR Fallback**: Handled missing or unconfigured Tesseract binaries without internal errors.


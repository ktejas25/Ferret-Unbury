# API Reference & Integration Guide

File Archaeologist exposes dedicated REST APIs for both execution environments:
1. **Desktop Edition API**: Local FastAPI server bound by default to `http://127.0.0.1:8420`.
2. **Cloud Edition API**: Cloudflare Worker API Gateway at your configured edge domain.

Both APIs follow consistent JSON request and response conventions while operating on completely independent data stores.

---

## 1. Authentication & Security Headers

When `REQUIRE_AUTH=true` is enabled on Desktop, or when accessing multi-tenant Cloud endpoints:
- Provide an API key or token via either:
  - `Authorization: Bearer <API_KEY>`
  - `X-API-Key: <API_KEY>`

---

## 2. Desktop Edition Endpoints

### 2.1 Search Routes

#### `POST /api/search`
Performs hybrid semantic + lexical search across indexed local files using Reciprocal Rank Fusion (RRF).
- **Request Body**:
  ```json
  {
    "query": "quarterly financial report",
    "top_k": 25,
    "file_types": ["pdf", "docx"],
    "date_from": "2026-01-01T00:00:00Z",
    "date_to": "2026-12-31T23:59:59Z"
  }
  ```
- **Response**:
  ```json
  {
    "query": "quarterly financial report",
    "results": [
      {
        "file_id": 42,
        "path": "C:\\Users\\User\\Documents\\Q3_Report.pdf",
        "filename": "Q3_Report.pdf",
        "extension": ".pdf",
        "size_bytes": 1048576,
        "modified_at": "2026-10-15T14:30:00",
        "score": 0.8842,
        "preview": "Executive financial summary: net revenue increased by..."
      }
    ],
    "total": 1,
    "took_ms": 14.2,
    "fallback_mode": false
  }
  ```

#### `POST /api/search/open`
Launches a file or opens its containing directory in the host OS file explorer (Windows Explorer, macOS Finder, Linux file manager).
- **Request Body**:
  ```json
  {
    "file_id": 42,
    "open_containing_folder": false
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "File launched successfully"
  }
  ```

#### `GET /api/search/suggest?q={partial}`
Returns query auto-completion and suggestion items based on indexed filenames.

---

### 2.2 Index Management Routes

#### `GET /api/index/status`
Returns full indexing statistics and worker operational state.
- **Response**:
  ```json
  {
    "total_files": 1250,
    "active_files": 1200,
    "indexed_files": 1180,
    "pending_files": 15,
    "processing_files": 5,
    "failed_files": 0,
    "skipped_files": 50,
    "files_with_vectors": 1180,
    "soft_deleted_files": 50,
    "vector_count": 1180,
    "deleted_vector_count": 0,
    "index_size_bytes": 1824768,
    "is_indexing": true,
    "is_paused": false,
    "current_task": "Indexing pending documents..."
  }
  ```

#### `GET /api/index/folders`
Lists all monitored local folders with scan statuses, file counts, and error timestamps.

#### `POST /api/index/folders`
Registers a new local directory for monitoring and kicks off an initial scan.
- **Request Body**:
  ```json
  {
    "path": "C:\\Users\\User\\Documents"
  }
  ```

#### `DELETE /api/index/folders/{folder_id}`
Removes a folder from monitoring and safely deactivates associated vector embeddings.

#### `POST /api/index/pause`
Pauses the background indexing worker thread.

#### `POST /api/index/resume`
Resumes the paused background indexing worker thread.

#### `POST /api/index/rebuild`
Clears existing vector indexes and resets file statuses to `pending` to trigger a clean full rebuild. Requires `{"confirm": true}`.

---

### 2.3 Synchronization Routes

#### `GET /api/sync/status`
Returns synchronization stats, connection status, and active transfer metrics.

#### `GET /api/sync/settings`
Returns current sync configuration (cloud endpoint, excluded folders, size limits).

#### `POST /api/sync/settings`
Updates sync rules (`excluded_folders`, `excluded_extensions`, `max_file_size_bytes`, `retry_limit`).

#### `POST /api/sync/connect`
Authenticates against a Cloudflare Worker edge endpoint and saves the connection.
- **Request Body**:
  ```json
  {
    "cloud_url": "https://archaeologist.edge.workers.dev",
    "api_key": "optional_token",
    "workspace_id": "default"
  }
  ```

#### `POST /api/sync/disconnect`
Disconnects cloud sync cleanly. Local files remain completely untouched.

#### `POST /api/sync/folders`
Adds an explicitly chosen local directory to the sync list.

#### `DELETE /api/sync/folders?folder_path={path}`
Removes a directory from the sync list without deleting any files.

#### `POST /api/sync/trigger`
Triggers an immediate incremental background sync cycle.

#### `POST /api/sync/retry`
Resets failed and conflicted items to pending for retry.

#### `DELETE /api/sync/cloud-copy?local_path={path}`
Deletes the corresponding file from Cloudflare R2 / D1 while preserving the local original.

---

### 2.4 System Routes

#### `GET /api/health`
Returns authentic operational health diagnostics for API, MySQL, embedding model, vector index, and watcher.
- **Response**:
  ```json
  {
    "status": "healthy",
    "database": "connected",
    "model": "ready (all-MiniLM-L6-v2)",
    "vector_index": "ready (1180 active vectors)",
    "worker": "indexing",
    "watcher": "active",
    "details": {
      "needs_rebuild": false,
      "current_task": "Processing file 12 of 20",
      "embedder": {
        "status": "ready",
        "model": "all-MiniLM-L6-v2",
        "dimensions": 384,
        "is_fallback": false,
        "device": "cpu"
      }
    }
  }
  ```

---

## 3. Cloud Edition Endpoints

All Cloud endpoints run on the Cloudflare Worker:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Edge diagnostics (D1, R2, Queue, Vectorize connectivity) |
| `POST` | `/api/upload` | Multipart document upload into Cloudflare R2 & D1 |
| `POST` | `/api/search` | Vector search across Cloudflare Vectorize & D1 |
| `GET` | `/api/history` | Cloud search history and zero-result queries |
| `DELETE`| `/api/history` | Clears workspace search history |
| `GET` | `/api/index/status` | Cloud indexing statistics and queue state |
| `GET` | `/api/index/folders`| Monitored cloud sources list |
| `POST` | `/api/index/pause` | Pauses cloud background queue consumer |
| `POST` | `/api/index/resume`| Resumes cloud background queue consumer |
| `DELETE`| `/api/files/:id` | Deletes a document from R2, D1, and Vectorize |


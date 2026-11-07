# Desktop-to-Cloud Synchronization Specification

This document details the architecture, safety principles, security policies, and lifecycle states of the **File Archaeologist Synchronization Subsystem**.

---

## 1. Safety Principles & Core Rules

1. **Local Documents Are Primary**: The synchronization engine is purely additive or unlinking. It **never** modifies, overwrites, or deletes original files on your computer.
2. **Opt-In Only**: Synchronization is disabled by default. No background uploads occur until a user explicitly connects their cloud workspace and adds individual folders to the sync list.
3. **No Root or System Folder Syncing**: Validations strictly prevent adding `/`, `C:\`, `C:\Windows`, `C:\Program Files`, or standard Unix system directories.
4. **Independent Document Identities**: Documents in the cloud receive their own Cloudflare D1 IDs and Vectorize embeddings. They are indexed as independent documents at the edge.
5. **Decoupled Deletion Policies**:
   - Removing a local folder from the sync list unlinks it locally; cloud copies are preserved unless explicitly deleted.
   - Deleting a cloud document copy never deletes the original file on disk.

---

## 2. Synchronization Architecture

```
+--------------------------------------------------------------------------------+
|                        DESKTOP SYNC SUBSYSTEM                                  |
|                                                                                |
|  [SyncSettings]             [SyncService Engine]              [Sync Manifest]  |
|  - Cloud URL                - Discover eligible files         (data/sync.db)   |
|  - Bearer Token             - Compute SHA-256 hashes          - sync_settings  |
|  - Workspace ID             - Filter size & extensions        - sync_items     |
|  - Sync Folder List         - Dispatch uploads via HTTPX      - sync_history   |
+------------------------------------+-------------------------------------------+
                                     |
                         HTTP POST /api/upload
                         (Multipart File + Metadata)
                                     |
                                     v
+--------------------------------------------------------------------------------+
|                   CLOUDFLARE WORKER INGESTION ENDPOINT                         |
|                                                                                |
|  [Auth Verification] ----> [R2 Storage] ----> [D1 Metadata] ----> [Queue]      |
|  Validates Bearer/Key      Stores Binary      Records file,       Dispatches   |
|  & Workspace access        Blob in R2         hash & size in D1   to Vectorize |
+--------------------------------------------------------------------------------+
```

---

## 3. Synchronization Lifecycle States

Tracked per file in `sync_items`:

| State | Description | Next Transitions |
|---|---|---|
| `not_selected` | File resides in an unselected folder or has been removed from sync. | `pending` |
| `pending` | File discovered or modified; queued for upload. | `uploading` |
| `uploading` | File content is actively transmitting to the Cloudflare Worker. | `synced`, `failed`, `conflict` |
| `uploaded` | Binary received by R2; waiting for cloud queue indexing. | `indexing`, `synced` |
| `indexing` | Cloudflare Queue consumer is generating embeddings in Vectorize. | `synced` |
| `synced` | File successfully stored in R2, metadata in D1, and vectors in Vectorize. | `pending` (if local file changes) |
| `failed` | Upload or network failure exceeded retry threshold. | `pending` (on manual retry) |
| `paused` | Synchronization temporarily halted by user. | `pending` (on resume) |
| `conflict` | Remote document exists with a conflicting hash under non-versioning policy. | `pending` (on resolution) |

---

## 4. Conflict Resolution Strategy

- **Local Modification**: If a local file's SHA-256 hash changes after being synced, its state automatically transitions from `synced` back to `pending`. On the next cycle, the new version is uploaded to the cloud with an incremented version number in `file_versions`.
- **Remote Mismatch (409 Conflict)**: If the cloud endpoint detects that a document with the same path exists with a conflicting signature from another source, the Desktop sync engine flags the item as `conflict` and logs the event in `sync_history`. The local file remains completely untouched.
- **Manual Retry**: Calling `POST /api/sync/retry` resets all `failed` and `conflict` items back to `pending` with zeroed retry counts.

---

## 5. Audit Logging & Verification

Every sync event is permanently recorded in `sync_history` (`data/sync.db`):
- `source_path`: Absolute local path of the file.
- `cloud_file_id`: Associated Cloudflare D1 identifier.
- `status`: Resulting state (`synced`, `failed`, `conflict`, `cloud_copy_removed`).
- `bytes_transferred`: Number of bytes transferred.
- `error_message`: Error details if unsuccessful.
- `timestamp`: UTC ISO timestamp.
- `action_taken`: Plain English description of the operation.


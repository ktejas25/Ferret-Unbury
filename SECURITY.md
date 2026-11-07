# Security Architecture & Policies

Security is a foundational requirement of File Archaeologist. This document outlines the access controls, input validations, directory traversal protections, and credential safety policies implemented across both editions.

---

## 1. Filesystem Traversal & Symlink Escape Protection

Implemented in `backend/app/core/security.py`.

### 1.1 Resolution via `realpath`
All path validation logic uses Python's `os.path.realpath` (and `pathlib.Path.resolve()`) to resolve symbolic links, junctions, and relative parent path components (`..`).

### 1.2 Jail Boundary Validation (`validate_path_within_roots`)
Before any file or folder can be opened or read via the API:
- The path is resolved to its canonical real path.
- The path is validated against the set of registered active monitored root folders.
- If the resolved real path does not begin with an authorized monitored root path prefix (followed by an OS separator), access is denied with an HTTP 403 / security exception.

### 1.3 System Directory & Root Drive Rejection (`validate_safe_folder_path`)
To prevent recursive indexing of entire disk drives or sensitive operating system files:
- Paths with `<= 1` path component (such as `/` or `C:\`) are immediately rejected.
- OS root anchors (e.g. `C:`, `D:\`) are rejected.
- Standard operating system directories are blocked:
  - Windows: `C:\Windows`, `C:\Program Files`, `C:\Program Files (x86)`, `C:\ProgramData`, `C:\Recovery`, `C:\$Recycle.Bin`, `System Volume Information`.
  - Unix / Linux: `/bin`, `/sbin`, `/usr`, `/etc`, `/var`, `/dev`, `/proc`, `/sys`, `/root`.

---

## 2. Unsafe Deserialization Elimination

- **Removal of Python Pickle**: The native HNSW index implementation originally used Python's `pickle` module for metadata persistence, exposing the system to arbitrary code execution risks.
- **Safe Persistence**: Vector metadata is strictly serialized using standard UTF-8 JSON (`vectors_metadata.json`), and native vector graphs are written to separate binary HNSW files (`vectors.hnsw`). Untrusted binary deserialization is completely disallowed.

---

## 3. Credential Safety & Environment Variables

- **Version Control Safety**: All production credentials, passwords, and API secrets are removed from version control. A `.gitignore` rule prevents `.env` and SQLite `.db` files from being committed.
- **Example Configuration**: A comprehensive `.env.example` file is provided to guide configuration without embedding real secrets.
- **CORS Policies**: Desktop FastAPI CORS origins are restricted to local loops (`http://127.0.0.1:*`, `http://localhost:*`).

---

## 4. Cloud Multi-Tenant Isolation

- **Workspace Boundaries**: All Cloudflare D1 tables (`files`, `file_chunks`, `search_history`, `sync_items`) enforce `workspace_id` foreign keys and indices.
- **R2 Storage Isolation**: Documents in Cloudflare R2 are scoped under `workspaces/{workspace_id}/files/{file_id}/`.
- **Authorization Enforcement**: Cloud endpoints enforce token verification before granting read or write access to workspace resources.


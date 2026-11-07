# Testing & Quality Assurance Guide

File Archaeologist maintains extensive test coverage across unit tests, database integration tests, frontend build validations, and Cloudflare Worker endpoint tests.

---

## 1. Test Suite Overview

```
backend/tests/
  ├── unit/
  │     ├── test_embedder.py            # Dimension checks, determinism, chunking, pooling, diagnostics
  │     ├── test_extractors.py          # Plaintext, UTF-16, binary detection, legacy DOC, HTML, OCR
  │     ├── test_scanner_and_worker.py  # Scanner cancellation, reconciliation safety, worker states
  │     ├── test_security.py            # Root path rejection, traversal/symlink validation, auth
  │     ├── test_sync_service.py        # Sync states, folder security, cycle execution, cloud copy removal
  │     └── test_vector_index.py        # HNSW persistence, manifest verification, corruption recovery, rebuild
  │
  └── integration/
        ├── test_api_endpoints.py       # REST API contracts, status, history, search, settings
        ├── test_full_lifecycle.py      # End-to-end folder add, scan, worker indexing, search, deletion
        └── test_metadata_store.py      # MySQL stored procedures, concurrency-safe transactions
```

---

## 2. Running Backend Tests

### 2.1 Run All Backend Tests (Unit & Integration)
```bash
python -m pytest backend/tests
```
*Expected Output: 39 tests passing across all suites.*

### 2.2 Run Unit Tests Only
```bash
python -m pytest backend/tests/unit
```
*Expected Output: 31 unit tests passing.*

### 2.3 Run Integration Tests Only (Requires MySQL)
```bash
python -m pytest backend/tests/integration
```
*Expected Output: 8 integration tests passing.*

---

## 3. Frontend Build & Typecheck Verification

Run from project root or `frontend/`:
```bash
npm --prefix frontend run build
```
This runs:
- `tsc -b`: Strict TypeScript compiler check without emitting files.
- `vite build`: Production minification and bundling into `backend/app/static`.

---

## 4. Cloudflare Worker Verification

Run the automated endpoint verification suite against local Miniflare:
```bash
npm run test:worker
```
Tests:
- `GET /api/health`
- `GET /api/settings`
- `GET /api/index/folders`
- `GET /api/index/status`
- `POST /api/index/pause` & `/api/index/resume`
- `POST /api/search`
- `GET /api/history`
- `GET /` (React SPA index serving)


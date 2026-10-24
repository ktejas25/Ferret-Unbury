# Testing and Release Verification

## 1. Automated Test Suite
The project includes automated tests covering all functional layers:
- **Unit Tests**:
  - `test_embedder.py`: 384-dimensional vector output, L2 normalization, deterministic generation.
  - `test_vector_index.py`: Vector addition, KNN search, soft deletion, index persistence and reload.
  - `test_extractors.py`: Text, HTML, DOCX, unsupported file fallback.
- **Integration Tests**:
  - `test_metadata_store.py`: MySQL 8 stored procedure execution (`sp_upsert_file`, `sp_fetch_pending_files`, `sp_mark_file_done`, `sp_get_index_stats`, `sp_soft_delete_file`).
  - `test_api_endpoints.py`: FastAPI route handlers for health, index status, folders, search, history, settings.
  - `test_full_lifecycle.py`: Complete end-to-end flow from folder discovery -> extraction -> embedding -> semantic search -> file modification -> file deletion -> reconciliation.

## 2. Test Execution Command
```bash
cd backend
python -m pytest tests
```
Result: **15 passed**

## 3. Frontend Production Build
```bash
cd frontend
npm run build
```
Result: Emitted production assets into `backend/app/static/`.

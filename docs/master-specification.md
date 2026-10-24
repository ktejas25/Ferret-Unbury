# File Archaeologist — Enhanced Master Specification

## Executive Overview
**File Archaeologist** is a local-first desktop productivity application engineered to help users discover personal files by describing memories, topics, dates, or fuzzy details, rather than requiring exact filenames or paths.

### Primary Technology Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Lucide Icons
- **Backend**: Python 3.10+, FastAPI, Pydantic, SQLAlchemy, PyMySQL
- **Metadata Database**: MySQL 8.0 (InnoDB) with version-controlled schema and 14 stored procedures
- **Vector Search Engine**: `hnswlib` (with NumPy Cosine Index fallback), 384 dimensions, Cosine metric, L2 normalized
- **Embedding Model**: `all-MiniLM-L6-v2` (Sentence-Transformers) with deterministic local fallback
- **File Monitoring**: Python `watchdog` with debouncing
- **Extraction & OCR**: `pypdf`, `python-docx`, `BeautifulSoup4`, `Pillow`, `pytesseract`

---

## Canonical Resolutions
1. **Backend Port**: Standardized canonical port `8420` (`127.0.0.1:8420`). Vite proxy configured to `8420`.
2. **Static Asset Directory**: Built frontend static assets reside in `backend/app/static/` and are directly served by FastAPI on root `/`.
3. **Database Schema & Deletion Semantics**:
   - Soft-deletion via `is_deleted = 1` and `deleted_at = CURRENT_TIMESTAMP`.
   - Vector IDs are retained during normal file updates, and purged metadata rows only after vector cleanup is confirmed in the vector index.
4. **Search History Semantics**:
   - Zero-result searches are categorized as discoverability insights (`/api/history/failed`), not system errors.
   - Total history retention bounded to 500 rows.
5. **Path Validation & Security**:
   - Resolved file paths in `/api/search/open` are strictly checked against active monitored root directories to prevent path traversal and unmonitored file access.

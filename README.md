# File Archaeologist — Desktop Application

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-1.0.0-emerald.svg)](https://fastapi.tiangolo.com/)
[![React: 18](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![MySQL: 8.0](https://img.shields.io/badge/MySQL-8.0%20InnoDB-orange.svg)](https://www.mysql.com/)

**File Archaeologist** is a local-first desktop productivity application that indexes files from user-selected folders and enables users to discover documents through **natural-language semantic search**, fuzzy memories, topics, dates, and filename fallback.

---

## Key Features

- **Local-First Privacy**: File content, extracted text, embeddings, vector indices, and search history remain 100% on your machine.
- **Natural-Language Discovery**: Search by topic or content memory (e.g. *"annual invoice March"*, *"database error screenshot"*).
- **Multi-Format Text Extraction**:
  - PDF (`pypdf` with encrypted/malformed protection)
  - Microsoft Word (`python-docx` for paragraphs and tables)
  - Plain text, Markdown, CSV, JSON, LOG, and code files
  - HTML (`BeautifulSoup4` visible text extraction)
  - Images / Screenshots (OCR via Pillow + Tesseract)
- **HNSW Vector Search**: 384-dimensional cosine vector space (`all-MiniLM-L6-v2`) with persistent binary index.
- **MySQL 8.0 Metadata Store**: InnoDB schema with 14 transactional stored procedures, atomic worker claims (`FOR UPDATE SKIP LOCKED`), and soft-deletion protection.
- **Filesystem Watcher**: Background `watchdog` monitoring with event debouncing.
- **Modern Desktop UI**: Raycast/Spotlight-inspired React interface with dark mode, quick filters, progress dashboard, history insights, and settings.

---

## Project Structure

```text
file-archaeologist/
├── frontend/                     # React + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/                  # Typed REST API client
│   │   ├── components/           # Navbar, SettingsModal
│   │   ├── pages/                # SearchPage, StatusPage, HistoryPage
│   │   ├── types/                # TypeScript models and interfaces
│   │   ├── App.tsx               # Main layout and state routing
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts            # Configured with proxy to port 8420
├── backend/                      # Python + FastAPI Backend
│   ├── app/
│   │   ├── core/                 # Embedder, VectorIndex, MetadataStore, Worker, Watcher, Scanner
│   │   ├── db/                   # Database connection pool & migrations
│   │   ├── extractor/            # PDF, DOCX, Text, HTML, Image/OCR registry
│   │   ├── models/               # SQLAlchemy entities & Pydantic schemas
│   │   ├── routes/               # Search, Index, History, System routes
│   │   ├── services/             # Business logic orchestration
│   │   ├── static/               # Built production frontend SPA assets
│   │   └── main.py               # FastAPI application lifecycle (Port 8420)
│   ├── tests/                    # Unit, integration, and lifecycle test suite
│   ├── requirements.txt
│   ├── pytest.ini
│   └── .env.example
├── database/
│   ├── schema.sql                # MySQL 8.0 canonical schema DDL
│   └── stored_procedures.sql     # 14 Canonical Stored Procedures
├── data/                         # Runtime vector indices & logs (.gitkeep)
├── scripts/
│   ├── run_app.py                # Desktop application launcher
│   ├── init_db.sql               # Consolidated DB initialization script
│   └── build.sh                  # Complete build script
└── docs/                         # Technical specifications and guides
```

---

## Prerequisites

1. **Python 3.10+** (tested on Python 3.12)
2. **Node.js v18+** & **npm**
3. **MySQL Server 8.0+** running locally on port `3306`

---

## Getting Started

### 1. Database Setup

Ensure your local MySQL service is running, then initialize the database and 14 stored procedures:

```bash
# Using MySQL Command Line Client:
mysql -u root -p < database/schema.sql
mysql -u root -p < database/stored_procedures.sql
```

*(Alternatively, run `docker-compose up -d` to launch an isolated MySQL 8 container).*

### 2. Configure Backend Environment

Copy the example environment configuration:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your local MySQL password:

```ini
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=file_archaeologist

API_HOST=127.0.0.1
API_PORT=8420
```

### 3. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Build the Frontend

```bash
cd ../frontend
npm install
npm run build
```
This builds the production React application directly into `backend/app/static/`.

---

## Running the Application

### Option A: Desktop Launcher (Recommended)

Run the desktop runner from the root directory:

```bash
python scripts/run_app.py
```
This starts the backend on `http://127.0.0.1:8420` and automatically opens the desktop interface in your default browser.

### Option B: Development Mode (Vite HMR + FastAPI)

Start the backend:
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8420 --reload
```

In a separate terminal, start the Vite development server:
```bash
cd frontend
npm run dev
```
Navigate to `http://localhost:5173`. Vite will automatically proxy API requests to `http://127.0.0.1:8420`.

---

## Running Automated Tests

Run the complete test suite (unit tests, stored procedures integration, and full indexing lifecycle):

```bash
cd backend
python -m pytest tests
```

Expected result:
```text
============================= 15 passed in ~10s =============================
```

---

## 14 MySQL Stored Procedures

| # | Stored Procedure | Description |
| :- | :--- | :--- |
| 1 | `sp_upsert_file` | Idempotent insert/update; resets to pending on file changes |
| 2 | `sp_fetch_pending_files` | Atomically claims jobs via `FOR UPDATE SKIP LOCKED` |
| 3 | `sp_mark_file_done` | Records vector ID, preview, and indexed timestamp |
| 4 | `sp_mark_file_failed` | Increments retries; records failures in `failed_extractions` |
| 5 | `sp_soft_delete_file` | Marks file as deleted while preserving vector bridge |
| 6 | `sp_purge_deleted_file` | Hard-deletes metadata row only after vector cleanup is verified |
| 7 | `sp_get_files_by_vector_ids` | Bulk-fetches metadata for candidate vectors via `JSON_TABLE` |
| 8 | `sp_search_fallback_filename` | Filename and metadata search fallback |
| 9 | `sp_get_index_stats` | Database-side file and queue statistics |
| 10 | `sp_refresh_folder_count` | Refreshes folder active file count |
| 11 | `sp_remove_folder_cascade` | Coordinates folder removal and returns vector IDs for cleanup |
| 12 | `sp_log_operation` | Creates an audit record in `operation_logs` |
| 13 | `sp_purge_old_history` | Retains newest N records from search history |
| 14 | `sp_reset_all_for_rebuild` | Resets all active file records to pending for index rebuild |

---

## Desktop Packaging

To package into a standalone desktop executable:

```bash
cd backend
pyinstaller file_archaeologist.spec
```
The compiled bundle will be generated in `backend/dist/file-archaeologist/`.

---

## License

This project is licensed under the [MIT License](LICENSE).
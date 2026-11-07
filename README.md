# File Archaeologist – Local-First Semantic File Discovery

> **Find files by content, topic, meaning, and fuzzy memory—not just exact filenames.**  
> Built as a dual-platform system: **100% Offline-Capable Desktop Edition** and **Scalable Cloudflare Edge Edition**, linked by an **optional, user-controlled, non-destructive synchronization engine**.

---

## Key Highlights

- **Dual Independent Architecture**:
  - **Desktop Edition**: Runs entirely on your local machine using Python 3.12, FastAPI, MySQL 8.0, native HNSW vector indexing, SentenceTransformers embeddings, and Watchdog recursive filesystem monitoring. Zero internet required.
  - **Cloud Edition**: Global serverless edge deployment on Cloudflare Workers, Cloudflare D1 (distributed SQL), Cloudflare R2 (document object storage), Cloudflare Queues (asynchronous document parsing), and Cloudflare Vectorize (vector similarity search).
- **Independent Search Guarantees**: Local search queries local documents only. Cloud search queries cloud documents only. No merged result hazards or data leaking.
- **Optional & Non-Destructive Synchronization**: Desktop-to-cloud synchronization is opt-in, folder-specific, and non-destructive. Local documents are always primary and are **never** modified or deleted during sync.
- **Deep Content Extraction**: Full parsing support for `.pdf`, `.docx`, `.doc` (safe legacy OLE stream extractor), `.html`, plain text/code (`.txt`, `.md`, `.py`, `.ts`, `.json`, etc.), and images via local OCR (Tesseract + Pillow).
- **Reciprocal Rank Fusion (RRF)**: Hybrid search combining semantic vector cosine similarity with lexical filename matching and token overlap.
- **Enterprise-Grade Security**: Path traversal protection via `realpath`, strict rejection of OS root drives and critical system directories, safe atomic index persistence (no unsafe Python pickle deserialization), and Bearer/API-key authorization.

---

## Dual Platform Architecture Overview

```
                  +--------------------------------------------------+
                  |               React 18 + Vite UI                |
                  |     Spotlight Search • Violet/Slate Theme       |
                  +-------------------------+------------------------+
                                            |
                    +-----------------------+-----------------------+
                    |                                               |
                    v                                               v
     +------------------------------+               +-------------------------------+
     |       DESKTOP EDITION        |               |         CLOUD EDITION         |
     |   (100% Offline Capable)     |               |    (Cloudflare Edge Stack)    |
     +------------------------------+               +-------------------------------+
     | • FastAPI (Port 8420)        |               | • Cloudflare Workers          |
     | • MySQL 8.0 Metadata DB      |               | • Cloudflare D1 Database      |
     | • Persistent HNSW + Manifest |               | • Cloudflare Vectorize Index  |
     | • SentenceTransformers / SBERT|              | • Cloudflare R2 Object Store  |
     | • Watchdog Filesystem Events |               | • Cloudflare Indexing Queue   |
     | • Local Tesseract OCR        |               | • Multi-Tenant Workspaces     |
     +--------------+---------------+               +---------------+---------------+
                    |                                               ^
                    |         OPTIONAL SYNC SUBSYSTEM               |
                    +-----------------------------------------------+
                    • Opt-in folder selection (Never entire drive)
                    • SHA-256 content change detection
                    • Non-destructive: Local original remains untouched
                    • Independent document identities
```

---

## Quick Navigation

- [Desktop Setup Guide](DESKTOP_SETUP.md): Step-by-step instructions for running locally with MySQL and Python.
- [Cloud Setup Guide](CLOUD_SETUP.md): Step-by-step instructions for Cloudflare Workers, D1, R2, and Vectorize.
- [Architecture Documentation](ARCHITECTURE.md): Deep-dive into technical design and engineering principles.
- [Database Schema Reference](DATABASE_SCHEMA.md): Complete MySQL and D1 relational schemas and stored procedures.
- [API Documentation](API_DOCUMENTATION.md): Full REST endpoint specifications for Desktop and Cloud.
- [Synchronization Engine](SYNCHRONIZATION.md): Detailed protocol, states, security, and conflict handling.
- [Security Policies](SECURITY.md): Filesystem traversal protection, access controls, and credential safety.
- [Testing Guide](TESTING.md): Instructions for running unit tests, integration tests, and Worker tests.
- [Deployment Guide](DEPLOYMENT.md): Desktop bundling (PyInstaller) and Cloudflare production deployments.
- [Troubleshooting Manual](TROUBLESHOOTING.md): Diagnostic matrix for database, vector index, and OCR issues.
- [Changelog](CHANGELOG.md): History of audit findings, architectural fixes, and improvements.

---

## Quick Start (Desktop Edition)

### Prerequisites

- **Python 3.12+**
- **Node.js 20+** and `npm`
- **MySQL 8.0+** running locally (or via Docker)
- Optional: **Tesseract OCR** for image text extraction

### 1. Database Setup

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p file_archaeologist < database/stored_procedures.sql
```

### 2. Desktop Backend Setup

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp ../.env.example .env
# Edit .env with your MySQL credentials
uvicorn app.main:app --host 127.0.0.1 --port 8420 --reload
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. (Alternatively, run `npm run build` in the frontend directory to serve the SPA directly from FastAPI on `http://127.0.0.1:8420`).

---

## Quick Start (Cloudflare Edition)

### 1. Install Dependencies & Login

```bash
npm install
npx wrangler login
```

### 2. Create Cloud Resources

```bash
# Create D1 database
npx wrangler d1 create file_archaeologist_db

# Create R2 storage bucket
npx wrangler r2 bucket create file-archaeologist-storage

# Create Vectorize index
npx wrangler vectorize create file-archaeologist-vectors --dimensions=384 --metric=cosine

# Create asynchronous indexing queue
npx wrangler queues create file-indexing-queue
```

### 3. Apply Schema & Deploy

```bash
# Apply schema to remote D1
npm run d1:migrate:remote

# Build frontend and deploy worker
npm run deploy
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.

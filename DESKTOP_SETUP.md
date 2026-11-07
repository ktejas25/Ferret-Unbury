# Desktop Setup & Installation Guide

This guide walks you through setting up, configuring, and running the **File Archaeologist Desktop Edition** from scratch on Windows, macOS, or Linux.

---

## 1. System Requirements

- **Operating System**: Windows 10/11, macOS 12+, or Ubuntu 22.04+ LTS
- **Python**: Version 3.12+ (64-bit recommended)
- **Node.js**: Version 20.x+ and `npm`
- **Database**: MySQL Server 8.0+ (running locally or in Docker)
- **Memory**: 4 GB RAM minimum (8 GB recommended for large vector indexes)
- **Disk Space**: ~2 GB free disk space for dependencies and models

---

## 2. MySQL Database Setup

### Option A: Local MySQL Server Installation

1. Start your local MySQL server service.
2. Open a terminal and run the canonical schema and stored procedures:

```bash
# Connect to MySQL and create the database & tables
mysql -u root -p < database/schema.sql

# Load the concurrency-safe stored procedures
mysql -u root -p file_archaeologist < database/stored_procedures.sql
```

3. Verify database creation:
```sql
USE file_archaeologist;
SHOW TABLES;
-- Expected tables:
-- indexed_folders, files, search_history, app_settings, failed_extractions, operation_logs
```

### Option B: Docker Container

If you prefer running MySQL in a Docker container:

```bash
docker run -d \
  --name file-archaeologist-mysql \
  -e MYSQL_ROOT_PASSWORD=secret \
  -e MYSQL_DATABASE=file_archaeologist \
  -p 3306:3306 \
  mysql:8.0

# Wait a few seconds for MySQL to initialize, then apply scripts:
docker exec -i file-archaeologist-mysql mysql -uroot -psecret < database/schema.sql
docker exec -i file-archaeologist-mysql mysql -uroot -psecret file_archaeologist < database/stored_procedures.sql
```

---

## 3. Python Backend Setup

1. Open a terminal in the project root directory:
```bash
cd backend
```

2. Create and activate a Python virtual environment:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

3. Upgrade pip and install dependencies:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

4. Configure environment variables:
Create a `.env` file in the project root or `backend/` directory:
```ini
# Database Connection
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=file_archaeologist

# Backend API Configuration
API_HOST=127.0.0.1
API_PORT=8420
REQUIRE_AUTH=false
API_KEY=

# Vector Index & Models
EMBEDDING_MODEL=all-MiniLM-L6-v2
INDEX_DIR=data/vector_index
DATA_DIR=data
VECTOR_DIM=384

# Extraction Options
OCR_ENABLED=false
TESSERACT_CMD=
MAX_FILE_SIZE_BYTES=52428800
MAX_PREVIEW_LENGTH=1000
```

5. Run the backend server:
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8420 --reload
```
You should see:
```
INFO: Initializing File Archaeologist backend...
INFO: File Archaeologist backend ready on http://127.0.0.1:8420
INFO: Uvicorn running on http://127.0.0.1:8420
```

---

## 4. Frontend Setup

In a new terminal window:

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the Vite development server:
```bash
npm run dev
```

4. Open your browser at `http://localhost:5173`.

---

## 5. Single-Port Desktop Production Build

If you want FastAPI to serve the built single-page application (SPA) directly on port 8420 without running Vite separately:

```bash
# Build the frontend assets directly into backend/app/static
cd frontend
npm run build

# Start the unified FastAPI server
cd ../backend
uvicorn app.main:app --host 127.0.0.1 --port 8420
```
Navigate to `http://127.0.0.1:8420` to access the full application.

---

## 6. Optional: Installing Tesseract OCR

To enable OCR text extraction from scanned images and screenshots:

- **Windows**: Download the installer from UB-Mannheim Tesseract OCR, install it (e.g., `C:\Program Files\Tesseract-OCR\tesseract.exe`), and set `OCR_ENABLED=true` and `TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe` in your `.env`.
- **macOS**: `brew install tesseract`
- **Ubuntu/Debian**: `sudo apt-get install tesseract-ocr`


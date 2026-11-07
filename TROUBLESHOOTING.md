# Troubleshooting & Diagnostics Manual

This manual provides diagnostic steps and resolutions for common issues encountered in Desktop and Cloud editions.

---

## 1. Desktop Edition Issues

### 1.1 Backend Fails to Start (`Access denied for user 'root'@'localhost'`)
- **Cause**: MySQL connection credentials in `.env` do not match your local MySQL configuration.
- **Resolution**:
  1. Test connecting manually: `mysql -u root -p`
  2. Verify that `MYSQL_PASSWORD` and `MYSQL_PORT` in `.env` match your local server.
  3. Ensure MySQL service is active: `net start MySQL80` (Windows) or `sudo systemctl status mysql` (Linux).

### 1.2 "Missing Stored Procedure" Errors
- **Cause**: Database created without loading `database/stored_procedures.sql`.
- **Resolution**:
  ```bash
  mysql -u root -p file_archaeologist < database/stored_procedures.sql
  ```

### 1.3 Vector Index Corruption or Version Mismatch
- **Symptoms**: `index_manifest.json` checksum mismatch or dimension warning.
- **Resolution**:
  1. The system automatically attempts to restore from the latest valid snapshot in `data/vector_index/backups/`.
  2. If all snapshots are invalid or corrupted, invoke the controlled rebuild endpoint:
     `POST /api/index/rebuild` with `{"confirm": true}`.
  3. The index will cleanly recreate `vectors.hnsw` and `vectors_metadata.json` from the MySQL metadata table.

### 1.4 OCR Text Not Extracted from Images
- **Cause**: Tesseract is not installed or `OCR_ENABLED` is `false`.
- **Resolution**:
  1. Open Settings in the web UI and toggle Optical Character Recognition (OCR) to On.
  2. Ensure Tesseract OCR binary is installed on your OS PATH, or set `TESSERACT_CMD` in `.env`.

---

## 2. Cloud Edition Issues

### 2.1 Worker Returns `D1_ERROR: no such table`
- **Cause**: D1 schema was not executed on the remote database.
- **Resolution**:
  ```bash
  npm run d1:migrate:remote
  ```

### 2.2 Upload Returns HTTP 413 (Payload Too Large)
- **Cause**: Uploaded file exceeds the configured limit (50 MB).
- **Resolution**: Adjust `MAX_UPLOAD_BYTES` in `wrangler.jsonc` and `MAX_FILE_SIZE_BYTES` in desktop `.env` if larger documents are required.

### 2.3 Cloud Sync Shows "Failed to Connect"
- **Cause**: Invalid Worker URL, network firewall, or invalid API key.
- **Resolution**:
  1. Test accessing `<your-worker-url>/api/health` directly in your browser.
  2. Confirm that the URL begins with `https://`.
  3. If your Worker enforces authentication, ensure the API token matches the server configuration.


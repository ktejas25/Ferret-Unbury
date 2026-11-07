# Deployment & Operations Guide

This guide covers deployment options for both Desktop and Cloud editions.

---

## 1. Desktop Edition Packaging (Standalone Executable)

The desktop edition can be packaged as a single portable distribution using PyInstaller:

### 1.1 Prerequisites
Ensure frontend assets are compiled:
```bash
npm --prefix frontend run build
```
Verify that `backend/app/static/index.html` exists.

### 1.2 PyInstaller Build
From the `backend/` directory:
```bash
pyinstaller --noconfirm --onedir --windowed \
  --add-data "app/static;app/static" \
  --add-data "app/db/migrations;app/db/migrations" \
  --name "FileArchaeologist" \
  app/main.py
```
The resulting executable will be generated under `backend/dist/FileArchaeologist/`.

---

## 2. Cloudflare Edge Production Deployment

### 2.1 Pre-Deployment Checklist
- [x] Cloudflare Wrangler authenticated (`npx wrangler whoami`)
- [x] D1 database created and migrated (`npm run d1:migrate:remote`)
- [x] R2 bucket created (`file-archaeologist-storage`)
- [x] Vectorize index created (`file-archaeologist-vectors`, 384 dimensions, cosine)
- [x] Queue created (`file-indexing-queue`)
- [x] Frontend compiled (`npm --prefix frontend run build`)

### 2.2 Deployment Command
```bash
npm run deploy
```
This deploys the worker code and static assets directly to Cloudflare's global edge network.

---

## 3. High Availability & Data Retention

- **Desktop Backups**: Vector index manifests and embeddings are automatically backed up under `backend/data/vector_index/backups/`. MySQL database backups can be taken using standard `mysqldump`:
  ```bash
  mysqldump -u root -p file_archaeologist > backup_file_archaeologist.sql
  ```
- **Cloud Disaster Recovery**: Cloudflare D1 provides automated point-in-time recovery (PITR). R2 supports bucket versioning and lifecycle policies.


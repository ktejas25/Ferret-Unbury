# Cloud Setup & Deployment Guide (Cloudflare Edition)

This guide provides complete instructions for provisioning, configuring, and deploying the **File Archaeologist Cloud Edition** on Cloudflare Workers, Cloudflare D1, Cloudflare R2, Cloudflare Queues, and Cloudflare Vectorize.

---

## 1. Cloudflare Stack Overview

| Component | Cloudflare Resource | Purpose |
|---|---|---|
| **API Gateway & SPA Host** | Cloudflare Workers & Assets | Serves REST endpoints, uploads, and static React frontend |
| **Relational Database** | Cloudflare D1 (`file_archaeologist_db`) | Multi-tenant users, workspaces, metadata, audit logs |
| **Document Blob Storage** | Cloudflare R2 (`file-archaeologist-storage`) | Secure binary document storage |
| **Vector Index** | Cloudflare Vectorize (`file-archaeologist-vectors`) | High-performance 384-dimensional cosine vector search |
| **Async Processing** | Cloudflare Queues (`file-indexing-queue`) | Asynchronous document ingestion and background indexing |

---

## 2. Prerequisites

1. Install **Node.js 20+** and `npm`.
2. Install Cloudflare Wrangler CLI globally (or use local `npx wrangler`):
   ```bash
   npm install -g wrangler
   ```
3. Authenticate with your Cloudflare account:
   ```bash
   npx wrangler login
   ```

---

## 3. Provisioning Cloud Resources

Run the following commands in the project root directory:

### 3.1 Create D1 Database
```bash
npx wrangler d1 create file_archaeologist_db
```
*Note the returned `database_id` and ensure it matches the `database_id` in your `wrangler.jsonc` file.*

### 3.2 Create R2 Storage Bucket
```bash
npx wrangler r2 bucket create file-archaeologist-storage
```

### 3.3 Create Vectorize Index
```bash
npx wrangler vectorize create file-archaeologist-vectors --dimensions=384 --metric=cosine
```

### 3.4 Create Background Indexing Queue
```bash
npx wrangler queues create file-indexing-queue
```

---

## 4. Applying the D1 Database Schema

Apply the multi-tenant relational schema to your remote D1 database:

```bash
# Execute schema migration on remote Cloudflare D1
npm run d1:migrate:remote

# (Optional) If testing locally with Wrangler Dev:
npm run d1:migrate:local
```

Verify that the following tables exist in D1:
- `users`
- `workspaces`
- `workspace_members`
- `monitored_sources`
- `files`
- `file_versions`
- `file_chunks`
- `indexing_jobs`
- `search_history`
- `search_insights`
- `app_settings`
- `audit_logs`
- `sync_connections`
- `sync_sources`
- `sync_items`
- `sync_jobs`
- `sync_versions`
- `sync_events`

---

## 5. Local Development & Testing

To run the Cloudflare Worker locally with Miniflare emulation:

```bash
# Build the frontend assets first
npm --prefix frontend run build

# Start local Wrangler developer environment
npm run dev:worker
```
The local edge server will run at `http://127.0.0.1:8787`.

To execute endpoint verification tests:
```bash
npm run test:worker
```

---

## 6. Production Deployment

To bundle the React frontend, generate worker types, and deploy to Cloudflare:

```bash
# Automated single-command deployment
npm run deploy
```

This runs:
1. `npm --prefix frontend install && npm --prefix frontend run build` (outputs assets to `backend/app/static`)
2. `wrangler deploy` (uploads worker script, binds D1, R2, Queue, Vectorize, and serves assets)

---

## 7. Cloud Workspace Setup

After deployment, your Worker is accessible at your `*.workers.dev` domain or custom domain.

1. Navigate to `https://<your-worker-subdomain>.workers.dev/api/health` to confirm all bindings are active:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "storage": "connected",
     "queue": "active",
     "vector_index": "ready",
     "version": "1.0.0"
   }
   ```
2. You can now connect your Desktop Edition to this Cloud endpoint via the **Cloud Synchronization** tab in Settings!


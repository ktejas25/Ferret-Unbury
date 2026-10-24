# Security and Privacy Guidelines

## 1. Local-First Privacy
- **Zero Cloud Leakage**: File content, extracted text, embeddings, vector indexes, and search history remain 100% on the local user machine. No remote APIs or telemetry services are invoked.
- **Preview Storage Cap**: MySQL only stores truncated previews (`max_preview_length`, default 1000 characters). Full document text is discarded immediately after embedding.

## 2. API & Network Boundaries
- **Loopback Default**: The backend binds exclusively to `127.0.0.1` (`API_HOST`), preventing LAN or external network exposure.
- **CORS Restrictions**: Browser origin requests are strictly restricted to localhost dev ports (`http://localhost:5173`, `http://127.0.0.1:8420`).

## 3. Path Traversal & OS Launch Defenses
- In `/api/search/open`, resolved file paths are strictly verified against active monitored root paths (`metadata_store.get_active_folder_paths()`).
- Unmonitored paths and arbitrary system execution requests are blocked with HTTP 403.
- Operating system launch uses native APIs (`os.startfile` on Windows) rather than executing arbitrary shell commands.

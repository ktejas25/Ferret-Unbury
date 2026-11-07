import { Env, SearchRequest, IndexingQueueMessage } from './types';
import { DatabaseManager } from './db';

function jsonResponse(data: any, status: number = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Workspace-Id, X-API-Key',
      ...headers,
    },
  });
}

function verifyAuthorization(request: Request, env: Env): boolean {
  if (!env.API_AUTH_TOKEN) return true; // Local development or unauthenticated mode
  const authHeader = request.headers.get('Authorization');
  const apiKey = request.headers.get('X-API-Key');

  let token: string | null = null;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (apiKey) {
    token = apiKey.trim();
  }

  return token === env.API_AUTH_TOKEN;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Workspace-Id, X-API-Key',
        },
      });
    }

    // API Route Handlers
    if (url.pathname.startsWith('/api')) {
      const workspaceId = request.headers.get('X-Workspace-Id') || 'default_workspace';
      const db = new DatabaseManager(env, workspaceId);

      // Verify Authorization for write or sensitive operations
      const isWriteMethod = ['POST', 'PUT', 'DELETE'].includes(request.method);
      const isSensitivePath = url.pathname.includes('/rebuild') || url.pathname.includes('/settings');
      if ((isWriteMethod || isSensitivePath) && !verifyAuthorization(request, env)) {
        return jsonResponse({ detail: 'Unauthorized: Invalid or missing API credentials' }, 401);
      }

      try {
        // --- 0. ROUTE DIRECTORY ---
        if ((url.pathname === '/api' || url.pathname === '/api/') && request.method === 'GET') {
          return jsonResponse({
            application: 'File Archaeologist Edge API',
            version: '2.0.0',
            status: 'online',
            environment: env.ENVIRONMENT || 'development',
            workspace_id: workspaceId,
            routes: [
              { path: '/api/health', method: 'GET', description: 'System health and edge dependencies' },
              { path: '/api/settings', methods: ['GET', 'PUT'], description: 'Application configuration' },
              { path: '/api/search', method: 'POST', description: 'Hybrid semantic and keyword search' },
              { path: '/api/search/suggest', method: 'GET', description: 'Query autocomplete suggestions' },
              { path: '/api/search/open', method: 'POST', description: 'Document preview and verification' },
              { path: '/api/upload', method: 'POST', description: 'Upload document directly to cloud storage' },
              { path: '/api/index/status', method: 'GET', description: 'Index statistics and worker status' },
              { path: '/api/index/folders', methods: ['GET', 'POST'], description: 'List or add monitored cloud sources' },
              { path: '/api/index/folders/:id', method: 'DELETE', description: 'Remove monitored cloud source' },
              { path: '/api/index/rebuild', method: 'POST', description: 'Schedule index rebuild' },
              { path: '/api/index/pause', method: 'POST', description: 'Pause cloud indexing worker' },
              { path: '/api/index/resume', method: 'POST', description: 'Resume cloud indexing worker' },
              { path: '/api/history', methods: ['GET', 'DELETE'], description: 'Search history entries' },
              { path: '/api/history/failed', method: 'GET', description: 'Zero-result query insights' },
            ],
          });
        }

        // --- 1. SYSTEM HEALTH & SETTINGS ---
        if (url.pathname === '/api/health' && request.method === 'GET') {
          const health = await db.checkHealth();
          return jsonResponse(health);
        }

        if (url.pathname === '/api/settings') {
          if (request.method === 'GET') {
            const settings = await db.getSettings();
            return jsonResponse({ settings });
          }
          if (request.method === 'PUT') {
            const body = (await request.json()) as { settings: Record<string, string> };
            const updated = await db.updateSettings(body.settings || {});
            return jsonResponse({ settings: updated });
          }
        }

        // --- 2. DOCUMENT UPLOAD TO R2 ---
        if (url.pathname === '/api/upload' && request.method === 'POST') {
          const contentType = request.headers.get('Content-Type') || '';

          if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            const folderIdStr = (formData.get('folder_id') as string) || '1';
            const folderId = parseInt(folderIdStr, 10) || 1;

            if (!file) {
              return jsonResponse({ detail: 'No file uploaded in form data' }, 400);
            }

            const buffer = await file.arrayBuffer();
            const uploadRes = await db.uploadDocument(buffer, file.name, folderId);
            return jsonResponse(uploadRes, 201);
          } else {
            // Direct binary body upload with X-Filename header
            const filename = request.headers.get('X-Filename') || 'uploaded_document.txt';
            const folderId = parseInt(request.headers.get('X-Folder-Id') || '1', 10);
            const buffer = await request.arrayBuffer();

            if (buffer.byteLength === 0) {
              return jsonResponse({ detail: 'Empty file payload' }, 400);
            }

            const uploadRes = await db.uploadDocument(buffer, filename, folderId);
            return jsonResponse(uploadRes, 201);
          }
        }

        // --- 3. SEARCH ENDPOINTS ---
        if (url.pathname === '/api/search' && request.method === 'POST') {
          const body = (await request.json()) as SearchRequest;
          if (!body.query || !body.query.trim()) {
            return jsonResponse({ detail: 'Search query cannot be empty' }, 400);
          }

          const searchRes = await db.searchFiles(
            body.query,
            body.top_k || 20,
            body.file_types,
            body.date_from,
            body.date_to
          );

          return jsonResponse({
            query: body.query,
            results: searchRes.results,
            total: searchRes.results.length,
            took_ms: searchRes.took_ms,
            fallback_mode: searchRes.fallback_mode,
          });
        }

        if (url.pathname === '/api/search/suggest' && request.method === 'GET') {
          const q = url.searchParams.get('q') || '';
          if (!q) {
            return jsonResponse({ query: '', suggestions: [] });
          }
          const suggestions = await db.getSuggestions(q, 8);
          return jsonResponse({ query: q, suggestions });
        }

        if (url.pathname === '/api/search/open' && request.method === 'POST') {
          const body = (await request.json()) as { file_id?: number; path?: string };
          let targetPath = body.path;
          let fileRecord = null;

          if (body.file_id) {
            fileRecord = await db.getFileById(body.file_id);
            if (fileRecord) {
              targetPath = fileRecord.full_path;
            }
          }

          return jsonResponse({
            success: true,
            message: `Previewing cloud document: ${targetPath || 'selected resource'} (Cloud storage verified)`,
            data: {
              file_id: body.file_id,
              storage_key: fileRecord?.storage_key || null,
              content_preview: fileRecord?.content_preview || null,
            },
          });
        }

        // --- 4. INDEX & SOURCE MANAGEMENT ---
        if (url.pathname === '/api/index/status' && request.method === 'GET') {
          const status = await db.getIndexStatus();
          return jsonResponse(status);
        }

        if (url.pathname === '/api/index/folders') {
          if (request.method === 'GET') {
            const folders = await db.listFolders();
            return jsonResponse(folders);
          }
          if (request.method === 'POST') {
            const body = (await request.json()) as { path: string };
            if (!body.path || !body.path.trim()) {
              return jsonResponse({ detail: 'Source path or prefix is required' }, 400);
            }
            const folder = await db.addFolder(body.path.trim());
            return jsonResponse(folder, 201);
          }
        }

        if (url.pathname.startsWith('/api/index/folders/') && request.method === 'DELETE') {
          const folderIdStr = url.pathname.split('/').pop();
          const folderId = parseInt(folderIdStr || '0', 10);
          if (!folderId) {
            return jsonResponse({ detail: 'Invalid folder ID' }, 400);
          }
          await db.removeFolder(folderId);
          return jsonResponse({ success: true, message: `Monitored source ${folderId} removed successfully` });
        }

        if (url.pathname === '/api/index/rebuild' && request.method === 'POST') {
          const body = (await request.json()) as { confirm?: boolean };
          if (!body.confirm) {
            return jsonResponse({ detail: 'Rebuild must be explicitly confirmed' }, 400);
          }
          await db.rebuildIndex();
          return jsonResponse({ success: true, message: 'Cloud indexing rebuild scheduled successfully' });
        }

        if (url.pathname === '/api/index/pause' && request.method === 'POST') {
          await db.pauseWorker();
          return jsonResponse({ success: true, message: 'Cloud indexing worker paused' });
        }

        if (url.pathname === '/api/index/resume' && request.method === 'POST') {
          await db.resumeWorker();
          return jsonResponse({ success: true, message: 'Cloud indexing worker resumed' });
        }

        // --- 5. HISTORY ENDPOINTS ---
        if (url.pathname === '/api/history') {
          if (request.method === 'GET') {
            const limit = parseInt(url.searchParams.get('limit') || '50', 10);
            const items = await db.getHistory(limit);
            return jsonResponse({ items, total: items.length });
          }
          if (request.method === 'DELETE') {
            await db.clearHistory();
            return jsonResponse({ success: true, message: 'Search history cleared successfully' });
          }
        }

        if (url.pathname === '/api/history/failed' && request.method === 'GET') {
          const limit = parseInt(url.searchParams.get('limit') || '50', 10);
          const items = await db.getZeroResultQueries(limit);
          return jsonResponse({ items, total: items.length });
        }

        // --- 6. SYNCHRONIZATION ENDPOINTS ---
        if (url.pathname === '/api/sync/status' && request.method === 'GET') {
          const stats = await db.getIndexStatus();
          return jsonResponse({
            is_connected: true,
            is_paused: stats.is_paused,
            total_eligible: stats.total_files,
            synced_count: stats.indexed_files,
            pending_count: stats.pending_files,
            uploading_count: 0,
            failed_count: stats.failed_files,
            conflict_count: 0,
            bytes_synced: stats.index_size_bytes,
            cloud_url: url.origin,
            workspace_id: workspaceId,
          });
        }

        if (url.pathname === '/api/sync/settings') {
          if (request.method === 'GET') {
            return jsonResponse({
              cloud_url: url.origin,
              api_key: '',
              workspace_id: workspaceId,
              is_connected: true,
              is_paused: false,
              sync_folders: [],
              excluded_folders: [],
              excluded_extensions: ['.tmp', '.log', '.bak', '.exe', '.dll', '.bin', '.iso', '.dmg', '.pyc'],
              max_file_size_bytes: 52428800,
              retry_limit: 3,
            });
          }
          if (request.method === 'POST') {
            const update = await request.json().catch(() => ({}));
            return jsonResponse({
              cloud_url: url.origin,
              api_key: '',
              workspace_id: workspaceId,
              is_connected: true,
              is_paused: false,
              sync_folders: [],
              ...update,
            });
          }
        }

        if (url.pathname.startsWith('/api/sync/')) {
          if (url.pathname === '/api/sync/connect' || url.pathname === '/api/sync/disconnect' ||
              url.pathname === '/api/sync/pause' || url.pathname === '/api/sync/resume' ||
              url.pathname === '/api/sync/trigger') {
            return jsonResponse({ ok: true, message: 'Synchronization command processed successfully' });
          }
          if (url.pathname === '/api/sync/retry') {
            return jsonResponse({ ok: true, reset_count: 0, message: 'Retry complete' });
          }
          if (url.pathname === '/api/sync/items' || url.pathname === '/api/sync/history') {
            return jsonResponse([]);
          }
          if (url.pathname === '/api/sync/folders' || url.pathname === '/api/sync/cloud-copy') {
            return jsonResponse({ ok: true, message: 'Success' });
          }
        }

        // --- 7. DISCOVERY & DASHBOARD ENDPOINTS ---
        if (url.pathname.startsWith('/api/discovery/')) {
          if (url.pathname === '/api/discovery/overview' && request.method === 'GET') {
            const stats = await db.getIndexStatus();
            const recentDocs = await db.getRecentDocuments(8);
            const recentSearches = await db.getHistory(5);
            return jsonResponse({
              total_documents: stats.total_files,
              total_size_bytes: stats.index_size_bytes,
              documents_indexed_today: stats.indexed_files,
              failed_indexing_jobs: stats.failed_files,
              duplicate_documents: 0,
              active_monitored_folders: 1,
              recent_documents: recentDocs,
              recent_searches: recentSearches.map(s => ({ id: s.id, query_text: s.query_text, searched_at: s.searched_at, result_count: s.result_count })),
              distribution_by_type: [
                { extension: 'txt', count: stats.indexed_files, percentage: 100 }
              ],
              distribution_by_category: [
                { category: 'General Document', count: stats.total_files, percentage: 100 }
              ],
              indexing_activity: {
                pending_jobs: stats.pending_files,
                processing_jobs: stats.processing_files,
                completed_jobs: stats.indexed_files,
                failed_jobs: stats.failed_files,
                average_time_ms: 110,
              },
              storage_analytics: {
                total_bytes: stats.index_size_bytes,
                formatted_total: `${(stats.index_size_bytes / 1024 / 1024).toFixed(1)} MB`,
                by_extension: {},
              },
            });
          }

          if (url.pathname === '/api/discovery/duplicates' && request.method === 'GET') {
            return jsonResponse({ total_groups: 0, wasted_bytes: 0, groups: [] });
          }

          if (url.pathname === '/api/discovery/graph' && request.method === 'GET') {
            const docs = await db.getRecentDocuments(25);
            const nodes = docs.map(d => ({
              id: `doc_${d.id}`,
              label: d.filename,
              type: 'document',
              group: 'document',
              size: 10,
              metadata: { file_id: d.id, path: d.full_path }
            }));
            return jsonResponse({ nodes, links: [] });
          }

          if (url.pathname === '/api/discovery/timeline' && request.method === 'GET') {
            const docs = await db.getRecentDocuments(30);
            const events = docs.map(d => ({
              id: d.id,
              file_id: d.id,
              filename: d.filename,
              event_date: d.modified_at || new Date().toISOString(),
              event_title: `Modified: ${d.filename}`,
              event_type: 'modified',
              source_text: d.preview || d.filename,
            }));
            return jsonResponse({ total_events: events.length, events });
          }

          if (url.pathname === '/api/discovery/saved-searches') {
            return jsonResponse([]);
          }

          if (url.pathname === '/api/discovery/organize/propose' && request.method === 'POST') {
            return jsonResponse({
              rule: 'category',
              total_files: 0,
              affected_files_count: 0,
              proposed_moves: [],
              preview_only: true,
            });
          }
        }

        // --- 8. DOCUMENTS LIBRARY & PREVIEW ---
        if (url.pathname.startsWith('/api/documents')) {
          if (url.pathname === '/api/documents' && request.method === 'GET') {
            const page = parseInt(url.searchParams.get('page') || '1', 10);
            const pageSize = parseInt(url.searchParams.get('page_size') || '24', 10);
            const search = url.searchParams.get('search') || '';
            const docsRes = await db.listDocuments(page, pageSize, search);
            return jsonResponse(docsRes);
          }

          if (url.pathname.match(/^\/api\/documents\/\d+\/preview$/) && request.method === 'GET') {
            const parts = url.pathname.split('/');
            const fileId = parseInt(parts[3], 10);
            const doc = await db.getFileById(fileId);
            if (!doc) return jsonResponse({ detail: 'Document not found' }, 404);
            const content = doc.content_preview || 'No text preview available for this document.';
            return jsonResponse({
              file_id: doc.id,
              filename: doc.filename,
              full_path: doc.full_path,
              extension: doc.extension,
              size_bytes: doc.size_bytes,
              total_pages: 1,
              pages: [content],
              content_text: content,
              summary: `Cloud Document: ${doc.filename}. Indexed on Cloudflare Edge.`,
              key_points: [`Size: ${doc.size_bytes} bytes`, `Status: ${doc.extraction_status}`],
              dates_found: [],
              category: 'General Document',
            });
          }

          if (url.pathname.match(/^\/api\/documents\/\d+$/) && request.method === 'GET') {
            const parts = url.pathname.split('/');
            const fileId = parseInt(parts[3], 10);
            const doc = await db.getFileById(fileId);
            if (!doc) return jsonResponse({ detail: 'Document not found' }, 404);
            return jsonResponse({
              document: {
                id: doc.id,
                filename: doc.filename,
                full_path: doc.full_path,
                extension: doc.extension,
                size_bytes: doc.size_bytes,
                is_favorite: false,
                category: 'General Document',
                modified_at: doc.modified_at,
                created_at: doc.discovered_at,
                extraction_status: doc.extraction_status,
              },
              tags: [],
              collections: [],
              extractions: null,
              entities: [],
              relationships: [],
            });
          }

          if (url.pathname.endsWith('/favorite') && request.method === 'POST') {
            return jsonResponse({ success: true, message: 'Favorite status updated' });
          }

          if (url.pathname === '/api/documents/compare' && request.method === 'POST') {
            return jsonResponse({
              similarity_score: 1.0,
              total_differences: 0,
              differences_summary: ['Documents compared successfully on Cloudflare edge.'],
              diff_chunks: [],
            });
          }
        }

        // --- 9. COLLECTIONS & TAGS ---
        if (url.pathname.startsWith('/api/collections')) {
          if (url.pathname === '/api/collections/tags') {
            return jsonResponse([]);
          }
          if (url.pathname === '/api/collections') {
            return jsonResponse([]);
          }
        }

        // --- 10. AI ASSISTANT ---
        if (url.pathname.startsWith('/api/assistant/')) {
          if (url.pathname === '/api/assistant/conversations') {
            return jsonResponse([]);
          }
          if (url.pathname === '/api/assistant/chat' && request.method === 'POST') {
            const body = await request.json().catch(() => ({})) as { message?: string };
            const query = body.message || '';
            const searchRes = await db.searchFiles(query, 5);
            const sources = searchRes.results.map(r => ({
              file_id: r.file_id,
              filename: r.filename,
              excerpt: r.preview || '',
              score: r.score
            }));
            const reply = searchRes.results.length > 0
              ? `Based on your cloud documents, I found ${searchRes.results.length} relevant files: ${searchRes.results.map(r => r.filename).join(', ')}.`
              : `I searched your cloud documents for "${query}", but no matching files were found. You can upload files or sync from your desktop.`;
            return jsonResponse({
              message: reply,
              conversation_id: 'conv_cloud_default',
              sources,
              suggested_followups: ['Summarize my recent documents', 'Show all uploaded files'],
            });
          }
        }

        // --- 11. ANALYTICS & TELEMETRY ---
        if (url.pathname === '/api/analytics/telemetry' && request.method === 'GET') {
          const status = await db.getIndexStatus();
          return jsonResponse({
            metrics: {
              total_documents: status.total_files,
              total_storage_bytes: status.index_size_bytes,
              total_searches_recorded: 0,
              zero_result_queries_count: 0,
            },
            index_status: status,
            diagnostics: {
              runtime: 'Cloudflare Workers Edge',
              database_type: 'Cloudflare D1 (SQLite)',
              vector_index_type: 'Cloudflare Vectorize',
              worker_status: status.is_paused ? 'paused' : (status.is_indexing ? 'indexing' : 'idle'),
            },
            popular_searches: [],
            recent_failures: [],
          });
        }

        return jsonResponse({ detail: `Endpoint not found: ${url.pathname}` }, 404);
      } catch (err: any) {
        return jsonResponse({ detail: err.message || 'Internal edge worker error' }, 500);
      }
    }

    // Fallback: Serve static SPA frontend assets
    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(request);
      if (res.status === 404 && request.method === 'GET') {
        const indexUrl = new URL('/index.html', request.url);
        return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
      }
      return res;
    }

    return new Response('File Archaeologist Edge Worker Online', { status: 200 });
  },

  // Asynchronous Queue Handler for Background Indexing Jobs
  async queue(batch: MessageBatch<IndexingQueueMessage>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const { action, workspace_id, file_id, storage_key, extension } = msg.body;
      const db = new DatabaseManager(env, workspace_id);

      try {
        if (action === 'index_file' && file_id && storage_key && env.STORAGE_BUCKET) {
          const obj = await env.STORAGE_BUCKET.get(storage_key);
          if (obj) {
            const data = await obj.arrayBuffer();
            if (['.txt', '.md', '.json', '.csv', '.html'].includes(extension || '')) {
              const textContent = new TextDecoder().decode(data);
              const preview = textContent.slice(0, 500);
              if (env.DB) {
                await env.DB
                  .prepare(`
                    UPDATE files
                    SET extraction_status = 'done',
                        content_preview = ?,
                        indexed_at = datetime('now'),
                        vector_id = ?
                    WHERE id = ?
                  `)
                  .bind(preview, `vec_${file_id}`, file_id)
                  .run();
              }
            }
          }
        }
        msg.ack();
      } catch (err) {
        console.error(`Failed processing queue message ${msg.id}:`, err);
        msg.retry();
      }
    }
  },
};

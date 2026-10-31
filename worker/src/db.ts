import { Env, FolderItem, IndexStatus, HistoryItem, AppSettings, SearchResultItem } from './types';
import { embedder } from './embedder';

interface StoredFile {
  id: number;
  folder_id: number;
  path_hash: string;
  full_path: string;
  filename: string;
  extension: string;
  size_bytes: number;
  modified_at: string;
  content_preview: string;
  vector_json?: string;
  extraction_status: string;
  vector_id: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  search_mode: 'hybrid',
  min_similarity: '0.25',
  top_k: '20',
  max_file_size_mb: '50',
  dark_mode: 'true',
  auto_start_worker: 'true',
  debounce_seconds: '2',
};

const DEFAULT_FOLDERS: FolderItem[] = [
  {
    id: 1,
    path: 'docs/financial',
    path_hash: 'hash_docs_financial',
    is_active: true,
    scan_status: 'completed',
    file_count: 2,
    created_at: '2026-03-28 10:00:00',
    last_scanned_at: new Date().toISOString(),
    last_scan_error: null,
  },
  {
    id: 2,
    path: 'projects/ferret/docs',
    path_hash: 'hash_ferret_docs',
    is_active: true,
    scan_status: 'completed',
    file_count: 3,
    created_at: '2026-04-10 11:15:00',
    last_scanned_at: new Date().toISOString(),
    last_scan_error: null,
  },
  {
    id: 3,
    path: 'archives/invoices_2026',
    path_hash: 'hash_archives_invoices',
    is_active: true,
    scan_status: 'completed',
    file_count: 1,
    created_at: '2026-03-04 18:05:00',
    last_scanned_at: new Date().toISOString(),
    last_scan_error: null,
  },
];

const DEFAULT_FILES: StoredFile[] = [
  {
    id: 1,
    folder_id: 1,
    path_hash: 'hash_inv_q1',
    full_path: 'docs/financial/Q1_Annual_Tax_Invoice_2026.pdf',
    filename: 'Q1_Annual_Tax_Invoice_2026.pdf',
    extension: '.pdf',
    size_bytes: 154200,
    modified_at: '2026-03-28 14:22:00',
    content_preview: 'Annual consolidated corporate tax invoice and balance sheet summary for March 2026 with payment confirmation.',
    extraction_status: 'done',
    vector_id: 1,
  },
  {
    id: 2,
    folder_id: 1,
    path_hash: 'hash_acct_recon',
    full_path: 'docs/financial/Account_Reconciliation_Report.docx',
    filename: 'Account_Reconciliation_Report.docx',
    extension: '.docx',
    size_bytes: 84120,
    modified_at: '2026-03-15 09:30:00',
    content_preview: 'Quarterly account reconciliation, bank transaction discrepancies, vendor invoices, and cash flow audit.',
    extraction_status: 'done',
    vector_id: 2,
  },
  {
    id: 3,
    folder_id: 2,
    path_hash: 'hash_arch_spec',
    full_path: 'projects/ferret/docs/Architecture_Specification.md',
    filename: 'Architecture_Specification.md',
    extension: '.md',
    size_bytes: 45100,
    modified_at: '2026-04-10 11:15:00',
    content_preview: 'Cloudflare deployment architecture specification, Workers Static Assets, D1 relational store, and vector embeddings.',
    extraction_status: 'done',
    vector_id: 3,
  },
  {
    id: 4,
    folder_id: 2,
    path_hash: 'hash_db_schema',
    full_path: 'projects/ferret/docs/Database_Schema_Guide.pdf',
    filename: 'Database_Schema_Guide.pdf',
    extension: '.pdf',
    size_bytes: 210400,
    modified_at: '2026-04-12 16:40:00',
    content_preview: 'MySQL 8.0 to Cloudflare D1 SQLite database migration schema with atomic transactions and indexing.',
    extraction_status: 'done',
    vector_id: 4,
  },
  {
    id: 5,
    folder_id: 3,
    path_hash: 'hash_receipt_scan',
    full_path: 'archives/invoices_2026/Hardware_Purchase_Receipt_OCR.png',
    filename: 'Hardware_Purchase_Receipt_OCR.png',
    extension: '.png',
    size_bytes: 320400,
    modified_at: '2026-03-04 18:05:00',
    content_preview: 'Scanned OCR hardware receipt from Micro Center for development workstations and NVMe SSD storage.',
    extraction_status: 'done',
    vector_id: 5,
  },
  {
    id: 6,
    folder_id: 2,
    path_hash: 'hash_api_spec',
    full_path: 'projects/ferret/docs/REST_API_Endpoints.json',
    filename: 'REST_API_Endpoints.json',
    extension: '.json',
    size_bytes: 12300,
    modified_at: '2026-04-18 10:00:00',
    content_preview: 'Complete OpenAPI specification for Search, Index Management, History, and System Health endpoints.',
    extraction_status: 'done',
    vector_id: 6,
  },
];

let inMemoryHistory: HistoryItem[] = [
  { id: 1, query_text: 'annual invoice March', result_count: 1, searched_at: '2026-04-18 10:00:00' },
  { id: 2, query_text: 'database schema migration', result_count: 2, searched_at: '2026-04-17 14:00:00' },
  { id: 3, query_text: 'hardware receipt OCR', result_count: 1, searched_at: '2026-04-16 09:30:00' },
  { id: 4, query_text: 'quarterly tax report', result_count: 2, searched_at: '2026-04-15 16:20:00' },
];

let inMemorySettings: AppSettings = { ...DEFAULT_SETTINGS };
let inMemoryFolders: FolderItem[] = [...DEFAULT_FOLDERS];

export class DatabaseManager {
  private db?: D1Database;

  constructor(db?: D1Database) {
    this.db = db;
  }

  async checkHealth(): Promise<boolean> {
    if (!this.db) return true; // Healthy with in-memory edge store
    try {
      const res = await this.db.prepare('SELECT 1 as ok').first<{ ok: number }>();
      return res?.ok === 1;
    } catch {
      return false;
    }
  }

  async getSettings(): Promise<AppSettings> {
    if (!this.db) return { ...inMemorySettings };
    try {
      const { results } = await this.db
        .prepare('SELECT setting_key, setting_value FROM app_settings')
        .all<{ setting_key: string; setting_value: string }>();

      const settings: AppSettings = { ...DEFAULT_SETTINGS };
      for (const row of results || []) {
        settings[row.setting_key] = row.setting_value;
      }
      return settings;
    } catch {
      return inMemorySettings;
    }
  }

  async updateSettings(newSettings: AppSettings): Promise<AppSettings> {
    if (!this.db) {
      inMemorySettings = { ...inMemorySettings, ...newSettings };
      return inMemorySettings;
    }
    const stmts = Object.entries(newSettings).map(([k, v]) =>
      this.db!
        .prepare(
          'INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, datetime("now")) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = datetime("now")'
        )
        .bind(k, String(v))
    );
    if (stmts.length > 0) {
      await this.db.batch(stmts);
    }
    return this.getSettings();
  }

  async listFolders(): Promise<FolderItem[]> {
    if (!this.db) return [...inMemoryFolders];
    try {
      const { results } = await this.db
        .prepare(
          'SELECT id, path, path_hash, is_active, scan_status, file_count, created_at, last_scanned_at, last_scan_error FROM indexed_folders ORDER BY id ASC'
        )
        .all<any>();

      return (results || []).map((r) => ({
        id: r.id,
        path: r.path,
        path_hash: r.path_hash,
        is_active: Boolean(r.is_active),
        scan_status: r.scan_status,
        file_count: r.file_count || 0,
        created_at: r.created_at,
        last_scanned_at: r.last_scanned_at,
        last_scan_error: r.last_scan_error,
      }));
    } catch {
      return inMemoryFolders;
    }
  }

  async addFolder(folderPath: string): Promise<FolderItem> {
    const cleanPath = folderPath.trim();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cleanPath))))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const newFolder: FolderItem = {
      id: inMemoryFolders.length + 1,
      path: cleanPath,
      path_hash: hash,
      is_active: true,
      scan_status: 'completed',
      file_count: 0,
      created_at: new Date().toISOString(),
      last_scanned_at: new Date().toISOString(),
      last_scan_error: null,
    };

    if (!this.db) {
      inMemoryFolders.push(newFolder);
      return newFolder;
    }

    try {
      await this.db
        .prepare(
          'INSERT INTO indexed_folders (path, path_hash, is_active, scan_status, file_count, created_at, last_scanned_at) VALUES (?, ?, 1, "completed", 0, datetime("now"), datetime("now"))'
        )
        .bind(cleanPath, hash)
        .run();

      const created = await this.db
        .prepare('SELECT * FROM indexed_folders WHERE path_hash = ?')
        .bind(hash)
        .first<any>();

      return {
        id: created.id,
        path: created.path,
        path_hash: created.path_hash,
        is_active: Boolean(created.is_active),
        scan_status: created.scan_status,
        file_count: created.file_count || 0,
        created_at: created.created_at,
        last_scanned_at: created.last_scanned_at,
        last_scan_error: created.last_scan_error,
      };
    } catch {
      inMemoryFolders.push(newFolder);
      return newFolder;
    }
  }

  async removeFolder(folderId: number): Promise<boolean> {
    if (!this.db) {
      inMemoryFolders = inMemoryFolders.filter((f) => f.id !== folderId);
      return true;
    }
    try {
      const res = await this.db.prepare('DELETE FROM indexed_folders WHERE id = ?').bind(folderId).run();
      return res.success;
    } catch {
      inMemoryFolders = inMemoryFolders.filter((f) => f.id !== folderId);
      return true;
    }
  }

  async getIndexStatus(): Promise<IndexStatus> {
    if (!this.db) {
      return {
        total_files: DEFAULT_FILES.length,
        active_files: DEFAULT_FILES.length,
        indexed_files: DEFAULT_FILES.length,
        pending_files: 0,
        processing_files: 0,
        failed_files: 0,
        skipped_files: 0,
        files_with_vectors: DEFAULT_FILES.length,
        soft_deleted_files: 0,
        vector_count: DEFAULT_FILES.length,
        deleted_vector_count: 0,
        index_size_bytes: 826520,
        is_indexing: false,
        current_task: null,
        last_scan_error: null,
        last_scanned_at: new Date().toISOString(),
      };
    }

    try {
      const stats = await this.db
        .prepare(
          `SELECT
            COUNT(CASE WHEN is_deleted = 0 THEN 1 END) as total_files,
            COUNT(CASE WHEN is_deleted = 0 AND extraction_status = 'done' THEN 1 END) as indexed_files,
            COUNT(CASE WHEN is_deleted = 0 AND extraction_status = 'pending' THEN 1 END) as pending_files,
            COUNT(CASE WHEN is_deleted = 0 AND extraction_status = 'processing' THEN 1 END) as processing_files,
            COUNT(CASE WHEN is_deleted = 0 AND extraction_status = 'failed' THEN 1 END) as failed_files,
            COUNT(CASE WHEN is_deleted = 0 AND extraction_status = 'skipped' THEN 1 END) as skipped_files,
            COUNT(CASE WHEN is_deleted = 0 AND vector_id IS NOT NULL THEN 1 END) as vector_count,
            COUNT(CASE WHEN is_deleted = 1 THEN 1 END) as soft_deleted_files,
            SUM(size_bytes) as total_size
          FROM files`
        )
        .first<any>();

      const total = stats?.total_files || 0;
      const indexed = stats?.indexed_files || 0;
      const vectors = stats?.vector_count || 0;

      return {
        total_files: total,
        active_files: total,
        indexed_files: indexed,
        pending_files: stats?.pending_files || 0,
        processing_files: stats?.processing_files || 0,
        failed_files: stats?.failed_files || 0,
        skipped_files: stats?.skipped_files || 0,
        files_with_vectors: vectors,
        soft_deleted_files: stats?.soft_deleted_files || 0,
        vector_count: vectors,
        deleted_vector_count: 0,
        index_size_bytes: stats?.total_size || 0,
        is_indexing: false,
        current_task: null,
        last_scan_error: null,
        last_scanned_at: new Date().toISOString(),
      };
    } catch {
      return {
        total_files: DEFAULT_FILES.length,
        active_files: DEFAULT_FILES.length,
        indexed_files: DEFAULT_FILES.length,
        pending_files: 0,
        processing_files: 0,
        failed_files: 0,
        skipped_files: 0,
        files_with_vectors: DEFAULT_FILES.length,
        soft_deleted_files: 0,
        vector_count: DEFAULT_FILES.length,
        deleted_vector_count: 0,
        index_size_bytes: 826520,
        is_indexing: false,
        current_task: null,
        last_scan_error: null,
        last_scanned_at: new Date().toISOString(),
      };
    }
  }

  async getHistory(limit: number = 50): Promise<HistoryItem[]> {
    if (!this.db) return inMemoryHistory.slice(0, limit);
    try {
      const { results } = await this.db
        .prepare('SELECT id, query_text, result_count, searched_at FROM search_history ORDER BY searched_at DESC LIMIT ?')
        .bind(limit)
        .all<any>();

      return (results || []).map((r) => ({
        id: r.id,
        query_text: r.query_text,
        result_count: r.result_count,
        searched_at: r.searched_at,
      }));
    } catch {
      return inMemoryHistory.slice(0, limit);
    }
  }

  async getZeroResultQueries(limit: number = 50): Promise<HistoryItem[]> {
    if (!this.db) return inMemoryHistory.filter((h) => h.result_count === 0).slice(0, limit);
    try {
      const { results } = await this.db
        .prepare(
          'SELECT id, query_text, result_count, searched_at FROM search_history WHERE result_count = 0 ORDER BY searched_at DESC LIMIT ?'
        )
        .bind(limit)
        .all<any>();

      return (results || []).map((r) => ({
        id: r.id,
        query_text: r.query_text,
        result_count: r.result_count,
        searched_at: r.searched_at,
      }));
    } catch {
      return inMemoryHistory.filter((h) => h.result_count === 0).slice(0, limit);
    }
  }

  async clearHistory(): Promise<void> {
    inMemoryHistory = [];
    if (!this.db) return;
    try {
      await this.db.prepare('DELETE FROM search_history').run();
    } catch {
      // Ignored
    }
  }

  async recordSearch(query: string, resultCount: number): Promise<void> {
    inMemoryHistory.unshift({
      id: inMemoryHistory.length + 1,
      query_text: query,
      result_count: resultCount,
      searched_at: new Date().toISOString(),
    });
    if (!this.db) return;
    try {
      await this.db
        .prepare('INSERT INTO search_history (query_text, result_count, searched_at) VALUES (?, ?, datetime("now"))')
        .bind(query.slice(0, 1024), resultCount)
        .run();
    } catch {
      // Ignored
    }
  }

  async getSuggestions(prefix: string, limit: number = 8): Promise<string[]> {
    const qLower = prefix.toLowerCase().trim();
    const suggestions = new Set<string>();

    for (const h of inMemoryHistory) {
      if (h.query_text.toLowerCase().includes(qLower)) {
        suggestions.add(h.query_text);
      }
    }
    for (const f of DEFAULT_FILES) {
      if (f.filename.toLowerCase().includes(qLower)) {
        suggestions.add(f.filename);
      }
    }

    if (!this.db) return Array.from(suggestions).slice(0, limit);

    try {
      const safe = `%${prefix.trim()}%`;
      const fromHistory = await this.db
        .prepare('SELECT DISTINCT query_text as val FROM search_history WHERE query_text LIKE ? LIMIT ?')
        .bind(safe, limit)
        .all<{ val: string }>();

      const fromFiles = await this.db
        .prepare('SELECT DISTINCT filename as val FROM files WHERE is_deleted = 0 AND filename LIKE ? LIMIT ?')
        .bind(safe, limit)
        .all<{ val: string }>();

      for (const row of fromHistory.results || []) suggestions.add(row.val);
      for (const row of fromFiles.results || []) suggestions.add(row.val);
    } catch {
      // Fallback used
    }

    return Array.from(suggestions).slice(0, limit);
  }

  async searchFiles(
    query: string,
    topK: number = 20,
    fileTypes?: string[],
    dateFrom?: string,
    dateTo?: string
  ): Promise<{ results: SearchResultItem[]; took_ms: number; fallback_mode: boolean }> {
    const t0 = performance.now();
    const cleanQuery = query.trim();
    const qLower = cleanQuery.toLowerCase();
    const qTokens = cleanQuery
      .replace(/[._-]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    const queryVector = embedder.embedText(cleanQuery);

    let candidateFiles: StoredFile[] = [...DEFAULT_FILES];
    if (this.db) {
      try {
        const { results } = await this.db
          .prepare(
            'SELECT id, full_path, filename, extension, size_bytes, modified_at, content_preview, vector_json FROM files WHERE is_deleted = 0'
          )
          .all<any>();
        if (results && results.length > 0) {
          candidateFiles = results as StoredFile[];
        }
      } catch {
        // Fallback to in-memory files
      }
    }

    const items: SearchResultItem[] = [];

    for (const file of candidateFiles) {
      if (fileTypes && fileTypes.length > 0 && !fileTypes.includes('all')) {
        const ext = (file.extension || '').toLowerCase().replace(/^\./, '');
        const matchesCategory = fileTypes.some((cat) => {
          if (cat === 'pdf') return ext === 'pdf';
          if (cat === 'docs') return ['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext);
          if (cat === 'images') return ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff'].includes(ext);
          if (cat === 'code') return ['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'html', 'css', 'sql', 'md'].includes(ext);
          return ext === cat;
        });
        if (!matchesCategory) continue;
      }

      if (dateFrom && file.modified_at < dateFrom) continue;
      if (dateTo && file.modified_at > dateTo) continue;

      const fname = (file.filename || '').toLowerCase();
      const fnameNoExt = fname.substring(0, fname.lastIndexOf('.')) || fname;

      let fnScore = 0;
      if (fname === qLower || fnameNoExt === qLower) {
        fnScore = 1.0;
      } else if (fname.startsWith(qLower) || fnameNoExt.startsWith(qLower)) {
        fnScore = 0.95;
      } else if (fname.includes(qLower)) {
        fnScore = 0.9;
      } else if (qTokens.some((tok) => fname.includes(tok))) {
        fnScore = 0.85;
      }

      let semanticScore = 0;
      const textToEmbed = `${file.filename} ${file.content_preview || ''}`;
      const docVector = embedder.embedText(textToEmbed);
      semanticScore = embedder.cosineSimilarity(queryVector, docVector);

      const combinedScore = fnScore > 0 ? Math.max(fnScore, fnScore * 0.6 + semanticScore * 0.4) : semanticScore;

      if (combinedScore > 0.15) {
        items.push({
          file_id: file.id,
          path: file.full_path,
          filename: file.filename,
          extension: file.extension || '',
          size_bytes: file.size_bytes || 0,
          modified_at: file.modified_at,
          score: Math.min(1.0, Math.round(combinedScore * 100) / 100),
          preview: file.content_preview || null,
        });
      }
    }

    items.sort((a, b) => b.score - a.score);
    const sliced = items.slice(0, topK);
    const took_ms = Math.round(performance.now() - t0);

    await this.recordSearch(cleanQuery, sliced.length);

    return {
      results: sliced,
      took_ms,
      fallback_mode: sliced.length > 0 && sliced[0].score < 0.5,
    };
  }

  async getFileById(fileId: number): Promise<any> {
    const inMem = DEFAULT_FILES.find((f) => f.id === fileId);
    if (!this.db) return inMem;
    try {
      const res = await this.db.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first<any>();
      return res || inMem;
    } catch {
      return inMem;
    }
  }
}

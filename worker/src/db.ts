import { Env, FolderItem, IndexStatus, HistoryItem, AppSettings, SearchResultItem } from './types';
import { embedder } from './embedder';

export class DatabaseManager {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await this.db.prepare('SELECT 1 as ok').first<{ ok: number }>();
      return res?.ok === 1;
    } catch {
      return false;
    }
  }

  async getSettings(): Promise<AppSettings> {
    try {
      const { results } = await this.db
        .prepare('SELECT setting_key, setting_value FROM app_settings')
        .all<{ setting_key: string; setting_value: string }>();

      const settings: AppSettings = {};
      for (const row of results || []) {
        settings[row.setting_key] = row.setting_value;
      }
      return settings;
    } catch {
      return {
        theme: 'dark',
        search_mode: 'hybrid',
        min_similarity: '0.25',
        top_k: '20',
        max_file_size_mb: '50',
        dark_mode: 'true',
        auto_start_worker: 'true',
        debounce_seconds: '2',
      };
    }
  }

  async updateSettings(newSettings: AppSettings): Promise<AppSettings> {
    const stmts = Object.entries(newSettings).map(([k, v]) =>
      this.db
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
  }

  async addFolder(folderPath: string): Promise<FolderItem> {
    const cleanPath = folderPath.trim();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cleanPath))))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

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
  }

  async removeFolder(folderId: number): Promise<boolean> {
    const res = await this.db.prepare('DELETE FROM indexed_folders WHERE id = ?').bind(folderId).run();
    return res.success;
  }

  async getIndexStatus(): Promise<IndexStatus> {
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
  }

  async getHistory(limit: number = 50): Promise<HistoryItem[]> {
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
  }

  async getZeroResultQueries(limit: number = 50): Promise<HistoryItem[]> {
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
  }

  async clearHistory(): Promise<void> {
    await this.db.prepare('DELETE FROM search_history').run();
  }

  async recordSearch(query: string, resultCount: number): Promise<void> {
    try {
      await this.db
        .prepare('INSERT INTO search_history (query_text, result_count, searched_at) VALUES (?, ?, datetime("now"))')
        .bind(query.slice(0, 1024), resultCount)
        .run();
    } catch {
      // Non-blocking history record
    }
  }

  async getSuggestions(prefix: string, limit: number = 8): Promise<string[]> {
    const safe = `%${prefix.trim()}%`;
    const fromHistory = await this.db
      .prepare(
        'SELECT DISTINCT query_text as val FROM search_history WHERE query_text LIKE ? ORDER BY searched_at DESC LIMIT ?'
      )
      .bind(safe, limit)
      .all<{ val: string }>();

    const fromFiles = await this.db
      .prepare(
        'SELECT DISTINCT filename as val FROM files WHERE is_deleted = 0 AND filename LIKE ? ORDER BY filename ASC LIMIT ?'
      )
      .bind(safe, limit)
      .all<{ val: string }>();

    const merged = new Set<string>();
    for (const row of fromHistory.results || []) {
      merged.add(row.val);
    }
    for (const row of fromFiles.results || []) {
      merged.add(row.val);
    }
    return Array.from(merged).slice(0, limit);
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

    // Embed the query for semantic vector scoring
    const queryVector = embedder.embedText(cleanQuery);

    // Fetch candidate active files
    const { results: allFiles } = await this.db
      .prepare('SELECT id, full_path, filename, extension, size_bytes, modified_at, content_preview, vector_json FROM files WHERE is_deleted = 0')
      .all<any>();

    const items: SearchResultItem[] = [];

    for (const file of allFiles || []) {
      // Filter by extension if requested
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

      // Filter by modified_at date if provided
      if (dateFrom && file.modified_at < dateFrom) continue;
      if (dateTo && file.modified_at > dateTo) continue;

      // 1. Filename match score
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

      // 2. Semantic vector score
      let semanticScore = 0;
      const textToEmbed = `${file.filename} ${file.content_preview || ''}`;
      const docVector = embedder.embedText(textToEmbed);
      semanticScore = embedder.cosineSimilarity(queryVector, docVector);

      // Hybrid combination score matching backend service
      let combinedScore = fnScore > 0 ? Math.max(fnScore, fnScore * 0.6 + semanticScore * 0.4) : semanticScore;

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

    // Sort descending by score
    items.sort((a, b) => b.score - a.score);
    const sliced = items.slice(0, topK);
    const took_ms = Math.round(performance.now() - t0);

    // Record in history
    await this.recordSearch(cleanQuery, sliced.length);

    return {
      results: sliced,
      took_ms,
      fallback_mode: sliced.length > 0 && sliced[0].score < 0.5,
    };
  }

  async getFileById(fileId: number): Promise<any> {
    return this.db.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first<any>();
  }
}


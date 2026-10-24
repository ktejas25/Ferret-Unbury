import React, { useState, useEffect, useRef } from 'react';
import {
  Search, FileText, Image as ImageIcon, FileCode, File, ExternalLink,
  Folder, Copy, Check, Clock, Calendar, Sparkles, AlertCircle, X, ChevronRight
} from 'lucide-react';
import { api } from '../api/client';
import { SearchResultItem, SearchResponse } from '../types';

interface SearchPageProps {
  initialQuery?: string;
  onClearInitialQuery?: () => void;
  onNavigateToStatus?: () => void;
  foldersCount?: number;
  totalIndexedFiles?: number;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  initialQuery,
  onClearInitialQuery,
  onNavigateToStatus,
  foldersCount = 0,
  totalIndexedFiles = 0,
}) => {
  const [query, setQuery] = useState(initialQuery || '');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [tookMs, setTookMs] = useState<number | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Trigger search if initialQuery changes from history page
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      executeSearch(initialQuery);
      if (onClearInitialQuery) onClearInitialQuery();
    }
  }, [initialQuery]);

  const getDateFromFilter = (range: string): string | undefined => {
    const now = new Date();
    if (range === '7d') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d.toISOString();
    }
    if (range === '30d') {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return d.toISOString();
    }
    if (range === '1y') {
      const d = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      return d.toISOString();
    }
    return undefined;
  };

  const getFileTypesArray = (type: string): string[] | undefined => {
    if (type === 'pdf') return ['pdf'];
    if (type === 'docs') return ['docx', 'doc', 'txt', 'md', 'rtf'];
    if (type === 'images') return ['png', 'jpg', 'jpeg', 'webp', 'bmp'];
    if (type === 'code') return ['py', 'js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'sql', 'sh'];
    return undefined;
  };

  const executeSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setActionMessage(null);

    try {
      const res: SearchResponse = await api.searchFiles({
        query: searchQuery.trim(),
        top_k: 25,
        file_types: getFileTypesArray(fileTypeFilter),
        date_from: getDateFromFilter(dateRangeFilter),
      });
      setResults(res.results);
      setTotal(res.total);
      setTookMs(res.took_ms);
      setFallbackMode(res.fallback_mode);
    } catch (err: any) {
      setError(err.message || 'An error occurred during search.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setTookMs(null);
    setError(null);
    inputRef.current?.focus();
  };

  const handleOpenFile = async (fileId: number, openFolder: boolean = false) => {
    try {
      const res = await api.openFile({
        file_id: fileId,
        open_containing_folder: openFolder,
      });
      setActionMessage(openFolder ? 'Folder opened in File Explorer' : 'File launched with default application');
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      setActionMessage(`Could not open: ${err.message}`);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleCopyPath = (fileId: number, path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedId(fileId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const getFileIcon = (ext: string) => {
    const cleanExt = ext.toLowerCase().replace('.', '');
    if (cleanExt === 'pdf') return <FileText className="w-5 h-5 text-rose-400" />;
    if (['png', 'jpg', 'jpeg', 'webp'].includes(cleanExt)) return <ImageIcon className="w-5 h-5 text-cyan-400" />;
    if (['py', 'ts', 'js', 'html', 'css', 'sql', 'json'].includes(cleanExt)) return <FileCode className="w-5 h-5 text-amber-400" />;
    return <File className="w-5 h-5 text-indigo-400" />;
  };

  const exampleQueries = [
    'annual tax statement March',
    'screenshot with database error message',
    'backend python configuration settings',
    'quarterly revenue roadmap presentation',
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Alert if no folders are configured yet */}
      {foldersCount === 0 && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl flex-shrink-0">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-100 text-sm">No folders are currently being monitored</p>
              <p className="text-slate-400 mt-0.5">
                File Archaeologist only indexes folders you explicitly select. Add a folder (e.g. Documents, Pictures) to find your files.
              </p>
            </div>
          </div>
          {onNavigateToStatus && (
            <button
              onClick={onNavigateToStatus}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-xs flex-shrink-0 transition-colors shadow-sm"
            >
              Add Monitored Folder →
            </button>
          )}
        </div>
      )}

      {/* Central Spotlight Search Field */}
      <div className="relative mb-6">
        <form onSubmit={handleSearchSubmit} className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
            <Search className="w-6 h-6" />
          </div>

          <input
            id="main-search-input"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleClear();
            }}
            placeholder="Search files by content, topic, or fuzzy memory... (e.g., 'invoice annotated last March')"
            autoFocus
            className="w-full pl-13 pr-24 py-4 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-lg text-slate-100 placeholder-slate-500 shadow-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-sans"
          />

          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center space-x-2">
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Clear (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-[11px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded-md">
              ⌘K
            </kbd>
          </div>
        </form>

        {/* Quick Filter Bars */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-1">
          {/* File Types */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'All Files' },
              { id: 'pdf', label: 'PDFs' },
              { id: 'docs', label: 'Documents' },
              { id: 'images', label: 'Images / OCR' },
              { id: 'code', label: 'Code' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFileTypeFilter(f.id);
                  if (query) executeSearch(query);
                }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  fileTypeFilter === f.id
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={dateRangeFilter}
              onChange={(e) => {
                setDateRangeFilter(e.target.value);
                if (query) executeSearch(query);
              }}
              className="bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Any Modified Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div className="mb-4 px-4 py-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs font-medium flex items-center justify-between animate-fade-in">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-indigo-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search Header Diagnostics */}
      {tookMs !== null && (
        <div className="flex items-center justify-between px-1 mb-4 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span>Found {total} {total === 1 ? 'file' : 'files'}</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-slate-500" />
              {tookMs} ms
            </span>
          </div>

          {fallbackMode && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-medium">
              Filename Fallback Mode Active
            </span>
          )}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Search Failed</p>
            <p className="text-xs text-rose-400/90 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-800/60 rounded w-2/3 mb-3" />
              <div className="h-10 bg-slate-850 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Results List */}
      {!isLoading && results.length > 0 && (
        <div className="space-y-3">
          {results.map((item) => (
            <div
              key={item.file_id}
              className="p-5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700/90 rounded-2xl transition-all shadow-sm group"
            >
              <div className="flex items-start justify-between gap-4">
                {/* File Details */}
                <div className="flex items-start space-x-3.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 flex-shrink-0 mt-0.5">
                    {getFileIcon(item.extension)}
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-base font-medium text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                      {item.filename}
                    </h3>
                    <p className="text-xs font-mono text-slate-400 truncate mt-0.5">
                      {item.path}
                    </p>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400">
                      <span className="font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/40">
                        {formatFileSize(item.size_bytes)}
                      </span>
                      <span>•</span>
                      <span>Modified {formatDate(item.modified_at)}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        <Sparkles className="w-3 h-3" />
                        Match {(item.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <button
                    onClick={() => handleOpenFile(item.file_id, false)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                    title="Open with default application"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Open File</span>
                  </button>

                  <button
                    onClick={() => handleOpenFile(item.file_id, true)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Open containing folder"
                  >
                    <Folder className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleCopyPath(item.file_id, item.path)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Copy full path"
                  >
                    {copiedId === item.file_id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Content Preview Snippet */}
              {item.preview && (
                <div className="mt-3.5 pt-3 border-t border-slate-800/60">
                  <p className="text-xs text-slate-300 font-sans leading-relaxed line-clamp-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800/40">
                    "{item.preview}"
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State / Initial Prompts */}
      {!isLoading && results.length === 0 && (
        <div className="text-center py-16 px-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-medium text-slate-200">
            {query ? 'No matching files found' : 'Ready to discover your files'}
          </h3>

          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1.5">
            {query
              ? "We couldn't find any documents matching this query. Try fuzzy keywords or adjusting your filters."
              : 'Type what you remember about the file content, topics, or key phrases.'}
          </p>

          {!query && (
            <div className="mt-8 max-w-lg mx-auto">
              <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">Example Searches</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {exampleQueries.map((ex, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(ex);
                      executeSearch(ex);
                    }}
                    className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-300 hover:text-white transition-all flex items-center justify-between group"
                  >
                    <span className="truncate">{ex}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

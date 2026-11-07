import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileText,
  Image as ImageIcon,
  FileCode,
  File,
  ExternalLink,
  Folder,
  FolderOpen,
  Copy,
  Check,
  Clock,
  Calendar,
  Sparkles,
  AlertCircle,
  X,
  ChevronRight,
  Code2,
  Table,
  Archive,
  Film,
  Music,
  LayoutList,
  LayoutGrid,
  ArrowUpDown,
  Filter,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Compass,
  FolderPlus,
  Loader2,
  Zap,
  Info
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
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'size'>('relevance');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Set<number>>(new Set());
  
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [tookMs, setTookMs] = useState<number | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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

  // Handle outside click to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.getSuggestions(query.trim());
        if (res && res.suggestions) {
          setSuggestions(res.suggestions.slice(0, 5));
        }
      } catch {
        // Silently skip suggestions error
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

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
    if (type === 'docs') return ['docx', 'doc', 'txt', 'md', 'rtf', 'odt'];
    if (type === 'images') return ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'svg', 'tiff'];
    if (type === 'code') return ['py', 'js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'sql', 'sh', 'rs', 'go', 'cpp', 'c', 'java'];
    if (type === 'archives') return ['zip', 'tar', 'gz', 'rar', '7z'];
    return undefined;
  };

  const executeSearch = async (
    searchQuery: string,
    overrideType?: string,
    overrideDate?: string
  ) => {
    if (!searchQuery.trim()) return;

    const activeType = overrideType !== undefined ? overrideType : fileTypeFilter;
    const activeDate = overrideDate !== undefined ? overrideDate : dateRangeFilter;

    setIsLoading(true);
    setError(null);
    setActionMessage(null);
    setShowSuggestions(false);

    try {
      const res: SearchResponse = await api.searchFiles({
        query: searchQuery.trim(),
        top_k: 30,
        file_types: getFileTypesArray(activeType),
        date_from: getDateFromFilter(activeDate),
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
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleOpenFile = async (fileId: number, openFolder: boolean = false) => {
    try {
      await api.openFile({
        file_id: fileId,
        open_containing_folder: openFolder,
      });
      setActionMessage(openFolder ? 'Revealed in file manager' : 'Launched in default application');
      setTimeout(() => setActionMessage(null), 3000);
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

  const togglePreview = (id: number) => {
    setExpandedPreviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
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
    const cleanExt = (ext || '').toLowerCase().replace('.', '');
    if (cleanExt === 'pdf') {
      return <FileText className="w-5 h-5 text-rose-400" />;
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'svg'].includes(cleanExt)) {
      return <ImageIcon className="w-5 h-5 text-cyan-400" />;
    }
    if (['py', 'ts', 'js', 'html', 'css', 'sql', 'json', 'tsx', 'jsx', 'rs', 'go'].includes(cleanExt)) {
      return <Code2 className="w-5 h-5 text-amber-400" />;
    }
    if (['csv', 'xlsx', 'xls', 'tsv'].includes(cleanExt)) {
      return <Table className="w-5 h-5 text-emerald-400" />;
    }
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(cleanExt)) {
      return <Archive className="w-5 h-5 text-purple-400" />;
    }
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(cleanExt)) {
      return <Film className="w-5 h-5 text-pink-400" />;
    }
    if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(cleanExt)) {
      return <Music className="w-5 h-5 text-violet-400" />;
    }
    return <File className="w-5 h-5 text-indigo-400" />;
  };

  // Filter chips configuration
  const filterCategories = [
    { id: 'all', label: 'All Files', icon: File },
    { id: 'pdf', label: 'PDFs', icon: FileText },
    { id: 'docs', label: 'Documents', icon: FileText },
    { id: 'images', label: 'Images / OCR', icon: ImageIcon },
    { id: 'code', label: 'Code', icon: Code2 },
    { id: 'archives', label: 'Archives', icon: Archive },
  ];

  // Sorting
  const sortedResults = [...results].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime();
    }
    if (sortBy === 'size') {
      return b.size_bytes - a.size_bytes;
    }
    return b.score - a.score;
  });

  const exampleQueries = [
    { text: 'annual tax statement March', tag: 'Finance' },
    { text: 'screenshot with database error message', tag: 'OCR / Image' },
    { text: 'backend python configuration settings', tag: 'Code' },
    { text: 'quarterly revenue roadmap presentation', tag: 'Work' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Alert if no folders are configured yet */}
      {foldersCount === 0 && (
        <div className="mb-8 p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-lg shadow-amber-500/5">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl flex-shrink-0 ring-1 ring-amber-500/30">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                No Monitored Folders Configured
              </p>
              <p className="text-slate-400 mt-1 max-w-xl leading-relaxed">
                File Archaeologist requires at least one indexed folder (e.g., Documents, Projects, Pictures) to discover your files semantically.
              </p>
            </div>
          </div>
          {onNavigateToStatus && (
            <button
              onClick={onNavigateToStatus}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-xs flex items-center gap-1.5 flex-shrink-0 transition-all shadow-md shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Add Folder</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Hero Spotlight Search Container */}
      <div className="relative mb-8" ref={searchContainerRef}>
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/30 via-violet-500/20 to-indigo-500/30 rounded-3xl blur-md opacity-40 group-focus-within:opacity-100 transition duration-500" />
          
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <div className="absolute left-4.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </div>

            <input
              id="main-search-input"
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleClear();
              }}
              placeholder="Search files by concept, topic, or fuzzy memory... (e.g. 'contract signed last winter')"
              autoFocus
              className="w-full pl-13 pr-28 py-4 sm:py-4.5 bg-slate-900/95 border border-slate-700/80 rounded-2xl text-base sm:text-lg text-slate-100 placeholder-slate-500 shadow-2xl backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/80 transition-all font-sans"
            />

            <div className="absolute right-3.5 flex items-center space-x-2">
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                  title="Clear input (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-[11px] font-mono text-slate-400 bg-slate-800/90 border border-slate-700/80 rounded-md shadow-sm">
                ⌘K
              </kbd>
            </div>
          </form>
        </div>

        {/* Live Search Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl z-30 overflow-hidden divide-y divide-slate-800/60 animate-fade-in">
            <div className="px-4 py-2 text-[10px] uppercase font-mono tracking-wider text-slate-400 flex items-center gap-1.5 bg-slate-950/40">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Suggested Queries</span>
            </div>
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(sug);
                  setShowSuggestions(false);
                  executeSearch(sug);
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-indigo-600/10 flex items-center justify-between transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400" />
                  <span>{sug}</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        )}

        {/* Filter and View Control Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mt-4 pt-1">
          {/* File Types Pill Navigation */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1.5 lg:pb-0 scrollbar-none text-xs">
            {filterCategories.map((f) => {
              const Icon = f.icon;
              const isActive = fileTypeFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setFileTypeFilter(f.id);
                    if (query) executeSearch(query, f.id, dateRangeFilter);
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-medium transition-all duration-150 whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 border border-indigo-500'
                      : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* Controls: Date, Sort, View Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
            {/* Date Range Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={dateRangeFilter}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setDateRangeFilter(newDate);
                  if (query) executeSearch(query, fileTypeFilter, newDate);
                }}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-slate-900 text-slate-200">Any Time</option>
                <option value="7d" className="bg-slate-900 text-slate-200">Past 7 Days</option>
                <option value="30d" className="bg-slate-900 text-slate-200">Past 30 Days</option>
                <option value="1y" className="bg-slate-900 text-slate-200">Past Year</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="relevance" className="bg-slate-900 text-slate-200">Sort: Relevance</option>
                <option value="date" className="bg-slate-900 text-slate-200">Sort: Newest</option>
                <option value="size" className="bg-slate-900 text-slate-200">Sort: Largest</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-900/60 border border-slate-800 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="List view"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Grid / Card view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div className="mb-6 px-4 py-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-200 text-xs font-medium flex items-center justify-between shadow-lg shadow-indigo-500/10 animate-fade-in">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="p-1 text-indigo-400 hover:text-white rounded-md transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search Header Diagnostics */}
      {tookMs !== null && (
        <div className="flex items-center justify-between px-1 mb-5 text-xs text-slate-400">
          <div className="flex items-center space-x-2 font-mono">
            <span className="text-slate-300 font-semibold">{total}</span>
            <span>{total === 1 ? 'file match' : 'files matched'}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{tookMs} ms</span>
            </span>
            {totalIndexedFiles > 0 && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline text-slate-500">
                  from {totalIndexedFiles} indexed files
                </span>
              </>
            )}
          </div>

          {fallbackMode && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-medium">
              <Info className="w-3 h-3" />
              <span>Filename Fallback Mode</span>
            </span>
          )}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start space-x-3 shadow-lg shadow-rose-500/5 animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
          <div>
            <p className="font-semibold text-rose-200">Search Failed</p>
            <p className="text-xs text-rose-300/90 mt-1 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 bg-slate-900/40 border border-slate-800/80 rounded-2xl animate-pulse"
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-slate-800" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-800 rounded w-1/3 mb-1.5" />
                  <div className="h-3 bg-slate-800/60 rounded w-2/3" />
                </div>
              </div>
              <div className="h-12 bg-slate-850/60 rounded-xl w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Search Results Display */}
      {!isLoading && sortedResults.length > 0 && (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
              : 'space-y-3'
          }
        >
          {sortedResults.map((item) => {
            const isPreviewExpanded = expandedPreviewIds.has(item.file_id);
            const scorePercent = Math.round(item.score * 100);

            return (
              <div
                key={item.file_id}
                className="p-5 bg-slate-900/70 hover:bg-slate-900/95 border border-slate-800/80 hover:border-indigo-500/40 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 group relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    {/* File Icon & Info */}
                    <div className="flex items-start space-x-3.5 min-w-0">
                      <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/60 flex-shrink-0 group-hover:border-indigo-500/30 transition-colors">
                        {getFileIcon(item.extension)}
                      </div>

                      <div className="min-w-0">
                        <h3
                          onClick={() => handleOpenFile(item.file_id, false)}
                          className="text-sm sm:text-base font-semibold text-slate-100 truncate group-hover:text-indigo-300 transition-colors cursor-pointer"
                          title={item.filename}
                        >
                          {item.filename}
                        </h3>

                        {/* Breadcrumb Path */}
                        <div
                          className="flex items-center text-xs font-mono text-slate-400 truncate mt-1 cursor-pointer hover:text-slate-200"
                          onClick={() => handleOpenFile(item.file_id, true)}
                          title={`Click to open containing folder: ${item.path}`}
                        >
                          <Folder className="w-3 h-3 text-slate-500 flex-shrink-0 mr-1.5" />
                          <span className="truncate">{item.path}</span>
                        </div>

                        {/* Metadata Badges */}
                        <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] text-slate-400">
                          <span className="font-mono bg-slate-800/90 px-2 py-0.5 rounded-md border border-slate-700/50">
                            {formatFileSize(item.size_bytes)}
                          </span>
                          <span>•</span>
                          <span>{formatDate(item.modified_at)}</span>
                          <span>•</span>
                          <span
                            className={`inline-flex items-center gap-1 font-mono px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                              scorePercent >= 80
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                : scorePercent >= 60
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            <Sparkles className="w-3 h-3" />
                            {scorePercent}% match
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <button
                        onClick={() => handleOpenFile(item.file_id, false)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                        title="Open file with default application"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Open</span>
                      </button>

                      <button
                        onClick={() => handleOpenFile(item.file_id, true)}
                        className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/90 rounded-xl border border-transparent hover:border-slate-700/60 transition-colors"
                        title="Reveal in containing folder"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleCopyPath(item.file_id, item.path)}
                        className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/90 rounded-xl border border-transparent hover:border-slate-700/60 transition-colors"
                        title="Copy absolute file path"
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
                    <div className="mt-3.5 pt-3 border-t border-slate-800/80">
                      <div className="relative">
                        <p
                          className={`text-xs text-slate-300 font-sans leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/60 ${
                            isPreviewExpanded ? '' : 'line-clamp-2'
                          }`}
                        >
                          "{item.preview}"
                        </p>
                        {item.preview.length > 140 && (
                          <button
                            type="button"
                            onClick={() => togglePreview(item.file_id)}
                            className="mt-1.5 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                          >
                            {isPreviewExpanded ? (
                              <>
                                <EyeOff className="w-3 h-3" />
                                <span>Show less snippet</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3" />
                                <span>Read full snippet preview</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State / Initial Search Exploration */}
      {!isLoading && results.length === 0 && (
        <div className="text-center py-16 px-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-violet-500/10 to-transparent border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/10">
            <Compass className="w-8 h-8 text-indigo-400" />
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-slate-100">
            {query ? 'No matching files found' : 'Ready to discover your files'}
          </h3>

          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto mt-2 leading-relaxed">
            {query
              ? "We couldn't find any documents matching this query. Try fuzzy keywords, broadening your search phrase, or switching the file type filter."
              : 'Search files using natural language, topics, or key phrases. Local embeddings match conceptual meanings even when exact words differ.'}
          </p>

          {!query && (
            <div className="mt-8 max-w-xl mx-auto">
              <div className="flex items-center justify-center gap-1.5 text-xs font-mono uppercase tracking-wider text-slate-400 mb-3.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Try an example search</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {exampleQueries.map((ex, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(ex.text);
                      executeSearch(ex.text);
                    }}
                    className="p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-800/90 border border-slate-800/80 hover:border-indigo-500/40 text-xs text-slate-300 hover:text-white transition-all duration-200 flex items-center justify-between group shadow-sm"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="block truncate font-medium">{ex.text}</span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{ex.tag}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
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

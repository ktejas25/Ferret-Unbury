import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutGrid, List, Table, Filter, ArrowUpDown, Search, Star,
  Eye, ExternalLink, Tag, Bookmark, Download, RefreshCw,
  Folder, Calendar, CheckSquare, Square, MoreHorizontal, FileText, Files
} from 'lucide-react';
import { api } from '../api/client';
import { DocumentItem, DocumentListResponse, TagItem, CollectionItem } from '../types';

interface DocumentsLibraryPageProps {
  onOpenPreview: (fileId: number) => void;
  onOpenDetails: (fileId: number) => void;
}

export const DocumentsLibraryPage: React.FC<DocumentsLibraryPageProps> = ({
  onOpenPreview,
  onOpenDetails,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('modified_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedExtension, setSelectedExtension] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<number | undefined>(undefined);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<number | undefined>(undefined);

  // Bulk Selection
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);

  // Fetch Tags and Folders for filtering
  const { data: tags = [] } = useQuery<TagItem[]>({
    queryKey: ['tagsList'],
    queryFn: () => api.getTags(),
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['foldersList'],
    queryFn: () => api.getFolders(),
  });

  const { data: collections = [] } = useQuery<CollectionItem[]>({
    queryKey: ['collectionsList'],
    queryFn: () => api.getCollections(),
  });

  // Query documents
  const { data, isLoading, refetch } = useQuery<DocumentListResponse>({
    queryKey: [
      'documentsLibrary',
      page, pageSize, sortBy, sortOrder,
      selectedCategory, selectedExtension, selectedFolder,
      onlyFavorites, selectedTagId, search
    ],
    queryFn: () => api.getDocuments({
      page,
      page_size: pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
      category: selectedCategory || undefined,
      extension: selectedExtension || undefined,
      folder_id: selectedFolder,
      is_favorite: onlyFavorites ? true : undefined,
      tag_id: selectedTagId,
      search: search.trim() || undefined,
    }),
  });

  const documents = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.total_pages || 1;

  const handleToggleSelectAll = () => {
    if (selectedFileIds.length === documents.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(documents.map(d => d.id));
    }
  };

  const handleToggleSelectOne = (id: number) => {
    setSelectedFileIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleFavorite = async (doc: DocumentItem, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.toggleFavorite(doc.id, !doc.is_favorite);
    refetch();
  };

  const handleExportMetadata = () => {
    const exportItems = selectedFileIds.length > 0
      ? documents.filter(d => selectedFileIds.includes(d.id))
      : documents;

    const blob = new Blob([JSON.stringify(exportItems, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document_library_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const CATEGORIES = [
    'Invoice', 'Receipt', 'Contract', 'Report', 'Resume',
    'Purchase Order', 'Research Paper', 'Technical Documentation',
    'Presentation', 'Spreadsheet', 'General Document'
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
      {/* Page Title & View Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Document Library</h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse, manage, filter, and organize all {total} indexed files across your workstation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition ${viewMode === 'list' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Compact Table View"
            >
              <Table className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => refetch()}
            className="p-2 text-slate-400 hover:text-slate-100 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition"
            title="Refresh Library"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search in library */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by filename or content text..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-44 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Sort By Dropdown */}
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split(':');
              setSortBy(sb);
              setSortOrder(so);
            }}
            className="w-full md:w-44 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
          >
            <option value="modified_at:desc">Newest Modified</option>
            <option value="modified_at:asc">Oldest Modified</option>
            <option value="filename:asc">Name (A-Z)</option>
            <option value="filename:desc">Name (Z-A)</option>
            <option value="size_bytes:desc">Largest Size</option>
            <option value="size_bytes:asc">Smallest Size</option>
          </select>

          {/* Favorite Toggle */}
          <button
            onClick={() => {
              setOnlyFavorites(!onlyFavorites);
              setPage(1);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition shrink-0 ${
              onlyFavorites
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-current' : ''}`} />
            <span>Starred</span>
          </button>
        </div>

        {/* Quick Tag Pills */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/40 text-xs">
            <span className="text-slate-500 text-[11px] font-mono mr-1">Tags:</span>
            <button
              onClick={() => setSelectedTagId(undefined)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition ${
                selectedTagId === undefined
                  ? 'bg-violet-600/30 text-violet-200 border-violet-500/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              All
            </button>
            {tags.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTagId(selectedTagId === t.id ? undefined : t.id)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition ${
                  selectedTagId === t.id
                    ? 'bg-violet-600/30 text-violet-200 border-violet-500/50'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Action Bar (when items are selected) */}
      {selectedFileIds.length > 0 && (
        <div className="bg-violet-950/40 border border-violet-800/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-violet-200 animate-slide-in">
          <div className="flex items-center gap-2">
            <span className="font-semibold font-mono">{selectedFileIds.length}</span>
            <span>document(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportMetadata}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg flex items-center gap-1.5 transition text-slate-300 hover:text-white"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Metadata</span>
            </button>
            <button
              onClick={() => setSelectedFileIds([])}
              className="text-slate-400 hover:text-slate-200 ml-2"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-xs">Loading documents...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && documents.length === 0 && (
        <div className="py-20 text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl flex flex-col items-center justify-center gap-2">
          <Files className="w-10 h-10 text-slate-600 mb-1" />
          <span className="text-sm font-medium text-slate-300">No documents found</span>
          <span className="text-xs text-slate-500">Try adjusting your filters, search terms, or add monitored folders.</span>
        </div>
      )}

      {/* GRID VIEW */}
      {!isLoading && viewMode === 'grid' && documents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {documents.map((doc) => {
            const isSelected = selectedFileIds.includes(doc.id);
            return (
              <div
                key={doc.id}
                onClick={() => onOpenDetails(doc.id)}
                className={`group bg-slate-900/70 border rounded-2xl p-4 cursor-pointer hover:border-violet-500/40 hover:bg-slate-900 transition flex flex-col justify-between relative shadow-lg ${
                  isSelected ? 'border-violet-500/80 ring-1 ring-violet-500/50' : 'border-slate-800/80'
                }`}
              >
                {/* Card Top */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-violet-400" />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleToggleFavorite(doc, e)}
                        className={`p-1 rounded hover:bg-slate-800 transition ${
                          doc.is_favorite ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${doc.is_favorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectOne(doc.id);
                        }}
                        className="p-1 rounded text-slate-600 hover:text-slate-400"
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4 text-violet-400" /> : <Square className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-medium text-slate-100 group-hover:text-violet-200 transition truncate mb-1">
                    {doc.filename}
                  </h3>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-950 text-slate-400 border border-slate-800 inline-block mb-3">
                    {doc.category || 'General Document'}
                  </span>

                  {doc.content_preview && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-4">
                      {doc.content_preview}
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>{formatBytes(doc.size_bytes)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPreview(doc.id);
                      }}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                      title="Preview Document"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        api.openFile({ file_id: doc.id });
                      }}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                      title="Open with OS"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {!isLoading && viewMode === 'list' && documents.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-800/60 shadow-xl">
          {documents.map((doc) => {
            const isSelected = selectedFileIds.includes(doc.id);
            return (
              <div
                key={doc.id}
                onClick={() => onOpenDetails(doc.id)}
                className={`p-3.5 flex items-center justify-between hover:bg-slate-800/40 cursor-pointer transition text-xs ${
                  isSelected ? 'bg-violet-950/20' : ''
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelectOne(doc.id);
                    }}
                    className="text-slate-600 hover:text-slate-400 shrink-0"
                  >
                    {isSelected ? <CheckSquare className="w-4 h-4 text-violet-400" /> : <Square className="w-4 h-4" />}
                  </button>

                  <div className="w-8 h-8 rounded-lg bg-violet-950/60 border border-violet-800/40 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-violet-400" />
                  </div>

                  <div className="truncate">
                    <span className="font-medium text-slate-100 block truncate">{doc.filename}</span>
                    <span className="text-[11px] text-slate-500 font-mono truncate block">{doc.full_path}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-950 text-slate-400 border border-slate-800">
                    {doc.category || 'General Document'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 w-16 text-right">
                    {formatBytes(doc.size_bytes)}
                  </span>
                  <button
                    onClick={(e) => handleToggleFavorite(doc, e)}
                    className={`p-1 rounded hover:bg-slate-800 transition ${
                      doc.is_favorite ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${doc.is_favorite ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPreview(doc.id);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-200"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COMPACT TABLE VIEW */}
      {!isLoading && viewMode === 'table' && documents.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 pl-4 pr-2 w-8">
                  <button onClick={handleToggleSelectAll}>
                    {selectedFileIds.length === documents.length ? <CheckSquare className="w-3.5 h-3.5 text-violet-400" /> : <Square className="w-3.5 h-3.5" />}
                  </button>
                </th>
                <th className="py-2.5 px-3">Filename</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Modified</th>
                <th className="py-2.5 px-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => onOpenDetails(doc.id)}
                  className="hover:bg-slate-800/40 cursor-pointer transition"
                >
                  <td className="py-2 pl-4 pr-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelectOne(doc.id);
                      }}
                    >
                      {selectedFileIds.includes(doc.id) ? <CheckSquare className="w-3.5 h-3.5 text-violet-400" /> : <Square className="w-3.5 h-3.5 text-slate-600" />}
                    </button>
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-200 truncate max-w-xs">{doc.filename}</td>
                  <td className="py-2 px-3 text-slate-400">{doc.category || 'General'}</td>
                  <td className="py-2 px-3 font-mono text-slate-500">{formatBytes(doc.size_bytes)}</td>
                  <td className="py-2 px-3 text-slate-500">{new Date(doc.modified_at).toLocaleDateString()}</td>
                  <td className="py-2 px-3 text-right pr-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPreview(doc.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-200"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleToggleFavorite(doc, e)}
                        className={`p-1 ${doc.is_favorite ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <Star className={`w-3.5 h-3.5 ${doc.is_favorite ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 font-mono pt-4">
          <span>Showing page {page} of {totalPages} ({total} documents)</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-30 hover:bg-slate-800 text-slate-300 transition"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-30 hover:bg-slate-800 text-slate-300 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

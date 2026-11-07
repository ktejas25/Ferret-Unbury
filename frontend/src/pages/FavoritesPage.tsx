import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, Eye, ExternalLink, FileText, RefreshCw, Search } from 'lucide-react';
import { api } from '../api/client';
import { DocumentListResponse } from '../types';

interface FavoritesPageProps {
  onOpenPreview: (fileId: number) => void;
  onOpenDetails: (fileId: number) => void;
}

export const FavoritesPage: React.FC<FavoritesPageProps> = ({
  onOpenPreview,
  onOpenDetails,
}) => {
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery<DocumentListResponse>({
    queryKey: ['favoritesList', search],
    queryFn: () => api.getDocuments({
      is_favorite: true,
      search: search.trim() || undefined,
      page_size: 100,
    }),
  });

  const favorites = data?.items || [];

  const handleToggleFavorite = async (fileId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.toggleFavorite(fileId, false);
    refetch();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-400 fill-current" />
            Starred Favorites
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Quick access to your most critical and frequently referenced documents.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2 text-slate-400 hover:text-slate-100 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition"
          title="Refresh favorites"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter favorites..."
          className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
        />
      </div>

      {isLoading && (
        <div className="py-20 text-center text-slate-500">Loading favorites...</div>
      )}

      {!isLoading && favorites.length === 0 && (
        <div className="py-20 text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl flex flex-col items-center justify-center gap-2">
          <Star className="w-10 h-10 text-slate-600 mb-1" />
          <span className="text-sm font-medium text-slate-300">No favorite documents yet</span>
          <span className="text-xs text-slate-500">Star any document from the library or search results to pin it here.</span>
        </div>
      )}

      {!isLoading && favorites.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {favorites.map((doc) => (
            <div
              key={doc.id}
              onClick={() => onOpenDetails(doc.id)}
              className="group bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 cursor-pointer hover:border-violet-500/40 hover:bg-slate-900 transition flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-violet-400" />
                  </div>
                  <button
                    onClick={(e) => handleToggleFavorite(doc.id, e)}
                    className="p-1 text-amber-400 hover:text-slate-400 transition"
                    title="Remove from favorites"
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
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
          ))}
        </div>
      )}
    </div>
  );
};


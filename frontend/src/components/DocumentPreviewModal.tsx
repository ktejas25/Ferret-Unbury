import React, { useState, useEffect } from 'react';
import {
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw,
  ExternalLink, Copy, Check, Search, Sparkles, Calendar, Tag, FileText, AlertCircle
} from 'lucide-react';
import { api } from '../api/client';
import { DocumentPreviewResponse } from '../types';

interface DocumentPreviewModalProps {
  fileId: number | null;
  onClose: () => void;
  highlightText?: string;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  fileId,
  onClose,
  highlightText,
}) => {
  const [data, setData] = useState<DocumentPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [searchInDoc, setSearchInDoc] = useState('');
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!fileId) return;
    setLoading(true);
    setError(null);
    setCurrentPage(0);
    setZoomLevel(100);

    api.getDocumentPreview(fileId)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load preview');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fileId]);

  if (!fileId) return null;

  const handleCopy = () => {
    if (!data) return;
    const textToCopy = data.pages[currentPage] || data.content_text;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenOriginal = async () => {
    if (!fileId) return;
    try {
      await api.openFile({ file_id: fileId });
    } catch (err: any) {
      alert(err.message || 'Could not open file');
    }
  };

  const highlightMatches = (text: string) => {
    const term = searchInDoc || highlightText || '';
    if (!term || !term.trim()) return text;

    try {
      const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
      return parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="bg-amber-400/30 text-amber-200 px-0.5 rounded font-medium">
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-6xl h-[88vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3 truncate">
            <FileText className="w-5 h-5 text-violet-400 shrink-0" />
            <div className="truncate">
              <h2 className="text-sm font-semibold text-slate-100 truncate">{data?.filename || 'Document Preview'}</h2>
              <span className="text-[11px] text-slate-500 font-mono truncate block">{data?.full_path}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Open Original */}
            <button
              onClick={handleOpenOriginal}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition"
              title="Open with OS default application"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open Original</span>
            </button>

            {/* Toggle AI Sidebar */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition ${
                sidebarOpen ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30' : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="hidden sm:inline">AI Intelligence</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Bar */}
        <div className="flex flex-wrap items-center justify-between px-5 py-2 border-b border-slate-800/80 bg-slate-950/20 text-xs text-slate-400 gap-3">
          {/* Page Controls */}
          <div className="flex items-center gap-2">
            <button
              disabled={!data || currentPage <= 0}
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page {data && data.pages.length > 0 ? currentPage + 1 : 1} of {data?.pages.length || 1}
            </span>
            <button
              disabled={!data || currentPage >= data.pages.length - 1}
              onClick={() => setCurrentPage(p => Math.min((data?.pages.length ?? 1) - 1, p + 1))}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoomLevel(z => Math.max(70, z - 15))}
              className="p-1 rounded hover:bg-slate-800"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono text-[11px] w-12 text-center">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel(z => Math.min(180, z + 15))}
              className="p-1 rounded hover:bg-slate-800"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className="p-1 rounded hover:bg-slate-800 ml-1"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search within document & Copy */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5" />
              <input
                type="text"
                value={searchInDoc}
                onChange={(e) => setSearchInDoc(e.target.value)}
                placeholder="Find in page..."
                className="bg-slate-800/80 border border-slate-700/60 rounded-md pl-7 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 w-36"
              />
            </div>
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Document Content View */}
          <div className="flex-1 overflow-auto p-8 flex justify-center bg-slate-950/60">
            {loading && (
              <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                <span className="text-xs">Extracting preview and intelligence...</span>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center text-rose-400 gap-2 p-6 max-w-md text-center">
                <AlertCircle className="w-8 h-8" />
                <span className="text-sm font-medium">{error}</span>
                <span className="text-xs text-slate-500">You can still open the original file with your desktop application.</span>
              </div>
            )}

            {!loading && !error && data && (
              <div
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                className="w-full max-w-3xl min-h-[500px] bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl text-slate-200 text-sm font-sans leading-relaxed whitespace-pre-wrap select-text transition-transform duration-100"
              >
                {highlightMatches(data.pages[currentPage] || data.content_text || 'No preview text available.')}
              </div>
            )}
          </div>

          {/* AI Intelligence Sidebar */}
          {sidebarOpen && data && (
            <div className="w-80 border-l border-slate-800 bg-slate-900/95 overflow-y-auto p-4 flex flex-col gap-4 text-xs animate-slide-in">
              <div className="flex items-center gap-2 text-violet-400 font-semibold text-xs tracking-wider uppercase">
                <Sparkles className="w-4 h-4" />
                <span>Document Intelligence</span>
              </div>

              {/* Category */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Classification</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-950 text-violet-300 border border-violet-800/40 inline-block">
                  {data.category || 'General Document'}
                </span>
              </div>

              {/* Summary */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Executive Summary</span>
                <p className="text-slate-300 leading-relaxed">{data.summary || 'Summary unavailable.'}</p>
              </div>

              {/* Key Points */}
              {data.key_points && data.key_points.length > 0 && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Key Highlights</span>
                  <ul className="space-y-1.5">
                    {data.key_points.map((pt, i) => (
                      <li key={i} className="text-slate-300 flex items-start gap-1.5">
                        <span className="text-violet-400 mt-0.5">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Important Dates */}
              {data.important_dates && data.important_dates.length > 0 && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-violet-400" />
                    Important Dates
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.important_dates.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

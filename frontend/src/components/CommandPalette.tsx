import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, ArrowRight, Star, Folder, Sparkles, X, CornerDownLeft } from 'lucide-react';
import { api } from '../api/client';
import { SearchResultItem } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onOpenFilePreview: (fileId: number) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenFilePreview,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === 'k') || (e.ctrlKey && e.shiftKey && e.code === 'Space')) {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.searchFiles({ query: query.trim(), top_k: 8 });
        setResults(res.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const quickNav = [
    { label: 'Overview Dashboard', tab: 'overview', icon: Sparkles },
    { label: 'All Documents Library', tab: 'documents', icon: FileText },
    { label: 'AI Document Assistant', tab: 'assistant', icon: Sparkles },
    { label: 'Duplicate Manager', tab: 'duplicates', icon: Folder },
    { label: 'Knowledge Graph', tab: 'graph', icon: Sparkles },
    { label: 'Cloud Synchronization', tab: 'sync', icon: Folder },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl shadow-violet-950/20 overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 gap-3">
          <Search className="w-5 h-5 text-violet-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, entities, commands... (Ctrl+K)"
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 rounded border border-slate-700">ESC</span>
        </div>

        {/* Content Box */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-slate-800/40">
          {loading && (
            <div className="py-6 text-center text-xs text-slate-400">Searching your library...</div>
          )}

          {/* Document Search Results */}
          {!loading && results.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Documents</div>
              {results.map((r, i) => (
                <div
                  key={r.file_id}
                  onClick={() => {
                    onOpenFilePreview(r.file_id);
                    onClose();
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition text-xs ${
                    selectedIndex === i ? 'bg-violet-600/20 text-violet-200' : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                    <span className="font-medium truncate">{r.filename}</span>
                    <span className="text-[10px] text-slate-500 truncate">{r.path}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-950/60 text-violet-300 font-mono">
                      {Math.round(r.score * 100)}%
                    </span>
                    <CornerDownLeft className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Navigation Commands */}
          {!loading && results.length === 0 && (
            <div className="py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Quick Navigation</div>
              {quickNav.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <div
                    key={cmd.tab}
                    onClick={() => {
                      onNavigate(cmd.tab);
                      onClose();
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800/60 text-slate-300 cursor-pointer text-xs transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-slate-400" />
                      <span>{cmd.label}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/50 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>File Archaeologist Quick Search</span>
        </div>
      </div>
    </div>
  );
};


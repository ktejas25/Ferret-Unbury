import React, { useState } from 'react';
import {
  History,
  Trash2,
  ArrowRight,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Zap,
  Filter,
  X
} from 'lucide-react';
import { api } from '../api/client';
import { HistoryItem } from '../types';

interface HistoryPageProps {
  history: HistoryItem[];
  zeroResultQueries: HistoryItem[];
  onSelectQuery: (q: string) => void;
  refetchHistory: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  history,
  zeroResultQueries,
  onSelectQuery,
  refetchHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'zero'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [copiedQueryId, setCopiedQueryId] = useState<number | null>(null);

  const rawList = activeTab === 'all' ? history : zeroResultQueries;
  const displayedList = rawList.filter((item) =>
    item.query_text.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      await api.clearHistory();
      setShowClearModal(false);
      refetchHistory();
    } catch (err) {
      console.error('Failed to clear history:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleCopyQuery = (e: React.MouseEvent, id: number, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedQueryId(id);
    setTimeout(() => setCopiedQueryId(null), 2000);
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <History className="w-6 h-6 text-indigo-400" />
            <span>Search History & Insights</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
            Audit past searches, replay queries with one click, or review zero-match terms to optimize your files.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => refetchHistory()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-medium transition-all shadow-sm active:scale-95"
            title="Refresh search history"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          {history.length > 0 && (
            <button
              onClick={() => setShowClearModal(true)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 border border-slate-800 hover:border-rose-500/30 rounded-xl text-xs font-medium transition-all shadow-sm active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs and Local Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 mb-6 pb-3">
        {/* Segmented Tab Switch */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>All Queries</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-slate-900/60 border border-slate-700/50">
              {history.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('zero')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'zero'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Zero-Result Queries</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-slate-900/60 border border-slate-700/50">
              {zeroResultQueries.length}
            </span>
          </button>
        </div>

        {/* Filter input for history list */}
        {rawList.length > 5 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter history entries..."
              className="pl-8 pr-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
            />
          </div>
        )}
      </div>

      {/* Zero-Result Insights Info Banner */}
      {activeTab === 'zero' && (
        <div className="p-4 mb-6 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent border border-indigo-500/20 text-xs text-indigo-300 flex items-start space-x-3 shadow-sm animate-fade-in">
          <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-slate-100">Discoverability Insights</p>
            <p className="text-slate-400 text-xs leading-relaxed mt-0.5">
              Zero-result queries highlight topics you searched for that did not match any indexed documents.
              Use these insights to determine if you need to add more folders or if files need to be re-indexed.
            </p>
          </div>
        </div>
      )}

      {/* Query List */}
      {displayedList.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-xs sm:text-sm bg-slate-900/30 rounded-2xl border border-slate-800/60">
          <History className="w-10 h-10 mx-auto mb-2 text-slate-600" />
          <p className="text-slate-300 font-medium">
            {activeTab === 'all'
              ? searchFilter
                ? 'No past searches match your filter.'
                : 'No search history recorded yet.'
              : 'No zero-result searches found!'}
          </p>
          <p className="text-slate-500 text-xs mt-1">
            {activeTab === 'all'
              ? 'Searches you run on the Search page will appear here.'
              : 'All your previous queries have found at least one matching file.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-800/60 shadow-sm">
          {displayedList.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectQuery(item.query_text)}
              className="p-4 sm:p-4.5 flex items-center justify-between gap-4 hover:bg-slate-850/80 cursor-pointer transition-all group"
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className="p-2 rounded-xl bg-slate-800/90 text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors flex-shrink-0 border border-slate-700/50">
                  <Search className="w-4 h-4" />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100 group-hover:text-indigo-200 transition-colors truncate">
                    "{item.query_text}"
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{formatTimestamp(item.searched_at)}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5 flex-shrink-0">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border ${
                    item.result_count > 0
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {item.result_count} {item.result_count === 1 ? 'match' : 'matches'}
                </span>

                <button
                  type="button"
                  onClick={(e) => handleCopyQuery(e, item.id, item.query_text)}
                  className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Copy query text"
                >
                  {copiedQueryId === item.id ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>

                <div className="p-1.5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold text-slate-100">Clear Search History?</h4>
            </div>
            
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              This will remove all locally stored search query history and query telemetry. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                disabled={isClearing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-md shadow-rose-600/20"
              >
                {isClearing ? 'Clearing...' : 'Clear All History'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

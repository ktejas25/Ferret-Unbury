import React, { useState } from 'react';
import { History, Trash2, ArrowRight, Sparkles, HelpCircle } from 'lucide-react';
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
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const displayedList = activeTab === 'all' ? history : zeroResultQueries;

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

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-400" />
            Search History & Insights
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Review past searches, investigate zero-match queries, or rerun past searches with one click.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => setShowClearModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 rounded-xl text-xs font-medium transition-colors border border-slate-700/60"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 mb-6 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>All Recent Queries</span>
          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/40">
            {history.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('zero')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'zero'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Zero-Result Queries (Insights)</span>
          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/40">
            {zeroResultQueries.length}
          </span>
        </button>
      </div>

      {/* Tab Explanatory note for zero-result queries */}
      {activeTab === 'zero' && (
        <div className="p-4 mb-6 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
          <p className="font-medium mb-0.5">Discoverability Insights</p>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Zero-result queries reflect topics searched that had no matching indexed documents. They are analytical insights into search intent, not application errors.
          </p>
        </div>
      )}

      {/* Query List */}
      {displayedList.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-xs">
          {activeTab === 'all'
            ? 'No search history recorded yet. Enter a query on the Search page to get started.'
            : 'No zero-result searches found. All past searches matched one or more files!'}
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/80">
          {displayedList.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectQuery(item.query_text)}
              className="p-4 flex items-center justify-between gap-4 hover:bg-slate-800/60 cursor-pointer transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                  "{item.query_text}"
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Searched {formatTimestamp(item.searched_at)}
                </p>
              </div>

              <div className="flex items-center space-x-3 flex-shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                    item.result_count > 0
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                  }`}
                >
                  {item.result_count} {item.result_count === 1 ? 'match' : 'matches'}
                </span>

                <div className="p-1 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h4 className="text-base font-semibold text-slate-100 mb-2">Clear Search History?</h4>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              This will remove all locally stored search query history. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                disabled={isClearing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium"
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

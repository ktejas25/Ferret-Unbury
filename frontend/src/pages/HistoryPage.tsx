import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Copy,
  HelpCircle,
  History,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from '../api/client';
import { HistoryItem } from '../types';

/* ────────────────────────────────────────────────
   Configuration
   ──────────────────────────────────────────────── */

type Tab = 'all' | 'zero';

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'all', label: 'All queries', Icon: History },
  { id: 'zero', label: 'Zero-result queries', Icon: HelpCircle },
];

const FILTER_THRESHOLD = 5;
const COPY_FEEDBACK_MS = 2000;

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';

/* ────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────── */

const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} at ${time}`;
};

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

/* ────────────────────────────────────────────────
   Components
   ──────────────────────────────────────────────── */

const TabButton = ({
  label,
  Icon,
  count,
  active,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  count: number;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${FOCUS_RING} ${
      active
        ? 'bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-600/30'
        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
    }`}
  >
    <Icon className="h-3.5 w-3.5" aria-hidden />
    <span>{label}</span>
    <span className="rounded-md border border-slate-700/50 bg-slate-900/60 px-1.5 py-0.5 font-mono text-[10px]">
      {count}
    </span>
  </button>
);

const QueryRow = React.memo(function QueryRow({
  item,
  isCopied,
  onSelect,
  onCopy,
}: {
  item: HistoryItem;
  isCopied: boolean;
  onSelect: (text: string) => void;
  onCopy: (id: number, text: string) => void;
}) {
  const hasResults = item.result_count > 0;

  return (
    <li className="group flex items-center gap-2 transition-colors hover:bg-slate-800/50">
      <button
        type="button"
        onClick={() => onSelect(item.query_text)}
        className={`flex min-w-0 flex-1 items-center gap-3.5 px-4 py-4 text-left ${FOCUS_RING}`}
      >
        <span className="flex-shrink-0 rounded-xl border border-slate-700/50 bg-slate-800/90 p-2 text-slate-400 transition-colors group-hover:bg-indigo-500/10 group-hover:text-indigo-400">
          <Search className="h-4 w-4" aria-hidden />
        </span>

        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-100 transition-colors group-hover:text-indigo-200">
            &ldquo;{item.query_text}&rdquo;
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <Clock className="h-3 w-3 text-slate-500" aria-hidden />
            <span>{formatTimestamp(item.searched_at)}</span>
          </span>
        </span>
      </button>

      <div className="flex flex-shrink-0 items-center gap-2.5 pr-4">
        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${
            hasResults
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
              : 'border-slate-700 bg-slate-800 text-slate-400'
          }`}
        >
          {item.result_count} {item.result_count === 1 ? 'match' : 'matches'}
        </span>

        <button
          type="button"
          onClick={() => onCopy(item.id, item.query_text)}
          aria-label={isCopied ? 'Query copied' : 'Copy query text'}
          title="Copy query text"
          className={`rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 ${FOCUS_RING}`}
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-emerald-400" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
        </button>

        <ArrowRight
          className="h-4 w-4 text-slate-500 transition-all group-hover:translate-x-1 group-hover:text-indigo-400"
          aria-hidden
        />
      </div>
    </li>
  );
});

const EmptyState = ({
  tab,
  isFiltering,
}: {
  tab: Tab;
  isFiltering: boolean;
}) => {
  const { title, hint } = (() => {
    if (isFiltering) {
      return {
        title: 'No past searches match your filter.',
        hint: 'Try a different word or clear the filter.',
      };
    }
    if (tab === 'all') {
      return {
        title: 'No search history yet.',
        hint: 'Searches you run on the Search page will appear here.',
      };
    }
    return {
      title: 'No zero-result searches.',
      hint: 'All your previous queries found at least one matching file.',
    };
  })();

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 px-4 py-16 text-center text-xs text-slate-500 sm:text-sm">
      <History className="mx-auto mb-2 h-10 w-10 text-slate-600" aria-hidden />
      <p className="font-medium text-slate-300">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
};

interface ClearHistoryDialogProps {
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const ClearHistoryDialog = ({ busy, error, onConfirm, onCancel }: ClearHistoryDialogProps) => {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2 text-rose-400">
            <Trash2 className="h-5 w-5" aria-hidden />
          </div>
          <h2 id={titleId} className="text-base font-semibold text-slate-100">
            Clear search history?
          </h2>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-slate-400">
          This removes all locally stored search queries and their telemetry. This action
          cannot be undone.
        </p>

        {error && (
          <p
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-300"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-400" aria-hidden />
            <span>{error}</span>
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={busy}
            className={`rounded-xl bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50 ${FOCUS_RING}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-rose-600/20 transition-colors hover:bg-rose-500 disabled:opacity-50 ${FOCUS_RING}`}
          >
            {busy && <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            <span>{busy ? 'Clearing…' : 'Clear all history'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────── */

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
  const filterId = useId();

  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [filterText, setFilterText] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const activeList = activeTab === 'all' ? history : zeroResultQueries;

  const visibleList = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    if (!term) return activeList;
    return activeList.filter((item) => item.query_text.toLowerCase().includes(term));
  }, [activeList, filterText]);

  // Show the filter whenever the list is long or a filter is active,
  // so an active filter never hides itself.
  const showFilter = activeList.length > FILTER_THRESHOLD || filterText !== '';

  /* ─── Copy feedback ─── */

  useEffect(() => {
    if (copiedId === null) return;
    const t = window.setTimeout(() => setCopiedId(null), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(t);
  }, [copiedId]);

  const copyQuery = useCallback(async (id: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
    } catch {
      // Clipboard can be blocked by the browser. Stay silent rather than show a false success.
    }
  }, []);

  /* ─── Clear history ─── */

  const closeClearDialog = useCallback(() => {
    setShowClearDialog(false);
    setClearError(null);
  }, []);

  const confirmClear = async () => {
    setIsClearing(true);
    setClearError(null);
    try {
      await api.clearHistory();
      closeClearDialog();
      refetchHistory();
    } catch (err) {
      setClearError(getErrorMessage(err, 'Failed to clear history. Please try again.'));
    } finally {
      setIsClearing(false);
    }
  };

  /* ─────────────── Render ─────────────── */

  return (
    <div className="mx-auto max-w-5xl animate-fade-in px-4 py-8 sm:px-6">
      {/* Header */}
      <header className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-100">
            <History className="h-6 w-6 text-indigo-400" aria-hidden />
            <span>Search history &amp; insights</span>
          </h1>
          <p className="mt-1 max-w-xl text-xs text-slate-400 sm:text-sm">
            Review past searches, rerun them with one click, or find zero-match terms
            to improve your indexed files.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={refetchHistory}
            title="Refresh search history"
            className={`flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 shadow-sm transition-all hover:bg-slate-800 active:scale-95 ${FOCUS_RING}`}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            <span>Refresh</span>
          </button>

          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearDialog(true)}
              className={`flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-400 shadow-sm transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95 ${FOCUS_RING}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              <span>Clear history</span>
            </button>
          )}
        </div>
      </header>

      {/* Tabs and filter */}
      <div className="mb-6 flex flex-col justify-between gap-3 border-b border-slate-800 pb-3 sm:flex-row sm:items-center">
        <div role="group" aria-label="Query view" className="flex items-center gap-2">
          {TABS.map(({ id, label, Icon }) => (
            <TabButton
              key={id}
              label={label}
              Icon={Icon}
              count={id === 'all' ? history.length : zeroResultQueries.length}
              active={activeTab === id}
              onClick={() => setActiveTab(id)}
            />
          ))}
        </div>

        {showFilter && (
          <div className="relative">
            <label htmlFor={filterId} className="sr-only">
              Filter queries
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
              aria-hidden
            />
            <input
              id={filterId}
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter queries…"
              className="rounded-xl border border-slate-800 bg-slate-900/80 py-1.5 pl-8 pr-3 font-sans text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Zero-result insight banner */}
      {activeTab === 'zero' && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent p-4 text-xs shadow-sm animate-fade-in">
          <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" aria-hidden />
          <div>
            <p className="font-semibold text-slate-100">Discoverability insights</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              These searches matched no indexed files. If they should have matched, add
              the relevant folder or re-index the files.
            </p>
          </div>
        </div>
      )}

      {/* List */}
      {visibleList.length === 0 ? (
        <EmptyState tab={activeTab} isFiltering={filterText.trim() !== ''} />
      ) : (
        <ul className="divide-y divide-slate-800/60 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-sm">
          {visibleList.map((item) => (
            <QueryRow
              key={item.id}
              item={item}
              isCopied={copiedId === item.id}
              onSelect={onSelectQuery}
              onCopy={copyQuery}
            />
          ))}
        </ul>
      )}

      {showClearDialog && (
        <ClearHistoryDialog
          busy={isClearing}
          error={clearError}
          onConfirm={confirmClear}
          onCancel={closeClearDialog}
        />
      )}
    </div>
  );
};
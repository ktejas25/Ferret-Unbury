import React, {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Archive,
  ArrowUpDown,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Code2,
  Compass,
  Copy,
  EyeOff,
  Eye,
  ExternalLink,
  File,
  FileText,
  FolderOpen,
  FolderPlus,
  Folder,
  Film,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  LayoutList,
  Loader2,
  Music,
  RefreshCw,
  Search,
  Sparkles,
  Table,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { SearchResultItem, SearchResponse } from '../types';

/* ────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────── */

type FilterId = 'all' | 'pdf' | 'docs' | 'images' | 'code' | 'archives';
type DateRange = 'all' | '7d' | '30d' | '1y';
type SortBy = 'relevance' | 'date' | 'size';
type ViewMode = 'list' | 'grid';

interface SearchFilters {
  type: FilterId;
  date: DateRange;
}

interface LastSearch {
  query: string;
  filters: SearchFilters;
  limit: number;
}

interface Toast {
  message: string;
  tone: 'success' | 'error';
}

/* ────────────────────────────────────────────────
   Configuration
   ──────────────────────────────────────────────── */

const DEFAULT_FILTERS: SearchFilters = { type: 'all', date: 'all' };
const PAGE_SIZE = 30;
const MAX_SUGGESTIONS = 5;
const MIN_SUGGEST_CHARS = 2;
const SUGGEST_DEBOUNCE_MS = 250;
const SNIPPET_COLLAPSE_LENGTH = 140;
const TOAST_DURATION_MS = 3500;
const COPY_FEEDBACK_MS = 2000;
const EMPTY_RESULTS: SearchResultItem[] = [];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';

const FILTER_CATEGORIES: { id: FilterId; label: string; Icon: LucideIcon }[] = [
  { id: 'all', label: 'All Files', Icon: File },
  { id: 'pdf', label: 'PDFs', Icon: FileText },
  { id: 'docs', label: 'Documents', Icon: BookOpen },
  { id: 'images', label: 'Images / OCR', Icon: ImageIcon },
  { id: 'code', label: 'Code', Icon: Code2 },
  { id: 'archives', label: 'Archives', Icon: Archive },
];

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'Any Time' },
  { value: '7d', label: 'Past 7 Days' },
  { value: '30d', label: 'Past 30 Days' },
  { value: '1y', label: 'Past Year' },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'relevance', label: 'Sort: Relevance' },
  { value: 'date', label: 'Sort: Newest' },
  { value: 'size', label: 'Sort: Largest' },
];

const EXAMPLE_QUERIES = [
  { text: 'annual tax statement March', tag: 'Finance' },
  { text: 'screenshot with database error message', tag: 'OCR / Image' },
  { text: 'backend python configuration settings', tag: 'Code' },
  { text: 'quarterly revenue roadmap presentation', tag: 'Work' },
];

/** Extensions grouped by category. Single source of truth. */
const EXT_GROUPS = {
  pdf: ['pdf'],
  docs: ['docx', 'doc', 'txt', 'md', 'rtf', 'odt'],
  images: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'svg', 'tiff'],
  code: [
    'py', 'js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css',
    'sql', 'sh', 'rs', 'go', 'cpp', 'c', 'java',
  ],
  spreadsheets: ['csv', 'xlsx', 'xls', 'tsv'],
  archives: ['zip', 'tar', 'gz', 'rar', '7z'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
  audio: ['mp3', 'wav', 'flac', 'ogg', 'm4a'],
} as const;

/** Extensions each filter chip sends to the API. */
const FILTER_EXTENSIONS: Partial<Record<FilterId, readonly string[]>> = {
  pdf: EXT_GROUPS.pdf,
  docs: EXT_GROUPS.docs,
  images: EXT_GROUPS.images,
  code: EXT_GROUPS.code,
  archives: EXT_GROUPS.archives,
};

/** Icon and color per file category, checked in order. */
const FILE_STYLES: { exts: readonly string[]; Icon: LucideIcon; color: string }[] = [
  { exts: EXT_GROUPS.pdf, Icon: FileText, color: 'text-rose-400' },
  { exts: EXT_GROUPS.docs, Icon: BookOpen, color: 'text-sky-400' },
  { exts: EXT_GROUPS.images, Icon: ImageIcon, color: 'text-cyan-400' },
  { exts: EXT_GROUPS.code, Icon: Code2, color: 'text-amber-400' },
  { exts: EXT_GROUPS.spreadsheets, Icon: Table, color: 'text-emerald-400' },
  { exts: EXT_GROUPS.archives, Icon: Archive, color: 'text-purple-400' },
  { exts: EXT_GROUPS.video, Icon: Film, color: 'text-pink-400' },
  { exts: EXT_GROUPS.audio, Icon: Music, color: 'text-violet-400' },
];
const FALLBACK_FILE_STYLE = { Icon: File, color: 'text-indigo-400' };

/* ────────────────────────────────────────────────
   Pure helpers
   ──────────────────────────────────────────────── */

const errorMessage = (err: unknown, fallback = 'Something went wrong.') =>
  err instanceof Error && err.message ? err.message : fallback;

const cleanExt = (ext: string) => (ext ?? '').toLowerCase().replace(/^\./, '');

const getFileStyle = (ext: string) => {
  const e = cleanExt(ext);
  return FILE_STYLES.find((s) => s.exts.includes(e)) ?? FALLBACK_FILE_STYLE;
};

const getFileTypes = (type: FilterId): string[] | undefined => {
  const exts = FILTER_EXTENSIONS[type];
  return exts ? [...exts] : undefined;
};

const getDateFrom = (range: DateRange): string | undefined => {
  if (range === 'all') return undefined;
  const d = new Date();
  switch (range) {
    case '7d':
      d.setDate(d.getDate() - 7);
      break;
    case '30d':
      d.setDate(d.getDate() - 30);
      break;
    case '1y':
      d.setFullYear(d.getFullYear() - 1);
      break;
  }
  return d.toISOString();
};

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    SIZE_UNITS.length - 1
  );
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${SIZE_UNITS[i]}`;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFormatter.format(d);
};

const toPercent = (score: number) =>
  Math.max(0, Math.min(100, Math.round(score * 100)));

const scoreTone = (percent: number) => {
  if (percent >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
  if (percent >= 60) return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25';
  return 'bg-slate-800 text-slate-400 border-slate-700';
};

const sortResults = (items: SearchResultItem[], sortBy: SortBy) => {
  const copy = [...items];
  switch (sortBy) {
    case 'date':
      return copy.sort(
        (a, b) => new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime()
      );
    case 'size':
      return copy.sort((a, b) => b.size_bytes - a.size_bytes);
    default:
      return copy.sort((a, b) => b.score - a.score);
  }
};

/* ────────────────────────────────────────────────
   Hooks
   ──────────────────────────────────────────────── */

/** Debounced autocomplete. Stale responses are ignored. */
const useSuggestions = (query: string): string[] => {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_SUGGEST_CHARS) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.getSuggestions(term);
        if (!cancelled) setSuggestions((res?.suggestions ?? []).slice(0, MAX_SUGGESTIONS));
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return suggestions;
};

/* ────────────────────────────────────────────────
   Small presentational components
   ──────────────────────────────────────────────── */

interface ResultCardProps {
  item: SearchResultItem;
  isExpanded: boolean;
  isCopied: boolean;
  onOpen: (fileId: number, revealFolder: boolean) => void;
  onCopy: (fileId: number, path: string) => void;
  onToggleSnippet: (fileId: number) => void;
  onPreview?: (fileId: number) => void;
  onDetails?: (fileId: number) => void;
}

const ResultCard = memo(function ResultCard({
  item,
  isExpanded,
  isCopied,
  onOpen,
  onCopy,
  onToggleSnippet,
  onPreview,
  onDetails,
}: ResultCardProps) {
  const { Icon, color } = getFileStyle(item.extension);
  const percent = toPercent(item.score);
  const isLongSnippet = (item.preview?.length ?? 0) > SNIPPET_COLLAPSE_LENGTH;

  return (
    <article className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-sm transition-all duration-200 hover:border-indigo-500/40 hover:bg-slate-900/95 hover:shadow-xl hover:shadow-indigo-500/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex-shrink-0 rounded-xl border border-slate-700/60 bg-slate-800/90 p-2.5 transition-colors group-hover:border-indigo-500/30">
            <Icon className={`h-5 w-5 ${color}`} aria-hidden />
          </div>

          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onPreview ? onPreview(item.file_id) : onOpen(item.file_id, false)}
              title={`${item.filename} (Click to preview)`}
              className={`block max-w-full truncate rounded text-left text-sm font-semibold text-slate-100 transition-colors hover:text-indigo-300 sm:text-base ${FOCUS_RING}`}
            >
              {item.filename}
            </button>

            <button
              type="button"
              onClick={() => onOpen(item.file_id, true)}
              title={`Show containing folder: ${item.path}`}
              className={`mt-1 flex max-w-full items-center rounded text-left font-mono text-xs text-slate-400 hover:text-slate-200 ${FOCUS_RING}`}
            >
              <Folder className="mr-1.5 h-3 w-3 flex-shrink-0 text-slate-500" aria-hidden />
              <span className="truncate">{item.path}</span>
            </button>

            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="rounded-md border border-slate-700/50 bg-slate-800/90 px-2 py-0.5 font-mono">
                {formatFileSize(item.size_bytes)}
              </span>
              <span aria-hidden>•</span>
              <span>{formatDate(item.modified_at)}</span>
              <span aria-hidden>•</span>
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${scoreTone(percent)}`}
              >
                <Sparkles className="h-3 w-3" aria-hidden />
                {percent}% match
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          {onPreview && (
            <button
              type="button"
              onClick={() => onPreview(item.file_id)}
              title="Preview document"
              aria-label={`Preview ${item.filename}`}
              className={`rounded-xl border border-transparent p-2 text-slate-400 transition-colors hover:border-slate-700/60 hover:bg-slate-800/90 hover:text-slate-100 ${FOCUS_RING}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </button>
          )}

          {onDetails && (
            <button
              type="button"
              onClick={() => onDetails(item.file_id)}
              title="View metadata and entities"
              aria-label={`Details for ${item.filename}`}
              className={`rounded-xl border border-transparent p-2 text-slate-400 transition-colors hover:border-slate-700/60 hover:bg-slate-800/90 hover:text-slate-100 ${FOCUS_RING}`}
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpen(item.file_id, false)}
            title="Open with default application"
            aria-label={`Open ${item.filename}`}
            className={`flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-95 ${FOCUS_RING}`}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Open</span>
          </button>

          <button
            type="button"
            onClick={() => onOpen(item.file_id, true)}
            title="Reveal in containing folder"
            aria-label="Reveal in containing folder"
            className={`rounded-xl border border-transparent p-2 text-slate-400 transition-colors hover:border-slate-700/60 hover:bg-slate-800/90 hover:text-slate-100 ${FOCUS_RING}`}
          >
            <FolderOpen className="h-4 w-4" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => onCopy(item.file_id, item.path)}
            title="Copy file path"
            aria-label={isCopied ? 'Path copied' : 'Copy file path'}
            className={`rounded-xl border border-transparent p-2 text-slate-400 transition-colors hover:border-slate-700/60 hover:bg-slate-800/90 hover:text-slate-100 ${FOCUS_RING}`}
          >
            {isCopied ? (
              <Check className="h-4 w-4 text-emerald-400" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {item.preview && (
        <div className="mt-3.5 border-t border-slate-800/80 pt-3">
          <p
            className={`rounded-xl border border-slate-800/60 bg-slate-950/50 p-3 text-xs leading-relaxed text-slate-300 ${
              isExpanded ? '' : 'line-clamp-2'
            }`}
          >
            &ldquo;{item.preview}&rdquo;
          </p>
          {isLongSnippet && (
            <button
              type="button"
              onClick={() => onToggleSnippet(item.file_id)}
              aria-expanded={isExpanded}
              className="mt-1.5 flex items-center gap-1 rounded text-[11px] font-medium text-indigo-400 transition-colors hover:text-indigo-300"
            >
              {isExpanded ? (
                <>
                  <EyeOff className="h-3 w-3" aria-hidden />
                  <span>Show less</span>
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" aria-hidden />
                  <span>Show full snippet</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </article>
  );
});

interface ControlSelectProps<T extends string> {
  Icon: LucideIcon;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

function ControlSelect<T extends string>({
  Icon,
  label,
  value,
  options,
  onChange,
}: ControlSelectProps<T>) {
  return (
    <label className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-400">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="cursor-pointer bg-transparent pr-1 text-xs text-slate-200 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-slate-900 text-slate-200">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const SkeletonList = ({ grid }: { grid: boolean }) => (
  <div
    aria-busy="true"
    aria-label="Loading results"
    className={grid ? 'grid grid-cols-1 gap-4 md:grid-cols-2' : 'space-y-3'}
  >
    {Array.from({ length: 4 }, (_, i) => (
      <div
        key={i}
        className="animate-pulse rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-800" />
          <div className="flex-1">
            <div className="mb-1.5 h-4 w-1/3 rounded bg-slate-800" />
            <div className="h-3 w-2/3 rounded bg-slate-800/60" />
          </div>
        </div>
        <div className="h-12 w-full rounded-xl bg-slate-800/60" />
      </div>
    ))}
  </div>
);

interface NoFoldersBannerProps {
  onNavigate?: () => void;
}

const NoFoldersBanner = ({ onNavigate }: NoFoldersBannerProps) => (
  <div
    role="note"
    className="mb-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 text-xs shadow-lg shadow-amber-500/5 sm:flex-row sm:items-center"
  >
    <div className="flex items-center gap-3.5">
      <div className="flex-shrink-0 rounded-xl bg-amber-500/20 p-2.5 text-amber-400 ring-1 ring-amber-500/30">
        <FolderPlus className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-100">No monitored folders yet</p>
        <p className="mt-1 max-w-xl leading-relaxed text-slate-400">
          Add at least one folder, such as Documents, Projects, or Pictures, so
          File Archaeologist can index and search your files.
        </p>
      </div>
    </div>
    {onNavigate && (
      <button
        type="button"
        onClick={onNavigate}
        className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] hover:bg-amber-400 active:scale-[0.98] ${FOCUS_RING}`}
      >
        <span>Add folder</span>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    )}
  </div>
);

const ErrorBanner = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div
    role="alert"
    className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300 shadow-lg shadow-rose-500/5"
  >
    <div className="flex items-start gap-3">
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-400" aria-hidden />
      <div>
        <p className="font-semibold text-rose-200">Search failed</p>
        <p className="mt-1 text-xs leading-relaxed text-rose-300/90">{message}</p>
      </div>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/30 ${FOCUS_RING}`}
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        <span>Retry</span>
      </button>
    )}
  </div>
);

const ToastBar = ({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) => (
  <div
    role="status"
    aria-live="polite"
    className={`mb-6 flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-medium shadow-lg animate-fade-in motion-reduce:animate-none ${
      toast.tone === 'error'
        ? 'border-rose-500/30 bg-rose-500/10 text-rose-200 shadow-rose-500/10'
        : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200 shadow-indigo-500/10'
    }`}
  >
    <div className="flex items-center gap-2">
      <Zap
        className={`h-4 w-4 ${toast.tone === 'error' ? 'text-rose-400' : 'text-indigo-400'}`}
        aria-hidden
      />
      <span>{toast.message}</span>
    </div>
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss notification"
      className={`rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 ${FOCUS_RING}`}
    >
      <X className="h-3.5 w-3.5" aria-hidden />
    </button>
  </div>
);

const EmptyState = ({
  hasSearched,
  onExampleSelect,
}: {
  hasSearched: boolean;
  onExampleSelect: (text: string) => void;
}) => (
  <div className="animate-fade-in px-4 py-16 text-center motion-reduce:animate-none">
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/30 bg-gradient-to-tr from-indigo-500/20 via-violet-500/10 to-transparent text-indigo-400 shadow-xl shadow-indigo-500/10">
      <Compass className="h-8 w-8" aria-hidden />
    </div>

    <h2 className="text-lg font-bold text-slate-100 sm:text-xl">
      {hasSearched ? 'No matching files' : 'Ready to find your files'}
    </h2>

    <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-slate-400 sm:text-sm">
      {hasSearched
        ? 'Try different keywords, a broader phrase, or a different file type filter.'
        : 'Search using natural language, topics, or key phrases. Semantic matching finds files even when the exact words differ.'}
    </p>

    {!hasSearched && (
      <div className="mx-auto mt-8 max-w-xl">
        <div className="mb-3.5 flex items-center justify-center gap-1.5 font-mono text-xs uppercase tracking-wider text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" aria-hidden />
          <span>Try an example</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
          {EXAMPLE_QUERIES.map((ex) => (
            <button
              key={ex.text}
              type="button"
              onClick={() => onExampleSelect(ex.text)}
              className={`group flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 text-xs text-slate-300 shadow-sm transition-all duration-200 hover:border-indigo-500/40 hover:bg-slate-800/90 hover:text-white ${FOCUS_RING}`}
            >
              <div className="min-w-0 pr-2">
                <span className="block truncate font-medium">{ex.text}</span>
                <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{ex.tag}</span>
              </div>
              <ChevronRight
                className="h-4 w-4 flex-shrink-0 text-slate-600 transition-all group-hover:translate-x-1 group-hover:text-indigo-400"
                aria-hidden
              />
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);

/* ────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────── */

interface SearchPageProps {
  initialQuery?: string;
  onClearInitialQuery?: () => void;
  onNavigateToStatus?: () => void;
  foldersCount?: number;
  totalIndexedFiles?: number;
  onPreviewFile?: (fileId: number) => void;
  onOpenDetails?: (fileId: number) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  initialQuery,
  onClearInitialQuery,
  onNavigateToStatus,
  foldersCount = 0,
  totalIndexedFiles = 0,
  onPreviewFile,
  onOpenDetails,
}) => {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Incremented per request so only the latest response is applied. */
  const requestIdRef = useRef(0);

  const [query, setQuery] = useState(initialQuery ?? '');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [lastSearch, setLastSearch] = useState<LastSearch | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestions = useSuggestions(query);
  const isSuggestionListOpen = showSuggestions && suggestions.length > 0;

  const results = response?.results ?? EMPTY_RESULTS;
  const sortedResults = useMemo(() => sortResults(results, sortBy), [results, sortBy]);
  const hasSearched = lastSearch !== null;
  const remaining = response ? Math.max(0, response.total - results.length) : 0;

  /* ─── Search ─── */

  const runSearch = useCallback(
    async (text: string, activeFilters: SearchFilters, limit = PAGE_SIZE) => {
      const term = text.trim();
      if (!term) return;

      const requestId = ++requestIdRef.current;
      setLastSearch({ query: term, filters: activeFilters, limit });
      setIsLoading(true);
      setError(null);
      setShowSuggestions(false);
      setActiveSuggestion(-1);

      try {
        const res = await api.searchFiles({
          query: term,
          top_k: limit,
          file_types: getFileTypes(activeFilters.type),
          date_from: getDateFrom(activeFilters.date),
        });
        if (requestId === requestIdRef.current) setResponse(res);
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setResponse(null);
          setError(errorMessage(err, 'Search failed. Please try again.'));
        }
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    []
  );

  // Handle a query passed in from another page.
  useEffect(() => {
    if (!initialQuery) return;
    setQuery(initialQuery);
    void runSearch(initialQuery, DEFAULT_FILTERS);
    onClearInitialQuery?.();
  }, [initialQuery, onClearInitialQuery, runSearch]);

  const pickSuggestion = (text: string) => {
    setQuery(text);
    void runSearch(text, filters);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(query, filters);
  };

  const updateFilters = (patch: Partial<SearchFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (query.trim()) void runSearch(query, next);
  };

  const clearSearch = () => {
    requestIdRef.current++; // cancel any in-flight request
    setQuery('');
    setResponse(null);
    setLastSearch(null);
    setError(null);
    setIsLoading(false);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    inputRef.current?.focus();
  };

  const retrySearch = () => {
    if (lastSearch) void runSearch(lastSearch.query, lastSearch.filters, lastSearch.limit);
  };

  const loadMore = () => {
    if (lastSearch) {
      void runSearch(lastSearch.query, lastSearch.filters, lastSearch.limit + PAGE_SIZE);
    }
  };

  /* ─── File actions ─── */

  const openFile = useCallback(async (fileId: number, revealFolder: boolean) => {
    try {
      await api.openFile({ file_id: fileId, open_containing_folder: revealFolder });
      setToast({
        message: revealFolder ? 'Opened containing folder' : 'Opened in default application',
        tone: 'success',
      });
    } catch (err) {
      setToast({ message: `Could not open file: ${errorMessage(err)}`, tone: 'error' });
    }
  }, []);

  const copyPath = useCallback(async (fileId: number, path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedId(fileId);
    } catch {
      setToast({ message: 'Could not copy path to clipboard', tone: 'error' });
    }
  }, []);

  const toggleSnippet = useCallback((fileId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  /* ─── Keyboard and outside-click ─── */

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (isSuggestionListOpen) {
        setShowSuggestions(false);
        setActiveSuggestion(-1);
      } else {
        clearSearch();
      }
      return;
    }

    if (!isSuggestionListOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[activeSuggestion]);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setActiveSuggestion(-1);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Auto-dismiss toast and copy feedback.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (copiedId === null) return;
    const t = window.setTimeout(() => setCopiedId(null), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(t);
  }, [copiedId]);

  /* ─────────────── Render ─────────────── */

  return (
    <div className="mx-auto max-w-6xl animate-fade-in px-4 py-8 sm:px-6 motion-reduce:animate-none">
      {foldersCount === 0 && <NoFoldersBanner onNavigate={onNavigateToStatus} />}

      {/* Search hero */}
      <div className="relative mb-8" ref={containerRef}>
        <div className="group relative">
          <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-indigo-500/30 via-violet-500/20 to-indigo-500/30 opacity-40 blur-md transition duration-500 group-focus-within:opacity-100 motion-reduce:transition-none" />

          <form onSubmit={handleSubmit} className="relative flex items-center" role="search">
            <div className="pointer-events-none absolute left-4 flex items-center text-slate-400 transition-colors group-focus-within:text-indigo-400">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400 motion-reduce:animate-none" aria-hidden />
              ) : (
                <Search className="h-5 w-5" aria-hidden />
              )}
            </div>

            <input
              id="main-search-input"
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label="Search files"
              aria-expanded={isSuggestionListOpen}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeSuggestion >= 0 ? `${listboxId}-${activeSuggestion}` : undefined
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
                setActiveSuggestion(-1);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search by topic or fuzzy memory, e.g. “contract signed last winter”"
              autoFocus
              className="w-full rounded-2xl border border-slate-700/80 bg-slate-900/95 py-4 pl-12 pr-28 font-sans text-base text-slate-100 placeholder-slate-500 shadow-2xl backdrop-blur-xl transition-all focus:border-indigo-500/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 sm:text-lg"
            />

            <div className="absolute right-3.5 flex items-center gap-2">
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  title="Clear (Esc)"
                  aria-label="Clear search"
                  className={`rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 ${FOCUS_RING}`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
              <kbd
                className="hidden items-center rounded-md border border-slate-700/80 bg-slate-800/90 px-2 py-1 font-mono text-[11px] text-slate-400 shadow-sm sm:inline-flex"
                aria-hidden
              >
                ⌘K
              </kbd>
            </div>
          </form>
        </div>

        {isSuggestionListOpen && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 animate-fade-in overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-xl motion-reduce:animate-none">
            <div className="flex items-center gap-1.5 bg-slate-950/40 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              <Sparkles className="h-3 w-3 text-indigo-400" aria-hidden />
              <span id={`${listboxId}-label`}>Suggested queries</span>
            </div>
            <ul
              id={listboxId}
              role="listbox"
              aria-labelledby={`${listboxId}-label`}
              className="divide-y divide-slate-800/60"
            >
              {suggestions.map((text, idx) => {
                const isActive = idx === activeSuggestion;
                return (
                  <li
                    key={`${text}-${idx}`}
                    id={`${listboxId}-${idx}`}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveSuggestion(idx)}
                    onMouseDown={(e) => e.preventDefault()} // keep input focus
                    onClick={() => pickSuggestion(text)}
                    className={`group flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs transition-colors ${
                      isActive ? 'bg-indigo-600/10 text-white' : 'text-slate-300 hover:bg-indigo-600/10 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Search className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400" aria-hidden />
                      <span>{text}</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-400" aria-hidden />
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Filters and sort */}
        <div className="mt-4 flex flex-col justify-between gap-4 pt-1 lg:flex-row lg:items-center">
          <div role="group" aria-label="Filter by file type" className="flex items-center gap-1.5 overflow-x-auto pb-1.5 text-xs lg:pb-0">
            {FILTER_CATEGORIES.map(({ id, label, Icon }) => {
              const isActive = filters.type === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => updateFilters({ type: id })}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 font-medium transition-all duration-150 ${FOCUS_RING} ${
                    isActive
                      ? 'border border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                      : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <ControlSelect
              Icon={Calendar}
              label="Filter by date"
              value={filters.date}
              options={DATE_OPTIONS}
              onChange={(date) => updateFilters({ date })}
            />
            <ControlSelect
              Icon={ArrowUpDown}
              label="Sort results"
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={setSortBy}
            />
            <div role="group" aria-label="View mode" className="flex items-center rounded-xl border border-slate-800 bg-slate-900/60 p-0.5">
              {(
                [
                  { mode: 'list', Icon: LayoutList, title: 'List view' },
                  { mode: 'grid', Icon: LayoutGrid, title: 'Grid view' },
                ] as const
              ).map(({ mode, Icon, title }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  title={title}
                  aria-label={title}
                  className={`rounded-lg p-1.5 transition-colors ${FOCUS_RING} ${
                    viewMode === mode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {toast && <ToastBar toast={toast} onDismiss={() => setToast(null)} />}

      {/* Status line */}
      {response && !error && !isLoading && (
        <div role="status" aria-live="polite" className="mb-5 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2 font-mono">
            <span className="font-semibold text-slate-300">{response.total}</span>
            <span>{response.total === 1 ? 'file match' : 'file matches'}</span>
            <span aria-hidden>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-500" aria-hidden />
              <span>{response.took_ms} ms</span>
            </span>
            {totalIndexedFiles > 0 && (
              <span className="hidden text-slate-500 sm:inline">
                • from {totalIndexedFiles} indexed files
              </span>
            )}
          </div>

          {response.fallback_mode && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
              <Info className="h-3 w-3" aria-hidden />
              <span>Filename-only matching</span>
            </span>
          )}
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={lastSearch ? retrySearch : undefined} />}

      {isLoading && <SkeletonList grid={viewMode === 'grid'} />}

      {!isLoading && sortedResults.length > 0 && (
        <>
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2' : 'space-y-3'}>
            {sortedResults.map((item) => (
              <ResultCard
                key={item.file_id}
                item={item}
                isExpanded={expandedIds.has(item.file_id)}
                isCopied={copiedId === item.file_id}
                onOpen={openFile}
                onCopy={copyPath}
                onToggleSnippet={toggleSnippet}
                onPreview={onPreviewFile}
                onDetails={onOpenDetails}
              />
            ))}
          </div>

          {remaining > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                className={`rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-indigo-500/40 hover:bg-slate-800 ${FOCUS_RING}`}
              >
                Show more ({remaining} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {!isLoading && !error && sortedResults.length === 0 && (
        <EmptyState hasSearched={hasSearched} onExampleSelect={pickSuggestion} />
      )}
    </div>
  );
};
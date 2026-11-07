import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GitCompare, ArrowRight, FileText, CheckCircle2,
  AlertCircle, Sparkles, Layers, RefreshCw
} from 'lucide-react';
import { api } from '../api/client';
import { DocumentListResponse, CompareDocumentsResponse } from '../types';

interface ComparisonPageProps {
  onOpenPreview: (fileId: number) => void;
}

export const ComparisonPage: React.FC<ComparisonPageProps> = ({ onOpenPreview }) => {
  const [fileIdA, setFileIdA] = useState<number | undefined>(undefined);
  const [fileIdB, setFileIdB] = useState<number | undefined>(undefined);
  const [isComparing, setIsComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareDocumentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch document candidates
  const { data: docData } = useQuery<DocumentListResponse>({
    queryKey: ['documentsForComparison'],
    queryFn: () => api.getDocuments({ page_size: 100 }),
  });

  const documents = docData?.items || [];

  const handleRunComparison = async () => {
    if (!fileIdA || !fileIdB) {
      alert('Please select both documents to compare.');
      return;
    }
    if (fileIdA === fileIdB) {
      alert('Please select two distinct documents.');
      return;
    }

    setIsComparing(true);
    setError(null);
    try {
      const res = await api.compareDocuments(fileIdA, fileIdB);
      setCompareResult(res);
    } catch (err: any) {
      setError(err.message || 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
          <GitCompare className="w-6 h-6 text-violet-400" />
          Document Comparison
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Perform side-by-side textual diffs, identify clause modifications, and generate AI difference summaries.
        </p>
      </div>

      {/* Selectors Card */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Document A */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono block mb-1.5">
              Document A (Baseline)
            </label>
            <select
              value={fileIdA || ''}
              onChange={(e) => setFileIdA(Number(e.target.value) || undefined)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
            >
              <option value="">Select first document...</option>
              {documents.map(d => (
                <option key={d.id} value={d.id}>{d.filename} ({d.category || 'General'})</option>
              ))}
            </select>
          </div>

          {/* Document B */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono block mb-1.5">
              Document B (Comparison Target)
            </label>
            <select
              value={fileIdB || ''}
              onChange={(e) => setFileIdB(Number(e.target.value) || undefined)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
            >
              <option value="">Select second document...</option>
              {documents.map(d => (
                <option key={d.id} value={d.id}>{d.filename} ({d.category || 'General'})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            disabled={!fileIdA || !fileIdB || isComparing}
            onClick={handleRunComparison}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-violet-950/40"
          >
            {isComparing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Comparing...</span>
              </>
            ) : (
              <>
                <GitCompare className="w-4 h-4" />
                <span>Compare Documents</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Comparison Results */}
      {compareResult && (
        <div className="space-y-6 animate-slide-in">
          {/* Summary Banner */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400 font-mono flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                AI Difference Summary
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800/40">
                Similarity: {Math.round(compareResult.similarity_score * 100)}%
              </span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">
              {compareResult.summary_diff}
            </p>

            {compareResult.clauses_changed.length > 0 && (
              <div className="pt-2 border-t border-slate-800/60 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-semibold block">
                  Identified Variations:
                </span>
                <ul className="text-xs space-y-1">
                  {compareResult.clauses_changed.map((clause, idx) => (
                    <li key={idx} className="text-slate-300 flex items-center gap-2">
                      <span className="text-violet-400">•</span>
                      <span>{clause}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Diff View Box */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Textual Line Diffs
            </h2>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-mono text-xs max-h-[420px] overflow-y-auto space-y-1">
              {compareResult.diffs.map((diff, i) => {
                if (diff.type === 'added') {
                  return (
                    <div key={i} className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded break-all">
                      + {diff.text}
                    </div>
                  );
                }
                if (diff.type === 'removed') {
                  return (
                    <div key={i} className="text-rose-400 bg-rose-950/30 px-2 py-0.5 rounded break-all">
                      - {diff.text}
                    </div>
                  );
                }
                return (
                  <div key={i} className="text-slate-500 px-2 py-0.5 break-all">
                    &nbsp;&nbsp;{diff.text}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


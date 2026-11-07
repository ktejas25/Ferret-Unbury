import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, Eye, ExternalLink, FileText, RefreshCw,
  Clock, ShieldCheck
} from 'lucide-react';
import { api } from '../api/client';
import { DocumentTimelineResponse } from '../types';

interface TimelinePageProps {
  onOpenPreview: (fileId: number) => void;
}

export const TimelinePage: React.FC<TimelinePageProps> = ({ onOpenPreview }) => {
  const { data, isLoading, refetch } = useQuery<DocumentTimelineResponse>({
    queryKey: ['documentTimeline'],
    queryFn: () => api.getTimeline(100),
  });

  const events = data?.events || [];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-violet-400" />
            Document Chronological Timeline
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Chronological milestones, effective dates, deadlines, and events extracted across your files.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2 text-slate-400 hover:text-slate-100 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition self-start sm:self-auto"
          title="Refresh timeline"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-xs">Extracting chronological events from documents...</span>
        </div>
      )}

      {!isLoading && events.length === 0 && (
        <div className="py-20 text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl flex flex-col items-center justify-center gap-2">
          <Calendar className="w-10 h-10 text-slate-600 mb-1" />
          <span className="text-sm font-medium text-slate-300">No chronological events found</span>
          <span className="text-xs text-slate-500">Dates mentioned in your documents will automatically populate here.</span>
        </div>
      )}

      {!isLoading && events.length > 0 && (
        <div className="relative border-l border-violet-500/30 ml-4 md:ml-32 space-y-8 pl-6 py-4">
          {events.map((ev, idx) => (
            <div key={idx} className="relative group">
              {/* Dot */}
              <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-violet-400 group-hover:scale-125 transition-transform shadow-md shadow-violet-950" />

              {/* Date Tag on Left (for desktop) */}
              <div className="hidden md:block absolute -left-36 top-1 text-right w-24 text-xs font-mono text-violet-400 font-semibold">
                {ev.event_date}
              </div>

              {/* Event Card */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-xl space-y-2 hover:border-violet-500/40 transition">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="md:hidden text-xs font-mono text-violet-400 font-semibold">
                      {ev.event_date} •
                    </span>
                    <h3 className="text-sm font-semibold text-slate-100">{ev.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800">
                      {Math.round(ev.confidence * 100)}% confidence
                    </span>
                    <button
                      onClick={() => onOpenPreview(ev.file_id)}
                      className="p-1 text-slate-400 hover:text-slate-200 transition"
                      title="Preview Source Document"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => api.openFile({ file_id: ev.file_id })}
                      className="p-1 text-slate-400 hover:text-slate-200 transition"
                      title="Open Original File"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {ev.description && (
                  <p className="text-xs text-slate-300 leading-relaxed font-sans italic bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                    "{ev.description}"
                  </p>
                )}

                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{ev.filename}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


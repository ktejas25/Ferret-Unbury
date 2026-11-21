import React from 'react';
import { Logo } from '../components/Logo';
import { Search, FolderGit2, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

interface OnboardingPageProps {
  onComplete: () => void;
}

/**
 * Onboarding and welcome screen with primary logo placed at the top.
 */
export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onComplete }) => {
  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800/90 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-xl text-center">
        {/* Primary logo at top */}
        <div className="flex justify-center mb-8">
          <Logo
            variant="primary"
            height={52}
            alt="Ferret-Unbury"
            className="hover:scale-105 transition-transform"
          />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
          Welcome to Ferret-Unbury
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          Your personal local-first document archaeologist. Discover, search, and uncover buried knowledge across your local filesystem with deterministic semantic intelligence.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8 text-left">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
              <Search className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-200">Semantic Search</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Find concepts and topics even if you don't recall the exact filename.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-200">Local-First Index</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Monitors directories on your machine with near-zero overhead.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-3">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-200">AI Synthesizer</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Extract insights, summaries, and duplicates in seconds.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onComplete}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/30 inline-flex items-center gap-2 group"
        >
          <span>Get Started with Ferret-Unbury</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>100% Private • Offline Ready • No Data Collection</span>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;

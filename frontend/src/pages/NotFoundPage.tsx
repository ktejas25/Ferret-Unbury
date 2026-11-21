import React from 'react';
import { Logo } from '../components/Logo';
import { Home, ArrowLeft } from 'lucide-react';

interface NotFoundPageProps {
  onNavigateHome: () => void;
  message?: string;
}

/**
 * 404 and Error Page: Icon version centered with a short message beneath it.
 */
export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  onNavigateHome,
  message = 'The page or resource you requested could not be located in Ferret-Unbury.',
}) => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-slate-900/70 border border-slate-800/80 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-md">
        {/* Icon version centered */}
        <div className="flex justify-center mb-6">
          <Logo
            variant="icon"
            height={80}
            width={80}
            alt="Ferret-Unbury"
            withClearSpace={false}
            className="rounded-2xl shadow-xl shadow-black/50"
          />
        </div>

        <div className="text-2xl font-mono font-bold text-slate-100 tracking-tight">
          404 Not Found
        </div>

        {/* Short message beneath */}
        <p className="mt-3 text-xs text-slate-400 leading-relaxed font-sans">
          {message}
        </p>

        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            onClick={onNavigateHome}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/30 flex items-center gap-2"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;

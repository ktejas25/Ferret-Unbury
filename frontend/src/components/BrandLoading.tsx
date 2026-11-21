import React from 'react';
import { Logo } from './Logo';

interface BrandLoadingProps {
  message?: string;
  submessage?: string;
  size?: number;
  className?: string;
}

/**
 * Brand-compliant loading placeholder for long operations (e.g. search, indexing, file parsing).
 * Uses the Ferret-Unbury icon version with a slow pulse animation (no generic spinner).
 */
export const BrandLoading: React.FC<BrandLoadingProps> = ({
  message = 'Loading...',
  submessage,
  size = 48,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center animate-fade-in ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="relative animate-pulse duration-1000">
        <Logo
          variant="icon"
          height={size}
          width={size}
          alt="Loading Ferret-Unbury"
          withClearSpace={false}
          className="rounded-2xl shadow-lg shadow-indigo-950/40"
        />
      </div>
      {message && (
        <p className="mt-4 text-xs font-semibold text-slate-200 tracking-tight">
          {message}
        </p>
      )}
      {submessage && (
        <p className="mt-1 text-[11px] text-slate-400 font-mono">
          {submessage}
        </p>
      )}
    </div>
  );
};

export default BrandLoading;

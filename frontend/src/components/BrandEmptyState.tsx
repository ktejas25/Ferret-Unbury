import React from 'react';
import { Logo } from './Logo';

interface BrandEmptyStateProps {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Brand-compliant empty state placeholder (e.g. no search results, no files indexed).
 * Displays the Ferret-Unbury icon at 96px, muted, with the message beneath.
 */
export const BrandEmptyState: React.FC<BrandEmptyStateProps> = ({
  title = 'No items found',
  message = 'Try modifying your search query or selecting a different category.',
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center select-none ${className}`}
      role="region"
      aria-label={title}
    >
      <div className="opacity-40 grayscale contrast-125 hover:opacity-60 transition-opacity duration-300">
        <Logo
          variant="icon"
          height={96}
          width={96}
          alt="Ferret-Unbury empty state"
          withClearSpace={false}
          className="rounded-3xl shadow-md shadow-black/40"
        />
      </div>
      <h3 className="mt-5 text-sm sm:text-base font-bold text-slate-200 tracking-tight">
        {title}
      </h3>
      {message && (
        <p className="mt-1.5 text-xs text-slate-400 max-w-md leading-relaxed font-sans">
          {message}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

export default BrandEmptyState;

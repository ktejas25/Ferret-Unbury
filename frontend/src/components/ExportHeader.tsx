import React from 'react';
import { Logo } from './Logo';

interface ExportHeaderProps {
  title: string;
  subtitle?: string;
  date?: string;
  isBlackAndWhite?: boolean;
  className?: string;
}

/**
 * Printable / Exported document and PDF header with Ferret-Unbury branding in top-left.
 * Automatically uses mono version if the export is black-and-white.
 */
export const ExportHeader: React.FC<ExportHeaderProps> = ({
  title,
  subtitle,
  date = new Date().toLocaleDateString(),
  isBlackAndWhite = false,
  className = '',
}) => {
  return (
    <header className={`border-b pb-4 mb-6 flex items-start justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-4">
        <Logo
          variant={isBlackAndWhite ? 'mono' : 'primary'}
          height={36}
          alt="Ferret-Unbury"
          withClearSpace={false}
          className="shrink-0"
        />
        <div className="border-l border-slate-300 dark:border-slate-700 pl-4">
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 font-mono mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="text-right text-[11px] font-mono text-slate-400">
        <div>Generated: {date}</div>
        <div className="text-[10px] text-slate-500">Ferret-Unbury Intelligence</div>
      </div>
    </header>
  );
};

export default ExportHeader;

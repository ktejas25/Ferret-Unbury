import React, { useState, useEffect } from 'react';
import { X, Settings, Check, RefreshCw, Cpu, Database, Eye } from 'lucide-react';
import { api } from '../api/client';
import { AppSettings, HealthStatus } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  health?: HealthStatus;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  health,
}) => {
  const [settings, setSettings] = useState<AppSettings>({});
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [ignoredExts, setIgnoredExts] = useState('');
  const [maxPreview, setMaxPreview] = useState('1000');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await api.getSettings();
      setSettings(res.settings);
      setOcrEnabled(res.settings.ocr_enabled === 'true');
      setIgnoredExts(res.settings.ignored_extensions || '');
      setMaxPreview(res.settings.max_preview_length || '1000');
      setSavedSuccess(false);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateSettings({
        ocr_enabled: ocrEnabled ? 'true' : 'false',
        ignored_extensions: ignoredExts,
        max_preview_length: maxPreview,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-fade-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Application Settings</h3>
              <p className="text-xs text-slate-400">Manage indexing rules, OCR, and local engine configuration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* OCR Toggle */}
          <div className="p-3.5 bg-slate-800/40 border border-slate-700/60 rounded-xl flex items-center justify-between">
            <div className="pr-4">
              <label className="text-xs font-semibold text-slate-200 block">
                Optical Character Recognition (OCR)
              </label>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Extract text inside PNG, JPG, and screenshot images using local Tesseract OCR engine.
              </p>
            </div>
            <input
              type="checkbox"
              checked={ocrEnabled}
              onChange={(e) => setOcrEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
            />
          </div>

          {/* Ignored Extensions */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Ignored Extensions
            </label>
            <input
              type="text"
              value={ignoredExts}
              onChange={(e) => setIgnoredExts(e.target.value)}
              placeholder=".tmp, .log, .bak, .pyc, .dll"
              className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">Comma-separated list of extensions to skip during scans.</p>
          </div>

          {/* Max Preview Length */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Max Content Preview Length (chars)
            </label>
            <input
              type="number"
              value={maxPreview}
              onChange={(e) => setMaxPreview(e.target.value)}
              min="100"
              max="5000"
              className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* System Diagnostics Box */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs">
            <p className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider mb-2">Engine Diagnostics</p>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-slate-500" /> Database</span>
              <span className="font-mono text-[11px] text-emerald-400">{health?.database || 'connected'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-slate-500" /> Embedding Model</span>
              <span className="font-mono text-[11px] text-indigo-400">{health?.model || 'all-MiniLM-L6-v2'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-slate-500" /> Vector Index</span>
              <span className="font-mono text-[11px] text-slate-300">{health?.vector_index || 'ready'}</span>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            {savedSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved successfully
              </span>
            )}
            {!savedSuccess && <span />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium flex items-center space-x-1.5"
              >
                {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

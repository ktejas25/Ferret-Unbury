import React, { useState, useEffect } from 'react';
import {
  X, FileText, Star, Folder, Calendar, HardDrive, Tag,
  ExternalLink, Eye, Check, Edit2, Sparkles, Hash
} from 'lucide-react';
import { api } from '../api/client';
import { DocumentDetailResponse, TagItem, CollectionItem } from '../types';

interface DocumentDetailsDrawerProps {
  fileId: number | null;
  onClose: () => void;
  onOpenPreview: (fileId: number) => void;
  onFavoriteToggled?: () => void;
}

const ALL_CATEGORIES = [
  'Invoice', 'Receipt', 'Contract', 'Report', 'Resume',
  'Purchase Order', 'Research Paper', 'Technical Documentation',
  'Presentation', 'Spreadsheet', 'General Document'
];

export const DocumentDetailsDrawer: React.FC<DocumentDetailsDrawerProps> = ({
  fileId,
  onClose,
  onOpenPreview,
  onFavoriteToggled,
}) => {
  const [data, setData] = useState<DocumentDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    if (!fileId) return;
    setLoading(true);
    setIsEditingCategory(false);

    Promise.all([
      api.getDocumentDetails(fileId),
      api.getTags()
    ]).then(([detailRes, tagsRes]) => {
      setData(detailRes);
      setSelectedCategory(detailRes.document.category || 'General Document');
      setAvailableTags(tagsRes);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [fileId]);

  if (!fileId) return null;

  const doc = data?.document;

  const handleToggleFavorite = async () => {
    if (!doc) return;
    const nextState = !doc.is_favorite;
    await api.toggleFavorite(doc.id, nextState);
    setData(prev => prev ? {
      ...prev,
      document: { ...prev.document, is_favorite: nextState }
    } : null);
    onFavoriteToggled?.();
  };

  const handleUpdateCategory = async () => {
    if (!doc) return;
    await api.classifyDocument(doc.id, selectedCategory);
    setData(prev => prev ? {
      ...prev,
      document: { ...prev.document, category: selectedCategory }
    } : null);
    setIsEditingCategory(false);
  };

  const handleToggleTag = async (tagId: number) => {
    if (!doc) return;
    const currentTagIds = (doc.tags || []).map(t => t.id);
    const newTagIds = currentTagIds.includes(tagId)
      ? currentTagIds.filter(id => id !== tagId)
      : [...currentTagIds, tagId];

    await api.assignTags(doc.id, newTagIds);
    // Reload
    const updated = await api.getDocumentDetails(doc.id);
    setData(updated);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-slide-in">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100 truncate">
          <FileText className="w-4 h-4 text-violet-400 shrink-0" />
          <span className="truncate">Document Details</span>
        </div>
        <div className="flex items-center gap-2">
          {doc && (
            <button
              onClick={handleToggleFavorite}
              className={`p-1.5 rounded-lg border transition ${
                doc.is_favorite
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title={doc.is_favorite ? 'Favorited' : 'Add to Favorites'}
            >
              <Star className="w-4 h-4 fill-current" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
        {loading && (
          <div className="py-12 text-center text-slate-500">Loading document metadata...</div>
        )}

        {!loading && doc && (
          <>
            {/* Title & Actions */}
            <div>
              <h3 className="text-base font-semibold text-slate-100 break-all mb-1">{doc.filename}</h3>
              <p className="text-[11px] font-mono text-slate-500 break-all mb-4">{doc.full_path}</p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenPreview(doc.id)}
                  className="flex-1 py-2 px-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg flex items-center justify-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Document</span>
                </button>
                <button
                  onClick={() => api.openFile({ file_id: doc.id })}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition"
                  title="Open with OS default application"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open File</span>
                </button>
              </div>
            </div>

            {/* Classification Section */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  Document Classification
                </span>
                {!isEditingCategory ? (
                  <button
                    onClick={() => setIsEditingCategory(true)}
                    className="text-violet-400 hover:text-violet-300 text-[11px] flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                ) : (
                  <button
                    onClick={handleUpdateCategory}
                    className="text-emerald-400 hover:text-emerald-300 text-[11px] flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Save
                  </button>
                )}
              </div>

              {!isEditingCategory ? (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-violet-950/80 text-violet-300 border border-violet-800/40 text-xs font-medium">
                    {doc.category || 'General Document'}
                  </span>
                  {doc.category_confidence && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {Math.round(doc.category_confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-violet-500"
                  >
                    {ALL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Tags Section */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-violet-400" />
                Custom Tags
              </span>

              <div className="flex flex-wrap gap-1.5">
                {availableTags.map(tag => {
                  const isAssigned = (doc.tags || []).some(t => t.id === tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleToggleTag(tag.id)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition ${
                        isAssigned
                          ? 'bg-violet-600/30 text-violet-200 border-violet-500/60'
                          : 'bg-slate-800 text-slate-400 border-slate-700/60 hover:text-slate-200'
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Metadata & Properties
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 text-[10px] block">File Size</span>
                  <span className="text-slate-200 font-mono">{formatBytes(doc.size_bytes)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Extension</span>
                  <span className="text-slate-200 uppercase font-mono">{doc.extension || 'None'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Modified Date</span>
                  <span className="text-slate-200">{new Date(doc.modified_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Indexing Status</span>
                  <span className="capitalize px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-emerald-400">
                    {doc.extraction_status}
                  </span>
                </div>
              </div>

              {doc.content_hash && (
                <div className="pt-2 border-t border-slate-800/60">
                  <span className="text-slate-500 text-[10px] block mb-0.5 flex items-center gap-1">
                    <Hash className="w-3 h-3" /> Content Hash (SHA-256)
                  </span>
                  <span className="text-slate-400 font-mono text-[10px] break-all">{doc.content_hash}</span>
                </div>
              )}
            </div>

            {/* Extracted Fields (if any) */}
            {data.extractions && Object.keys(data.extractions).length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Structured Extractions
                </span>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {Object.entries(data.extractions).map(([extType, fields]) => (
                    <div key={extType} className="bg-slate-900 rounded p-2 border border-slate-800">
                      <span className="text-violet-400 text-[10px] uppercase block mb-1 font-sans font-semibold">{extType}</span>
                      {typeof fields === 'object' && fields !== null && Object.entries(fields).map(([k, v]) => (
                        <div key={k} className="flex justify-between py-0.5">
                          <span className="text-slate-500">{k}:</span>
                          <span className="text-slate-200 truncate ml-2">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};


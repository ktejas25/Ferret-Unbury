import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark, Tag, Plus, Trash2, Edit3, Sparkles, Folder,
  Check, X, FileText, Layers, Hash
} from 'lucide-react';
import { api } from '../api/client';
import { CollectionItem, TagItem } from '../types';

interface CollectionsPageProps {
  onOpenPreview: (fileId: number) => void;
  onOpenDetails: (fileId: number) => void;
}

export const CollectionsPage: React.FC<CollectionsPageProps> = ({
  onOpenPreview,
  onOpenDetails,
}) => {
  const [activeTab, setActiveTab] = useState<'collections' | 'tags'>('collections');

  // New Collection Form
  const [isCreatingColl, setIsCreatingColl] = useState(false);
  const [collName, setCollName] = useState('');
  const [collDesc, setCollDesc] = useState('');
  const [isSmartColl, setIsSmartColl] = useState(false);
  const [smartCategory, setSmartCategory] = useState('');

  // New Tag Form
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#8b5cf6');

  // Query Collections & Tags
  const { data: collections = [], refetch: refetchColls } = useQuery<CollectionItem[]>({
    queryKey: ['collectionsList'],
    queryFn: () => api.getCollections(),
  });

  const { data: tags = [], refetch: refetchTags } = useQuery<TagItem[]>({
    queryKey: ['tagsList'],
    queryFn: () => api.getTags(),
  });

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collName.trim()) return;

    const rules = isSmartColl && smartCategory ? { category: smartCategory } : undefined;
    await api.createCollection({
      name: collName.trim(),
      description: collDesc.trim() || undefined,
      is_smart: isSmartColl,
      rules_json: rules,
    });

    setCollName('');
    setCollDesc('');
    setIsSmartColl(false);
    setIsCreatingColl(false);
    refetchColls();
  };

  const handleDeleteCollection = async (id: number) => {
    if (!confirm('Are you sure you want to delete this collection? Documents inside will not be deleted.')) return;
    await api.deleteCollection(id);
    refetchColls();
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;

    await api.createTag(tagName.trim(), tagColor);
    setTagName('');
    setIsCreatingTag(false);
    refetchTags();
  };

  const handleDeleteTag = async (id: number) => {
    await api.deleteTag(id);
    refetchTags();
  };

  const CATEGORIES = [
    'Invoice', 'Receipt', 'Contract', 'Report', 'Resume',
    'Purchase Order', 'Research Paper', 'Technical Documentation',
    'Presentation', 'Spreadsheet', 'General Document'
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Collections & Tags</h1>
          <p className="text-xs text-slate-400 mt-1">
            Organize documents with manual collections, automatic smart rules, and custom multi-tags.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center gap-1 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'collections' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Collections ({collections.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'tags' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Tags ({tags.length})</span>
          </button>
        </div>
      </div>

      {/* COLLECTIONS VIEW */}
      {activeTab === 'collections' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-400">
              Manual and rule-based Smart Collections
            </span>
            <button
              onClick={() => setIsCreatingColl(true)}
              className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Collection</span>
            </button>
          </div>

          {/* Creation Modal / Inline Box */}
          {isCreatingColl && (
            <form onSubmit={handleCreateCollection} className="bg-slate-900/90 border border-violet-500/40 rounded-2xl p-5 shadow-2xl space-y-4 animate-slide-in">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">Create New Collection</span>
                <button onClick={() => setIsCreatingColl(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Collection Name *</label>
                  <input
                    type="text"
                    required
                    value={collName}
                    onChange={(e) => setCollName(e.target.value)}
                    placeholder="e.g. Q4 Financial Invoices"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={collDesc}
                    onChange={(e) => setCollDesc(e.target.value)}
                    placeholder="Short description..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={isSmartColl}
                    onChange={(e) => setIsSmartColl(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-violet-600 focus:ring-violet-500"
                  />
                  <span>Smart Collection (Auto-populated by category rule)</span>
                </label>

                {isSmartColl && (
                  <select
                    value={smartCategory}
                    onChange={(e) => setSmartCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                  >
                    <option value="">Select category rule...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingColl(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium"
                >
                  Create Collection
                </button>
              </div>
            </form>
          )}

          {/* Collections Grid */}
          {collections.length === 0 ? (
            <div className="py-16 text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
              No collections created yet. Click "New Collection" to group your documents.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {collections.map((coll) => (
                <div
                  key={coll.id}
                  className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-violet-500/40 transition group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-violet-950/60 border border-violet-800/40 flex items-center justify-center shrink-0">
                        {coll.is_smart ? (
                          <Sparkles className="w-4 h-4 text-violet-400" />
                        ) : (
                          <Bookmark className="w-4 h-4 text-indigo-400" />
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteCollection(coll.id)}
                        className="p-1 text-slate-600 hover:text-rose-400 transition"
                        title="Delete collection"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-100 group-hover:text-violet-200 transition">
                      {coll.name}
                    </h3>

                    {coll.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{coll.description}</p>
                    )}

                    {coll.is_smart && coll.rules_json?.category && (
                      <span className="mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-mono bg-violet-950 text-violet-300 border border-violet-800/40">
                        Rule: {coll.rules_json.category}
                      </span>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>{coll.item_count} documents</span>
                    <span className="capitalize">{coll.is_smart ? 'Smart Rule' : 'Manual'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAGS VIEW */}
      {activeTab === 'tags' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-400">
              Custom labels and tags applied to documents
            </span>
            <button
              onClick={() => setIsCreatingTag(true)}
              className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Tag</span>
            </button>
          </div>

          {/* New Tag Form */}
          {isCreatingTag && (
            <form onSubmit={handleCreateTag} className="bg-slate-900/90 border border-violet-500/40 rounded-2xl p-5 shadow-2xl space-y-4 animate-slide-in">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">Create New Tag</span>
                <button onClick={() => setIsCreatingTag(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Tag Name *</label>
                  <input
                    type="text"
                    required
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    placeholder="e.g. Tax-2026, Urgent, Confidential"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Color</label>
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="w-full h-8 bg-slate-950 border border-slate-800 rounded-lg p-1 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingTag(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium"
                >
                  Create Tag
                </button>
              </div>
            </form>
          )}

          {/* Tags List */}
          {tags.length === 0 ? (
            <div className="py-16 text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
              No tags defined yet. Create your first tag to label your files.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {tags.map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between hover:border-violet-500/40 transition group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.color || '#8b5cf6' }}
                    />
                    <span className="text-xs font-medium text-slate-200 truncate">{t.name}</span>
                  </div>

                  <button
                    onClick={() => handleDeleteTag(t.id)}
                    className="text-slate-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition"
                    title="Delete tag"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Network, Search, Filter, ZoomIn, ZoomOut, RotateCcw,
  Eye, FileText, Layers, Building, Hash, Sparkles
} from 'lucide-react';
import { api } from '../api/client';
import { KnowledgeGraphResponse, GraphNode, GraphLink } from '../types';

interface KnowledgeGraphPageProps {
  onOpenPreview: (fileId: number) => void;
  onOpenDetails: (fileId: number) => void;
}

export const KnowledgeGraphPage: React.FC<KnowledgeGraphPageProps> = ({
  onOpenPreview,
  onOpenDetails,
}) => {
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, refetch } = useQuery<KnowledgeGraphResponse>({
    queryKey: ['knowledgeGraph', filterGroup],
    queryFn: () => api.getKnowledgeGraph(filterGroup),
  });

  const nodes = data?.nodes || [];
  const links = data?.links || [];

  // Filter nodes by search query
  const filteredNodes = searchQuery.trim()
    ? nodes.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : nodes;

  // Simple deterministic circular / cluster layout calculation for SVG
  const width = 900;
  const height = 550;
  const centerX = width / 2;
  const centerY = height / 2;

  const nodePositions = React.useMemo(() => {
    const posMap: Record<string, { x: number; y: number }> = {};
    const n = filteredNodes.length;
    if (n === 0) return posMap;

    filteredNodes.forEach((node, idx) => {
      // Cluster by group or distribute in concentric rings
      const radius = node.group === 'document' ? 180 : 250;
      const angle = (2 * Math.PI * idx) / n;
      posMap[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
    return posMap;
  }, [filteredNodes, centerX, centerY]);

  const getNodeColor = (group: string) => {
    switch (group) {
      case 'document': return '#8b5cf6'; // violet
      case 'topic': return '#6366f1';    // indigo
      case 'company': return '#06b6d4';  // cyan
      case 'person': return '#10b981';   // emerald
      default: return '#f59e0b';         // amber
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Network className="w-6 h-6 text-violet-400" />
            Knowledge Graph Explorer
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Explore interconnected entities, companies, topics, and cross-document relationships.
          </p>
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter graph nodes..."
              className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 w-44"
            />
          </div>

          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
          >
            <option value="all">All Groups</option>
            <option value="topic">Topics Only</option>
            <option value="company">Companies Only</option>
          </select>
        </div>
      </div>

      {/* Main Graph Viewport + Sidebar Details */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Interactive SVG Canvas */}
        <div className="lg:col-span-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl h-[580px] shadow-2xl relative overflow-hidden flex items-center justify-center">
          {/* Zoom controls */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1 shadow-lg">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono px-2 text-slate-400">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Group Legend */}
          <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-3 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> Documents
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Topics
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Companies
            </span>
          </div>

          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
              <div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              <span>Constructing knowledge network...</span>
            </div>
          )}

          {!isLoading && nodes.length === 0 && (
            <div className="text-center text-xs text-slate-500">
              No entities or relationships discovered yet. Index more documents to populate the graph.
            </div>
          )}

          {!isLoading && nodes.length > 0 && (
            <svg
              className="w-full h-full cursor-grab active:cursor-grabbing"
              viewBox={`0 0 ${width} ${height}`}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
            >
              {/* Edges / Links */}
              {links.map((link, idx) => {
                const s = nodePositions[link.source];
                const t = nodePositions[link.target];
                if (!s || !t) return null;
                return (
                  <line
                    key={idx}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke="#334155"
                    strokeWidth={1.5}
                    strokeDasharray={link.relation === 'mentions' ? '3 3' : 'none'}
                    className="hover:stroke-violet-400 transition"
                  />
                );
              })}

              {/* Nodes */}
              {filteredNodes.map((node) => {
                const pos = nodePositions[node.id];
                if (!pos) return null;
                const isSelected = selectedNode?.id === node.id;
                const color = getNodeColor(node.group);
                const radius = node.group === 'document' ? 14 : 18;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onClick={() => setSelectedNode(node)}
                    className="cursor-pointer group"
                  >
                    <circle
                      r={radius}
                      fill={color}
                      fillOpacity={0.25}
                      stroke={color}
                      strokeWidth={isSelected ? 3 : 1.5}
                      className="group-hover:fill-opacity-50 transition"
                    />
                    <circle r={4} fill={color} />
                    <text
                      y={radius + 12}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize={10}
                      fontFamily="sans-serif"
                      className="select-none pointer-events-none drop-shadow"
                    >
                      {node.name.length > 18 ? node.name.slice(0, 16) + '...' : node.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Selected Node Details Panel */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span>Node Inspector</span>
            </div>

            {selectedNode ? (
              <div className="space-y-4 animate-fade-in text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                    Entity Group: {selectedNode.group}
                  </span>
                  <h3 className="text-base font-bold text-slate-100 break-words">{selectedNode.name}</h3>
                </div>

                {selectedNode.file_id && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Associated Document</span>
                    <button
                      onClick={() => onOpenPreview(selectedNode.file_id!)}
                      className="w-full py-2 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium flex items-center justify-center gap-1.5 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Source</span>
                    </button>
                    <button
                      onClick={() => onOpenDetails(selectedNode.file_id!)}
                      className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-1.5 transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Details</span>
                    </button>
                  </div>
                )}

                {/* Evidence Links */}
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Connected Relations</span>
                  {links
                    .filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
                    .slice(0, 6)
                    .map((l, i) => (
                      <div key={i} className="p-2 rounded bg-slate-950/60 border border-slate-800/60 text-[11px] text-slate-300">
                        <span className="text-violet-400 uppercase font-mono mr-1.5 font-semibold text-[10px]">{l.relation}</span>
                        {l.evidence && <span className="text-slate-400 block mt-0.5">{l.evidence}</span>}
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-slate-500 text-xs">
                Click any node in the graph to view relationships, linked evidence, and source documents.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


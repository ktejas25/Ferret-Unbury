import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, Send, Plus, MessageSquare, Trash2, ExternalLink,
  Eye, FileText, CornerDownLeft, AlertCircle, HelpCircle, User, Bot
} from 'lucide-react';
import { api } from '../api/client';
import { ChatMessageItem, ConversationItem, SourceCitation } from '../types';

interface AIAssistantPageProps {
  onOpenPreview: (fileId: number) => void;
}

export const AIAssistantPage: React.FC<AIAssistantPageProps> = ({ onOpenPreview }) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [scopeType, setScopeType] = useState<'all' | 'file' | 'collection'>('all');
  const [suggestedFollowups, setSuggestedFollowups] = useState<string[]>([
    "Summarize all invoices received this year",
    "Find contracts with renewal clauses",
    "What are the major deliverables across my project reports?",
    "Extract key milestones and deadlines from recent documents"
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations on mount
  useEffect(() => {
    api.getConversations().then(res => {
      setConversations(res || []);
      if (res && res.length > 0 && !activeConvId) {
        selectConversation(res[0].id);
      }
    }).catch(console.error);
  }, []);

  const selectConversation = async (convId: string) => {
    setActiveConvId(convId);
    try {
      const details = await api.getConversationDetails(convId);
      setMessages(details.messages || []);
    } catch {
      setMessages([]);
    }
  };

  const startNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setSuggestedFollowups([
      "Summarize all invoices received this year",
      "Find contracts with renewal clauses",
      "What are the major deliverables across my project reports?",
      "Extract key milestones and deadlines from recent documents"
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || loading) return;

    const userMsg: ChatMessageItem = {
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await api.assistantChat({
        conversation_id: activeConvId || undefined,
        message: text.trim(),
        scope_type: scopeType,
      });

      setActiveConvId(res.conversation_id);
      const assistantMsg: ChatMessageItem = {
        role: 'assistant',
        content: res.message,
        sources: res.sources,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setSuggestedFollowups(res.suggested_followups || []);

      // Refresh conversations list
      api.getConversations().then(resConvs => setConversations(resConvs || []));
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to process document query'}`,
          created_at: new Date().toISOString(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteConversation(convId);
    const updated = await api.getConversations();
    setConversations(updated);
    if (activeConvId === convId) {
      startNewConversation();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="flex-1 flex h-[calc(100vh-80px)] overflow-hidden bg-slate-950 animate-fade-in">
      {/* Left Chat Sessions Sidebar */}
      <div className="w-72 bg-slate-900/60 border-r border-slate-800 flex flex-col justify-between hidden md:flex shrink-0">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-100 uppercase tracking-wider font-mono">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>AI Conversations</span>
          </div>
          <button
            onClick={startNewConversation}
            className="p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition text-xs flex items-center gap-1 shadow-md shadow-violet-950/40"
            title="Start New Thread"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition group ${
                activeConvId === conv.id
                  ? 'bg-violet-600/20 text-violet-200 border border-violet-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-slate-500 group-hover:text-violet-400" />
                <span className="truncate font-medium">{conv.title}</span>
              </div>
              <button
                onClick={(e) => handleDeleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {conversations.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-500">
              No conversations yet. Ask a question to begin.
            </div>
          )}
        </div>

        {/* Scope Selector */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-xs">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono block mb-1">
            Grounding Scope
          </label>
          <select
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value as any)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
          >
            <option value="all">Entire Document Library</option>
            <option value="file">Selected Document Only</option>
          </select>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/60">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto w-full">
          {messages.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white shadow-xl shadow-violet-950/50">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">AI Document Assistant</h2>
                <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
                  Ask natural-language questions grounded on your personal files.
                  Every factual answer is accompanied by verifiable document citations.
                </p>
              </div>

              {/* Suggested Questions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl w-full pt-4">
                {suggestedFollowups.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(q)}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-violet-500/50 text-slate-300 hover:text-white text-xs text-left transition flex items-center justify-between group"
                  >
                    <span className="truncate mr-2">{q}</span>
                    <CornerDownLeft className="w-3.5 h-3.5 text-slate-600 group-hover:text-violet-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 text-xs leading-relaxed ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-violet-950 border border-violet-800/60 flex items-center justify-center shrink-0 text-violet-400 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 shadow-xl ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-tr-none'
                    : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none space-y-3'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Source Citations */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-2">
                    <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider block font-mono">
                      Source References ({msg.sources.length})
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {msg.sources.map((src, sIdx) => (
                        <div
                          key={sIdx}
                          className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex items-start justify-between gap-3"
                        >
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 mb-1 truncate">
                              <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                              <span className="font-semibold text-slate-100 truncate">{src.filename}</span>
                              <span className="text-[10px] text-slate-500 font-mono">Page {src.page_number || 1}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed italic">
                              "{src.excerpt}"
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => onOpenPreview(src.file_id)}
                              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                              title="Preview passage in document"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => api.openFile({ file_id: src.file_id })}
                              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                              title="Open original file"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3 text-xs text-slate-400 py-2">
              <div className="w-7 h-7 rounded-lg bg-violet-950 border border-violet-800/60 flex items-center justify-center shrink-0 text-violet-400">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl">
                <div className="w-3.5 h-3.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                <span>Searching documents and formulating grounded answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 max-w-4xl mx-auto w-full">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-2 focus-within:border-violet-500 shadow-xl"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask a question about your documents... (e.g. 'What were the total expenses last quarter?')"
              className="flex-1 bg-transparent px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:hover:bg-violet-600 text-white transition shadow-md shadow-violet-950/40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};


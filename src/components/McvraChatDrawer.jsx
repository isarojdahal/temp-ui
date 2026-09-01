'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Sparkles,
  X,
  Trash2,
  RefreshCw,
  Bot,
  User,
  Layout,
  Calculator,
  GitBranch,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { chatWithMcvra } from '../utils/api';
import { Button } from './ui/button';

export function McvraChatDrawer({
  isOpen,
  onClose,
  mcvraUrl,
  rawTreeData,
  assessmentId,
  userId,
  assessmentName,
  domain,
  onApplyUpdatedGraph,
  onFitView
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome-mcvra',
      role: 'assistant',
      content: `### 👋 Welcome to MCVRA Graph Copilot!

I can interact directly with your current assessment graph. Try asking me to:
- **🔄 Re-arrange node positions** (horizontal, vertical, compact, or spacious)
- **📐 Show formulas of nodes** and mathematical rollup equations
- **🌲 Show attached components & child hierarchy** for any pillar
- **📊 List counts and summary** of criteria, metrics, and question indicators`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const quickActions = [
    { label: '🔄 Re-arrange Nodes', query: 'Please re-arrange the node positions to optimize the graph layout.' },
    { label: '📐 Show Formulas', query: 'Show the calculation formulas of all nodes in this graph.' },
    { label: '🌲 Attached Components', query: 'Show the attached components and child indicators for each pillar.' },
    { label: '📊 Graph Counts & Summary', query: 'List the counts and summary of nodes and overall graph structure.' },
    { label: '↕️ Vertical Layout', query: 'Re-arrange the nodes into a top-down vertical layout.' },
    { label: '↔️ Compact Layout', query: 'Re-arrange the nodes into a compact horizontal layout.' },
  ];

  const handleSend = async (queryText) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend || !textToSend.trim() || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!queryText) setInputQuery('');
    setLoading(true);

    try {
      // Build conversation history for context
      const history = messages
        .filter((m) => m.id !== 'welcome-mcvra')
        .map((m) => ({ role: m.role, content: m.content }));

      const graphPayload = rawTreeData || [];

      const res = await chatWithMcvra(mcvraUrl, {
        message: textToSend.trim(),
        assessmentId,
        userId,
        domain: domain || 'pokhara.dastaa.org',
        graph: graphPayload,
        assessmentName: assessmentName || 'MCVRA Assessment',
        history
      });

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.reply || 'No response received.',
        action_taken: res.action_taken,
        summary: res.summary,
        usage: res.usage,
        has_updated_graph: Boolean(res.updated_graph && res.updated_graph.length > 0),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // If graph rearrangement was returned, apply it to the canvas in real-time!
      if (res.updated_graph && res.updated_graph.length > 0 && onApplyUpdatedGraph) {
        onApplyUpdatedGraph(res.updated_graph);
      }
    } catch (err) {
      console.error('MCVRA chat error:', err);
      let errMsg = 'Failed to get a response from MCVRA chat assistant.';
      if (err.response?.data?.detail) {
        errMsg = typeof err.response.data.detail === 'string'
          ? err.response.data.detail
          : JSON.stringify(err.response.data.detail);
      } else if (err.message) {
        errMsg = err.message;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Error:** ${errMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome-mcvra-cleared',
        role: 'assistant',
        content: 'Conversation history cleared. How can I help you inspect or rearrange your MCVRA graph?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl flex flex-col transition-all duration-300 ease-in-out text-slate-800">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#208661] text-white flex items-center justify-center shadow-md shadow-[#208661]/20">
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              MCVRA Graph Copilot
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/60 capitalize">
                {domain ? domain.replace(/_/g, ' ') : 'Live Graph'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Interactive graph rearrangement, formulas & hierarchy inspector
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
            title="Clear Chat History"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            title="Close Assistant"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Quick Action Suggestion Pills */}
      <div className="p-2.5 bg-slate-100/70 border-b border-slate-200 overflow-x-auto flex gap-1.5 scrollbar-none">
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(action.query)}
            disabled={loading}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-[#208661] hover:text-[#208661] hover:bg-emerald-50/50 shrink-0 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Message History Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs shadow-xs ${isUser ? 'bg-[#208661] text-white' : 'bg-white border border-slate-200 text-[#208661]'
                  }`}
              >
                {isUser ? <User size={14} /> : <Bot size={14} />}
              </div>

              <div className={`space-y-1.5 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${isUser
                      ? 'bg-[#208661] text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                    }`}
                >
                  <div className="prose prose-xs max-w-none text-inherit prose-headings:text-inherit prose-headings:font-bold prose-headings:mb-1.5 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-pre:p-2 prose-pre:rounded-lg prose-table:text-xs">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Rearrangement canvas sync badge */}
                  {msg.has_updated_graph && (
                    <div className="mt-3 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <CheckCircle2 size={14} className="text-[#208661]" />
                        Canvas Updated With New Positions
                      </div>
                      {onFitView && (
                        <button
                          onClick={onFitView}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#208661] text-white hover:bg-[#1a6d4f] flex items-center gap-1"
                        >
                          <Maximize2 size={10} /> Fit View
                        </button>
                      )}
                    </div>
                  )}

                  {/* Token usage badge */}
                  {msg.usage && (
                    <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Model: {msg.usage.model || 'deepseek-chat'}</span>
                      <span className="font-mono text-emerald-700 font-semibold">
                        {msg.usage.formatted_price} ({msg.usage.total_tokens} tokens)
                      </span>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 px-1">{msg.timestamp}</span>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 items-center">
            <div className="w-7 h-7 rounded-full bg-white border border-slate-200 text-[#208661] flex items-center justify-center shrink-0">
              <RefreshCw size={14} className="animate-spin" />
            </div>
            <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-xs text-xs text-slate-500 shadow-2xs flex items-center gap-2">
              <Sparkles size={13} className="text-[#208661] animate-pulse" />
              <span>Analyzing graph hierarchy and computing response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-slate-200 bg-white space-y-1.5"
      >
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask about node formulas, children, or request re-arrangement..."
            disabled={loading}
            className="w-full text-xs pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 bg-slate-50/70 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#208661] focus:border-[#208661] focus:bg-white transition-all"
          />
          <Button
            type="submit"
            size="xs"
            disabled={!inputQuery.trim() || loading}
            className="absolute right-1.5 bg-[#208661] hover:bg-[#1a6d4f] text-white rounded-lg p-1.5 h-7 w-7"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
          </Button>
        </div>
        <p className="text-[10px] text-slate-400 text-center">
          Powered by DeepSeek MCVRA Engine • Repositions xyflow canvas in real-time
        </p>
      </form>
    </div>
  );
}

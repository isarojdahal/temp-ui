'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  Maximize2,
  Eye,
  FileSpreadsheet,
  AlertCircle,
  Layers,
  SendHorizontal
} from 'lucide-react';
import { chatWithMcvra, chatWithMcvraStream } from '../utils/api';
import { Button } from './ui/button';
import { TreePreviewModal } from './TreePreviewModal';

const ACTION_PILLS = [
  {
    id: 'generate',
    label: '⚡ Generate Assessment Tree',
    prompt: 'Generate assessment tree',
  },
  {
    id: 'rearrange',
    label: 'Re-arrange Nodes',
    prompt: 'Please help me re-arrange the node positions (horizontal or vertical layout).',
  },
  {
    id: 'formulas',
    label: 'Show Formulas',
    prompt: 'Show formulas of all nodes and mathematical rollup equations.',
  },
  {
    id: 'components',
    label: 'Attached Components',
    prompt: 'Show attached components and child hierarchy for each pillar node.',
  },
  {
    id: 'summary',
    label: 'Graph Counts & Summary',
    prompt: 'List counts and summary of criteria, metrics, and question indicators.',
  },
];

export function McvraChatDrawer({
  isOpen,
  onClose,
  mcvraUrl,
  rawTreeData,
  assessmentId,
  userId,
  assessmentName,
  domain,
  facilityType,
  assessmentType,
  frameworkFileContent,
  frameworkFileName,
  surveyColumnsText,
  onApplyUpdatedGraph,
  onFitView
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome-mcvra',
      role: 'assistant',
      content: `### 👋 Welcome to MCVRA Assessment Tree Copilot!

I can generate and interact directly with your multi-criteria assessment graph. Try asking me to:
- **⚡ Generate assessment tree** from your uploaded framework
- **🔄 Re-arrange node positions** (horizontal, vertical, compact, or spacious)
- **📐 Show formulas of nodes** and mathematical rollup equations
- **🌲 Show attached components & child hierarchy** for each pillar
- **📊 List counts and summary** of criteria, metrics, and question indicators`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewTreeData, setPreviewTreeData] = useState(null);
  const [activeProgress, setActiveProgress] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend || !textToSend.trim() || loading) return;

    const lowerText = textToSend.trim().toLowerCase();
    const isGeneratePrompt = [
      'generate assessment tree',
      'generate tree',
      'create tree',
      'build tree',
      'generate mcvra'
    ].some((k) => lowerText.includes(k));

    // If generate is requested but no framework uploaded
    if (isGeneratePrompt && !frameworkFileContent) {
      const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: textToSend.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Framework File Required**\n\nPlease upload your MCVRA assessment framework file (\`.xlsx\`, \`.csv\`, or \`.json\`) on the page sidebar first.\n\nOnce uploaded, click **⚡ Generate Assessment Tree** or ask me again!`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, userMessage, assistantMsg]);
      if (!queryText) setInputQuery('');
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const assistantMsgId = `assistant-${Date.now()}`;
    let accumulatedContent = '';
    let capturedTree = null;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    if (!queryText) setInputQuery('');
    setLoading(true);
    setActiveProgress(null);

    try {
      // Build conversation history for context
      const history = messages
        .filter((m) => m.id !== 'welcome-mcvra' && !m.isStreaming)
        .map((m) => ({ role: m.role, content: m.content }));

      const graphPayload = rawTreeData || [];

      let res = null;
      try {
        res = await chatWithMcvraStream(
          mcvraUrl,
          {
            message: textToSend.trim(),
            assessmentId,
            userId,
            domain: domain || 'health_facility',
            graph: graphPayload,
            assessmentName: assessmentName || 'MCVRA Assessment',
            history,
            facilityType: facilityType || 'health_facility',
            assessmentType: assessmentType || 'flood',
            frameworkFileContent: frameworkFileContent || null,
            surveyFileColumnNames: surveyColumnsText || null,
          },
          (delta, eventData) => {
            if (eventData?.event === 'chunk' && delta) {
              accumulatedContent += delta;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: accumulatedContent, isStreaming: true }
                    : msg
                )
              );
            } else if (eventData?.event === 'progress') {
              setActiveProgress({
                step: eventData.step || 1,
                total_steps: eventData.total_steps || 8,
                title: eventData.title || 'Processing pipeline step...',
                description: eventData.description || '',
              });
            } else if (eventData?.event === 'complete') {
              const fullTree =
                eventData.graph ||
                eventData.updated_graph ||
                eventData.result?.graph;
              if (fullTree && Array.isArray(fullTree) && fullTree.length > 0) {
                capturedTree = fullTree;
              }
            }
          }
        );
      } catch (streamErr) {
        console.warn('MCVRA streaming failed, falling back to sync chat:', streamErr);
        res = await chatWithMcvra(mcvraUrl, {
          message: textToSend.trim(),
          assessmentId,
          userId,
          domain: domain || 'health_facility',
          graph: graphPayload,
          assessmentName: assessmentName || 'MCVRA Assessment',
          history,
          facilityType: facilityType || 'health_facility',
          assessmentType: assessmentType || 'flood',
          frameworkFileContent: frameworkFileContent || null,
          surveyFileColumnNames: surveyColumnsText || null,
        });
      }

      const finalTree =
        capturedTree ||
        res?.graph ||
        res?.updated_graph ||
        res?.result?.graph ||
        (Array.isArray(res) ? res : null);

      const hasTree = Boolean(finalTree && Array.isArray(finalTree) && finalTree.length > 0);

      const replyContent =
        accumulatedContent.trim() ||
        res?.reply ||
        res?.response ||
        res?.message ||
        (hasTree ? 'Assessment tree generated successfully.' : 'No response received.');

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: replyContent,
                action_taken: res?.action_taken,
                summary: res?.summary,
                usage: res?.usage,
                has_updated_tree: hasTree,
                tree_data: finalTree,
                isStreaming: false,
              }
            : msg
        )
      );

      // If user prompted to generate or rearrange, automatically apply or make available
      if (hasTree && onApplyUpdatedGraph) {
        onApplyUpdatedGraph(finalTree);
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

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `⚠️ **Error:** ${errMsg}`,
                isStreaming: false,
                isError: true,
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
      setActiveProgress(null);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome-mcvra-cleared',
        role: 'assistant',
        content: 'Conversation history cleared. How can I help you inspect, generate, or rearrange your MCVRA tree?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-all duration-300 ease-in-out text-slate-800">
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#208661] text-white flex items-center justify-center shadow-xs">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Build with AI
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-[#208661] capitalize">
                {domain ? domain.replace(/_/g, ' ') : 'Live Graph'}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Drishti AI Assessment Tree Copilot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close Assistant"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Framework Status Banner */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 text-slate-600 truncate">
          <FileSpreadsheet size={13} className={frameworkFileContent ? 'text-[#208661]' : 'text-slate-400'} />
          <span className="font-medium truncate">
            {frameworkFileName ? (
              <>Framework: <strong className="text-slate-800">{frameworkFileName}</strong></>
            ) : (
              <span className="text-amber-700 font-medium">No framework uploaded yet</span>
            )}
          </span>
        </div>
        {frameworkFileContent && (
          <span className="text-[10px] bg-emerald-100 text-[#208661] font-semibold px-2 py-0.5 rounded-full shrink-0">
            Ready
          </span>
        )}
      </div>

      {/* Message History Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-white">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs ${
                  isUser ? 'bg-[#208661] text-white' : 'bg-emerald-100 text-[#208661]'
                }`}
              >
                {isUser ? <User size={14} /> : <Bot size={14} />}
              </div>

              <div className={`space-y-1.5 max-w-[88%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-[#208661] text-white rounded-tr-xs'
                      : msg.isError
                      ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                  }`}
                >
                  <div className="chat-markdown">
                    {msg.content ? (
                      <>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 bg-[#208661] ml-0.5 animate-pulse rounded-xs align-middle" />
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 py-1">
                        <Sparkles size={13} className="text-[#208661] animate-pulse" />
                        <span className="italic">Processing request...</span>
                      </div>
                    )}
                  </div>

                  {/* Assessment Tree Ready Card with Preview & Apply actions */}
                  {msg.has_updated_tree && msg.tree_data && (
                    <div className="mt-3 p-3 rounded-xl border border-[#208661]/30 bg-[#e9f3f0]/70 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#208661] text-white flex items-center justify-center shadow-xs">
                            <Sparkles size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#15573f]">Assessment Tree Ready</p>
                            <p className="text-[11px] text-[#2c775a]">
                              {Array.isArray(msg.tree_data) ? `${msg.tree_data.length} nodes generated` : 'Preview and apply to canvas'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewTreeData(msg.tree_data)}
                            className="flex items-center gap-1.5 rounded-lg border border-[#208661] bg-white px-2.5 py-1 text-xs font-semibold text-[#208661] shadow-2xs hover:bg-[#208661] hover:text-white transition cursor-pointer"
                            title="Preview Assessment Tree Graph in Dialog"
                          >
                            <Eye size={13} />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (onApplyUpdatedGraph) {
                                onApplyUpdatedGraph(msg.tree_data);
                              }
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-[#208661] text-white px-2.5 py-1 text-xs font-semibold shadow-2xs hover:bg-[#186a4d] transition cursor-pointer"
                            title="Apply to active ReactFlow canvas"
                          >
                            <CheckCircle2 size={13} />
                            <span>Apply</span>
                          </button>
                        </div>
                      </div>
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

        {/* Streaming Progress Step Indicator */}
        {activeProgress && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <RefreshCw size={12} className="animate-spin text-[#208661]" />
                {activeProgress.title}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Step {activeProgress.step}/{activeProgress.total_steps}
              </span>
            </div>
            {activeProgress.description && (
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {activeProgress.description}
              </p>
            )}
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#208661] h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(10, (activeProgress.step / activeProgress.total_steps) * 100))}%` }}
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Suggestion Pills & Input Area */}
      <div className="shrink-0 border-t border-slate-200 bg-white p-3.5 sm:p-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Quick Suggestions
          </span>
        </div>
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          {ACTION_PILLS.map((action, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => handleSend(action.prompt)}
              className="cursor-pointer whitespace-nowrap rounded-full border border-[#208661]/30 bg-white px-3.5 py-1.5 text-xs font-medium text-[#1a6e50] shadow-2xs transition-all hover:border-[#208661] hover:bg-[#208661] hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            ref={inputRef}
            value={inputQuery}
            disabled={loading}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask to generate tree, rearrange nodes, show formulas, or inspect..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-12 pl-4 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs transition focus:border-[#208661] focus:ring-2 focus:ring-[#208661]/20 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="absolute right-1.5 sm:right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-[#208661] text-white shadow-2xs transition hover:bg-[#1a6e50] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#208661]"
            title="Send Message"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>

      {/* Tree Preview Dialog */}
      {previewTreeData && (
        <TreePreviewModal
          open={Boolean(previewTreeData)}
          onClose={() => setPreviewTreeData(null)}
          treeData={previewTreeData}
          onApply={(treeToApply) => {
            if (onApplyUpdatedGraph) {
              onApplyUpdatedGraph(treeToApply);
            }
          }}
        />
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Sparkles,
  Trash2,
  Key,
  FileText,
  ChevronDown,
  ChevronUp,
  Zap,
  RefreshCw,
  Bot,
  User,
  ExternalLink,
  Plus,
  Search,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Edit2
} from 'lucide-react';
import {
  sendChatStream,
  fetchChatSuggestions,
  clearPipelineCache,
  DEFAULT_RAG_TOKEN
} from '../utils/api';
import { PdfViewerModal } from './PdfViewerModal';
import { Button } from './ui/button';

export function ChatbotView({ chatbotUrl, chatbotOnline, apiKey, setApiKey }) {
  // Chat sessions list stored in localStorage
  const defaultSession = {
    id: `session-default`,
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    messages: [
      {
        id: 'welcome-1',
        role: 'assistant',
        content: 'Hello! I am **Drishti Climate Assistant**. How can I help you analyze climate risk, vulnerability models, or disaster assessment guidelines today?',
        sources: [],
        timestamp: '10:00 AM'
      }
    ]
  };

  const [sessions, setSessions] = useState([defaultSession]);
  const [activeSessionId, setActiveSessionId] = useState(defaultSession.id);
  const [isClient, setIsClient] = useState(false);

  // Sync localStorage only on client mount
  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem('drishti_chat_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
        }
      } catch (e) { }
    }
  }, []);

  const [historySidebarOpen, setHistorySidebarOpen] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const [inputQuery, setInputQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isChatMode, setIsChatMode] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [activeSources, setActiveSources] = useState({});
  const [currentStreamMessage, setCurrentStreamMessage] = useState(null);
  const [pdfPreviewState, setPdfPreviewState] = useState(null);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleText, setEditingTitleText] = useState('');


  const messagesEndRef = useRef(null);

  // Fallback active session object
  const activeSession = sessions.find((s) => s?.id === activeSessionId) || sessions[0] || { id: 'fallback', title: 'New Conversation', messages: [] };
  const activeMessages = activeSession ? (activeSession.messages || []) : [];

  // Ensure activeSessionId is valid
  useEffect(() => {
    if (!sessions.some(s => s.id === activeSessionId) && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Save sessions to localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('drishti_chat_sessions', JSON.stringify(sessions));
      }
    } catch (e) { }
  }, [sessions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages, currentStreamMessage]);

  // Fetch initial chat suggestions
  useEffect(() => {
    async function loadInitialData() {
      const sugData = await fetchChatSuggestions(chatbotUrl, apiKey, 4);
      if (sugData && sugData.suggestions) {
        setSuggestions(sugData.suggestions);
      }
    }
    loadInitialData();
  }, [chatbotUrl, apiKey]);

  // Create new chat session
  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSession = {
      id: newId,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: 'New chat session started. Ask Drishti AI about climate hazards, vulnerability metrics, or framework rules.',
          sources: [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
  };

  // Delete chat session
  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      handleNewChat();
      return;
    }
    const filtered = sessions.filter((s) => s.id !== sessionId);
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0].id);
    }
  };

  // Update messages for active session
  const updateActiveMessages = (newMessages, autoTitlePrompt = null) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === activeSessionId) {
          let updatedTitle = session.title;
          if (autoTitlePrompt && (session.title === 'New Conversation' || !session.title)) {
            updatedTitle = autoTitlePrompt.slice(0, 32) + (autoTitlePrompt.length > 32 ? '...' : '');
          }
          return {
            ...session,
            title: updatedTitle,
            messages: newMessages
          };
        }
        return session;
      })
    );
  };

  const handleSend = async (queryText) => {
    const text = queryText || inputQuery;
    if (!text || !text.trim() || isStreaming) return;

    const userMessageId = `user-${Date.now()}`;
    const userMsg = {
      id: userMessageId,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...activeMessages, userMsg];
    updateActiveMessages(newHistory, text.trim());
    setInputQuery('');
    setIsStreaming(true);

    const assistantMsgId = `asst-${Date.now()}`;
    let streamedContent = '';
    let streamSources = [];
    let isCached = false;

    setCurrentStreamMessage({
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      sources: [],
      cached: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    await sendChatStream({
      baseUrl: chatbotUrl,
      apiKey: apiKey || DEFAULT_RAG_TOKEN,
      query: text.trim(),
      conversationId: activeSessionId,
      messagesHistory: newHistory.filter(m => !m.id.startsWith('welcome-')),
      isChatMode,
      onChunk: (chunkText) => {
        streamedContent += chunkText;
        setCurrentStreamMessage((prev) => ({
          ...prev,
          content: streamedContent
        }));
      },
      onMetadata: (metadata) => {
        if (metadata.sources) streamSources = metadata.sources;
        if (metadata.cached) isCached = true;
        setCurrentStreamMessage((prev) => ({
          ...prev,
          sources: streamSources,
          cached: isCached
        }));
      },
      onError: (errMessage) => {
        const errorContent = streamedContent
          ? `${streamedContent}\n\n*⚠️ Stream error: ${errMessage}*`
          : `⚠️ Failed to get response: ${errMessage}`;

        const finalMessages = [
          ...newHistory,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: errorContent,
            sources: [],
            error: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
        updateActiveMessages(finalMessages);
        setCurrentStreamMessage(null);
        setIsStreaming(false);
      },
      onComplete: () => {
        const finalMessages = [
          ...newHistory,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: streamedContent || 'No response content received.',
            sources: streamSources,
            cached: isCached,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
        updateActiveMessages(finalMessages);
        setCurrentStreamMessage(null);
        setIsStreaming(false);
      }
    });
  };

  const handleClearCache = async () => {
    try {
      await clearPipelineCache(chatbotUrl, apiKey);
      alert('Pipeline cache cleared successfully!');
    } catch (e) {
      alert(`Cache clear error: ${e.message}`);
    }
  };

  const toggleSources = (msgId) => {
    setActiveSources((prev) => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="flex h-full w-full bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      {/* 1. Left History Sidebar */}
      <div
        className={`sidebar-container-rich bg-white border-r border-slate-200 shadow-xs ${historySidebarOpen ? 'w-64' : 'w-0 overflow-hidden p-0 border-none'
          }`}
      >
        <div className="p-3.5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <Button
            variant="gradient"
            size="sm"
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 bg-[#208661] hover:bg-[#1a6d4f] text-white h-9 rounded-xl font-semibold shadow-xs"
          >
            <Plus size={15} /> Start New Chat
          </Button>
        </div>

        {/* Search */}
        <div className="px-3.5 pt-3.5 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search chat history..."
              className="input-rich pl-9 text-xs py-2 rounded-xl border-slate-200"
            />
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Conversations ({filteredSessions.length})
          </div>

          {filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-all ${isActive
                  ? 'bg-[#e9f3f0] border border-[#208661]/30 text-[#208661] font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                  }`}
              >
                <div className="flex items-center gap-2.5 truncate max-w-[170px]">
                  <MessageSquare size={14} className={isActive ? 'text-[#208661]' : 'text-slate-400'} />
                  {editingTitleId === session.id ? (
                    <input
                      type="text"
                      value={editingTitleText}
                      onChange={(e) => setEditingTitleText(e.target.value)}
                      onBlur={() => {
                        setSessions((prev) =>
                          prev.map((s) => s.id === session.id ? { ...s, title: editingTitleText } : s)
                        );
                        setEditingTitleId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setSessions((prev) =>
                            prev.map((s) => s.id === session.id ? { ...s, title: editingTitleText } : s)
                          );
                          setEditingTitleId(null);
                        }
                      }}
                      autoFocus
                      className="input-rich text-xs p-0 px-1 bg-white text-slate-900"
                    />
                  ) : (
                    <span className="truncate">{session.title}</span>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTitleId(session.id);
                      setEditingTitleText(session.title);
                    }}
                    className="h-6 w-6 text-slate-400 hover:text-slate-700"
                    title="Rename chat session"
                  >
                    <Edit2 size={12} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="h-6 w-6 text-slate-400 hover:text-rose-600"
                    title="Delete session"
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Main Chat Conversation Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#f8fafc]">
        {/* Top Control Bar */}
        <div className="h-13 border-b border-slate-200 px-5 flex items-center justify-between bg-white shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setHistorySidebarOpen(!historySidebarOpen)}
              title={historySidebarOpen ? 'Hide History Sidebar' : 'Show History Sidebar'}
            >
              {historySidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </Button>

            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-md block">
                {activeSession ? activeSession.title : 'Climate AI Chatbot'}
              </span>
              <span className="text-[11px] text-slate-500 block">RAG Document Grounded Pipeline</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-100 border border-slate-200 p-1 rounded-xl flex gap-1">
              <Button
                variant={isChatMode ? 'default' : 'ghost'}
                size="xs"
                onClick={() => setIsChatMode(true)}
                className="rounded-lg text-[11px]"
              >
                Multi-Turn
              </Button>
              <Button
                variant={!isChatMode ? 'default' : 'ghost'}
                size="xs"
                onClick={() => setIsChatMode(false)}
                className="rounded-lg text-[11px]"
              >
                Stateless Query
              </Button>
            </div>

            <Button
              variant="outline"
              size="xs"
              onClick={() => setShowKeyModal(true)}
              title="Configure API key"
              className="rounded-lg"
            >
              <Key size={13} /> Token
            </Button>

            <Button
              variant="outline"
              size="xs"
              onClick={handleClearCache}
              title="Clear pipeline cache"
              className="rounded-lg"
            >
              <Zap size={13} /> Clear Cache
            </Button>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 w-full">
          {/* Welcome Prompt Chips */}
          {activeMessages.length <= 2 && suggestions.length > 0 && (
            <div className="my-4 card-rich p-5 space-y-3.5 border-slate-200 shadow-xs">
              <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles size={17} className="text-amber-600 animate-pulse" /> AI-Grounded Climate Prompt Starters
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestions.map((sug) => (
                  <button
                    key={sug.id}
                    onClick={() => handleSend(sug.prompt)}
                    disabled={isStreaming}
                    className="text-left p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#208661] hover:bg-[#e9f3f0]/60 transition-all space-y-1.5 group cursor-pointer shadow-xs"
                  >
                    <span className="text-[10px] font-bold text-[#208661] uppercase tracking-wider block">
                      {sug.category || 'Topic'}
                    </span>
                    <span className="text-slate-800 block text-xs sm:text-sm group-hover:text-[#208661] font-medium leading-snug">
                      {sug.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Messages Feed */}
          {activeMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 text-xs sm:text-sm ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center shrink-0 shadow-xs mt-1">
                  <Bot size={17} className="text-[#208661]" />
                </div>
              )}

              <div className={`space-y-1.5 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-400 px-1">
                  <span className="font-semibold text-slate-700">{msg.role === 'user' ? 'You' : 'Drishti AI'}</span>
                  <span>{msg.timestamp}</span>
                  {msg.cached && <span className="text-amber-600 flex items-center gap-0.5"><Zap size={10} /> Cached</span>}
                </div>

                <div className={`p-4 sm:p-5 rounded-2xl text-xs sm:text-sm leading-relaxed ${msg.role === 'user'
                  ? 'bg-[#208661] text-white rounded-tr-xs shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-xs'
                  }`}>
                  {msg.role === 'assistant' ? (
                    <div className="markdown-content">
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>

                {/* Grounded Citation Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="pt-1">
                    <Button
                      variant="cyan"
                      size="xs"
                      onClick={() => toggleSources(msg.id)}
                      className="rounded-lg px-2.5 py-1 text-[11px]"
                    >
                      <FileText size={12} /> {msg.sources.length} Grounded PDF Citations
                      {activeSources[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </Button>

                    {activeSources[msg.id] && (
                      <div className="mt-2.5 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs shadow-xs">
                        {msg.sources.map((src, idx) => {
                          const rawTitle = src.title || src.documentName || src.documentId || src.source || src.document || 'Document';
                          const cleanName = rawTitle.replace(/\.pdf$/i, '');
                          const pageNum = src.page || src.page_number || null;
                          const filenameToOpen = src.documentId || src.title || src.documentName || src.source || 'Document.pdf';

                          return (
                            <div key={idx} className="border-b border-slate-200 pb-2.5 last:border-none">
                              <div className="flex justify-between items-center font-semibold text-[#208661]">
                                <span className="truncate max-w-[320px]">
                                  {idx + 1}. {cleanName} {pageNum ? `(Page ${pageNum})` : ''}
                                </span>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => setPdfPreviewState({ filename: filenameToOpen, page: pageNum })}
                                  className="rounded-lg text-[11px]"
                                >
                                  <ExternalLink size={11} /> Preview PDF
                                </Button>
                              </div>
                              {src.content_preview && (
                                <p className="text-[11px] text-slate-500 italic mt-1.5 bg-white p-2 rounded-lg border border-slate-200 leading-relaxed">
                                  "{src.content_preview}"
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-[#208661]/15 border border-[#208661]/30 flex items-center justify-center shrink-0 shadow-xs mt-1">
                  <User size={16} className="text-[#208661]" />
                </div>
              )}
            </div>
          ))}

          {/* Real-time Streaming message */}
          {currentStreamMessage && (
            <div className="flex gap-3 text-xs sm:text-sm justify-start">
              <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center shrink-0 shadow-xs mt-1">
                <Bot size={17} className="text-[#208661] animate-pulse" />
              </div>
              <div className="space-y-1.5 max-w-[85%]">
                <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-400 px-1">
                  <span className="font-semibold text-slate-700">Drishti AI</span>
                  <span className="text-[#208661] animate-pulse font-medium">Streaming response...</span>
                </div>
                <div className="p-4 sm:p-5 rounded-2xl text-xs sm:text-sm leading-relaxed bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-xs">
                  <div className="markdown-content">
                    <ReactMarkdown>
                      {currentStreamMessage.content || '...'}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white shrink-0 shadow-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="w-full flex items-center gap-3"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask Drishti AI about climate hazards, vulnerability metrics, framework rules..."
              disabled={isStreaming}
              className="input-rich flex-1 text-xs sm:text-sm py-3.5 px-5 rounded-full border-slate-300 focus:border-[#208661] shadow-xs"
            />
            <Button
              type="submit"
              variant="gradient"
              size="default"
              disabled={isStreaming || !inputQuery.trim()}
              className="rounded-full px-6 h-11 bg-[#208661] hover:bg-[#1a6d4f] text-white shadow-xs shrink-0"
            >
              {isStreaming ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </form>
        </div>
      </div>

      {/* PDF Modal */}
      {pdfPreviewState && (
        <PdfViewerModal
          filename={pdfPreviewState.filename}
          page={pdfPreviewState.page}
          chatbotUrl={chatbotUrl}
          onClose={() => setPdfPreviewState(null)}
        />
      )}


      {/* Token Modal */}
      {showKeyModal && (
        <div className="pdf-modal-backdrop" onClick={() => setShowKeyModal(false)}>
          <div className="card-rich w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Configure Service Token</h3>
            <p className="text-xs text-slate-400">
              Set the <code>api-key</code> header token required for RAG pipeline access.
            </p>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="input-rich font-mono text-xs"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={() => setShowKeyModal(false)} variant="gradient" size="sm">
                Save & Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

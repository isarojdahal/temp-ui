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
  ExternalLink,
  MessageSquare,
  FileText,
  Zap,
  Info
} from 'lucide-react';
import { sendChatStream, fetchChatSuggestions } from '../utils/api';
import { Button } from './ui/button';

export function FloatingChatDrawer({
  isOpen,
  onClose,
  chatbotUrl,
  chatbotOnline,
  apiKey
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome-drawer',
      role: 'assistant',
      content: 'Hi! I am your **Climate AI Copilot**. Ask me anything about MCVRA criteria, vulnerability metrics, or hazard assessment guidelines.',
      sources: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSources, setActiveSources] = useState({});
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Load chat suggestions on mount
  useEffect(() => {
    async function loadSuggestions() {
      if (chatbotOnline) {
        const list = await fetchChatSuggestions(chatbotUrl, apiKey);
        if (list && list.length > 0) {
          setSuggestions(list);
        }
      }
    }
    loadSuggestions();
  }, [chatbotOnline, chatbotUrl, apiKey]);

  const handleSend = async (queryText) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend || !textToSend.trim() || isStreaming) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!queryText) setInputQuery('');
    setIsStreaming(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      sources: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, initialAssistantMsg]);

    let accumulatedContent = '';
    let accumulatedSources = [];

    try {
      await sendChatStream(
        chatbotUrl,
        {
          message: textToSend,
          chat_history: messages.map((m) => ({ role: m.role, content: m.content }))
        },
        apiKey,
        (token) => {
          accumulatedContent += token;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          );
        },
        (sourcesData) => {
          if (Array.isArray(sourcesData)) {
            accumulatedSources = sourcesData;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, sources: sourcesData }
                  : msg
              )
            );
          }
        }
      );
    } catch (err) {
      console.error('Drawer Chat Stream error:', err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: accumulatedContent || '⚠️ Failed to connect to Climate AI backend.' }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: 'Conversation reset. How can I assist you with climate risk assessment tree models?',
        sources: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const defaultPrompts = [
    'Suggest MCVRA Criteria for Flood Risk',
    'How do I calculate Health Vulnerability index?',
    'Explain Raster Layer weighting formulas'
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white/98 backdrop-blur-xl border-l border-slate-200 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#208661] p-0.5 shadow-md flex items-center justify-center">
            <Sparkles size={16} className="text-white animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              Climate AI Copilot
              <span className={`w-2 h-2 rounded-full ${chatbotOnline ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
            </h3>
            <p className="text-[10px] text-slate-500">RAG Assistant Drawer</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearHistory}
            title="Clear Chat"
            className="h-7 w-7 text-slate-500 hover:text-slate-900"
          >
            <Trash2 size={14} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title="Close Drawer"
            className="h-7 w-7 text-slate-500 hover:text-slate-900"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="p-2.5 bg-slate-50 border-b border-slate-200 overflow-x-auto flex gap-1.5 no-scrollbar">
        {(suggestions.length > 0 ? suggestions.slice(0, 4) : defaultPrompts).map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            disabled={isStreaming}
            className="shrink-0 text-[10px] font-medium bg-[#e9f3f0] text-[#208661] border border-[#63ab91]/40 hover:border-[#208661] px-2.5 py-1 rounded-lg transition text-left flex items-center gap-1"
          >
            <Zap size={10} className="text-amber-600 shrink-0" />
            <span className="truncate max-w-[160px]">{prompt}</span>
          </button>
        ))}
      </div>

      {/* Messages Stream Container */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs bg-slate-50/50">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white shadow-sm ${isUser ? 'bg-[#208661]' : 'bg-slate-200'
                  }`}
              >
                {isUser ? <User size={14} /> : <Bot size={14} className="text-[#208661]" />}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl p-3 space-y-1.5 shadow-sm border ${isUser
                  ? 'bg-[#208661] border-[#208661] text-white rounded-tr-none shadow-sm'
                  : 'bg-white border-slate-200 text-slate-800 rounded-tl-none'
                  }`}
              >
                <div className={`prose ${isUser ? 'prose-invert' : ''} prose-xs max-w-none break-words`}>
                  {msg.content ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500 py-1 font-mono text-[11px]">
                      <RefreshCw size={12} className="animate-spin text-[#208661]" />
                      Generating response...
                    </div>
                  )}
                </div>

                {/* Sources list */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                      <FileText size={10} className="text-[#208661]" /> Grounded Sources:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {msg.sources.map((src, i) => (
                        <span
                          key={i}
                          className="text-[9px] bg-slate-100 text-[#208661] px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1 font-medium"
                        >
                          {src.file_name || src.document || `Doc #${i + 1}`}
                          {src.page_number && ` (p.${src.page_number})`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <span className={`text-[9px] block text-right ${isUser ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-slate-200 bg-white flex gap-2"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask Climate AI Assistant..."
          disabled={isStreaming}
          className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#208661]"
        />
        <Button
          type="submit"
          variant="gradient"
          size="sm"
          disabled={isStreaming || !inputQuery.trim()}
          className="px-3 bg-[#208661] hover:bg-[#1a6d4f] text-white"
        >
          {isStreaming ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
        </Button>
      </form>
    </div>
  );
}

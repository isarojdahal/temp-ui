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
  Wand2,
  Layout,
  CheckCircle2,
  ArrowRight,
  Globe,
  AlertCircle,
  FileText,
  Sliders,
  Layers,
  Zap,
} from 'lucide-react';
import { chatWithScorecard } from '../utils/scorecardApi';
import { Button } from './ui/button';

export function ScorecardChatDrawer({
  isOpen,
  onClose,
  scorecardUrl,
  document,
  assessmentId,
  domain,
  userId,
  assessmentName,
  facilityType,
  hazardType,
  layoutSize,
  language,
  indicators,
  overallScore,
  surveyItems,
  onApplyDocument,
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome-scorecard',
      role: 'assistant',
      content: `### 👋 Welcome to Risk Scorecard Copilot!

I can help you build, customize, and refine your risk scorecard dashboard in real-time. Try asking me to:
- **⚡ Generate a scorecard** from your active MCVRA indicators and survey attributes
- **📐 Change canvas layout** between **A4**, **A3**, or **Full Width**
- **🚨 Update risk status or scores** (e.g. "Set overall risk status to Critical")
- **💡 Add mitigation recommendations** to the qualitative interpretation section
- **🇳🇵 Translate the dashboard** into Nepali, Hindi, or English
- **📊 Analyze & summarize** key vulnerability drivers and findings`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
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
    { label: '⚡ Generate Scorecard', query: 'Generate a complete risk scorecard dashboard with profile, indicators, and interpretation.' },
    { label: '📐 Switch to A3 Layout', query: 'Change canvas layout to A3 for an expanded dashboard presentation.' },
    { label: '↔️ Switch to A4 Layout', query: 'Change canvas layout to standard A4 printable format.' },
    { label: '🚨 Set Status: Critical', query: 'Update overall risk status to Critical and highlight high-risk indicators.' },
    { label: '🇳🇵 Translate to Nepali', query: 'Translate all headings, labels, and qualitative interpretation into Nepali.' },
    { label: '💡 Add Mitigation Plan', query: 'Add actionable emergency mitigation recommendations to the interpretation section.' },
    { label: '📊 Summarize Risk Drivers', query: 'Summarize the primary risk drivers and critical vulnerabilities from this assessment.' },
  ];

  const handleSend = async (queryText) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend || !textToSend.trim() || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const assistantMsgId = `assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isLoading: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    if (!queryText) setInputQuery('');
    setLoading(true);

    try {
      // Build conversation history for context
      const history = messages
        .filter((m) => m.id !== 'welcome-scorecard' && !m.isLoading)
        .map((m) => ({ role: m.role, content: m.content }));

      // Map survey key-values
      const surveyValues = {};
      (surveyItems || []).forEach((item) => {
        if (item.key && item.key.trim()) {
          surveyValues[item.key.trim()] = item.value;
        }
      });

      // Build evaluated MCVRA indicators format
      const mcvraGraphJson = {
        overall_score: Number(overallScore) || 68.5,
        overall_scale: [0.0, 100.0],
        pillars: [
          { name: 'Hazard & Exposure', score: 75.0, scale: [0.0, 100.0] },
          { name: 'Physical Vulnerability', score: 62.0, scale: [0.0, 100.0] },
        ],
        indicators: (indicators || []).map((row) => ({
          name: row.name,
          pillar: row.pillar,
          category: row.category,
          score: Number(row.score) || 0,
          scale: [Number(row.scaleMin) || 0, Number(row.scaleMax) || 100],
          unit: row.unit || '%',
          weight: 1.0,
          status:
            Number(row.score) >= 70
              ? 'critical'
              : Number(row.score) >= 50
                ? 'high'
                : Number(row.score) >= 30
                  ? 'moderate'
                  : 'low',
        })),
      };

      const cardProfileDetails = {
        assessment_id: assessmentId || 'scorecard-01',
        title: assessmentName || 'Risk Scorecard',
        facility_name: assessmentName,
        facility_type: facilityType || 'Primary Health Clinic',
        hazard_type: hazardType || 'Monsoon Riverine Flood',
        domain: domain || 'health_facility',
        user_id: userId || 'analyst-1',
        layout_size: layoutSize || 'a4',
        language: language || 'en',
        persist: false,
      };

      const payload = {
        message: textToSend.trim(),
        document: document || null,
        card_profile_detatils: cardProfileDetails,
        mcvra_graph_json_with_scores: mcvraGraphJson,
        survey_col_name_and_values: Object.keys(surveyValues).length
          ? surveyValues
          : {
            building_construction: 'Reinforced Concrete',
            flood_barrier_present: 'No',
            backup_power_elevated: 'Yes',
            emergency_water_supply_days: 3,
          },
        assessment_id: assessmentId,
        domain,
        user_id: userId,
        assessment_name: assessmentName,
        layout_size: layoutSize,
        language,
        history,
      };

      const res = await chatWithScorecard(scorecardUrl, payload);

      const returnedDoc = res?.document;
      const hasUpdatedDoc = Boolean(returnedDoc && returnedDoc.root);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
              ...msg,
              content: res?.reply || 'Scorecard processed successfully.',
              has_updated_doc: hasUpdatedDoc,
              updated_doc: returnedDoc,
              isLoading: false,
            }
            : msg
        )
      );

      // Auto-apply generated or modified document to the live Puck canvas
      if (hasUpdatedDoc && onApplyDocument) {
        onApplyDocument(returnedDoc, 'Scorecard updated by AI Copilot.');
      }
    } catch (err) {
      console.error('Scorecard chat error:', err);
      let errMsg = 'Failed to process request with Scorecard Assistant.';
      if (err.response?.data?.detail) {
        errMsg =
          typeof err.response.data.detail === 'string'
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
              isLoading: false,
            }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome-scorecard-cleared',
        role: 'assistant',
        content: 'Conversation history cleared. How can I help you design, edit, or customize your risk scorecard?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl flex flex-col transition-all duration-300 ease-in-out text-slate-800">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#208661] text-white flex items-center justify-center shadow-md shadow-[#208661]/20">
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Build with AI
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-[#208661] border border-emerald-300/60 capitalize">
                {document ? `Layout: ${document.layout_size || layoutSize || 'A4'}` : 'Live Dashboard'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Drishti AI Scorecard Copilot
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
      <div className="px-4 py-3 bg-slate-100/70 border-b border-slate-200 overflow-x-auto flex gap-2 scrollbar-none">
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            disabled={loading}
            onClick={() => handleSend(action.query)}
            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white hover:bg-[#e9f3f0] hover:text-[#208661] border border-slate-200 text-xs font-semibold text-slate-700 transition shadow-xs disabled:opacity-50 disabled:pointer-events-none"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 text-xs leading-relaxed ${msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
          >
            {msg.role !== 'user' && (
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#208661] border border-[#63ab91]/40 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <Bot size={15} />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-xs space-y-2 ${msg.role === 'user'
                  ? 'bg-[#208661] text-white rounded-br-xs'
                  : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs'
                }`}
            >
              <div className="prose prose-xs max-w-none text-inherit dark:prose-invert">
                {msg.isLoading ? (
                  <div className="flex items-center gap-2 py-1 text-slate-500">
                    <RefreshCw size={14} className="animate-spin text-[#208661]" />
                    <span className="text-xs font-medium">Processing scorecard request...</span>
                  </div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>

              {/* Document Applied Badge & Re-apply button */}
              {msg.has_updated_doc && msg.updated_doc && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 size={13} className="text-[#208661]" />
                    <span>Canvas Synced</span>
                    <span className="text-slate-400 font-normal">
                      ({msg.updated_doc.layout_size?.toUpperCase() || 'A4'})
                    </span>
                  </div>
                  {onApplyDocument && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onApplyDocument(msg.updated_doc, 'Re-applied scorecard to canvas.')}
                      className="text-[10px] h-6 px-2 py-0 border-[#208661]/40 text-[#208661] hover:bg-[#e9f3f0]"
                    >
                      Re-apply
                    </Button>
                  )}
                </div>
              )}

              <div
                className={`text-[10px] text-right font-medium ${msg.role === 'user' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
              >
                {msg.timestamp}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <User size={15} />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 sm:p-4 bg-slate-50/90 border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={inputQuery}
            disabled={loading}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask to generate, change layout, update score, or translate..."
            className="w-full pl-3.5 pr-11 py-2.5 text-xs bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#208661]/30 focus:border-[#208661] text-slate-800 placeholder-slate-400 shadow-xs transition"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="absolute right-1.5 p-1.5 bg-[#208661] text-white rounded-lg hover:bg-[#186a4c] disabled:opacity-40 disabled:hover:bg-[#208661] transition shadow-sm"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>
        <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-slate-400">
          <span>Powered by DeepSeek & Schema-Constrained Engine</span>
          <span>Port 10001</span>
        </div>
      </div>
    </div>
  );
}

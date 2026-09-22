import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { McvraVisualizer } from './components/McvraVisualizer';
import { ScorecardView } from './components/ScorecardView';
import { ChatbotView } from './components/ChatbotView';
import { FloatingChatDrawer } from './components/FloatingChatDrawer';
import {
  DEFAULT_MCVRA_URL,
  DEFAULT_SCORECARD_URL,
  DEFAULT_CHATBOT_URL,
  DEFAULT_RAG_TOKEN,
  checkMcvraHealth,
  checkScorecardHealth,
  checkChatbotHealth
} from './utils/api';
import { Button } from './components/ui/button';
import { Sparkles, Settings, X, Sliders, Server } from 'lucide-react';
import { getGlobalConfig, saveGlobalConfig } from './utils/config';

const VALID_TABS = new Set(['mcvra', 'scorecard', 'chatbot']);
const MCVRA_CONTEXT_STORAGE_KEY = 'drishti_mcvra_graph_context';

export default function App() {
  const initialConfig = getGlobalConfig();
  const [activeTab, setActiveTab] = useState('mcvra');
  const [mcvraUrl, setMcvraUrl] = useState(initialConfig.mcvraUrl);
  const [scorecardUrl, setScorecardUrl] = useState(initialConfig.scorecardUrl);
  const [chatbotUrl, setChatbotUrl] = useState(initialConfig.chatbotUrl);
  const [apiKey, setApiKey] = useState(initialConfig.apiKey);
  const [assessmentId, setAssessmentId] = useState(initialConfig.assessmentId);
  const [domain, setDomain] = useState(initialConfig.domain);
  const [userId, setUserId] = useState(initialConfig.userId);

  const [draftSettings, setDraftSettings] = useState(initialConfig);

  const [mcvraOnline, setMcvraOnline] = useState(false);
  const [scorecardOnline, setScorecardOnline] = useState(false);
  const [chatbotOnline, setChatbotOnline] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [mcvraGraphContext, setMcvraGraphContext] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('drishti_active_tab');
      if (savedTab && VALID_TABS.has(savedTab)) {
        setActiveTab(savedTab);
      }

      const savedGraph = localStorage.getItem(MCVRA_CONTEXT_STORAGE_KEY);
      if (savedGraph) {
        try {
          const parsedGraph = JSON.parse(savedGraph);
          const hasNodes = Array.isArray(parsedGraph?.nodes) && parsedGraph.nodes.length > 0;
          const hasRawGraph = parsedGraph?.rawTreeData && typeof parsedGraph.rawTreeData === 'object';
          if ((hasNodes || hasRawGraph) && Array.isArray(parsedGraph?.edges)) {
            setMcvraGraphContext(parsedGraph);
          }
        } catch {
          localStorage.removeItem(MCVRA_CONTEXT_STORAGE_KEY);
        }
      }
    }
  }, []);

  const handleOpenSettings = () => {
    setDraftSettings({
      assessmentId,
      domain,
      userId,
      mcvraUrl,
      scorecardUrl,
      chatbotUrl,
      apiKey,
    });
    setShowSettingsModal(true);
  };

  const handleSaveSettings = () => {
    setAssessmentId(draftSettings.assessmentId);
    setDomain(draftSettings.domain);
    setUserId(draftSettings.userId);
    setMcvraUrl(draftSettings.mcvraUrl);
    setScorecardUrl(draftSettings.scorecardUrl);
    setChatbotUrl(draftSettings.chatbotUrl);
    setApiKey(draftSettings.apiKey);

    saveGlobalConfig(draftSettings);
    setShowSettingsModal(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('drishti_active_tab', tab);
    }
  };

  const handleGraphChange = (context) => {
    setMcvraGraphContext(context);
    if (typeof window !== 'undefined' && context?.nodes?.length) {
      try {
        localStorage.setItem(MCVRA_CONTEXT_STORAGE_KEY, JSON.stringify(context));
      } catch {
        // Graph persistence is best effort; the active session remains usable.
      }
    }
  };

  const pollHealth = async () => {
    const mcvraStatus = await checkMcvraHealth(mcvraUrl);
    const scorecardStatus = await checkScorecardHealth(scorecardUrl);
    const chatbotStatus = await checkChatbotHealth(chatbotUrl);
    setMcvraOnline(mcvraStatus);
    setScorecardOnline(scorecardStatus);
    setChatbotOnline(chatbotStatus);
  };

  useEffect(() => {
    pollHealth();
    const interval = setInterval(pollHealth, 10000);
    return () => clearInterval(interval);
  }, [mcvraUrl, scorecardUrl, chatbotUrl]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070a12] text-slate-100 font-sans">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        mcvraOnline={mcvraOnline}
        chatbotOnline={chatbotOnline}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={activeTab === 'mcvra' ? setSidebarOpen : null}
        onOpenSettings={handleOpenSettings}
        onToggleChatDrawer={() => setIsChatDrawerOpen((prev) => !prev)}
      />

      {/* Main Feature Workspace View - every tab stays mounted (visibility
          toggled with CSS) so switching tabs never destroys component state
          such as the generated MCVRA graph, in-progress scorecard edits, or
          chat history. */}
      <main className="flex-1 min-h-0 h-full w-full flex flex-col overflow-hidden relative">
        <div className={activeTab === 'mcvra' ? 'flex-1 min-h-0 h-full w-full flex flex-col overflow-hidden' : 'hidden'}>
          <McvraVisualizer
            mcvraUrl={mcvraUrl}
            mcvraOnline={mcvraOnline}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            onGraphChange={handleGraphChange}
            isActive={activeTab === 'mcvra'}
            assessmentId={assessmentId}
            domain={domain}
            userId={userId}
          />
        </div>

        <div className={activeTab === 'scorecard' ? 'flex-1 min-h-0 h-full w-full flex flex-col overflow-hidden' : 'hidden'}>
          <ScorecardView
            scorecardUrl={scorecardUrl}
            scorecardOnline={scorecardOnline}
            mcvraUrl={mcvraUrl}
            mcvraOnline={mcvraOnline}
            mcvraGraphContext={mcvraGraphContext}
            assessmentId={assessmentId}
            domain={domain}
            userId={userId}
          />
        </div>

        <div className={activeTab === 'chatbot' ? 'flex-1 min-h-0 h-full w-full flex flex-col overflow-hidden' : 'hidden'}>
          <ChatbotView
            chatbotUrl={chatbotUrl}
            chatbotOnline={chatbotOnline}
            apiKey={apiKey}
            setApiKey={setApiKey}
          />
        </div>
      </main>

      {/* Settings Modal Overlay */}
      {showSettingsModal && (
        <div className="pdf-modal-backdrop" onClick={() => setShowSettingsModal(false)}>
          <div
            className="card-rich w-full max-w-lg space-y-4 bg-white text-slate-900 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#e9f3f0] text-[#208661]">
                  <Settings size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Drishti AI System Settings
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure global assessment parameters and backend service endpoints
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
              {/* Section 1: Assessment & Tenancy Configuration */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <Sliders size={13} className="text-[#208661]" />
                  <span>Assessment & Tenancy Context</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-slate-600 block mb-1 font-semibold text-[11px]">Assessment ID</label>
                    <input
                      type="text"
                      value={draftSettings.assessmentId}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({ ...prev, assessmentId: e.target.value }))
                      }
                      placeholder="demo-assessment"
                      className="input-rich font-mono text-xs w-full"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-semibold text-[11px]">Domain / Tenant</label>
                    <input
                      type="text"
                      value={draftSettings.domain}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({ ...prev, domain: e.target.value }))
                      }
                      placeholder="health_facility"
                      className="input-rich font-mono text-xs w-full"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-semibold text-[11px]">User / Analyst ID</label>
                    <input
                      type="text"
                      value={draftSettings.userId}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({ ...prev, userId: e.target.value }))
                      }
                      placeholder="analyst-1"
                      className="input-rich font-mono text-xs w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Backend API Services */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <Server size={13} className="text-[#208661]" />
                  <span>Backend Service Endpoints</span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-slate-600 block mb-1 font-semibold text-[11px]">MCVRA Generator API Host</label>
                    <input
                      type="text"
                      value={draftSettings.mcvraUrl}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({ ...prev, mcvraUrl: e.target.value }))
                      }
                      className="input-rich font-mono text-xs w-full"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-semibold text-[11px]">Scorecard Generator API Host</label>
                    <input
                      type="text"
                      value={draftSettings.scorecardUrl}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({ ...prev, scorecardUrl: e.target.value }))
                      }
                      className="input-rich font-mono text-xs w-full"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-semibold text-[11px]">Climate Chatbot RAG API Host</label>
                    <input
                      type="text"
                      value={draftSettings.chatbotUrl}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({ ...prev, chatbotUrl: e.target.value }))
                      }
                      className="input-rich font-mono text-xs w-full"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-semibold text-[11px]">Service Token (api-key Header)</label>
                    <input
                      type="text"
                      value={draftSettings.apiKey}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({ ...prev, apiKey: e.target.value }))
                      }
                      placeholder="Enter API Key / Token"
                      className="input-rich font-mono text-xs w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettingsModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="gradient"
                size="sm"
                onClick={handleSaveSettings}
              >
                Save & Apply Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Copilot Trigger Button (Bottom-Right, hidden on chatbot, mcvra, and scorecard tabs) */}
      {!isChatDrawerOpen && activeTab !== 'chatbot' && activeTab !== 'mcvra' && activeTab !== 'scorecard' && (
        <button
          onClick={() => setIsChatDrawerOpen(true)}
          className="fixed bottom-20 right-6 z-40 bg-[#208661] hover:bg-[#1a6d4f] text-white shadow-xl shadow-[#208661]/25 px-4 py-3 rounded-full flex items-center gap-2.5 transition-all hover:scale-105 group border border-emerald-300/30"
          title="Open AI Copilot Chat Drawer"
        >
          <div className="relative">
            <Sparkles size={18} className="text-white animate-pulse" />
            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-900 ${chatbotOnline ? 'bg-emerald-400' : 'bg-rose-500'}`} />
          </div>
          <span className="text-xs font-bold tracking-wide">Climate AI Copilot</span>
        </button>
      )}

      {/* Slide-over AI Chat Drawer Overlay */}
      <FloatingChatDrawer
        isOpen={isChatDrawerOpen}
        onClose={() => setIsChatDrawerOpen(false)}
        chatbotUrl={chatbotUrl}
        chatbotOnline={chatbotOnline}
        apiKey={apiKey}
      />
    </div>
  );
}

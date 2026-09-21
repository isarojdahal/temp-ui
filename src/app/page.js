'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { McvraVisualizer } from '../components/McvraVisualizer';
import { ScorecardView } from '../components/ScorecardView';
import { ChatbotView } from '../components/ChatbotView';
import { DocumentsView } from '../components/DocumentsView';
import { DashboardView } from '../components/DashboardView';
import { FloatingChatDrawer } from '../components/FloatingChatDrawer';
import {
  DEFAULT_MCVRA_URL,
  DEFAULT_CHATBOT_URL,
  DEFAULT_RAG_TOKEN,
  checkMcvraHealth,
  checkChatbotHealth
} from '../utils/api';
import { Button } from '../components/ui/button';
import { Sparkles } from 'lucide-react';

const VALID_TABS = new Set(['mcvra', 'scorecard', 'chatbot', 'documents', 'dashboard']);
const MCVRA_CONTEXT_STORAGE_KEY = 'drishti_mcvra_graph_context';

export default function Home() {
  const [activeTab, setActiveTab] = useState('mcvra');
  const [mcvraUrl, setMcvraUrl] = useState(DEFAULT_MCVRA_URL);
  const [chatbotUrl, setChatbotUrl] = useState(DEFAULT_CHATBOT_URL);
  const [apiKey, setApiKey] = useState(DEFAULT_RAG_TOKEN);
  const [mcvraOnline, setMcvraOnline] = useState(false);
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
    const chatbotStatus = await checkChatbotHealth(chatbotUrl);
    setMcvraOnline(mcvraStatus);
    setChatbotOnline(chatbotStatus);
  };

  useEffect(() => {
    pollHealth();
    const interval = setInterval(pollHealth, 10000);
    return () => clearInterval(interval);
  }, [mcvraUrl, chatbotUrl]);

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
        onOpenSettings={() => setShowSettingsModal(true)}
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
          />
        </div>

        <div className={activeTab === 'scorecard' ? 'flex-1 min-h-0 h-full w-full flex flex-col overflow-hidden' : 'hidden'}>
          <ScorecardView
            mcvraUrl={mcvraUrl}
            mcvraOnline={mcvraOnline}
            mcvraGraphContext={mcvraGraphContext}
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

        <div className={activeTab === 'documents' ? 'flex-1 min-h-0 h-full w-full flex flex-col overflow-hidden' : 'hidden'}>
          <DocumentsView
            chatbotUrl={chatbotUrl}
            chatbotOnline={chatbotOnline}
            apiKey={apiKey}
          />
        </div>

        <div className={activeTab === 'dashboard' ? 'flex-1 min-h-0 h-full w-full flex flex-col overflow-hidden' : 'hidden'}>
          <DashboardView
            mcvraUrl={mcvraUrl}
            setMcvraUrl={setMcvraUrl}
            chatbotUrl={chatbotUrl}
            setChatbotUrl={setChatbotUrl}
            apiKey={apiKey}
            setApiKey={setApiKey}
            mcvraOnline={mcvraOnline}
            chatbotOnline={chatbotOnline}
            onRefreshHealth={pollHealth}
          />
        </div>
      </main>

      {/* Settings Modal Overlay */}
      {showSettingsModal && (
        <div className="pdf-modal-backdrop" onClick={() => setShowSettingsModal(false)}>
          <div className="card-rich w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
              Drishti AI System Settings
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">MCVRA Generator API Host</label>
                <input
                  type="text"
                  value={mcvraUrl}
                  onChange={(e) => setMcvraUrl(e.target.value)}
                  className="input-rich font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Climate Chatbot RAG API Host</label>
                <input
                  type="text"
                  value={chatbotUrl}
                  onChange={(e) => setChatbotUrl(e.target.value)}
                  className="input-rich font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Service Token (api-key Header)</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input-rich font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="gradient"
                size="sm"
                onClick={() => {
                  pollHealth();
                  setShowSettingsModal(false);
                }}
              >
                Save & Apply Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Copilot Trigger Button (Bottom-Right, hidden on chatbot and mcvra tabs) */}
      {!isChatDrawerOpen && activeTab !== 'chatbot' && activeTab !== 'mcvra' && (
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
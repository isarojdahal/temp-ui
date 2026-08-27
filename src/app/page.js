'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { McvraVisualizer } from '../components/McvraVisualizer';
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
import { Sparkles, MessageSquareText } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('chatbot');
  const [mcvraUrl, setMcvraUrl] = useState(DEFAULT_MCVRA_URL);
  const [chatbotUrl, setChatbotUrl] = useState(DEFAULT_CHATBOT_URL);
  const [apiKey, setApiKey] = useState(DEFAULT_RAG_TOKEN);
  const [mcvraOnline, setMcvraOnline] = useState(false);
  const [chatbotOnline, setChatbotOnline] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);

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
        setActiveTab={setActiveTab}
        mcvraOnline={mcvraOnline}
        chatbotOnline={chatbotOnline}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={activeTab === 'mcvra' ? setSidebarOpen : null}
        onOpenSettings={() => setShowSettingsModal(true)}
        onToggleChatDrawer={() => setIsChatDrawerOpen((prev) => !prev)}
      />

      {/* Main Feature Workspace View */}
      <main className="flex-1 min-h-0 h-full w-full flex flex-col overflow-hidden relative">
        {activeTab === 'mcvra' && (
          <McvraVisualizer
            mcvraUrl={mcvraUrl}
            mcvraOnline={mcvraOnline}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
        )}

        {activeTab === 'chatbot' && (
          <ChatbotView
            chatbotUrl={chatbotUrl}
            chatbotOnline={chatbotOnline}
            apiKey={apiKey}
            setApiKey={setApiKey}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentsView
            chatbotUrl={chatbotUrl}
            chatbotOnline={chatbotOnline}
            apiKey={apiKey}
          />
        )}

        {activeTab === 'dashboard' && (
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
        )}
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

      {/* Floating AI Copilot Trigger Button (Bottom-Right) */}
      {!isChatDrawerOpen && activeTab !== 'chatbot' && (
        <button
          onClick={() => setIsChatDrawerOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-[#208661] hover:bg-[#1a6d4f] text-white shadow-xl shadow-[#208661]/25 px-4 py-3 rounded-full flex items-center gap-2.5 transition-all hover:scale-105 group border border-emerald-300/30"
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

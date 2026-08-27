'use client';

import React from 'react';
import {
  Layers,
  MessageSquareText,
  FileText,
  Activity,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Settings
} from 'lucide-react';
import { Button } from './ui/button';

export function Header({
  activeTab,
  setActiveTab,
  mcvraOnline,
  chatbotOnline,
  sidebarOpen,
  setSidebarOpen,
  onOpenSettings,
  onToggleChatDrawer
}) {
  const tabs = [
    { id: 'mcvra', label: 'MCVRA Graph Generator', icon: Layers },
    { id: 'chatbot', label: 'Climate AI Assistant', icon: MessageSquareText },
    { id: 'documents', label: 'Knowledge Base', icon: FileText },
    { id: 'dashboard', label: 'API Diagnostics', icon: Activity }
  ];

  return (
    <header className="app-header-rich">
      {/* Brand Title & Sidebar Controls */}
      <div className="flex items-center gap-3">
        {setSidebarOpen && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Collapse Controls' : 'Expand Controls'}
          >
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </Button>
        )}

        <div
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => setActiveTab('mcvra')}
        >
          <div className="brand-logo-rich">
            <Sparkles size={18} className="text-[#208661] animate-pulse" />
          </div>
          <div>
            <h1 className="brand-title-rich text-base font-bold text-slate-900 tracking-tight flex items-center gap-1">
              Drishti <span className="text-[#208661] font-bold">AI</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Feature Segmented Navigation Tabs */}
      <nav className="nav-tabs-rich">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? 'gradient' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={isActive ? 'shadow-sm shadow-[#208661]/20 bg-[#208661] text-white' : 'text-slate-600 hover:bg-[#e9f3f0] hover:text-[#208661] font-medium'}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </Button>
          );
        })}
      </nav>

      {/* Settings Trigger */}
      <div className="flex items-center gap-3">
        {onOpenSettings && (
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenSettings}
            title="Configure System Settings"
          >
            <Settings size={16} />
          </Button>
        )}
      </div>
    </header>
  );
}

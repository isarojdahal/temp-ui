'use client';

import React, { useState } from 'react';
import axios from 'axios';
import {
  Activity,
  Server,
  RefreshCw,
  Code,
  Globe
} from 'lucide-react';
import { Button } from './ui/button';

export function DashboardView({
  mcvraUrl,
  setMcvraUrl,
  chatbotUrl,
  setChatbotUrl,
  apiKey,
  setApiKey,
  mcvraOnline,
  chatbotOnline,
  onRefreshHealth
}) {
  const [testEndpoint, setTestEndpoint] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runTest = async (type) => {
    setLoading(true);
    setTestResult(null);
    try {
      let res;
      if (type === 'mcvra-health') {
        setTestEndpoint(`GET ${mcvraUrl}/health`);
        res = await axios.get(`${mcvraUrl}/health`);
      } else if (type === 'mcvra-frameworks') {
        setTestEndpoint(`GET ${mcvraUrl}/mcda/frameworks`);
        res = await axios.get(`${mcvraUrl}/mcda/frameworks`);
      } else if (type === 'chatbot-health') {
        setTestEndpoint(`GET ${chatbotUrl}/health`);
        res = await axios.get(`${chatbotUrl}/health`);
      } else if (type === 'chatbot-suggestions') {
        setTestEndpoint(`GET ${chatbotUrl}/chat-suggestions`);
        res = await axios.get(`${chatbotUrl}/chat-suggestions?limit=3`, {
          headers: { 'api-key': apiKey }
        });
      } else if (type === 'chatbot-stats') {
        setTestEndpoint(`GET ${chatbotUrl}/stats`);
        res = await axios.get(`${chatbotUrl}/stats`, {
          headers: { 'api-key': apiKey }
        });
      } else if (type === 'chatbot-index') {
        setTestEndpoint(`GET ${chatbotUrl}/index-info`);
        res = await axios.get(`${chatbotUrl}/index-info`, {
          headers: { 'api-key': apiKey }
        });
      }

      setTestResult({
        status: res.status,
        statusText: res.statusText,
        data: res.data
      });
    } catch (err) {
      setTestResult({
        status: err.response?.status || 500,
        statusText: err.response?.statusText || 'Error',
        data: err.response?.data || { error: err.message }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 w-full bg-[#f8fafc] text-slate-900 min-h-full overflow-y-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Activity className="text-[#208661]" size={20} /> API Diagnostics & System Control
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure host ports and run live API tests against Drishti backends.
          </p>
        </div>

        <Button
          variant="gradient"
          size="sm"
          onClick={onRefreshHealth}
          className="bg-[#208661] hover:bg-[#1a6d4f] text-white"
        >
          <RefreshCw size={14} /> Refresh Health Status
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MCVRA API Config */}
        <div className="card-rich space-y-3">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Server size={16} className="text-blue-600" /> MCVRA Generator Backend
            </h3>
            <span className={`status-badge-rich ${mcvraOnline ? 'online' : 'offline'}`}>
              <span className="status-dot-rich" />
              {mcvraOnline ? 'Port 8000 Active' : 'Offline'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-700 block mb-1 font-semibold">Base API URL</label>
              <input
                type="text"
                value={mcvraUrl}
                onChange={(e) => setMcvraUrl(e.target.value)}
                className="input-rich font-mono text-xs"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => runTest('mcvra-health')}
                className="flex-1"
              >
                Test /health
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runTest('mcvra-frameworks')}
                className="flex-1"
              >
                Test /mcda/frameworks
              </Button>
            </div>
          </div>
        </div>

        {/* Chatbot API Config */}
        <div className="card-rich space-y-3">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Globe size={16} className="text-[#208661]" /> Climate Chatbot RAG Backend
            </h3>
            <span className={`status-badge-rich ${chatbotOnline ? 'online' : 'offline'}`}>
              <span className="status-dot-rich" />
              {chatbotOnline ? 'Port 8080 Active' : 'Offline'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-700 block mb-1 font-semibold">Base API URL</label>
              <input
                type="text"
                value={chatbotUrl}
                onChange={(e) => setChatbotUrl(e.target.value)}
                className="input-rich font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-slate-700 block mb-1 font-semibold">Service Token (api-key Header)</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input-rich font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button
                variant="outline"
                size="xs"
                onClick={() => runTest('chatbot-health')}
              >
                /health
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => runTest('chatbot-suggestions')}
              >
                /chat-suggestions
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => runTest('chatbot-index')}
              >
                /index-info
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Endpoint JSON Inspector */}
      <div className="card-rich space-y-3">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Code size={16} className="text-[#208661]" /> Live HTTP Endpoint Response Inspector
          </h3>
          {testEndpoint && (
            <span className="text-xs font-mono text-[#208661] bg-[#e9f3f0] px-2.5 py-1 rounded-lg border border-[#63ab91]/40">
              {testEndpoint}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin" size={16} /> Requesting endpoint data...
          </div>
        ) : testResult ? (
          <div className="space-y-2">
            <div>
              <span className={`text-xs px-2.5 py-1 rounded-lg font-bold font-mono ${testResult.status >= 200 && testResult.status < 300 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                HTTP {testResult.status} {testResult.statusText}
              </span>
            </div>
            <pre className="bg-slate-50 p-4 rounded-xl text-xs font-mono text-emerald-800 overflow-x-auto max-h-80 border border-slate-200">
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-8 border border-dashed border-slate-200 rounded-xl">
            Click any endpoint test button above to inspect live HTTP JSON output.
          </p>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Eye,
  Plus,
  Trash2,
  RotateCw
} from 'lucide-react';
import {
  uploadAdminDocument,
  reindexAdminDocument,
  deleteAdminDocument,
  rebuildAdminIndex,
  fetchIndexInfo
} from '../utils/api';
import { PdfViewerModal } from './PdfViewerModal';
import { Button } from './ui/button';

export function DocumentsView({ chatbotUrl, chatbotOnline, apiKey }) {
  const [indexStats, setIndexStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [docTitle, setDocTitle] = useState('');
  const [docVersion, setDocVersion] = useState(1);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [showPdfModal, setShowPdfModal] = useState(null);

  const [documentList, setDocumentList] = useState([
    { id: 'doc-101', title: 'Nepal Climate Vulnerability Assessment 2026.pdf', version: 1, status: 'Indexed' },
    { id: 'doc-102', title: 'Disaster Risk Reduction Guidelines.pdf', version: 1, status: 'Indexed' },
    { id: 'doc-103', title: 'Health Facility Flood Resilience Framework.pdf', version: 2, status: 'Indexed' }
  ]);

  useEffect(() => {
    async function loadStats() {
      if (chatbotOnline) {
        const stats = await fetchIndexInfo(chatbotUrl, apiKey);
        if (stats) setIndexStats(stats);
      }
    }
    loadStats();
  }, [chatbotUrl, apiKey, chatbotOnline]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setLoading(true);
    setUploadStatus(null);

    const documentId = crypto.randomUUID();
    const jobId = `job-${Date.now()}`;

    try {
      const res = await uploadAdminDocument({
        baseUrl: chatbotUrl,
        apiKey,
        file: uploadFile,
        documentId,
        jobId,
        title: docTitle || uploadFile.name,
        version: Number(docVersion) || 1
      });

      setUploadStatus({
        type: 'success',
        message: res.message || 'Document indexing queued successfully!'
      });

      setDocumentList((prev) => [
        {
          id: documentId,
          title: uploadFile.name,
          version: Number(docVersion) || 1,
          status: 'Indexing Queued'
        },
        ...prev
      ]);

      setUploadFile(null);
      setDocTitle('');
    } catch (err) {
      console.error(err);
      setUploadStatus({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Upload failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async (docId, title) => {
    try {
      const jobId = `job-reindex-${Date.now()}`;
      await reindexAdminDocument({
        baseUrl: chatbotUrl,
        apiKey,
        documentId: docId,
        jobId,
        title
      });
      alert(`Reindex job queued for ${title}`);
    } catch (err) {
      alert(`Reindex error: ${err.message}`);
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Are you sure you want to delete this document from the vector store?')) return;
    try {
      const jobId = `job-del-${Date.now()}`;
      await deleteAdminDocument({
        baseUrl: chatbotUrl,
        apiKey,
        documentId: docId,
        jobId
      });
      setDocumentList((prev) => prev.filter(d => d.id !== docId));
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleFullRebuild = async () => {
    if (!confirm('Trigger full vector index rebuild? This will re-process all raw PDF files.')) return;
    try {
      const jobId = `job-rebuild-${Date.now()}`;
      await rebuildAdminIndex({
        baseUrl: chatbotUrl,
        apiKey,
        jobId
      });
      alert('Full rebuild job queued successfully!');
    } catch (err) {
      alert(`Rebuild error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 p-6 w-full bg-[#f8fafc] text-slate-900 min-h-full overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText size={20} className="text-[#208661]" /> Knowledge Base & PDF Document Hub
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage PDF document ingestion, inspect vector chunks, and queue background index jobs.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleFullRebuild}
          disabled={!chatbotOnline}
        >
          <RotateCw size={14} /> Full Index Rebuild
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Index Summary */}
        <div className="card-rich space-y-3">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2.5">
            <Database size={16} className="text-[#208661]" /> Vector Index Overview
          </h3>
          {indexStats ? (
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-slate-200 pb-2 text-slate-500">
                <span>Index Name:</span>
                <span className="font-mono text-[#208661] font-semibold">{indexStats.index_name || 'dastaa_assistant_index'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2 text-slate-500">
                <span>Total Chunks:</span>
                <span className="font-bold text-slate-900 text-sm">{indexStats.total_chunks || indexStats.total_documents || 0}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Embedding Model:</span>
                <span className="text-slate-800">BAAI/bge-small-en (384d)</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4">
              {chatbotOnline ? 'Fetching index stats...' : 'Chatbot API offline.'}
            </p>
          )}
        </div>

        {/* Upload Form */}
        <div className="card-rich space-y-3">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2.5">
            <Upload size={16} className="text-purple-600" /> Ingest PDF Document
          </h3>
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Document Title</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g. Climate Resilience Guidelines 2026.pdf"
                className="input-rich text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">PDF File</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="input-rich text-xs file:mr-2 file:py-0.5 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:bg-[#e9f3f0] file:text-[#208661]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Version</label>
                <input
                  type="number"
                  value={docVersion}
                  onChange={(e) => setDocVersion(e.target.value)}
                  className="input-rich text-xs"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="sm"
              disabled={loading || !uploadFile || !chatbotOnline}
              className="w-full mt-1 bg-[#208661] hover:bg-[#1a6d4f] text-white"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              Queue PDF Document Indexing
            </Button>
          </form>

          {uploadStatus && (
            <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${uploadStatus.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}>
              {uploadStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{uploadStatus.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Document Records Table */}
      <div className="card-rich space-y-3">
        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2.5">
          <FolderOpen size={16} className="text-[#208661]" /> Document Repository
        </h3>

        <div className="space-y-2">
          {documentList.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs hover:border-[#208661]/50 transition">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#e9f3f0] border border-[#63ab91]/40 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-[#208661]" />
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block text-xs">{doc.title}</span>
                  <span className="text-[10px] text-slate-500 font-mono">ID: {doc.id} • v{doc.version}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setShowPdfModal(doc.title)}
                >
                  <Eye size={13} /> Preview PDF
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => handleReindex(doc.id, doc.title)}
                >
                  <RotateCw size={13} /> Reindex
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(doc.id)}
                  className="h-7 w-7"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PDF Modal */}
      {showPdfModal && (
        <PdfViewerModal
          filename={showPdfModal}
          chatbotUrl={chatbotUrl}
          onClose={() => setShowPdfModal(null)}
        />
      )}
    </div>
  );
}

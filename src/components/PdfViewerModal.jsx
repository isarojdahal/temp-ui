'use client';

import React from 'react';
import { X, ExternalLink, FileText } from 'lucide-react';

export function PdfViewerModal({ filename, page, chatbotUrl, onClose }) {
  let cleanFilename = filename || 'Document.pdf';
  if (!cleanFilename.toLowerCase().endsWith('.pdf')) {
    cleanFilename += '.pdf';
  }

  const pageHash = page ? `#page=${page}` : '';
  const pdfUrl = `${chatbotUrl}/documents/${encodeURIComponent(cleanFilename)}${pageHash}`;
  const displayTitle = filename ? filename.replace(/\.pdf$/i, '') : 'PDF Preview';

  return (
    <div className="pdf-modal-backdrop" onClick={onClose}>
      <div className="pdf-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-modal-header">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-cyan-400" />
            <span className="pdf-modal-title truncate max-w-lg">
              {displayTitle} {page ? `(Page ${page})` : ''}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pdf-action-btn"
            >
              Open in New Tab <ExternalLink size={12} />
            </a>
            <button onClick={onClose} className="pdf-close-btn">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="pdf-modal-body">
          <iframe
            src={pdfUrl}
            title={`PDF Preview - ${displayTitle}`}
            className="w-full h-full border-none"
          />
        </div>
      </div>
    </div>
  );
}


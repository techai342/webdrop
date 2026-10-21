'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileCode,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  Eye,
} from 'lucide-react';
import type { TransferItem } from '../lib/types';
import { formatBytes } from '../lib/device-info';

interface FilePreviewModalProps {
  item: TransferItem | null;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  item,
  onClose,
}) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingText, setLoadingText] = useState(false);

  useEffect(() => {
    if (!item || !item.blobUrl) {
      setTextContent(null);
      return;
    }

    const isTextOrCode =
      item.mimeType.startsWith('text/') ||
      item.mimeType.includes('json') ||
      item.mimeType.includes('javascript') ||
      item.mimeType.includes('typescript') ||
      /\.(txt|md|js|ts|tsx|jsx|json|py|html|css|cpp|rs|sql|xml|csv)$/i.test(item.name);

    if (isTextOrCode && item.size < 5 * 1024 * 1024) {
      setLoadingText(true);
      fetch(item.blobUrl)
        .then((res) => res.text())
        .then((text) => {
          setTextContent(text);
          setLoadingText(false);
        })
        .catch(() => {
          setLoadingText(false);
        });
    } else {
      setTextContent(null);
    }
  }, [item]);

  if (!item) return null;

  const isImage = item.mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(item.name);
  const isVideo = item.mimeType.startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(item.name);
  const isAudio = item.mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(item.name);

  const handleDownload = () => {
    if (!item.blobUrl) return;
    const a = document.createElement('a');
    a.href = item.blobUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 overflow-hidden cyber-glow-cyan">
        {/* Glow Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate" title={item.name}>
                {item.name}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {formatBytes(item.size)} • {item.mimeType || 'binary'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5" /> Save
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Content Area */}
        <div className="my-4 flex-1 overflow-auto flex items-center justify-center min-h-[240px] max-h-[60vh] bg-slate-950 rounded-xl p-2 border border-slate-800">
          {isImage && item.blobUrl ? (
            <img
              src={item.blobUrl}
              alt={item.name}
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          ) : isVideo && item.blobUrl ? (
            <video
              src={item.blobUrl}
              controls
              className="max-h-full max-w-full rounded-lg"
            />
          ) : isAudio && item.blobUrl ? (
            <div className="p-6 w-full flex flex-col items-center">
              <FileAudio className="w-16 h-16 text-cyan-400 mb-4 animate-pulse" />
              <audio src={item.blobUrl} controls className="w-full max-w-md" />
            </div>
          ) : textContent !== null ? (
            <div className="w-full h-full relative">
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={handleCopyText}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-mono flex items-center gap-1 shadow"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="w-full h-full p-4 overflow-auto text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap break-all">
                {textContent}
              </pre>
            </div>
          ) : loadingText ? (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono">Loading preview...</span>
            </div>
          ) : (
            <div className="text-center p-8 text-slate-400 space-y-2">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">Binary File Preview Unavailable</p>
              <p className="text-xs text-slate-500">
                Download the file to open it with your system's default viewer.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-mono pt-2 border-t border-slate-800">
          <span>Transferred via Direct LAN P2P</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

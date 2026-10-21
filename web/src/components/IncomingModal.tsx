'use client';

import React from 'react';
import {
  DownloadCloud,
  X,
  Check,
  FileArchive,
  FileImage,
  FileCode,
  FileText,
  User,
} from 'lucide-react';
import type { IncomingFileOffer } from '../lib/types';
import { formatBytes } from '../lib/device-info';

interface IncomingModalProps {
  offer: IncomingFileOffer | null;
  onAccept: (offer: IncomingFileOffer) => void;
  onDecline: (offer: IncomingFileOffer) => void;
}

export const IncomingModal: React.FC<IncomingModalProps> = ({
  offer,
  onAccept,
  onDecline,
}) => {
  if (!offer) return null;

  const getFileIcon = (mime: string, name: string) => {
    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(name)) {
      return <FileImage className="w-8 h-8 text-pink-400" />;
    }
    if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) {
      return <FileArchive className="w-8 h-8 text-amber-400" />;
    }
    if (/\.(ts|tsx|js|jsx|json|py|html|css|cpp|rs|go|sql)$/i.test(name)) {
      return <FileCode className="w-8 h-8 text-cyan-400" />;
    }
    return <FileText className="w-8 h-8 text-emerald-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 overflow-hidden cyber-glow-cyan">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <DownloadCloud className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Incoming File Transfer
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3 text-cyan-400" />
                From <span className="text-slate-200 font-medium">{offer.senderName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => onDecline(offer)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thumbnail Preview (if image) */}
        {offer.previewDataUrl ? (
          <div className="mb-4 w-full h-44 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
            <img
              src={offer.previewDataUrl}
              alt={offer.name}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="mb-4 w-full py-6 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-center">
            {getFileIcon(offer.mimeType, offer.name)}
          </div>
        )}

        {/* File Details */}
        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">File Name</span>
            <span className="text-xs font-semibold text-slate-200 truncate max-w-[220px]" title={offer.name}>
              {offer.name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Size</span>
            <span className="text-xs font-bold text-cyan-400 font-mono">
              {formatBytes(offer.size)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Chunks</span>
            <span className="text-xs text-slate-400 font-mono">
              {offer.totalChunks.toLocaleString()} chunks (64 KB each)
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onDecline(offer)}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-rose-950/50 hover:border-rose-500/50 hover:text-rose-300 border border-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <X className="w-4 h-4" /> Decline
          </button>
          <button
            onClick={() => onAccept(offer)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Check className="w-4 h-4" /> Accept & Download
          </button>
        </div>
      </div>
    </div>
  );
};

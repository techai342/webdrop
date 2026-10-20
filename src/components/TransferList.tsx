'use client';

import React from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  FileArchive,
  FileImage,
  FileCode,
  FileText,
  CheckCircle2,
  XCircle,
  Download,
  X,
  Gauge,
  Clock,
  Eye,
} from 'lucide-react';
import type { TransferItem } from '../lib/types';
import { formatBytes, formatSpeed, formatEta } from '../lib/device-info';

interface TransferListProps {
  transfers: TransferItem[];
  onCancelTransfer: (transferId: string) => void;
  onPreviewItem?: (item: TransferItem) => void;
}

export const TransferList: React.FC<TransferListProps> = ({
  transfers,
  onCancelTransfer,
  onPreviewItem,
}) => {
  if (transfers.length === 0) {
    return null;
  }

  const getFileIcon = (mime: string, name: string) => {
    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(name)) {
      return <FileImage className="w-5 h-5 text-pink-400" />;
    }
    if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) {
      return <FileArchive className="w-5 h-5 text-amber-400" />;
    }
    if (/\.(ts|tsx|js|jsx|json|py|html|css|cpp|rs|go|sql)$/i.test(name)) {
      return <FileCode className="w-5 h-5 text-cyan-400" />;
    }
    return <FileText className="w-5 h-5 text-emerald-400" />;
  };

  const handleDownload = (item: TransferItem) => {
    if (!item.blobUrl) return;
    const a = document.createElement('a');
    a.href = item.blobUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
          <span>Active & Completed Transfers</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs">
            {transfers.length}
          </span>
        </h3>
      </div>

      <div className="space-y-3">
        {transfers.map((item) => {
          const isSending = item.direction === 'send';
          const isDone = item.status === 'completed';
          const isFailed = item.status === 'cancelled' || item.status === 'error' || item.status === 'declined';
          const isBusy = item.status === 'transferring';

          return (
            <div
              key={item.id}
              className={`cyber-card p-4 transition-all relative overflow-hidden ${
                isDone
                  ? 'border-emerald-500/40 bg-slate-900/50'
                  : isFailed
                  ? 'border-rose-500/40 bg-slate-950/50'
                  : 'border-cyan-500/40 bg-slate-900/80 cyber-glow-cyan'
              }`}
            >
              {/* Top row: Icon, Name, Direction Badge, Action */}
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Thumbnail or Icon */}
                  {item.previewUrl ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0 flex items-center justify-center">
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 shrink-0 flex items-center justify-center">
                      {getFileIcon(item.mimeType, item.name)}
                    </div>
                  )}

                  {/* Title & Metadata */}
                  <div className="min-w-0">
                    <h4
                      className="text-sm font-semibold text-slate-100 truncate max-w-xs sm:max-w-md lg:max-w-lg"
                      title={item.name}
                    >
                      {item.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                      <span>{formatBytes(item.size)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {isSending ? (
                          <span className="text-cyan-400 flex items-center gap-0.5">
                            <ArrowUpRight className="w-3 h-3" /> Sending to peer
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            <ArrowDownLeft className="w-3 h-3" /> From {item.senderName}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions / Status */}
                <div className="flex items-center gap-2 shrink-0">
                  {isBusy && (
                    <button
                      onClick={() => onCancelTransfer(item.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 transition-colors"
                      title="Cancel Transfer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {isDone && item.blobUrl && onPreviewItem && (
                    <button
                      onClick={() => onPreviewItem(item)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-cyan-300 text-xs font-medium flex items-center gap-1 transition-all"
                      title="Preview File"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                  )}

                  {isDone && item.direction === 'receive' && item.blobUrl && (
                    <button
                      onClick={() => handleDownload(item)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-500/30 transition-all active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" /> Save File
                    </button>
                  )}

                  {isDone && isSending && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Sent
                    </span>
                  )}

                  {isFailed && (
                    <span className="flex items-center gap-1 text-xs text-rose-400 font-mono">
                      <XCircle className="w-4 h-4" /> {item.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800/80 mb-2">
                <div
                  className={`h-full transition-all duration-200 rounded-full ${
                    isDone
                      ? 'bg-emerald-500'
                      : isFailed
                      ? 'bg-rose-500'
                      : 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400'
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>

              {/* Live Speed & Stats footer */}
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-300">
                    {item.progress}%
                  </span>
                  {isBusy && (
                    <>
                      <span className="flex items-center gap-1 text-cyan-400">
                        <Gauge className="w-3 h-3" /> {formatSpeed(item.speed)}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3" /> ETA: {formatEta(item.eta)}
                      </span>
                    </>
                  )}
                </div>

                <span>
                  {item.chunksReceived > 0
                    ? `${item.chunksReceived} / ${item.totalChunks} chunks`
                    : `${item.totalChunks} chunks`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

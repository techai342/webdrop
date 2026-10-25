'use client';

import React, { useState } from 'react';
import {
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Smartphone,
  X,
  Search,
  Copy,
  Check,
  RefreshCw,
  Phone,
} from 'lucide-react';
import type { RemoteCallLogsData, CallLogItem } from '../lib/types';

interface RemoteCallsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceName?: string;
  peerId?: string;
  callLogsData?: RemoteCallLogsData | null;
  isLoading?: boolean;
  onRefresh?: (peerId: string) => void;
  onDialCall?: (peerId: string, number: string) => void;
}

export const RemoteCallsModal: React.FC<RemoteCallsModalProps> = ({
  isOpen,
  onClose,
  deviceName = 'Connected Phone',
  peerId = 'all',
  callLogsData,
  isLoading = false,
  onRefresh,
  onDialCall,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'incoming' | 'outgoing' | 'missed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customNumber, setCustomNumber] = useState('');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  if (!isOpen) return null;

  const calls = callLogsData?.calls || [];

  const filteredCalls = calls.filter((c) => {
    if (filterType !== 'all' && c.type !== filterType) return false;
    const q = searchQuery.toLowerCase();
    return c.number.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  });

  const handleCopy = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const handleDial = (num: string) => {
    if (!num.trim()) return;
    onDialCall?.(peerId, num.trim());
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getCallIcon = (type: string) => {
    switch (type) {
      case 'incoming':
        return <PhoneIncoming className="w-4 h-4 text-emerald-400" />;
      case 'outgoing':
        return <PhoneOutgoing className="w-4 h-4 text-blue-400" />;
      case 'missed':
        return <PhoneMissed className="w-4 h-4 text-rose-400" />;
      default:
        return <PhoneCall className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-2xl p-6 overflow-hidden cyber-glow-cyan max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Call Logs & Remote Dialer
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold">
                  {calls.length} Calls
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>Call history on {deviceName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onRefresh && (
              <button
                type="button"
                onClick={() => onRefresh(peerId)}
                disabled={isLoading}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-300 transition border border-slate-700 disabled:opacity-50"
                title="Refresh Call Logs"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick PC Dialer Bar */}
        <div className="my-3 p-2 rounded-xl bg-slate-950/80 border border-slate-800 shrink-0 flex items-center gap-2">
          <input
            type="text"
            placeholder="Type any number to call (e.g. 03001234567)..."
            value={customNumber}
            onChange={(e) => setCustomNumber(e.target.value)}
            className="flex-1 bg-transparent border-0 px-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => handleDial(customNumber)}
            disabled={!customNumber.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition disabled:opacity-30 shadow-sm"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call Now</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 mb-2 shrink-0">
          {(['all', 'incoming', 'outgoing', 'missed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold capitalize transition ${
                filterType === tab
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Call Logs List */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-2 py-1">
          {isLoading && calls.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-xs font-mono text-slate-400">Loading call history from phone...</p>
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <PhoneCall className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No call logs found</p>
            </div>
          ) : (
            filteredCalls.map((call) => {
              const isCopied = copiedNumber === call.number;

              return (
                <div
                  key={call.id}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                      {getCallIcon(call.type)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100 truncate block">
                          {call.name || call.number}
                        </span>
                        <span className={`text-[10px] font-mono capitalize px-1.5 py-0.2 rounded border ${
                          call.type === 'missed'
                            ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                            : call.type === 'incoming'
                            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                            : 'bg-blue-950/80 border-blue-500/40 text-blue-300'
                        }`}>
                          {call.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                        <span>{call.number}</span>
                        <span>•</span>
                        <span>{call.durationFormatted}</span>
                        <span>•</span>
                        <span>{formatDate(call.date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(call.number)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
                      title="Copy phone number"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDial(call.number)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center gap-1 transition shadow-sm"
                      title="Dial this number on phone"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Smartphone,
  X,
  Search,
  Copy,
  Check,
  Send,
  RefreshCw,
  KeyRound,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import type { RemoteSmsData, SmsMessageItem } from '../lib/types';

interface RemoteSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceName?: string;
  peerId?: string;
  smsData?: RemoteSmsData | null;
  isLoading?: boolean;
  onRefresh?: (peerId: string) => void;
  onSendSms?: (peerId: string, to: string, text: string) => void;
}

export const RemoteSmsModal: React.FC<RemoteSmsModalProps> = ({
  isOpen,
  onClose,
  deviceName = 'Connected Phone',
  peerId = 'all',
  smsData,
  isLoading = false,
  onRefresh,
  onSendSms,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedOtp, setCopiedOtp] = useState<string | null>(null);
  const [recipientNumber, setRecipientNumber] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const messages = smsData?.messages || [];

  const filteredMessages = messages.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.body.toLowerCase().includes(q) ||
      m.address.toLowerCase().includes(q) ||
      m.contactName.toLowerCase().includes(q)
    );
  });

  const handleCopyOtp = (otp: string) => {
    navigator.clipboard.writeText(otp);
    setCopiedOtp(otp);
    setTimeout(() => setCopiedOtp(null), 2000);
  };

  const handleReply = (number: string) => {
    setRecipientNumber(number);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientNumber.trim() || !messageText.trim()) return;
    setIsSending(true);
    onSendSms?.(peerId, recipientNumber.trim(), messageText.trim());
    setTimeout(() => {
      setMessageText('');
      setIsSending(false);
    }, 1000);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-2xl p-6 overflow-hidden cyber-glow-cyan max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Remote SMS & OTP Reader
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 font-bold">
                  {messages.length} SMS
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>SIM Messages on {deviceName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onRefresh && (
              <button
                type="button"
                onClick={() => onRefresh(peerId)}
                disabled={isLoading}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition border border-slate-700 disabled:opacity-50"
                title="Refresh SMS messages"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
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

        {/* Search Bar */}
        <div className="my-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search OTP code, bank, sender, or text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>
        </div>

        {/* Message List */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-2.5 py-1">
          {isLoading && messages.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs font-mono text-slate-400">Loading SMS from phone...</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs">
                {searchQuery ? 'No messages match your search' : 'No SMS messages found'}
              </p>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const hasOtp = Boolean(msg.otpCode);
              const isCopied = copiedOtp === msg.otpCode;

              return (
                <div
                  key={msg.id}
                  className={`p-3.5 rounded-xl border transition space-y-2 ${
                    hasOtp
                      ? 'bg-amber-950/20 border-amber-500/40 shadow-sm shadow-amber-950/30'
                      : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Sender & Timestamp Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`p-1 rounded-md text-xs ${
                        msg.isInbox ? 'bg-cyan-950 text-cyan-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {msg.isInbox ? (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <span className="text-xs font-bold text-slate-100 truncate">
                        {msg.contactName || msg.address}
                      </span>
                      {msg.contactName && (
                        <span className="text-[10px] font-mono text-slate-400 truncate hidden sm:inline">
                          ({msg.address})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-500">
                        {formatDate(msg.date)}
                      </span>
                      {msg.address && (
                        <button
                          type="button"
                          onClick={() => handleReply(msg.address)}
                          className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition"
                          title="Reply to this number"
                        >
                          Reply
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Smart 2FA OTP Card Banner */}
                  {hasOtp && (
                    <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs font-mono font-bold text-amber-300">
                          Detected OTP: <span className="text-sm underline tracking-widest">{msg.otpCode}</span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyOtp(msg.otpCode!)}
                        className={`px-3 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-1 transition shadow-sm ${
                          isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copy OTP
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Body Text */}
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text font-sans">
                    {msg.body}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom SMS Composer */}
        <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-800 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Recipient phone number (e.g. 03001234567)"
              value={recipientNumber}
              onChange={(e) => setRecipientNumber(e.target.value)}
              className="w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[11px] font-mono text-slate-500">
              Direct SIM dispatch
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Type message to send from phone..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={isSending || !recipientNumber.trim() || !messageText.trim()}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-cyan-500 hover:from-amber-400 hover:to-cyan-400 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 transition disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending...' : 'Send SMS'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

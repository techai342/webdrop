'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Send, X, MessageSquare, ExternalLink } from 'lucide-react';
import type { PhoneNotificationItem } from '../lib/types';

interface NotificationToastProps {
  notification: PhoneNotificationItem | null;
  onDismiss: (key: string) => void;
  onReply: (key: string, replyText: string) => void;
  onOpenHub: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onReply,
  onOpenHub,
}) => {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setReplyText('');
    setIsReplying(false);
    setIsSending(false);
  }, [notification?.key]);

  if (!notification) return null;

  const handleSendReply = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!replyText.trim() || !notification) return;
    setIsSending(true);
    onReply(notification.key, replyText.trim());
    setTimeout(() => {
      setIsSending(false);
      onDismiss(notification.key);
    }, 800);
  };

  return (
    <div className="fixed top-20 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-auto">
      <div className="relative rounded-2xl bg-slate-900/95 border border-cyan-500/40 shadow-2xl p-4 backdrop-blur-md cyber-glow-cyan overflow-hidden">
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-indigo-500" />

        <div className="flex items-start justify-between gap-3">
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center shadow-sm">
            {notification.iconBase64 ? (
              <img
                src={`data:image/png;base64,${notification.iconBase64}`}
                alt={notification.appName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-cyan-950/80 text-cyan-400 font-bold text-xs">
                {notification.appName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0" onClick={onOpenHub} role="button">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider truncate">
                {notification.appName}
              </span>
              <span className="text-[9px] text-slate-500 font-mono">Just now</span>
            </div>
            <h4 className="text-xs font-bold text-slate-100 truncate mt-0.5">
              {notification.title || notification.appName}
            </h4>
            <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">
              {notification.text}
            </p>
          </div>

          {/* Close / Dismiss */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notification.key);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inline Quick Reply */}
        {notification.canReply && (
          <div className="mt-3 pt-2.5 border-t border-slate-800/80">
            {!isReplying ? (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsReplying(true)}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Quick Reply...</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenHub}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
                >
                  <span>Open Hub</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Reply to ${notification.title || notification.appName}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSending}
                  className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white transition shadow-sm"
                  title="Send Reply"
                >
                  <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-ping' : ''}`} />
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

'use client';

import React, { useState, useMemo } from 'react';
import {
  Bell,
  BellOff,
  Search,
  RefreshCw,
  X,
  Send,
  Trash2,
  Settings,
  Smartphone,
  ShieldAlert,
  Check,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import type { PhoneNotificationItem, ActiveNotificationsListData } from '../lib/types';

interface NotificationHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceName?: string;
  peerId?: string;
  notificationsData?: ActiveNotificationsListData | null;
  liveNotifications?: PhoneNotificationItem[];
  isLoading?: boolean;
  onRefresh?: (peerId: string) => void;
  onReplyNotification?: (peerId: string, key: string, replyText: string) => void;
  onDismissNotification?: (peerId: string, key: string) => void;
  onOpenSettings?: (peerId: string) => void;
  onClearAllLocal?: () => void;
}

type TabType = 'all' | 'whatsapp' | 'messages' | 'social' | 'other';

export const NotificationHubModal: React.FC<NotificationHubModalProps> = ({
  isOpen,
  onClose,
  deviceName = 'Connected Phone',
  peerId = 'all',
  notificationsData,
  liveNotifications = [],
  isLoading = false,
  onRefresh,
  onReplyNotification,
  onDismissNotification,
  onOpenSettings,
  onClearAllLocal,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [sendingKeys, setSendingKeys] = useState<Record<string, boolean>>({});

  // Merge live incoming notifications with active snapshot, deduplicating by key
  const allNotifications = useMemo(() => {
    const map = new Map<string, PhoneNotificationItem>();
    
    // First snapshot
    notificationsData?.notifications?.forEach((n) => {
      map.set(n.key, n);
    });

    // Then live updates
    liveNotifications.forEach((n) => {
      map.set(n.key, n);
    });

    return Array.from(map.values()).sort((a, b) => b.postTime - a.postTime);
  }, [notificationsData, liveNotifications]);

  const filteredNotifications = useMemo(() => {
    let list = allNotifications;

    if (activeTab === 'whatsapp') {
      list = list.filter((n) => n.packageName.includes('whatsapp'));
    } else if (activeTab === 'messages') {
      list = list.filter(
        (n) =>
          n.packageName.includes('messaging') ||
          n.packageName.includes('mms') ||
          n.packageName.includes('sms')
      );
    } else if (activeTab === 'social') {
      list = list.filter(
        (n) =>
          n.packageName.includes('instagram') ||
          n.packageName.includes('facebook') ||
          n.packageName.includes('twitter') ||
          n.packageName.includes('telegram')
      );
    } else if (activeTab === 'other') {
      list = list.filter(
        (n) =>
          !n.packageName.includes('whatsapp') &&
          !n.packageName.includes('messaging') &&
          !n.packageName.includes('instagram') &&
          !n.packageName.includes('facebook')
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.text.toLowerCase().includes(q) ||
          n.appName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allNotifications, activeTab, searchQuery]);

  const handleReplyChange = (key: string, text: string) => {
    setReplyInputs((prev) => ({ ...prev, [key]: text }));
  };

  const handleSendReply = (key: string) => {
    const text = replyInputs[key]?.trim();
    if (!text) return;

    setSendingKeys((prev) => ({ ...prev, [key]: true }));
    onReplyNotification?.(peerId, key, text);

    setTimeout(() => {
      setSendingKeys((prev) => ({ ...prev, [key]: false }));
      setReplyInputs((prev) => ({ ...prev, [key]: '' }));
    }, 1200);
  };

  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp || timestamp <= 0) return 'Recent';
    const diff = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  const isAccessGranted = notificationsData?.isAccessGranted ?? true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-2xl p-6 overflow-hidden cyber-glow-cyan max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-indigo-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shadow-sm">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Notification Mirroring Hub
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold">
                  {allNotifications.length} Live
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mirrored from {deviceName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {allNotifications.length > 0 && (
              <button
                type="button"
                onClick={onClearAllLocal}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 transition border border-slate-700 text-xs font-semibold flex items-center gap-1"
                title="Clear all displayed notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear List</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onRefresh?.(peerId)}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition border border-slate-700"
              title="Rescan notifications"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Permission Alert (if notification listener is not enabled) */}
        {!isAccessGranted && (
          <div className="my-3 p-3 rounded-xl bg-amber-950/70 border border-amber-500/50 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-amber-200">Notification Access Required</p>
                <p className="text-slate-300 text-[11px]">
                  Enable Notification Access on your phone to mirror WhatsApp and app alerts.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenSettings?.(peerId)}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shrink-0 transition flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Enable on Phone</span>
            </button>
          </div>
        )}

        {/* Filter Tabs & Search */}
        <div className="py-3 shrink-0 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeTab === 'all'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({allNotifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeTab === 'whatsapp'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('messages')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeTab === 'messages'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SMS / Messages
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('social')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeTab === 'social'
                  ? 'bg-fuchsia-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Social
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
            />
          </div>
        </div>

        {/* Notifications Stream */}
        <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {isLoading && allNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
              <p className="text-sm font-medium">Listening for phone notifications...</p>
              <p className="text-xs text-slate-500 mt-1">Connecting to Phone Notification Listener</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <BellOff className="w-10 h-10 mb-2 opacity-40 text-cyan-400" />
              <p className="text-sm font-medium text-slate-400">No active notifications</p>
              <p className="text-xs text-slate-500 mt-1">
                Incoming WhatsApp, SMS, and app notifications will appear here live with Quick Reply.
              </p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const isSending = sendingKeys[n.key] || false;
              const replyVal = replyInputs[n.key] || '';

              return (
                <div
                  key={n.key}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/40 transition space-y-2.5 group"
                >
                  {/* Top Bar: Icon, App Name, Time, Dismiss */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center shadow-sm">
                        {n.iconBase64 ? (
                          <img
                            src={`data:image/png;base64,${n.iconBase64}`}
                            alt={n.appName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-cyan-950/80 text-cyan-400 font-bold text-xs">
                            {n.appName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-cyan-400 truncate">
                            {n.appName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            • {formatTimeAgo(n.postTime)}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-100 truncate mt-0.5">
                          {n.title || n.appName}
                        </h4>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDismissNotification?.(peerId, n.key)}
                      className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
                      title="Dismiss from phone"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Message Body */}
                  <p className="text-xs text-slate-300 whitespace-pre-wrap pl-10">
                    {n.text}
                  </p>

                  {/* Inline Quick Reply Field */}
                  {n.canReply && (
                    <div className="pl-10 pt-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={`Quick reply to ${n.title || n.appName}...`}
                          value={replyVal}
                          onChange={(e) => handleReplyChange(n.key, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSendReply(n.key);
                            }
                          }}
                          className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700/80 focus:border-cyan-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendReply(n.key)}
                          disabled={!replyVal.trim() || isSending}
                          className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
                        >
                          <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-ping' : ''}`} />
                          <span>{isSending ? 'Sending...' : 'Reply'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">
              Real-time synchronization active
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Replies are sent directly via WhatsApp / SIM without unlocking phone
          </span>
        </div>
      </div>
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import {
  Users,
  Smartphone,
  X,
  Copy,
  Check,
  ExternalLink,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Briefcase,
  Layers,
} from 'lucide-react';
import type { RemoteAccountsData, DeviceAccountItem } from '../lib/types';

interface RemoteAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceName?: string;
  peerId?: string;
  accountsData?: RemoteAccountsData | null;
  isLoading?: boolean;
  onRefresh?: (peerId: string) => void;
}

export const RemoteAccountsModal: React.FC<RemoteAccountsModalProps> = ({
  isOpen,
  onClose,
  deviceName = 'Connected Phone',
  peerId = 'all',
  accountsData,
  isLoading = false,
  onRefresh,
}) => {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const handleCopy = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => {
      setCopiedEmail(null);
    }, 2000);
  };

  const googleAccounts = accountsData?.googleAccounts || [];
  const otherAccounts = accountsData?.otherAccounts || [];

  const filteredGoogle = googleAccounts.filter((acc) =>
    acc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredOther = otherAccounts.filter((acc) =>
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 overflow-hidden cyber-glow-cyan max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 to-blue-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 via-red-500/20 to-yellow-500/20 border border-slate-700 flex items-center justify-center">
              <span className="text-xl">🌐</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Google & Business Accounts
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/90 border border-cyan-500/40 text-cyan-300 font-bold">
                  {googleAccounts.length} Google
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>Logged into {deviceName}</span>
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
                title="Re-scan phone accounts"
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
        {(googleAccounts.length > 2 || otherAccounts.length > 2) && (
          <div className="my-3 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search business accounts or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
              />
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4 py-2">
          {isLoading && googleAccounts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-xs font-mono text-slate-400">
                Scanning registered phone accounts...
              </p>
            </div>
          ) : (
            <>
              {/* Google Accounts Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    Google Accounts ({filteredGoogle.length})
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">
                    Direct Laptop Access
                  </span>
                </div>

                {filteredGoogle.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
                    <p className="text-xs text-slate-400">
                      {searchQuery
                        ? 'No accounts matching your search'
                        : 'No Google accounts detected yet. Click refresh to query phone.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredGoogle.map((acc, idx) => {
                      const isCopied = copiedEmail === acc.name;
                      const gmailUrl = `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(
                        acc.name
                      )}`;
                      const driveUrl = `https://drive.google.com/drive/u/?authuser=${encodeURIComponent(
                        acc.name
                      )}`;

                      return (
                        <div
                          key={acc.name + idx}
                          className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 transition group space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-500/30 flex items-center justify-center shrink-0">
                                <span className="text-sm font-bold text-blue-400">G</span>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-mono font-bold text-slate-100 truncate block">
                                    {acc.name}
                                  </span>
                                  {acc.isPrimary && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold shrink-0">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                  Synced & Verified
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCopy(acc.name)}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1 transition shrink-0 ${
                                isCopied
                                  ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40'
                              }`}
                              title="Copy email to clipboard"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* 1-Click Business Shortcuts */}
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
                            <a
                              href={gmailUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-blue-950/80 border border-slate-800 hover:border-blue-500/40 text-[11px] font-mono text-slate-300 hover:text-blue-300 flex items-center justify-center gap-1 transition"
                              title="Open Gmail inbox in laptop browser"
                            >
                              <Mail className="w-3 h-3 text-red-400" />
                              <span>Open Gmail</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>

                            <a
                              href={driveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-yellow-950/80 border border-slate-800 hover:border-yellow-500/40 text-[11px] font-mono text-slate-300 hover:text-yellow-300 flex items-center justify-center gap-1 transition"
                              title="Open Google Drive in laptop browser"
                            >
                              <Briefcase className="w-3 h-3 text-yellow-400" />
                              <span>Google Drive</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Other Synchronized Business Accounts */}
              {filteredOther.length > 0 && (
                <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    Other Synced Accounts ({filteredOther.length})
                  </h4>

                  <div className="space-y-1.5">
                    {filteredOther.map((acc, idx) => {
                      const isCopied = copiedEmail === acc.name;
                      return (
                        <div
                          key={acc.name + idx}
                          className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-mono text-slate-200 block truncate">
                              {acc.name}
                            </span>
                            <span className="text-[10px] font-mono text-purple-400">
                              {acc.type}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopy(acc.name)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
                            title="Copy account ID"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 shrink-0 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            Total {accountsData?.totalAccounts || googleAccounts.length} account(s) on device
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

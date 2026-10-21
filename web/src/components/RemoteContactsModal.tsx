'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Users,
  Star,
  Search,
  Phone,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Download,
  MessageCircle,
  ShieldAlert,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

export interface RemoteContactItem {
  id: string;
  name: string;
  phone: string;
  allPhones?: string[];
  email?: string;
  isStarred?: boolean;
  photoUri?: string;
}

interface RemoteContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneName: string;
  contacts: RemoteContactItem[];
  isLoading: boolean;
  favoritesCount: number;
  totalCount: number;
  hasPermission?: boolean;
  errorMessage?: string;
  onRefreshContacts: (query?: string, onlyFavorites?: boolean) => void;
}

export const RemoteContactsModal: React.FC<RemoteContactsModalProps> = ({
  isOpen,
  onClose,
  phoneName,
  contacts,
  isLoading,
  favoritesCount,
  totalCount,
  hasPermission = true,
  errorMessage,
  onRefreshContacts,
}) => {
  const [activeTab, setActiveTab] = useState<'favorites' | 'all'>('favorites');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // If there are no favorites but there are contacts, default to 'all'
  React.useEffect(() => {
    if (isOpen) {
      if (favoritesCount === 0 && totalCount > 0) {
        setActiveTab('all');
      }
    } else {
      setSearchQuery('');
    }
  }, [isOpen, favoritesCount, totalCount]);

  const filteredContacts = useMemo(() => {
    let list = contacts;
    if (activeTab === 'favorites') {
      list = list.filter((c) => c.isStarred);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.allPhones && c.allPhones.some((p) => p.includes(q))) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return list;
  }, [contacts, activeTab, searchQuery]);

  if (!isOpen) return null;

  const handleCopyPhone = (id: string, phone: string) => {
    const clean = phone.replace(/[^0-9+]/g, '');
    navigator.clipboard.writeText(clean || phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyEmail = (id: string, email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id + '_email');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const cleanWhatsAppNumber = (phone: string) => {
    let clean = phone.replace(/[^0-9]/g, '');
    // If Pakistani local number starting with 03, prefix with 92
    if (clean.startsWith('03') && clean.length === 11) {
      clean = '92' + clean.slice(1);
    }
    return clean;
  };

  const handleExportCsv = () => {
    if (contacts.length === 0) return;
    const headers = ['Name', 'Primary Phone', 'All Phones', 'Email', 'Is Starred'];
    const rows = contacts.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${(c.allPhones || [c.phone]).join('; ')}"`,
      `"${c.email || ''}"`,
      c.isStarred ? 'Yes' : 'No',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${phoneName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Contacts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || '??';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl bg-[#0f131c] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-[1.5px] shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  Client & Phone Contacts
                </h2>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 text-emerald-400">
                  {phoneName}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {totalCount} Total Contacts • {favoritesCount} Starred Favorites
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export CSV button */}
            {contacts.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 transition"
                title="Download all client contacts as CSV spreadsheet"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export CSV</span>
              </button>
            )}

            {/* Refresh button */}
            <button
              type="button"
              onClick={() => onRefreshContacts(searchQuery, activeTab === 'favorites')}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-emerald-300 transition border border-slate-700 disabled:opacity-50"
              title="Re-sync contacts from phone"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-950/80 hover:text-rose-400 text-slate-400 border border-slate-700 transition"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="px-5 py-3 border-b border-slate-800/60 bg-[#121622] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('favorites')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'favorites'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Favorite Clients ({favoritesCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'all'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>All Contacts ({totalCount})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, phone, or email..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {!hasPermission ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/10">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Contacts Permission Required
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                PulseShare needs Contacts access on your phone to display your client contacts directory.
              </p>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left text-xs font-mono text-slate-300 space-y-1">
                <p className="text-emerald-400 font-bold">👉 How to allow on phone:</p>
                <p>1. Open <strong>PulseShare</strong> app on your mobile.</p>
                <p>2. Tap <strong>Allow</strong> on the Contacts permission dialog.</p>
                <p>3. Or go to Phone Settings → Apps → PulseShare → Permissions → Contacts → Allow.</p>
              </div>
              <button
                type="button"
                onClick={() => onRefreshContacts()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 mx-auto shadow-lg shadow-emerald-500/20 active:scale-95 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>I Have Allowed • Sync Now</span>
              </button>
            </div>
          ) : isLoading && contacts.length === 0 ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-mono text-slate-400">Loading contacts directory from {phoneName}...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="py-24 text-center space-y-3 font-mono text-xs text-slate-500">
              <Users className="w-10 h-10 mx-auto text-slate-700 mb-1" />
              {searchQuery ? (
                <p>No contacts matching &ldquo;{searchQuery}&rdquo;</p>
              ) : activeTab === 'favorites' ? (
                <div className="space-y-2">
                  <p>No starred favorite contacts found on your phone.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold"
                  >
                    View All {totalCount} Contacts
                  </button>
                </div>
              ) : (
                <p>No contacts found on device.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredContacts.map((contact) => {
                const isCopied = copiedId === contact.id;
                const isEmailCopied = copiedId === contact.id + '_email';
                const waNumber = cleanWhatsAppNumber(contact.phone);

                return (
                  <div
                    key={contact.id}
                    className={`relative rounded-xl p-3.5 border transition bg-[#141824] flex flex-col justify-between gap-3 ${
                      contact.isStarred
                        ? 'border-amber-500/40 bg-[#161b2b] shadow-sm shadow-amber-500/10'
                        : 'border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {/* Top row: Avatar + Name + Star */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar initials */}
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            contact.isStarred
                              ? 'bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black shadow-md shadow-amber-500/20'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {getInitials(contact.name)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-slate-100 truncate">
                              {contact.name}
                            </h4>
                            {contact.isStarred && (
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                            )}
                          </div>
                          {contact.email && (
                            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 truncate mt-0.5">
                              <Mail className="w-3 h-3 text-cyan-400 shrink-0" />
                              <span className="truncate">{contact.email}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyEmail(contact.id, contact.email!)}
                                className="text-slate-500 hover:text-cyan-300 ml-1"
                                title="Copy email address"
                              >
                                {isEmailCopied ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Phone numbers */}
                    <div className="space-y-1 bg-slate-950/60 rounded-lg p-2 border border-slate-800/60 font-mono text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-emerald-300 font-bold truncate">
                          <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="tracking-wide select-all">{contact.phone}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          Primary
                        </span>
                      </div>

                      {/* Additional phone numbers if available */}
                      {contact.allPhones && contact.allPhones.length > 1 && (
                        <div className="pt-1 mt-1 border-t border-slate-800/50 space-y-0.5">
                          {contact.allPhones
                            .filter((p) => p !== contact.phone)
                            .map((extraPhone, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-[11px] text-slate-400"
                              >
                                <span>{extraPhone}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyPhone(contact.id + '_' + idx, extraPhone)}
                                  className="text-slate-500 hover:text-emerald-400"
                                  title="Copy this number"
                                >
                                  {copiedId === contact.id + '_' + idx ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Quick Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      {/* Copy Number */}
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(contact.id, contact.phone)}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          isCopied
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80'
                        }`}
                        title="Copy phone number to laptop clipboard"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Copy Number</span>
                          </>
                        )}
                      </button>

                      {/* WhatsApp Chat link */}
                      {waNumber && (
                        <a
                          href={`https://wa.me/${waNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-3 rounded-lg bg-emerald-950/80 hover:bg-emerald-600 hover:text-white border border-emerald-500/50 text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition"
                          title="Open WhatsApp chat with client"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-current text-emerald-400" />
                          <span>WhatsApp</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 border-t border-slate-800/80 bg-slate-950/90 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400">
          <span>⚡ PulseShare Direct Gigabit Contact Bridge</span>
          <span>Tip: Star your frequent clients in your phone to see them instantly at the top</span>
        </div>
      </div>
    </div>
  );
};

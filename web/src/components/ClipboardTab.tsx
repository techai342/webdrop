'use client';

import React, { useState } from 'react';
import {
  Send,
  Copy,
  Check,
  Code2,
  Clock,
  User,
  Sparkles,
  Terminal,
  Smartphone,
  RefreshCw,
  Trash2,
  Zap,
} from 'lucide-react';
import type { TextSnippet } from '../lib/types';

export interface MobileClipItem {
  id: string;
  text: string;
  timestamp: number;
  source?: string;
  length?: number;
}

interface ClipboardTabProps {
  snippets: TextSnippet[];
  onSendSnippet: (text: string, language: string) => void;
  isConnected: boolean;
  targetName?: string;
  mobileClips?: MobileClipItem[];
  onRefreshMobileClips?: () => void;
  onClearMobileClips?: () => void;
  onSetPhoneClipboard?: (text: string) => void;
}

const LANGUAGES = [
  { id: 'plaintext', label: 'Plain Text' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'json', label: 'JSON' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'sql', label: 'SQL' },
  { id: 'markdown', label: 'Markdown' },
];

export const ClipboardTab: React.FC<ClipboardTabProps> = ({
  snippets,
  onSendSnippet,
  isConnected,
  targetName,
  mobileClips = [],
  onRefreshMobileClips,
  onClearMobileClips,
  onSetPhoneClipboard,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedLang, setSelectedLang] = useState('plaintext');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pastedClipId, setPastedClipId] = useState<string | null>(null);

  const handleSend = () => {
    if (!inputText.trim() || !isConnected) return;
    onSendSnippet(inputText, selectedLang);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopySnippet = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSetToPhone = (id: string, text: string) => {
    onSetPhoneClipboard?.(text);
    setPastedClipId(id);
    setTimeout(() => setPastedClipId(null), 2000);
  };

  const formatTimestamp = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 📱 Real-Time Mobile Copied Clips & History Section */}
      <div className="cyber-card p-5 border-emerald-500/30 bg-[#0d121c] relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                  Mobile Copied Clipboard History
                </h3>
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Everything you copy on your phone appears here instantly • Click to copy on PC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefreshMobileClips && (
              <button
                type="button"
                onClick={onRefreshMobileClips}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 flex items-center gap-1 transition"
                title="Fetch latest clips from phone"
              >
                <RefreshCw className="w-3 h-3 text-cyan-400" />
                <span>Sync Phone</span>
              </button>
            )}

            {mobileClips.length > 0 && onClearMobileClips && (
              <button
                type="button"
                onClick={onClearMobileClips}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/80 hover:text-rose-400 text-slate-400 text-xs font-mono border border-slate-700 transition"
                title="Clear clipboard history on phone"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {mobileClips.length === 0 ? (
          <div className="py-6 text-center text-slate-500 font-mono text-xs space-y-1">
            <Zap className="w-6 h-6 mx-auto text-emerald-500/50 mb-1" />
            <p className="text-slate-400 font-medium">Ready to intercept copied text from mobile</p>
            <p className="text-[11px] text-slate-500">
              Copy any client message, number, link, or note on your phone — it will show up here automatically!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
            {mobileClips.map((clip) => {
              const isCopied = copiedId === clip.id;
              const isPastedToPhone = pastedClipId === clip.id;

              return (
                <div
                  key={clip.id}
                  className="rounded-xl p-3 bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition flex flex-col justify-between gap-2.5 group"
                >
                  <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap break-all max-h-24 overflow-y-auto select-all leading-relaxed">
                    {clip.text}
                  </pre>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <span>{formatTimestamp(clip.timestamp)}</span>
                      <span>•</span>
                      <span>{clip.text.length} chars</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Copy to PC Clipboard */}
                      <button
                        type="button"
                        onClick={() => handleCopySnippet(clip.id, clip.text)}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition ${
                          isCopied
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400'
                        }`}
                        title="Copy this snippet directly to PC clipboard"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy to PC</span>
                          </>
                        )}
                      </button>

                      {/* Set back on Phone clipboard */}
                      {onSetPhoneClipboard && (
                        <button
                          type="button"
                          onClick={() => handleSetToPhone(clip.id, clip.text)}
                          className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition ${
                            isPastedToPhone
                              ? 'bg-cyan-500 text-slate-950 font-bold'
                              : 'bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-400'
                          }`}
                          title="Push this snippet back to Phone clipboard"
                        >
                          <Smartphone className="w-3 h-3" />
                          <span>{isPastedToPhone ? 'Sent to Phone!' : 'To Phone'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input composer card */}
      <div className="cyber-card p-5 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Code2 className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Share Code / Text Snippet
            </span>
            {targetName && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-300">
                🎯 {targetName}
              </span>
            )}
          </div>

          {/* Language Selector */}
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id} className="bg-slate-900 text-slate-200">
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isConnected
                ? "Paste code snippet, password, auth token, or message here... (Ctrl+Enter to send)"
                : "Connect a peer to enable instant clipboard sharing..."
            }
            disabled={!isConnected}
            rows={5}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500 transition-all resize-y disabled:opacity-50"
          />
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Enter</kbd> to transmit
          </span>

          <button
            onClick={handleSend}
            disabled={!inputText.trim() || !isConnected}
            className="ml-auto px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/25 transition-all active:scale-95"
          >
            <Send className="w-3.5 h-3.5" /> Transmit Snippet
          </button>
        </div>
      </div>

      {/* Snippet Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Transmitted Snippets Feed</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
              {snippets.length}
            </span>
          </h4>
        </div>

        {snippets.length === 0 ? (
          <div className="cyber-card p-10 text-center text-slate-500">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-medium text-slate-400">No snippets shared yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Paste code or text above to sync instantly with your connected peer!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {snippets.map((snippet) => {
              const isCopied = copiedId === snippet.id;

              return (
                <div
                  key={snippet.id}
                  className={`cyber-card p-4 transition-all ${
                    snippet.isSelf
                      ? 'border-cyan-500/30 bg-slate-900/60'
                      : 'border-emerald-500/30 bg-slate-900/70'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-mono text-slate-300">
                        <User className="w-3 h-3 text-cyan-400" />
                        <span className={snippet.isSelf ? 'text-cyan-400 font-medium' : 'text-emerald-400 font-medium'}>
                          {snippet.senderName} {snippet.isSelf && '(You)'}
                        </span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-400 uppercase">
                        {snippet.language}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(snippet.timestamp)}
                      </span>

                      {/* 1-Click Copy */}
                      <button
                        onClick={() => handleCopySnippet(snippet.id, snippet.text)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                          isCopied
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/50'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        }`}
                        title="Copy to clipboard"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Snippet Code Box */}
                  <pre className="bg-slate-950 p-3 rounded-lg overflow-x-auto text-xs font-mono text-slate-200 border border-slate-800/90 leading-relaxed whitespace-pre-wrap break-all">
                    <code>{snippet.text}</code>
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

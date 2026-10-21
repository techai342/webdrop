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
} from 'lucide-react';
import type { TextSnippet } from '../lib/types';

interface ClipboardTabProps {
  snippets: TextSnippet[];
  onSendSnippet: (text: string, language: string) => void;
  isConnected: boolean;
  targetName?: string;
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
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedLang, setSelectedLang] = useState('plaintext');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const formatTimestamp = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="w-full flex flex-col gap-6">
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

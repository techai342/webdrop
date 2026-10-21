'use client';

import React, { useState } from 'react';
import {
  Wifi,
  QrCode,
  Share2,
  RefreshCw,
  Check,
  Radio,
  Zap,
  Volume2,
  VolumeX,
  ShieldCheck,
  Palette,
  Smartphone,
} from 'lucide-react';
import type { ConnectedPeer, P2PConnectionState, ThemeAccent } from '../lib/types';
import { formatBytes } from '../lib/device-info';

interface HeaderProps {
  roomId: string;
  connectionState: P2PConnectionState;
  peers?: ConnectedPeer[];
  onOpenQrModal: () => void;
  onRegenerateRoom: () => void;
  lanIp?: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  autoAccept: boolean;
  onToggleAutoAccept: () => void;
  themeAccent: ThemeAccent;
  onSelectTheme: (accent: ThemeAccent) => void;
  sessionStats: { totalFiles: number; totalBytes: number };
}

export const Header: React.FC<HeaderProps> = ({
  roomId,
  connectionState,
  peers,
  onOpenQrModal,
  onRegenerateRoom,
  lanIp,
  soundEnabled,
  onToggleSound,
  autoAccept,
  onToggleAutoAccept,
  themeAccent,
  onSelectTheme,
  sessionStats,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  const handleCopyLink = () => {
    let shareUrl = window.location.href;
    if (lanIp && !window.location.hostname.includes(lanIp) && window.location.hostname === 'localhost') {
      const port = window.location.port ? `:${window.location.port}` : '';
      shareUrl = `${window.location.protocol}//${lanIp}${port}/?room=${roomId}`;
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId);
      shareUrl = url.toString();
    }

    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const THEMES: Array<{ id: ThemeAccent; name: string; color: string }> = [
    { id: 'cyan', name: 'Cyber Cyan', color: 'bg-cyan-400' },
    { id: 'emerald', name: 'Matrix Emerald', color: 'bg-emerald-400' },
    { id: 'violet', name: 'Neon Violet', color: 'bg-purple-400' },
    { id: 'amber', name: 'Sunset Amber', color: 'bg-amber-400' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-950/85 border-b border-slate-800/80 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Logo & Radar Pulse */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-[1.5px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center relative overflow-hidden">
              <span className="absolute w-6 h-6 rounded-full bg-cyan-400/20 animate-radar-wave" />
              <span className="absolute w-10 h-10 rounded-full bg-emerald-400/10 animate-radar-wave" style={{ animationDelay: '0.6s' }} />
              <Radio className="w-5 h-5 text-cyan-400 relative z-10" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                WebDrop P2P
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-950/50 text-cyan-400">
                Wire-Free
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono hidden sm:block">
              Zero-Cloud Browser-to-Browser Mesh
            </p>
          </div>
        </div>

        {/* Center: Live Status Pill & LAN IP */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {connectionState === 'connected' || (peers && peers.length > 0) ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/50 text-emerald-400 text-xs font-medium shadow-sm shadow-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {peers && peers.length === 1
                  ? `🟢 Paired: ${peers[0].device.name}`
                  : peers && peers.length > 1
                  ? `🟢 ${peers.length} Devices Paired & Ready`
                  : 'P2P Ready (Direct LAN)'}
              </span>
            </div>
          ) : connectionState === 'connecting' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 text-xs font-medium shadow-sm shadow-cyan-500/20">
              <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span>Connecting to Mesh...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/50 border border-amber-500/40 text-amber-300 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Waiting for Peer...</span>
            </div>
          )}

          {lanIp && (
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
              <Wifi className="w-3 h-3 text-cyan-400" />
              {lanIp}
            </span>
          )}

          {sessionStats.totalFiles > 0 && (
            <span className="hidden xl:inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-500/30">
              Synced: {sessionStats.totalFiles} files ({formatBytes(sessionStats.totalBytes)})
            </span>
          )}
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          {/* Sound Mute/Unmute */}
          <button
            onClick={onToggleSound}
            className={`p-1.5 rounded-lg border transition-all ${
              soundEnabled
                ? 'bg-slate-900 border-slate-700 text-cyan-400 hover:border-cyan-500'
                : 'bg-slate-950 border-slate-800 text-slate-600'
            }`}
            title={soundEnabled ? 'Mute Sci-Fi Audio' : 'Unmute Sci-Fi Audio'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Auto-Accept Toggle */}
          <button
            onClick={onToggleAutoAccept}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              autoAccept
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
            }`}
            title="Auto-Accept Incoming Files"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Auto-Accept:</span>
            <span>{autoAccept ? 'ON' : 'OFF'}</span>
          </button>

          {/* Theme Palette */}
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(!showThemePicker)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 transition-colors"
              title="Change Theme Accent"
            >
              <Palette className="w-4 h-4" />
            </button>

            {showThemePicker && (
              <div className="absolute right-0 mt-2 w-40 bg-slate-900 border border-slate-700 rounded-xl p-2 shadow-2xl z-50 flex flex-col gap-1">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onSelectTheme(t.id);
                      setShowThemePicker(false);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors ${
                      themeAccent === t.id
                        ? 'bg-slate-800 text-white font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${t.color}`} />
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Download Native Android APK Button */}
          <a
            href="/PulseShare.apk"
            download="PulseShare.apk"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/50 hover:border-emerald-400 text-emerald-300 text-xs font-bold font-mono transition-all shadow-sm active:scale-95"
            title="Download Updated PulseShare Android APK"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Download App</span>
            <span className="sm:hidden">APK</span>
          </a>

          {/* QR Code Button */}
          <button
            onClick={onOpenQrModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 text-slate-200 hover:text-cyan-300 text-xs font-medium transition-all shadow-sm active:scale-95"
            title="Scan QR Code with Phone"
          >
            <QrCode className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Pair Device</span>
            <span className="sm:hidden">QR</span>
          </button>

          {/* Share Link Button */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 text-slate-200 hover:text-emerald-300 text-xs font-medium transition-all shadow-sm active:scale-95"
            title="Copy Join Link"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Share Link</span>
              </>
            )}
          </button>

          {/* Regenerate Room PIN Button */}
          <button
            onClick={onRegenerateRoom}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-400 hover:text-slate-200 text-xs transition-all active:scale-95"
            title="New Room PIN"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

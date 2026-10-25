'use client';

import React from 'react';
import {
  Volume2,
  VolumeX,
  Volume1,
  Smartphone,
  X,
  Bell,
  Music,
  PhoneCall,
  Vibrate,
  Sliders,
  Check,
} from 'lucide-react';
import type { PhoneVolumeState } from '../lib/types';

interface RemoteVolumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceName?: string;
  peerId?: string;
  volumeState?: PhoneVolumeState | null;
  onAdjustVolume: (
    peerId: string,
    stream: string,
    action: string,
    value?: number,
    percent?: number
  ) => void;
}

export const RemoteVolumeModal: React.FC<RemoteVolumeModalProps> = ({
  isOpen,
  onClose,
  deviceName = 'Connected Phone',
  peerId = 'all',
  volumeState,
  onAdjustVolume,
}) => {
  if (!isOpen) return null;

  const mediaPercent = volumeState?.mediaPercent ?? 70;
  const isMediaMuted = volumeState?.isMediaMuted ?? false;
  const ringPercent = volumeState?.ringPercent ?? 80;
  const isRingMuted = volumeState?.isRingMuted ?? false;
  const notifPercent = volumeState?.notifPercent ?? 75;
  const ringerMode = volumeState?.ringerMode ?? 'normal';

  const handleMediaSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = parseInt(e.target.value, 10);
    onAdjustVolume(peerId, 'music', 'set', undefined, p);
  };

  const handleRingSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = parseInt(e.target.value, 10);
    onAdjustVolume(peerId, 'ring', 'set', undefined, p);
  };

  const handleNotifSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = parseInt(e.target.value, 10);
    onAdjustVolume(peerId, 'notif', 'set', undefined, p);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-2xl p-6 overflow-hidden cyber-glow-cyan"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Remote Phone Volume
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold">
                  HUD Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>{deviceName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sliders Container */}
        <div className="py-4 space-y-5">
          {/* 1. Media Audio Stream */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Media & Apps Volume
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {isMediaMuted ? 'Muted' : `${mediaPercent}%`}
                </span>
                <button
                  type="button"
                  onClick={() => onAdjustVolume(peerId, 'music', 'toggle_mute')}
                  className={`p-1.5 rounded-lg border text-xs font-mono font-bold transition ${
                    isMediaMuted
                      ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 hover:bg-rose-900'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-cyan-300'
                  }`}
                  title={isMediaMuted ? 'Unmute Media' : 'Mute Media'}
                >
                  {isMediaMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={isMediaMuted ? 0 : mediaPercent}
              onChange={handleMediaSliderChange}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />

            {/* Quick Preset Buttons */}
            <div className="flex items-center justify-between gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onAdjustVolume(peerId, 'music', 'mute')}
                className="flex-1 py-1 px-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-cyan-300 text-center transition"
              >
                Mute
              </button>
              <button
                type="button"
                onClick={() => onAdjustVolume(peerId, 'music', 'set', undefined, 25)}
                className="flex-1 py-1 px-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-cyan-300 text-center transition"
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => onAdjustVolume(peerId, 'music', 'set', undefined, 50)}
                className="flex-1 py-1 px-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-cyan-300 text-center transition"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => onAdjustVolume(peerId, 'music', 'set', undefined, 75)}
                className="flex-1 py-1 px-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-cyan-300 text-center transition"
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => onAdjustVolume(peerId, 'music', 'set', undefined, 100)}
                className="flex-1 py-1 px-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-cyan-300 text-center transition"
              >
                100%
              </button>
            </div>
          </div>

          {/* 2. Ringtone & Call Audio Stream */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Ring & Call Volume
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-emerald-300">
                  {isRingMuted ? 'Muted' : `${ringPercent}%`}
                </span>
                <button
                  type="button"
                  onClick={() => onAdjustVolume(peerId, 'ring', 'toggle_mute')}
                  className={`p-1.5 rounded-lg border text-xs font-mono font-bold transition ${
                    isRingMuted
                      ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 hover:bg-rose-900'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-300'
                  }`}
                  title={isRingMuted ? 'Unmute Ring' : 'Mute Ring'}
                >
                  {isRingMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={isRingMuted ? 0 : ringPercent}
              onChange={handleRingSliderChange}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>

          {/* 3. Notification Stream */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Notification Volume
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-300">
                {notifPercent}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={notifPercent}
              onChange={handleNotifSliderChange}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          {/* 4. Ringer Profile Modes */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => onAdjustVolume(peerId, 'normal', 'set_ringer_mode')}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 border transition ${
                ringerMode === 'normal'
                  ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Normal</span>
            </button>
            <button
              type="button"
              onClick={() => onAdjustVolume(peerId, 'vibrate', 'set_ringer_mode')}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 border transition ${
                ringerMode === 'vibrate'
                  ? 'bg-amber-950 border-amber-500/50 text-amber-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Vibrate className="w-3.5 h-3.5" />
              <span>Vibrate</span>
            </button>
            <button
              type="button"
              onClick={() => onAdjustVolume(peerId, 'silent', 'set_ringer_mode')}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 border transition ${
                ringerMode === 'silent'
                  ? 'bg-rose-950 border-rose-500/50 text-rose-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Silent</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            Changes trigger phone on-screen volume UI
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

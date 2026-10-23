'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  X,
  Circle,
  Square,
  Download,
  AlertCircle,
  Activity,
  Sparkles,
} from 'lucide-react';

interface RemoteMicModalProps {
  isOpen: boolean;
  onClose: () => void;
  isStreaming: boolean;
  micLiveLevel: number; // 0 to 100
  micVolume: number;
  isMuted: boolean;
  error: string | null;
  deviceName?: string;
  onToggleMute: () => void;
  onVolumeChange: (vol: number) => void;
  onStartRecord?: () => void;
  onStopRecord?: () => Blob | null;
}

export const RemoteMicModal: React.FC<RemoteMicModalProps> = ({
  isOpen,
  onClose,
  isStreaming,
  micLiveLevel,
  micVolume,
  isMuted,
  error,
  deviceName = 'Android Phone',
  onToggleMute,
  onVolumeChange,
  onStartRecord,
  onStopRecord,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  if (!isOpen) return null;

  const handleToggleRecord = () => {
    if (!isRecording) {
      setRecordedBlob(null);
      setIsRecording(true);
      onStartRecord?.();
    } else {
      setIsRecording(false);
      const blob = onStopRecord?.() || null;
      setRecordedBlob(blob);
    }
  };

  const handleDownloadRecording = () => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Phone_Mic_Recording_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Generate dynamic waveform bars based on live mic level
  const waveBars = [0.2, 0.45, 0.7, 0.9, 1.0, 0.85, 0.6, 0.35, 0.75, 0.95, 0.5, 0.3, 0.65, 0.8, 0.4];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#131722] to-[#0c0f17] border border-cyan-500/40 shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="relative p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 shadow-md">
              <Mic className="w-5 h-5" />
              {isStreaming && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                </span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Remote Live Microphone</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
                  16 kHz Mono
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate max-w-[240px]">
                {deviceName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Close Microphone Stream"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col items-center gap-6">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs font-mono">
            {isStreaming ? (
              <>
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-bold">LIVE STREAMING ACTIVE</span>
              </>
            ) : (
              <>
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400">CONNECTING MIC...</span>
              </>
            )}
          </div>

          {/* Animated Sound Waveform Visualizer */}
          <div className="w-full py-8 px-4 rounded-2xl bg-black/40 border border-slate-800/80 flex items-center justify-center gap-1.5 sm:gap-2 h-36 relative overflow-hidden">
            {waveBars.map((baseMultiplier, idx) => {
              const liveFactor = isStreaming && !isMuted ? (micLiveLevel / 100) : 0.05;
              const barHeightPercent = Math.max(8, Math.min(100, (baseMultiplier * liveFactor * 100) + 6));
              const isPeak = barHeightPercent > 70;

              return (
                <div
                  key={idx}
                  className="w-2.5 sm:w-3 rounded-full transition-all duration-75"
                  style={{
                    height: `${barHeightPercent}%`,
                    background: isMuted
                      ? '#475569'
                      : isPeak
                      ? 'linear-gradient(to top, #06b6d4, #ec4899)'
                      : 'linear-gradient(to top, #0284c7, #06b6d4)',
                    boxShadow: isStreaming && !isMuted && barHeightPercent > 20
                      ? '0 0 12px rgba(6, 182, 212, 0.4)'
                      : 'none',
                  }}
                />
              );
            })}

            {isMuted && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center gap-2 text-slate-400 font-mono text-xs">
                <VolumeX className="w-4 h-4 text-rose-400" />
                <span>Audio is Muted</span>
              </div>
            )}
          </div>

          {/* Real-time Level Progress Bar */}
          <div className="w-full flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Input Sound Meter</span>
              </span>
              <span className="font-bold text-cyan-300">{micLiveLevel}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100 bg-gradient-to-r from-cyan-500 via-emerald-400 to-rose-500"
                style={{ width: `${isStreaming ? micLiveLevel : 0}%` }}
              />
            </div>
          </div>

          {/* Volume Control & Mute */}
          <div className="w-full p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-4">
            <button
              onClick={onToggleMute}
              className={`p-2.5 rounded-xl border transition flex items-center gap-2 font-mono text-xs font-bold ${
                isMuted
                  ? 'bg-rose-950/80 border-rose-500 text-rose-300 hover:bg-rose-900'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <div className="flex-1 flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={isMuted ? 0 : micVolume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-xs font-mono text-slate-400 w-10 text-right">
                {Math.round(micVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Record Audio Feature */}
          <div className="w-full flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleToggleRecord}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 transition border ${
                isRecording
                  ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {isRecording ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                  <span>Stop Recording ({formatSecs(recordingSeconds)})</span>
                </>
              ) : (
                <>
                  <Circle className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                  <span>Record to WAV</span>
                </>
              )}
            </button>

            {recordedBlob && (
              <button
                type="button"
                onClick={handleDownloadRecording}
                className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save Audio</span>
              </button>
            )}
          </div>

          {/* Error Message if any */}
          {error && (
            <div className="w-full p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer: Prominent Turn Off Button */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between gap-3">
          <p className="text-[11px] font-mono text-slate-500">
            Audio stream is encrypted & direct P2P.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold flex items-center gap-2 transition shadow-lg shadow-rose-950/50"
          >
            <span>🛑 Turn OFF Mic</span>
          </button>
        </div>
      </div>
    </div>
  );
};

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  RefreshCw,
  Zap,
  Download,
  Maximize2,
  Minimize2,
  X,
  AlertCircle,
  Radio,
  Eye,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

interface RemoteCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFrame: string | null; // Base64 JPEG string
  cameraFacing: 'back' | 'front';
  isStreaming: boolean;
  isTorchOn: boolean;
  error: string | null;
  deviceName?: string;
  onSwitchCamera: () => void;
  onSelectFacing?: (facing: 'back' | 'front') => void;
  onToggleTorch: () => void;
}

export const RemoteCameraModal: React.FC<RemoteCameraModalProps> = ({
  isOpen,
  onClose,
  currentFrame,
  cameraFacing,
  isStreaming,
  isTorchOn,
  error,
  deviceName = 'Android Device',
  onSwitchCamera,
  onSelectFacing,
  onToggleTorch,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapshotFlash, setSnapshotFlash] = useState(false);
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastFpsCalcRef = useRef(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Measure real-time FPS & Draw to GPU Canvas for continuous silky-smooth video motion
  useEffect(() => {
    if (!currentFrame) return;
    frameCountRef.current++;
    const now = Date.now();
    const elapsed = now - lastFpsCalcRef.current;
    if (elapsed >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / elapsed));
      frameCountRef.current = 0;
      lastFpsCalcRef.current = now;
    }

    // Hardware accelerated GPU canvas draw (no DOM img decode flicker)
    if (!imgRef.current) {
      imgRef.current = new Image();
    }
    const img = imgRef.current;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
    };
    img.src = currentFrame.startsWith('data:') ? currentFrame : `data:image/jpeg;base64,${currentFrame}`;
  }, [currentFrame]);

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Snapshot capture handler
  const handleTakeSnapshot = () => {
    if (!currentFrame) return;
    setSnapshotFlash(true);
    setTimeout(() => setSnapshotFlash(false), 200);

    const link = document.createElement('a');
    link.href = currentFrame.startsWith('data:') ? currentFrame : `data:image/jpeg;base64,${currentFrame}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `PulseShare_Snapshot_${cameraFacing}_${timestamp}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div
        ref={containerRef}
        className={`w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all relative ${
          isFullscreen ? 'h-full max-w-none rounded-none border-none' : 'max-h-[92vh]'
        }`}
      >
        {/* Flash effect when taking snapshot */}
        {snapshotFlash && (
          <div className="absolute inset-0 z-30 bg-white/80 pointer-events-none animate-ping" />
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-800/90 select-none">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-950/70 border border-pink-500/40 text-pink-400">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>Live Remote Camera Feed</span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-950/80 text-red-400 border border-red-500/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    LIVE
                  </span>
                </h3>
              </div>
              <p className="text-xs font-mono text-slate-400 truncate max-w-md">
                📱 {deviceName} • {cameraFacing === 'front' ? 'Front (Selfie)' : 'Rear (Main)'} Lens
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="p-2 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-rose-950/60 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white transition"
              title="Close Stream (Releases Camera)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Video Display Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[340px] sm:min-h-[460px] overflow-hidden">
          {error ? (
            <div className="flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-3">
              <div className="p-3 rounded-full bg-red-950/80 border border-red-500/40 text-red-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-slate-200">Camera Unavailable</h4>
              <p className="text-xs font-mono text-rose-300 bg-rose-950/40 p-3 rounded-xl border border-rose-800/50">
                {error}
              </p>
              <button
                type="button"
                onClick={onSwitchCamera}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-2 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try Other Camera
              </button>
            </div>
          ) : currentFrame ? (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Main Hardware-Accelerated Smooth Video Canvas */}
              <canvas
                ref={canvasRef}
                className={`max-w-full max-h-full object-contain ${
                  cameraFacing === 'front' ? 'scale-x-[-1]' : ''
                }`}
                style={{ imageRendering: 'auto' }}
              />

              {/* Top Left Feed HUD Overlay */}
              <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 pointer-events-none select-none">
                <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-sm border border-slate-700/80 text-[10px] font-mono font-bold text-cyan-300 shadow">
                  {cameraFacing === 'front' ? '🤳 FRONT' : '📷 REAR'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-sm border border-slate-700/80 text-[10px] font-mono font-bold text-emerald-400 shadow">
                  ⚡ {fps} FPS
                </span>
                {isTorchOn && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-950/80 backdrop-blur-sm border border-amber-500/80 text-[10px] font-mono font-bold text-amber-300 shadow animate-pulse">
                    🔦 TORCH ON
                  </span>
                )}
              </div>

              {/* Bottom Right Privacy Notice HUD */}
              <div className="absolute bottom-3 right-3 pointer-events-none select-none">
                <span className="px-2.5 py-1 rounded-md bg-slate-950/85 backdrop-blur-sm border border-slate-700/80 text-[10px] font-mono text-slate-300 flex items-center gap-1.5 shadow">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Phone Service Active
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-pink-500/60 animate-spin" />
                <Camera className="w-6 h-6 text-pink-400 absolute inset-0 m-auto" />
              </div>
              <h4 className="text-sm font-bold text-slate-200">Initializing Phone Camera...</h4>
              <p className="text-xs text-slate-400 font-mono max-w-sm">
                Requesting background camera stream from {deviceName}. The green privacy dot will appear on the phone while streaming.
              </p>
            </div>
          )}
        </div>

        {/* Modal Controls Toolbar */}
        <div className="px-4 py-3 bg-slate-950/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {/* Direct Lens Switcher (Rear vs Front) */}
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-700/80 shadow-inner">
              <button
                type="button"
                onClick={() => (onSelectFacing ? onSelectFacing('back') : onSwitchCamera())}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition ${
                  cameraFacing === 'back'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-slate-950 shadow-md shadow-pink-500/30 font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Switch to Rear (Back Main) Camera"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>📷 Rear (Back)</span>
              </button>
              <button
                type="button"
                onClick={() => (onSelectFacing ? onSelectFacing('front') : onSwitchCamera())}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition ${
                  cameraFacing === 'front'
                    ? 'bg-gradient-to-r from-indigo-500 to-cyan-400 text-slate-950 shadow-md shadow-indigo-500/30 font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Switch to Front (Selfie) Camera"
              >
                <span>🤳 Front (Selfie)</span>
              </button>
            </div>

            {/* Quick Toggle Button */}
            <button
              type="button"
              onClick={onSwitchCamera}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 border border-slate-700 text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 transition shadow-sm"
              title="Flip Camera Lens"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            </button>

            {/* Torch Toggle Button (Only active on rear camera) */}
            {cameraFacing === 'back' && (
              <button
                type="button"
                onClick={onToggleTorch}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition active:scale-95 shadow-sm ${
                  isTorchOn
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-300 shadow-amber-400/50 animate-pulse'
                    : 'bg-amber-950/80 hover:bg-amber-400 hover:text-slate-950 border border-amber-500/50 text-amber-300'
                }`}
                title="Toggle Camera Flashlight"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isTorchOn ? 'Torch ON' : 'Torch OFF'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Capture Snapshot Button */}
            <button
              type="button"
              disabled={!currentFrame}
              onClick={handleTakeSnapshot}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 active:scale-95 disabled:opacity-40 text-slate-950 text-xs font-mono font-bold flex items-center gap-2 transition shadow-lg shadow-pink-500/25"
              title="Save full resolution picture snapshot directly to your Laptop"
            >
              <Camera className="w-4 h-4 text-slate-950" />
              <span>Capture Snapshot</span>
            </button>

            {/* Stop & Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition"
            >
              Stop & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

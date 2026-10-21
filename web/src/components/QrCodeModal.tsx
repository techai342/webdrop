'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as QRCodeLib from 'qrcode';
const QRCode = (QRCodeLib as any).default || QRCodeLib;
import {
  X,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Camera,
  Smartphone,
  Wifi,
} from 'lucide-react';
import type { NetworkInfo } from '../lib/types';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  networkInfo: NetworkInfo | null;
  onScanRoomId?: (scannedRoomId: string) => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  roomId,
  networkInfo,
  onScanRoomId,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'qr' | 'camera'>('qr');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize selected IP
  useEffect(() => {
    if (networkInfo?.primaryIp) {
      setSelectedIp(networkInfo.primaryIp);
    } else if (window.location.hostname !== 'localhost') {
      setSelectedIp(window.location.hostname);
    } else {
      setSelectedIp('localhost');
    }
  }, [networkInfo]);

  // Construct target join URL
  const isWebDomain = typeof window !== 'undefined' && 
    (window.location.hostname.includes('.') && window.location.hostname !== '127.0.0.1' && !networkInfo?.primaryIp);
  
  const portPart = networkInfo?.port 
    ? `:${networkInfo.port}` 
    : (window.location.port ? `:${window.location.port}` : (isWebDomain ? '' : ':3000'));
    
  const targetHost = selectedIp || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  const joinUrl = `${protocol}//${targetHost}${portPart}/?room=${roomId}`;

  // Generate QR Code
  useEffect(() => {
    if (!isOpen || !roomId) return;

    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#020617',
        light: '#22d3ee', // Cyan-400
      },
      errorCorrectionLevel: 'M',
    })
      .then((url: string) => setQrDataUrl(url))
      .catch((err: unknown) => console.error('Failed to generate QR code:', err));
  }, [isOpen, roomId, joinUrl]);

  // Camera cleanup
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen || activeTab !== 'camera') {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const handleStartCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setCameraError(err.message || 'Unable to access camera.');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 overflow-hidden cyber-glow-cyan">
        {/* Glow Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <QrCode className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Pair Nearby Device
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Scan with Phone Camera or Laptop
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch: QR Display vs Camera Scanner */}
        <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 mb-4">
          <button
            onClick={() => {
              setActiveTab('qr');
              stopCamera();
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'qr'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Show QR Code
          </button>
          <button
            onClick={() => {
              setActiveTab('camera');
              handleStartCamera();
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'camera'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" /> Scan Camera
          </button>
        </div>

        {activeTab === 'qr' ? (
          <div>
            {/* High-Res QR Code Card */}
            <div className="my-2 p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center justify-center">
              {qrDataUrl ? (
                <div className="p-3 bg-cyan-400 rounded-xl shadow-lg shadow-cyan-500/20">
                  <img
                    src={qrDataUrl}
                    alt="WebDrop Pairing QR Code"
                    className="w-56 h-56 rounded-lg block"
                  />
                </div>
              ) : (
                <div className="w-56 h-56 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              <p className="mt-3 text-xs text-center text-slate-400">
                Point your phone's camera at the screen to open directly.
              </p>
            </div>

            {/* Network IP Switcher (for multiple network cards) */}
            {networkInfo && networkInfo.allIps && networkInfo.allIps.length > 1 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 shrink-0">
                  <Wifi className="w-3 h-3 text-cyan-400" /> Host IP:
                </span>
                <select
                  value={selectedIp}
                  onChange={(e) => setSelectedIp(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-cyan-300 font-mono w-full focus:outline-none"
                >
                  {networkInfo.allIps.map((ip) => (
                    <option key={ip} value={ip}>
                      {ip} {ip === networkInfo.primaryIp ? '(Detected Wi-Fi)' : ''}
                    </option>
                  ))}
                  <option value="localhost">localhost</option>
                </select>
              </div>
            )}

            {/* Join Link Display & Copy Button */}
            <div className="mt-3 flex items-center gap-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs text-slate-400 font-mono truncate flex-1 px-1">
                {joinUrl}
              </span>
              <button
                onClick={handleCopyLink}
                className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1 transition-all active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Direct APK Download Link */}
            <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-emerald-500/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-100 font-mono">
                    Install Native Android App
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    24/7 Background Sync & Remote Hardware
                  </p>
                </div>
              </div>
              <a
                href="/PulseShare.apk"
                download="PulseShare.apk"
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono shrink-0 shadow-sm transition active:scale-95 flex items-center gap-1"
              >
                ⬇️ Download APK
              </a>
            </div>
          </div>
        ) : (
          <div className="my-2 p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center">
            {cameraError ? (
              <div className="py-8 text-center text-rose-400 text-xs space-y-2">
                <p>{cameraError}</p>
                <p className="text-slate-400">
                  Please grant camera permission or pair manually with the 6-digit PIN.
                </p>
              </div>
            ) : (
              <div className="w-full h-64 rounded-xl overflow-hidden bg-black relative flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-8 border-2 border-dashed border-cyan-400/70 rounded-xl pointer-events-none animate-pulse" />
              </div>
            )}
            <p className="mt-3 text-xs text-slate-400 text-center">
              Point your camera at a peer's WebDrop QR code.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

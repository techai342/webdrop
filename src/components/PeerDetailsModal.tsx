'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Laptop,
  Smartphone,
  Tablet,
  Activity,
  Cpu,
  Monitor,
  Battery,
  BatteryCharging,
  Zap,
  Globe,
  Clock,
  HardDrive,
  ShieldCheck,
  Server,
} from 'lucide-react';
import type { ConnectedPeer, DeviceMeta } from '../lib/types';

interface PeerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  peer: ConnectedPeer | DeviceMeta | null;
  latencyMs?: number | null;
}

export const PeerDetailsModal: React.FC<PeerDetailsModalProps> = ({
  isOpen,
  onClose,
  peer,
  latencyMs: overrideLatency,
}) => {
  const [uptimeStr, setUptimeStr] = useState<string>('00:00');

  const device: DeviceMeta | null = peer ? ('device' in peer ? peer.device : peer) : null;
  const latencyMs = peer && 'latencyMs' in peer ? peer.latencyMs : overrideLatency ?? null;

  useEffect(() => {
    if (!isOpen || !device?.joinedAt) return;

    const updateTimer = () => {
      const elapsedSeconds = Math.floor((Date.now() - (device.joinedAt || Date.now())) / 1000);
      const mins = Math.floor(elapsedSeconds / 60);
      const secs = elapsedSeconds % 60;
      setUptimeStr(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, device?.joinedAt]);

  if (!isOpen || !device) return null;

  const renderDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-6 h-6 text-cyan-400" />;
      case 'tablet':
        return <Tablet className="w-6 h-6 text-purple-400" />;
      default:
        return <Laptop className="w-6 h-6 text-emerald-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 overflow-hidden cyber-glow-cyan">
        {/* Glow Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40">
              {renderDeviceIcon(device.type)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  {device.name}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                  Connected
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Device Telemetry & Hardware Diagnostics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* 1. OS & Platform */}
          <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1 font-mono">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>OS & Platform</span>
            </div>
            <p className="text-sm font-semibold text-slate-200">
              {device.os}
            </p>
            <span className="text-[11px] text-slate-400 font-mono">
              Browser: {device.browser}
            </span>
          </div>

          {/* 2. Display Resolution */}
          <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1 font-mono">
              <Monitor className="w-3.5 h-3.5 text-emerald-400" />
              <span>Display Resolution</span>
            </div>
            <p className="text-sm font-semibold text-slate-200 font-mono">
              {device.screenResolution || 'Standard'}
            </p>
            <span className="text-[11px] text-slate-400 font-mono capitalize">
              Class: {device.type}
            </span>
          </div>

          {/* 3. Battery Telemetry */}
          <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1 font-mono">
              {device.isCharging ? (
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Battery className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Battery Status</span>
            </div>
            {device.batteryLevel !== undefined ? (
              <div>
                <p className="text-sm font-semibold text-slate-200 font-mono flex items-center gap-1.5">
                  <span>{device.batteryLevel}%</span>
                  {device.isCharging && (
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      Charging ⚡
                    </span>
                  )}
                </p>
                <div className="w-full bg-slate-900 rounded-full h-1.5 mt-1.5 overflow-hidden">
                  <div
                    className={`h-full ${
                      device.batteryLevel > 30 ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    style={{ width: `${device.batteryLevel}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1">AC Powered / Unknown</p>
            )}
          </div>

          {/* 4. Hardware Specs */}
          <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1 font-mono">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>CPU & Memory</span>
            </div>
            <p className="text-sm font-semibold text-slate-200 font-mono">
              {device.cpuCores ? `${device.cpuCores} Logical Cores` : 'Multi-Core'}
            </p>
            <span className="text-[11px] text-slate-400 font-mono">
              {device.deviceMemory ? `RAM: ~${device.deviceMemory} GB` : 'System RAM'}
            </span>
          </div>
        </div>

        {/* Live Network & WebRTC Diagnostics */}
        <div className="bg-slate-950/90 rounded-xl p-4 border border-slate-800 mb-5 space-y-2.5 text-xs font-mono">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> Live LAN Ping / RTT:
            </span>
            <span className="font-bold text-cyan-300">
              {latencyMs !== null ? `${latencyMs} ms` : 'Direct Channel'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" /> Session Uptime:
            </span>
            <span className="font-semibold text-emerald-400">
              {uptimeStr}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" /> Channel Encryption:
            </span>
            <span className="text-slate-200">
              DTLS 1.2 / SRTP (Native)
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-purple-400" /> Peer ID:
            </span>
            <span className="text-slate-400 text-[11px] truncate max-w-[200px]">
              {device.id}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all active:scale-95"
        >
          Close Diagnostics
        </button>
      </div>
    </div>
  );
};

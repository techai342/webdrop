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
  Radio,
  Wifi,
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
  const isSelf = device?.isSelf || (!peer ? false : !('device' in peer));
  const latencyMs = peer && 'latencyMs' in peer ? peer.latencyMs : overrideLatency ?? (isSelf ? 0 : null);

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
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 overflow-hidden cyber-glow-cyan max-h-[90vh] overflow-y-auto">
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
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    isSelf
                      ? 'bg-cyan-950 border-cyan-500/40 text-cyan-300'
                      : 'bg-emerald-950 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  {isSelf ? 'This Device (You)' : 'Mesh Peer'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Hardware Specs & Live Telemetry Diagnostics
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {/* 1. OS & Platform */}
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5 font-mono">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>Operating System</span>
              </div>
              <p className="text-sm font-bold text-slate-100 font-mono">
                {device.os}
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono flex items-center justify-between">
              <span>Browser:</span>
              <span className="text-cyan-300 font-semibold">{device.browser}</span>
            </div>
          </div>

          {/* 2. CPU & Hardware Concurrency */}
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5 font-mono">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>CPU Processor</span>
              </div>
              <p className="text-sm font-bold text-slate-100 font-mono">
                {device.cpuCores ? `${device.cpuCores} Logical CPU Cores` : 'Multi-Core Processor'}
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono flex items-center justify-between">
              <span>Memory (RAM):</span>
              <span className="text-purple-300 font-semibold">
                {device.deviceMemory ? `~${device.deviceMemory} GB RAM` : 'Available'}
              </span>
            </div>
          </div>

          {/* 3. Display & GPU */}
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5 font-mono">
                <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                <span>Display & Graphics</span>
              </div>
              <p className="text-sm font-bold text-slate-100 font-mono">
                {device.screenResolution || 'Standard Display'}
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono truncate" title={device.gpuRenderer || 'WebGL 2.0'}>
              <span className="text-slate-500">GPU: </span>
              <span className="text-emerald-300 font-semibold">{device.gpuRenderer || 'Hardware Accelerated'}</span>
            </div>
          </div>

          {/* 4. Battery Telemetry */}
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5 font-mono">
                {device.isCharging ? (
                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Battery className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Battery & Power</span>
              </div>
              {device.batteryLevel !== undefined ? (
                <div>
                  <p className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
                    <span>{device.batteryLevel}%</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        device.isCharging
                          ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-950/80 border-amber-500/30 text-amber-400'
                      }`}
                    >
                      {device.isCharging ? 'Charging ⚡' : 'Discharging'}
                    </span>
                  </p>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        device.batteryLevel > 30 ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${device.batteryLevel}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm font-bold text-slate-300 font-mono flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" /> AC Powered (Desktop)
                </p>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono flex items-center justify-between">
              <span>Device Form:</span>
              <span className="text-amber-300 font-semibold capitalize">{device.type}</span>
            </div>
          </div>
        </div>

        {/* Live Network & WebRTC Diagnostics */}
        <div className="bg-slate-950/90 rounded-xl p-4 border border-slate-800 mb-5 space-y-2.5 text-xs font-mono">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> Network Latency / RTT:
            </span>
            <span className="font-bold text-cyan-300">
              {isSelf ? '0 ms (Localhost)' : latencyMs !== null ? `${latencyMs} ms` : 'Direct Channel (< 1ms)'}
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
              DTLS 1.2 / SRTP (Native E2E)
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-purple-400" /> Mesh Network ID:
            </span>
            <span className="text-slate-400 text-[11px] truncate max-w-[200px]">
              {device.id}
            </span>
          </div>
        </div>

        {/* Footer Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider font-mono transition-colors"
        >
          Close Diagnostics
        </button>
      </div>
    </div>
  );
};

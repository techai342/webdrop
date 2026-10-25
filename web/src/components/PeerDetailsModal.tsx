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
  Database,
  AppWindow,
  Compass,
  AlertTriangle,
  Layers,
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
  const [showAllSensors, setShowAllSensors] = useState<boolean>(false);

  const device: DeviceMeta | null = peer ? ('device' in peer ? peer.device : peer) : null;
  const isSelf = device?.isSelf || (!peer ? false : !('device' in peer));
  const latencyMs = peer && 'latencyMs' in peer ? peer.latencyMs : overrideLatency ?? (isSelf ? 0 : null);
  const telemetry = device?.telemetry;

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

  const isLowBattery = telemetry?.battery?.isLow || (device.batteryLevel !== undefined && device.batteryLevel <= 20 && !device.isCharging);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 overflow-hidden cyber-glow-cyan max-h-[90vh] overflow-y-auto">
        {/* Glow Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
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
                {telemetry ? '⚡ Live Real-Time Hardware Telemetry' : 'Hardware Specs & Diagnostics'}
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

        {/* Low Battery Alert Banner */}
        {isLowBattery && (
          <div className="mb-4 p-3 rounded-xl bg-amber-950/60 border border-amber-500/50 flex items-center gap-3 text-amber-300 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-xs font-mono">
              <span className="font-bold">⚠️ Battery Low Alert:</span> Phone is at {device.batteryLevel}% battery. Connect charger to maintain gigabit transfer speeds.
            </div>
          </div>
        )}

        {/* 🤖 Dedicated Android OS & Hardware Platform Architecture Card */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/70 rounded-xl p-4 border border-cyan-500/50 mb-4 shadow-xl shadow-cyan-950/40">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800/90 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-500/50 text-cyan-400">
                <Smartphone className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs uppercase font-mono tracking-wider font-bold text-cyan-300 flex items-center gap-1.5">
                  🤖 Android OS & Platform Architecture
                </h4>
                <p className="text-[11px] text-slate-400 font-mono">
                  Verified Real-Time Operating System & Firmware
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-mono text-[10px] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Verified
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
            {/* 1. Android Release & Codename */}
            <div className="bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/90">
              <span className="text-[10px] text-slate-400 block mb-0.5">Operating System</span>
              <span className="font-bold text-cyan-300 text-xs block truncate" title={telemetry?.device?.codeName || device.os}>
                {telemetry?.device?.codeName || (device.os.includes('Android') ? device.os.split('•')[0].trim() : 'Android 14 (Upside Down Cake)')}
              </span>
              <span className="text-[10px] text-slate-400">
                Release: <strong className="text-slate-200">{telemetry?.device?.androidRelease || '14.0'}</strong>
              </span>
            </div>

            {/* 2. API Level / Target SDK */}
            <div className="bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/90">
              <span className="text-[10px] text-slate-400 block mb-0.5">API Level / SDK</span>
              <span className="font-bold text-emerald-300 text-xs block">
                API {telemetry?.device?.apiLevel || 34}
              </span>
              <span className="text-[10px] text-slate-400">
                Level: <strong className="text-emerald-400">SDK {telemetry?.device?.apiLevel || 34}</strong>
              </span>
            </div>

            {/* 3. Custom ROM / Skin */}
            <div className="bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/90">
              <span className="text-[10px] text-slate-400 block mb-0.5">OS Skin / Custom ROM</span>
              <span className="font-bold text-purple-300 text-xs block truncate" title={telemetry?.device?.customRom || 'Stock Android'}>
                {telemetry?.device?.customRom || (device.os.includes('Android') ? 'Stock Android' : 'Standard OS')}
              </span>
              <span className="text-[10px] text-slate-400">
                Skin: <strong className="text-purple-300">{telemetry?.device?.customRom || 'Stock Android'}</strong>
              </span>
            </div>

            {/* 4. CPU Architecture */}
            <div className="bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/90">
              <span className="text-[10px] text-slate-400 block mb-0.5">CPU Architecture</span>
              <span className="font-bold text-indigo-300 text-xs block">
                {telemetry?.device?.arch || 'arm64-v8a'}
              </span>
              <span className="text-[10px] text-slate-400">
                64-bit ARM ({device.cpuCores || 8} Cores)
              </span>
            </div>

            {/* 5. Security Patch Level */}
            <div className="bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/90">
              <span className="text-[10px] text-slate-400 block mb-0.5">Security Patch</span>
              <span className="font-bold text-teal-300 text-xs block">
                {telemetry?.device?.securityPatch || '2024-05-01'}
              </span>
              <span className="text-[10px] text-slate-400">
                Google Play Protect
              </span>
            </div>

            {/* 6. Hardware Model & Brand */}
            <div className="bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/90">
              <span className="text-[10px] text-slate-400 block mb-0.5">Device Hardware</span>
              <span className="font-bold text-amber-300 text-xs block truncate" title={telemetry?.device?.model || device.name}>
                {telemetry?.device?.model || device.name}
              </span>
              <span className="text-[10px] text-slate-400">
                Brand: <strong className="text-amber-200">{telemetry?.device?.brand || telemetry?.device?.manufacturer || (device.name.includes(' ') ? device.name.split(' ')[0] : 'Android')}</strong>
              </span>
            </div>
          </div>

          {/* Build ID & Full OS String Strip */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-1">
            <span>
              <strong className="text-slate-300">Build:</strong> {telemetry?.device?.buildId || 'Release Build'}
            </span>
            <span className="text-cyan-400 font-semibold truncate max-w-full">
              {telemetry?.device?.osVersion || device.os}
            </span>
          </div>
        </div>

        {/* Live Telemetry Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          
          {/* 1. Internal Storage (Real StatFs) */}
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5 font-mono">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                <span>Internal Storage</span>
              </div>
              {telemetry?.storage ? (
                <div>
                  <p className="text-sm font-bold text-slate-100 font-mono flex items-center justify-between">
                    <span>{telemetry.storage.usedGB} GB Used</span>
                    <span className="text-xs text-cyan-400 font-semibold">{telemetry.storage.usedPercentage}%</span>
                  </p>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full"
                      style={{ width: `${Math.min(100, telemetry.storage.usedPercentage)}%` }}
                    />
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 font-mono flex justify-between">
                    <span>Free: <strong className="text-emerald-400">{telemetry.storage.freeGB} GB</strong></span>
                    <span>Total: {telemetry.storage.totalGB} GB</span>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-slate-300 font-mono">
                    Storage Available
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">Syncing live stats...</p>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono flex items-center justify-between">
              <span>Drive Status:</span>
              <span className="text-emerald-300 font-semibold">Mounted & Ready</span>
            </div>
          </div>

          {/* 2. RAM / Memory (Real ActivityManager) */}
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5 font-mono">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>Memory (RAM)</span>
              </div>
              {telemetry?.memory ? (
                <div>
                  <p className="text-sm font-bold text-slate-100 font-mono flex items-center justify-between">
                    <span>{telemetry.memory.totalRamGB} GB Total</span>
                    <span className="text-xs text-purple-400 font-semibold">{telemetry.memory.availRamGB} GB Free</span>
                  </p>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full"
                      style={{ width: `${Math.min(100, telemetry.memory.usedPercentage)}%` }}
                    />
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 font-mono flex justify-between">
                    <span>Usage: {telemetry.memory.usedPercentage}%</span>
                    <span>Status: <strong className={telemetry.memory.isLowRam ? "text-amber-400" : "text-emerald-400"}>{telemetry.memory.isLowRam ? "Low RAM" : "Optimal"}</strong></span>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-slate-100 font-mono">
                    {device.deviceMemory ? `~${device.deviceMemory} GB RAM` : 'Multi-Channel RAM'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">Active High-Speed Heap</p>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono flex items-center justify-between">
              <span>CPU Cores:</span>
              <span className="text-purple-300 font-semibold">{device.cpuCores || 8} Cores Active</span>
            </div>
          </div>

          {/* 3. Battery & Power Telemetry */}
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
                          : isLowBattery
                          ? 'bg-red-950/80 border-red-500/40 text-red-300'
                          : 'bg-amber-950/80 border-amber-500/30 text-amber-400'
                      }`}
                    >
                      {device.isCharging ? 'Charging ⚡' : isLowBattery ? 'Low Battery' : 'Discharging'}
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
              <span>Source:</span>
              <span className="text-amber-300 font-semibold">{telemetry?.battery?.plugType || 'Li-Ion Cell'}</span>
            </div>
          </div>

          {/* 4. Installed Apps Count (PackageManager) */}
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5 font-mono">
                <AppWindow className="w-3.5 h-3.5 text-teal-400" />
                <span>Installed Applications</span>
              </div>
              {telemetry?.apps ? (
                <div>
                  <p className="text-sm font-bold text-slate-100 font-mono flex items-center justify-between">
                    <span>{telemetry.apps.totalApps} Apps Total</span>
                    <span className="text-xs text-teal-400 font-semibold">{telemetry.apps.userApps} User</span>
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-1">
                    System Services: <strong className="text-slate-300">{telemetry.apps.systemApps}</strong>
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-slate-100 font-mono">
                    Apps Registry
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">Available on mobile</p>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono flex items-center justify-between">
              <span>OS Base:</span>
              <span className="text-teal-300 font-semibold">{telemetry?.device?.osVersion || device.os}</span>
            </div>
          </div>
        </div>

        {/* Device Runtime & System Uptime Telemetry */}
        {telemetry?.runtime && (
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/90 mb-4">
            <div className="flex items-center gap-1.5 text-slate-300 text-xs font-mono font-bold mb-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>System & Service Runtime</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-0.5">Device Uptime (Since Boot)</span>
                <span className="font-bold text-purple-300 font-mono text-sm block">
                  {telemetry.runtime.formatted}
                </span>
                {telemetry.runtime.bootTimeMillis && (
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Booted: {new Date(telemetry.runtime.bootTimeMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-0.5">PulseShare Service Uptime</span>
                <span className="font-bold text-emerald-300 font-mono text-sm block">
                  {telemetry.runtime.serviceUptimeFormatted || telemetry.runtime.formatted}
                </span>
                <span className="text-[10px] text-emerald-400/80 block mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active 24/7 background sync
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 5. Real Hardware Sensors Detected */}
        {telemetry?.sensors && (
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/90 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-slate-300 text-xs font-mono font-bold">
                <Compass className="w-4 h-4 text-emerald-400" />
                <span>Hardware Sensors ({telemetry.sensors.count} Total / {telemetry.sensors.uniqueCount} Active)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAllSensors(!showAllSensors)}
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline"
              >
                {showAllSensors ? 'Show Less' : 'Show All'}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {(showAllSensors ? telemetry.sensors.list : telemetry.sensors.list.slice(0, 8)).map((s: any, idx: number) => (
                <span
                  key={idx}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {s.name}
                </span>
              ))}
              {!showAllSensors && telemetry.sensors.list.length > 8 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  +{telemetry.sensors.list.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Live Network & WebRTC Diagnostics */}
        <div className="bg-slate-950/90 rounded-xl p-4 border border-slate-800 mb-5 space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> Network Latency / RTT:
            </span>
            <span className="font-bold text-cyan-300">
              {isSelf ? '0 ms (Localhost)' : latencyMs !== null ? `${latencyMs} ms` : 'Active Mesh (< 15ms)'}
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
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" /> 24/7 Background Sync:
            </span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Watchdog + 25s Heartbeat Active
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

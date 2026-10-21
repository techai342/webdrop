'use client';

import React, { useState } from 'react';
import {
  Laptop,
  Smartphone,
  Tablet,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Activity,
  UserCheck,
  Radio,
  Edit2,
  Battery,
  BatteryCharging,
  Cpu,
  Monitor,
  Eye,
  RadioTower,
  Users,
  Target,
  HardDrive,
  Zap,
} from 'lucide-react';
import type { ConnectedPeer, DeviceMeta } from '../lib/types';

interface DeviceCardsProps {
  roomId: string;
  onJoinRoom: (targetRoomId: string) => void;
  selfDevice: DeviceMeta;
  peers: ConnectedPeer[];
  selectedTargetPeerId: string; // 'all' or peerId
  onSelectTarget: (peerId: string) => void;
  onUpdateSelfName: (newName: string) => void;
  onInspectPeer: (peer: ConnectedPeer) => void;
  onInspectSelf?: () => void;
  onRegenerateRoom?: () => void;
  onSendDeviceCommand?: (targetPeerId: string, action: string, payload?: any) => void;
}

export const DeviceCards: React.FC<DeviceCardsProps> = ({
  roomId,
  onJoinRoom,
  selfDevice,
  peers,
  selectedTargetPeerId,
  onSelectTarget,
  onUpdateSelfName,
  onInspectPeer,
  onInspectSelf,
  onRegenerateRoom,
  onSendDeviceCommand,
}) => {
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [isGlobalAlarmActive, setIsGlobalAlarmActive] = useState(false);
  const [activeAlarmPeers, setActiveAlarmPeers] = useState<Record<string, boolean>>({});

  const handleToggleGlobalAlarm = () => {
    const nextState = !isGlobalAlarmActive;
    setIsGlobalAlarmActive(nextState);
    onSendDeviceCommand?.('all', 'find_my_phone', { enabled: nextState });
  };

  const handleTogglePeerAlarm = (peerId: string) => {
    const isCurrentlyRinging = activeAlarmPeers[peerId] || false;
    const nextState = !isCurrentlyRinging;
    setActiveAlarmPeers(prev => ({ ...prev, [peerId]: nextState }));
    onSendDeviceCommand?.(peerId, 'find_my_phone', { enabled: nextState });
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const isWeb = window.location.hostname.includes('.') && window.location.hostname !== '127.0.0.1';
      const port = window.location.port ? `:${window.location.port}` : (isWeb ? '' : ':3000');
      const link = `${window.location.protocol}//${window.location.hostname}${port}/?room=${roomId}`;
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Editing self device name
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(selfDevice.name);

  const handleCopyPin = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleManualJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = inputPin.trim();
    if (cleanPin.length >= 4) {
      onJoinRoom(cleanPin);
      setInputPin('');
    }
  };

  const handleSaveName = () => {
    if (editedName.trim()) {
      onUpdateSelfName(editedName.trim());
      setIsEditingName(false);
    }
  };

  const renderDeviceIcon = (type: string, className: string = 'w-5 h-5') => {
    switch (type) {
      case 'mobile':
        return <Smartphone className={className} />;
      case 'tablet':
        return <Tablet className={className} />;
      default:
        return <Laptop className={className} />;
    }
  };

  const connectedPeers = peers.filter((p) => p.connectionState === 'connected');

  return (
    <div className="mb-6 space-y-4">
      {/* Top 2 Cards: Room PIN & Local Host */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Room PIN Card */}
        <div className="cyber-card p-5 relative overflow-hidden flex flex-col justify-between group hover:border-cyan-500/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
                <Radio className="w-4 h-4" />
              </span>
              <h3 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-bold">
                Mesh Room Code
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
                title="Copy Direct Pairing Link"
              >
                {copiedLink ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span className="text-[11px] font-mono">{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyPin}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
                title="Copy Room PIN"
              >
                {copiedPin ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span className="text-[11px] font-mono">{copiedPin ? 'Copied' : 'PIN'}</span>
              </button>
            </div>
          </div>

          <div className="my-1 text-center py-2 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span className="text-3xl lg:text-4xl font-extrabold tracking-widest font-mono bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-300 bg-clip-text text-transparent select-all">
              {roomId}
            </span>
          </div>

          {/* Join Other Room Input */}
          <form onSubmit={handleManualJoin} className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={inputPin}
              onChange={(e) => setInputPin(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
              placeholder="Enter room code to join..."
              maxLength={8}
              className="w-full bg-slate-900/90 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
            />
            <button
              type="submit"
              disabled={!inputPin.trim()}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all"
            >
              Join <ArrowRight className="w-3 h-3" />
            </button>
          </form>

          {/* Persistent Room Indicator */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3 h-3" /> Always Auto-Paired
            </span>
            {onRegenerateRoom && (
              <button
                type="button"
                onClick={onRegenerateRoom}
                className="text-[10px] text-slate-500 hover:text-cyan-400 underline transition-colors"
                title="Generate a brand new room PIN"
              >
                Reset PIN
              </button>
            )}
          </div>
        </div>

        {/* 2. This Device Card */}
        <div className="cyber-card p-5 relative overflow-hidden flex flex-col justify-between group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-cyan-400">
                {renderDeviceIcon(selfDevice.type)}
              </span>
              <h3 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-bold">
                This Device (You)
              </h3>
            </div>
            {onInspectSelf && (
              <button
                type="button"
                onClick={onInspectSelf}
                className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-500/40 text-cyan-300 flex items-center gap-1.5 transition-all shadow-sm"
                title="View Full Hardware Specs & Telemetry"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Specs & Details</span>
              </button>
            )}
          </div>

          {/* Device Name (Editable) */}
          <div className="my-1">
            {isEditingName ? (
              <div className="flex items-center gap-1.5 mb-1">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  maxLength={30}
                  className="w-full bg-slate-950 border border-cyan-500 rounded px-2 py-1 text-xs text-slate-100 font-semibold focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="px-2 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded text-xs font-bold"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-slate-100 truncate" title={selfDevice.name}>
                  {selfDevice.name}
                </h4>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded text-slate-500 hover:text-cyan-400 transition-colors"
                  title="Edit Device Name"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Clear, High-Contrast Specs Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                {selfDevice.os}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200">
                {selfDevice.browser}
              </span>
              {selfDevice.cpuCores && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-purple-300 flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-purple-400" />
                  {selfDevice.cpuCores} Cores
                </span>
              )}
              {selfDevice.deviceMemory && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-blue-300 flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-blue-400" />
                  ~{selfDevice.deviceMemory}GB RAM
                </span>
              )}
              {selfDevice.screenResolution && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-teal-300 flex items-center gap-1">
                  <Monitor className="w-3 h-3 text-teal-400" />
                  {selfDevice.screenResolution}
                </span>
              )}
              {selfDevice.batteryLevel !== undefined ? (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-emerald-400 flex items-center gap-1">
                  {selfDevice.isCharging ? (
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Battery className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  {selfDevice.batteryLevel}% {selfDevice.isCharging ? '⚡' : ''}
                </span>
              ) : (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-slate-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" /> AC Powered
                </span>
              )}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span className="truncate">Node ID: {selfDevice.id.slice(0, 10)}</span>
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> P2P Mesh Active
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Hardware Remote Controls & Live Telemetry Banner (Always visible when mobile is in room) */}
      {(() => {
        const mobilePeer = peers.find((p) => p.device.type === 'mobile' || p.device.os.toLowerCase().includes('android'));
        if (!mobilePeer) return null;

        const tel = mobilePeer.device.telemetry;
        const batLevel = tel?.battery?.level ?? mobilePeer.device.batteryLevel;
        const isCharging = tel?.battery?.isCharging ?? mobilePeer.device.isCharging;
        const isLowBat = tel?.battery?.isLow || (batLevel !== undefined && batLevel <= 20 && !isCharging);

        return (
          <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/80 via-slate-900 to-emerald-950/80 border border-cyan-500/50 shadow-xl shadow-cyan-950/50 space-y-3 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <div className="text-sm font-mono font-bold text-slate-100 flex flex-wrap items-center gap-2">
                    📱 <span className="text-cyan-400">{mobilePeer.device.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold">
                      🤖 {tel?.device?.codeName || (mobilePeer.device.os.includes('Android') ? mobilePeer.device.os.split('•')[0].trim() : mobilePeer.device.os)}
                    </span>
                    {tel?.device?.customRom && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/50 text-purple-300 font-bold">
                        {tel.device.customRom}
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold">
                      24/7 Watchdog Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Live Anti-Timeout Heartbeat • Background Multitasking Ready (TikTok, YouTube, Locked)
                  </p>
                </div>
              </div>

              {/* Hardware Remote Triggers */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSendDeviceCommand?.('all', 'vibrate', { durationMs: 2000 })}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/30 transition transform active:scale-95"
                  title="Trigger Full Strength Fast Vibration on Phone"
                >
                  📳 Vibrate Phone
                </button>
                <button
                  type="button"
                  onClick={() => onSendDeviceCommand?.('all', 'torch_toggle')}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-400/30 transition transform active:scale-95"
                  title="Turn Phone Flashlight / Torch ON or OFF"
                >
                  🔦 Torch ON/OFF
                </button>
                <button
                  type="button"
                  onClick={handleToggleGlobalAlarm}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-md transition transform active:scale-95 ${
                    isGlobalAlarmActive
                      ? 'bg-red-600 hover:bg-red-500 text-white animate-bounce shadow-red-600/50'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                  }`}
                  title={isGlobalAlarmActive ? "Click to STOP ringing and turn off flashlight" : "Ring Loud Alarm + Strobe Torch to Find Misplaced Phone"}
                >
                  {isGlobalAlarmActive ? '🛑 Stop Ringing' : '🚨 Find My Phone'}
                </button>
              </div>
            </div>

            {/* Live Telemetry Badges Strip */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-2">
                {/* Android OS Badge */}
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300 flex items-center gap-1.5 font-bold">
                  🤖 {tel?.device?.androidRelease ? `Android ${tel.device.androidRelease} (API ${tel.device.apiLevel || 34})` : (mobilePeer.device.os.includes('Android') ? mobilePeer.device.os.split('•')[0].trim() : 'Android 14')}
                </span>

                {/* Battery Badge */}
                {batLevel !== undefined && (
                  <span className={`px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                    isLowBat
                      ? 'bg-red-950/90 border-red-500/50 text-red-300 animate-pulse'
                      : 'bg-slate-950 border-slate-800 text-emerald-400'
                  }`}>
                    {isCharging ? <BatteryCharging className="w-3.5 h-3.5" /> : <Battery className="w-3.5 h-3.5" />}
                    <strong>{batLevel}%</strong> {isCharging ? 'Charging ⚡' : isLowBat ? 'Low Battery' : ''}
                  </span>
                )}

                {/* Storage Badge */}
                {tel?.storage ? (
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                    Storage: <strong>{tel.storage.usedGB}GB / {tel.storage.totalGB}GB</strong> ({tel.storage.freeGB}GB Free)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                    Storage: ~128GB
                  </span>
                )}

                {/* RAM Badge */}
                {tel?.memory && (
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-purple-300 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    RAM: <strong>{tel.memory.availRamGB}GB Free</strong> of {tel.memory.totalRamGB}GB
                  </span>
                )}

                {/* Apps Count Badge */}
                {tel?.apps && (
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-teal-300 flex items-center gap-1.5">
                    📱 <strong>{tel.apps.totalApps} Apps</strong> ({tel.apps.userApps} User)
                  </span>
                )}

                {/* Sensors Count */}
                {tel?.sensors && (
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-300 flex items-center gap-1.5">
                    🧭 <strong>{tel.sensors.count} Sensors</strong>
                  </span>
                )}
              </div>

              {/* View Full Specs Modal Button */}
              {onInspectPeer && (
                <button
                  type="button"
                  onClick={() => onInspectPeer(mobilePeer)}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-bold text-[11px] flex items-center gap-1 transition"
                >
                  <Cpu className="w-3 h-3 text-cyan-400" /> Full Specs & Diagnostics ➔
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Target Selector Toolbar (Broadcast to All vs Single Device) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800/90">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5">
            <Target className="w-4 h-4 text-cyan-400" />
            <span>Target Mode:</span>
          </span>
          <span className="text-xs font-semibold text-slate-200">
            {selectedTargetPeerId === 'all'
              ? `⚡ Broadcast to All (${connectedPeers.length} Peers)`
              : `🎯 Target: ${peers.find((p) => p.peerId === selectedTargetPeerId)?.device.name || 'Single Peer'}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectTarget('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${
              selectedTargetPeerId === 'all'
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <RadioTower className="w-3.5 h-3.5" /> Broadcast to All ({connectedPeers.length})
          </button>
        </div>
      </div>

      {/* Connected Peers Dynamic Mesh Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Connected Mesh Devices ({peers.length})</span>
          </h4>
        </div>

        {peers.length === 0 ? (
          <div className="cyber-card p-8 text-center text-slate-500">
            <UserCheck className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No peers connected to this room yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Scan the QR Code on your mobile phone or share room code <strong className="text-cyan-400 font-mono">{roomId}</strong> with any laptop or tablet to pair instantly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {peers.map((peer) => {
              const isConnected = peer.connectionState === 'connected';
              const isSelected = selectedTargetPeerId === peer.peerId;

              return (
                <div
                  key={peer.peerId}
                  onClick={() => onSelectTarget(peer.peerId)}
                  className={`cyber-card p-4 cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/20 cyber-glow-cyan ring-1 ring-cyan-400/50'
                      : isConnected
                      ? 'hover:border-emerald-500/50 hover:bg-slate-900/90'
                      : 'border-slate-800 opacity-60'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`p-1.5 rounded-lg border ${
                        isConnected
                          ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}>
                        {renderDeviceIcon(peer.device.type)}
                      </span>
                      <div>
                        <h5 className="text-sm font-bold text-slate-100 truncate max-w-[140px]" title={peer.device.name}>
                          {peer.device.name}
                        </h5>
                        <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono text-slate-400">
                          <span className="text-cyan-400 font-bold">
                            🤖 {peer.device.telemetry?.device?.codeName || (peer.device.os.includes('Android') ? peer.device.os.split('•')[0].trim() : peer.device.os)}
                          </span>
                          {peer.device.telemetry?.device?.customRom && (
                            <span className="text-purple-300 px-1 rounded bg-purple-950/60 border border-purple-800/40 text-[9px]">
                              {peer.device.telemetry.device.customRom}
                            </span>
                          )}
                          <span>• {peer.device.browser}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isSelected ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold">
                          Target
                        </span>
                      ) : isConnected ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title="Connected" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-600" title="Connecting..." />
                      )}
                    </div>
                  </div>

                  {/* Telemetry info */}
                  <div className="flex flex-wrap items-center gap-1.5 my-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300 flex items-center gap-1 font-semibold">
                      🤖 {peer.device.telemetry?.device?.androidRelease ? `Android ${peer.device.telemetry.device.androidRelease} (API ${peer.device.telemetry.device.apiLevel || 34})` : (peer.device.os.includes('Android') ? peer.device.os.split('•')[0].trim() : 'Android 14')}
                    </span>
                    {peer.device.cpuCores && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-purple-300 flex items-center gap-1">
                        <Cpu className="w-2.5 h-2.5 text-purple-400" />
                        {peer.device.cpuCores} Cores
                      </span>
                    )}
                    {peer.device.deviceMemory && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-blue-300 flex items-center gap-1">
                        <HardDrive className="w-2.5 h-2.5 text-blue-400" />
                        ~{peer.device.deviceMemory}GB
                      </span>
                    )}
                    {peer.device.screenResolution && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-teal-300 flex items-center gap-1">
                        <Monitor className="w-2.5 h-2.5 text-teal-400" />
                        {peer.device.screenResolution}
                      </span>
                    )}
                    {peer.device.batteryLevel !== undefined ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400 flex items-center gap-1">
                        {peer.device.isCharging ? (
                          <BatteryCharging className="w-2.5 h-2.5" />
                        ) : (
                          <Battery className="w-2.5 h-2.5 text-emerald-400" />
                        )}
                        {peer.device.batteryLevel}% {peer.device.isCharging ? '⚡' : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 text-amber-400" /> AC Powered
                      </span>
                    )}
                    {peer.device.telemetry?.storage && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300 flex items-center gap-1">
                        <HardDrive className="w-2.5 h-2.5 text-cyan-400" />
                        {peer.device.telemetry.storage.usedGB}/{peer.device.telemetry.storage.totalGB}GB
                      </span>
                    )}
                    {peer.device.telemetry?.apps && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-teal-300 flex items-center gap-1">
                        📱 {peer.device.telemetry.apps.totalApps} Apps
                      </span>
                    )}
                  </div>

                  {/* Remote Hardware Controls for Mobile/Android Phones */}
                  {onSendDeviceCommand && (
                    <div className="my-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onSendDeviceCommand(peer.peerId, 'vibrate', { durationMs: 2000 })}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-cyan-950/80 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-bold flex items-center justify-center gap-1 transition shadow-sm"
                        title="Vibrate Connected Phone"
                      >
                        📳 Vibrate
                      </button>
                      <button
                        type="button"
                        onClick={() => onSendDeviceCommand(peer.peerId, 'torch_toggle')}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-amber-950/80 hover:bg-amber-400 hover:text-slate-950 border border-amber-500/50 text-amber-300 text-xs font-mono font-bold flex items-center justify-center gap-1 transition shadow-sm"
                        title="Toggle Flashlight on Phone"
                      >
                        🔦 Torch
                      </button>
                      {(() => {
                        const isRinging = activeAlarmPeers[peer.peerId] || isGlobalAlarmActive;
                        return (
                          <button
                            type="button"
                            onClick={() => handleTogglePeerAlarm(peer.peerId)}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1 transition shadow-sm ${
                              isRinging
                                ? 'bg-red-600 hover:bg-red-500 text-white animate-bounce shadow-red-600/50'
                                : 'bg-rose-950/80 hover:bg-rose-600 hover:text-white border border-rose-500/50 text-rose-300'
                            }`}
                            title={isRinging ? "Click to STOP ringing phone" : "Ring & Flash Phone to find it!"}
                          >
                            {isRinging ? '🛑 Stop' : '🚨 Find'}
                          </button>
                        );
                      })()}
                    </div>
                  )}

                  {/* Footer Stats & Prominent Action Button */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-xs font-mono font-bold text-cyan-300">
                      <Activity className="w-3 h-3 text-cyan-400" />
                      {peer.latencyMs !== null ? `${peer.latencyMs} ms` : 'P2P Ready'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectPeer(peer);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-500/40 text-cyan-300 flex items-center gap-1 text-xs font-mono font-bold transition-all shadow-sm"
                      title="View Full Device Diagnostics"
                    >
                      <Eye className="w-3.5 h-3.5" /> Specs & Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

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
  Clock,
  RadioTower,
  Users,
  Target,
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
}) => {
  const [copiedPin, setCopiedPin] = useState(false);
  const [inputPin, setInputPin] = useState('');

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
              <h3 className="text-xs uppercase font-mono tracking-wider text-slate-400">
                Room Mesh PIN
              </h3>
            </div>
            <button
              onClick={handleCopyPin}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors p-1"
              title="Copy PIN"
            >
              {copiedPin ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span className="text-[11px]">{copiedPin ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="my-1 text-center py-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <span className="text-3xl lg:text-4xl font-extrabold tracking-widest font-mono bg-gradient-to-r from-cyan-400 to-teal-200 bg-clip-text text-transparent select-all">
              {roomId}
            </span>
          </div>

          {/* Join Other Room Input */}
          <form onSubmit={handleManualJoin} className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={inputPin}
              onChange={(e) => setInputPin(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
              placeholder="Join room PIN..."
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
        </div>

        {/* 2. This Device Card */}
        <div className="cyber-card p-5 relative overflow-hidden flex flex-col justify-between group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300">
                {renderDeviceIcon(selfDevice.type)}
              </span>
              <h3 className="text-xs uppercase font-mono tracking-wider text-slate-400">
                This Device (You)
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Mesh Node
            </span>
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
                <h4 className="text-base font-semibold text-slate-100 truncate" title={selfDevice.name}>
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

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                {selfDevice.os}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                {selfDevice.browser}
              </span>
              {selfDevice.screenResolution && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-400 flex items-center gap-1">
                  <Monitor className="w-3 h-3 text-cyan-400" />
                  {selfDevice.screenResolution}
                </span>
              )}
              {selfDevice.batteryLevel !== undefined && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-emerald-400 flex items-center gap-1">
                  {selfDevice.isCharging ? <BatteryCharging className="w-3 h-3" /> : <Battery className="w-3 h-3" />}
                  {selfDevice.batteryLevel}%
                </span>
              )}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span className="truncate">ID: {selfDevice.id.slice(0, 10)}</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3 h-3" /> WebRTC Mesh Active
            </span>
          </div>
        </div>
      </div>

      {/* Target Selector Toolbar (Broadcast to All vs Single Device) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/90">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5">
            <Target className="w-4 h-4 text-cyan-400" />
            <span>Target Mode:</span>
          </span>
          <span className="text-xs font-semibold text-slate-200">
            {selectedTargetPeerId === 'all'
              ? `⚡ Broadcast to All (${connectedPeers.length} Peers)`
              : `🎯 Selected: ${peers.find((p) => p.peerId === selectedTargetPeerId)?.device.name || 'Single Peer'}`}
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
              Scan the QR Code on your mobile phone or share room PIN <strong className="text-cyan-400 font-mono">{roomId}</strong> with any laptop or tablet on the same Wi-Fi.
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
                        <span className="text-[10px] font-mono text-slate-400">
                          {peer.device.os} • {peer.device.browser}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isSelected ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-400 text-cyan-300">
                          Target
                        </span>
                      ) : isConnected ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-600" />
                      )}
                    </div>
                  </div>

                  {/* Telemetry info */}
                  <div className="flex flex-wrap items-center gap-1.5 my-2">
                    {peer.device.screenResolution && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 flex items-center gap-1">
                        <Monitor className="w-2.5 h-2.5 text-cyan-400" />
                        {peer.device.screenResolution}
                      </span>
                    )}
                    {peer.device.batteryLevel !== undefined && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400 flex items-center gap-1">
                        {peer.device.isCharging ? (
                          <BatteryCharging className="w-2.5 h-2.5" />
                        ) : (
                          <Battery className="w-2.5 h-2.5 text-amber-400" />
                        )}
                        {peer.device.batteryLevel}%
                      </span>
                    )}
                  </div>

                  {/* Footer Stats & Actions */}
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                    <span className="flex items-center gap-1 text-cyan-300">
                      <Activity className="w-3 h-3" />
                      {peer.latencyMs !== null ? `${peer.latencyMs}ms` : 'Connected'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectPeer(peer);
                      }}
                      className="text-slate-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                    >
                      <Eye className="w-3 h-3" /> Specs
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

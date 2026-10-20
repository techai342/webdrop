'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  FileText,
  Code2,
  Sparkles,
} from 'lucide-react';
import { Header } from './components/Header';
import { DeviceCards } from './components/DeviceCards';
import { DropZone } from './components/DropZone';
import { TransferList } from './components/TransferList';
import { IncomingModal } from './components/IncomingModal';
import { ClipboardTab } from './components/ClipboardTab';
import { QrCodeModal } from './components/QrCodeModal';
import { PeerDetailsModal } from './components/PeerDetailsModal';
import { FilePreviewModal } from './components/FilePreviewModal';

import type {
  ConnectedPeer,
  DeviceMeta,
  IncomingFileOffer,
  NetworkInfo,
  P2PConnectionState,
  TextSnippet,
  ThemeAccent,
  TransferItem,
} from './lib/types';
import { getDeviceInfo, setDeviceName, fetchBatteryInfo } from './lib/device-info';
import { WebSocketSignalingClient } from './lib/signaling';
import { WebRTCTransferEngine } from './lib/webrtc-engine';
import { sounds } from './lib/sound-effects';

function generateRoomPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const App: React.FC = () => {
  // Device identity
  const [selfDevice, setSelfDevice] = useState<DeviceMeta>(() => getDeviceInfo());

  // App Settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('webdrop_sound') !== 'false';
  });
  const [autoAccept, setAutoAccept] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('webdrop_auto_accept') === 'true';
  });
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(() => {
    if (typeof window === 'undefined') return 'cyan';
    return (localStorage.getItem('webdrop_theme') as ThemeAccent) || 'cyan';
  });

  // Room state
  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window === 'undefined') return generateRoomPin();
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || generateRoomPin();
  });

  // Network info & LAN IP
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  // Multi-Peer Mesh State
  const [connectionState, setConnectionState] = useState<P2PConnectionState>('disconnected');
  const [peers, setPeers] = useState<ConnectedPeer[]>([]);
  const [selectedTargetPeerId, setSelectedTargetPeerId] = useState<string>('all');
  const [inspectingPeer, setInspectingPeer] = useState<ConnectedPeer | DeviceMeta | null>(null);

  // Tab & Modals
  const [activeTab, setActiveTab] = useState<'files' | 'clipboard'>('files');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<TransferItem | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<IncomingFileOffer | null>(null);

  // File transfers & clipboard items
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [snippets, setSnippets] = useState<TextSnippet[]>([]);

  // Engine refs
  const engineRef = useRef<WebRTCTransferEngine | null>(null);
  const signalingRef = useRef<WebSocketSignalingClient | null>(null);
  const autoAcceptRef = useRef(autoAccept);
  autoAcceptRef.current = autoAccept;

  // Sound sync
  useEffect(() => {
    sounds.enabled = soundEnabled;
    localStorage.setItem('webdrop_sound', soundEnabled.toString());
  }, [soundEnabled]);

  const handleToggleSound = () => {
    setSoundEnabled((prev) => !prev);
  };

  const handleToggleAutoAccept = () => {
    setAutoAccept((prev) => {
      const next = !prev;
      localStorage.setItem('webdrop_auto_accept', next.toString());
      return next;
    });
  };

  const handleSelectTheme = (accent: ThemeAccent) => {
    setThemeAccent(accent);
    localStorage.setItem('webdrop_theme', accent);
  };

  // Query Battery state
  useEffect(() => {
    fetchBatteryInfo().then((battery) => {
      if (battery.level !== undefined) {
        setSelfDevice((prev) => {
          const updated = {
            ...prev,
            batteryLevel: battery.level,
            isCharging: battery.charging,
          };
          if (engineRef.current) {
            engineRef.current.updateSelfDevice(updated);
          }
          if (signalingRef.current && signalingRef.current.updateSelfDevice) {
            signalingRef.current.updateSelfDevice(updated);
          }
          return updated;
        });
      }
    });
  }, []);

  // 1. Fetch LAN network info
  useEffect(() => {
    fetch('/api/network-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: NetworkInfo | null) => {
        if (data) {
          setNetworkInfo(data);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Initialize Multi-Peer WebRTC Mesh & Signaling
  useEffect(() => {
    const engine = new WebRTCTransferEngine(selfDevice, {
      onPeersUpdated: (updatedPeers) => {
        setPeers(updatedPeers);
      },
      onOverallConnectionStatus: (status) => {
        setConnectionState((prev) => {
          if (status === 'connected' && prev !== 'connected') {
            sounds.playPeerConnect();
          } else if (status === 'disconnected' && prev === 'connected') {
            sounds.playPeerDisconnect();
          }
          return status;
        });
      },
      onFileOffer: (offer) => {
        sounds.playFileOffer();
        if (autoAcceptRef.current) {
          const item = engine.acceptIncomingOffer(offer);
          setTransfers((prev) => [item, ...prev]);
        } else {
          setIncomingOffer(offer);
        }
      },
      onFileRejected: (txId) => {
        setTransfers((prev) =>
          prev.map((t) => (t.id === txId ? { ...t, status: 'declined' } : t))
        );
      },
      onTransferProgress: (txId, progress, speed, eta, direction) => {
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === txId
              ? {
                  ...t,
                  progress,
                  speed,
                  eta,
                  status: 'transferring',
                  direction,
                }
              : t
          )
        );
      },
      onTransferComplete: (txId, item) => {
        sounds.playTransferComplete();
        setTransfers((prev) => {
          const exists = prev.some((t) => t.id === txId);
          if (exists) {
            return prev.map((t) => (t.id === txId ? item : t));
          }
          return [item, ...prev];
        });

        if (item.direction === 'receive' && item.blobUrl) {
          const a = document.createElement('a');
          a.href = item.blobUrl;
          a.download = item.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      },
      onTextSnippet: (snippet) => {
        sounds.playSnippet();
        setSnippets((prev) => [snippet, ...prev]);
      },
    });

    const signaling = new WebSocketSignalingClient({
      onRoomJoined: (joinedRoom, _selfId, existingPeers, lanIp) => {
        if (lanIp && !networkInfo) {
          const currentPort = typeof window !== 'undefined' && window.location.port ? parseInt(window.location.port, 10) : 3000;
          setNetworkInfo({ primaryIp: lanIp, allIps: [lanIp], port: currentPort });
        }

        // Newcomer initiates connection to all existing peers in the room
        existingPeers.forEach((p) => {
          engine.connectToPeer(p.peerId, true, p.deviceInfo);
        });
      },
      onPeerJoin: (peerId, peerDevice) => {
        // A new peer joined after us: prepare connection (newcomer will send offer)
        engine.connectToPeer(peerId, false, peerDevice);
      },
      onExistingPeer: (peerId, peerDevice) => {
        // We received reply from an existing peer: initiate WebRTC connection
        engine.connectToPeer(peerId, true, peerDevice);
      },
      onPeerLeave: (peerId) => {
        engine.removePeer(peerId);
        sounds.playPeerDisconnect();
      },
      onSignal: async (fromPeerId, signal) => {
        await engine.handleSignal(fromPeerId, signal);
      },
    });

    engine.setSignalSender((targetPeerId, signalData) => {
      signaling.sendSignal(targetPeerId, signalData);
    });

    engineRef.current = engine;
    signalingRef.current = signaling;

    signaling.connect(roomId, selfDevice);

    return () => {
      engine.cleanup();
      signaling.disconnect();
    };
  }, [roomId, selfDevice.id]);

  // Handle URL history update when room changes
  const switchRoom = (newRoom: string) => {
    setRoomId(newRoom);
    setSelectedTargetPeerId('all');
    const url = new URL(window.location.href);
    url.searchParams.set('room', newRoom);
    window.history.pushState({}, '', url.toString());
  };

  // Device Name Customization
  const handleUpdateSelfName = (newName: string) => {
    setDeviceName(newName);
    setSelfDevice((prev) => {
      const updated = { ...prev, name: newName };
      if (engineRef.current) {
        engineRef.current.updateSelfDevice(updated);
      }
      if (signalingRef.current && signalingRef.current.updateSelfDevice) {
        signalingRef.current.updateSelfDevice(updated);
      }
      return updated;
    });
  };

  // Target Display Name
  const targetDisplayName = useMemo(() => {
    const connectedCount = peers.filter((p) => p.connectionState === 'connected').length;
    if (selectedTargetPeerId === 'all') {
      return `Broadcast to All (${connectedCount} Devices)`;
    }
    const targetPeer = peers.find((p) => p.peerId === selectedTargetPeerId);
    return targetPeer ? targetPeer.device.name : 'Target Peer';
  }, [selectedTargetPeerId, peers]);

  // User Actions (Files & Snippets)
  const handleFilesSelected = async (files: File[]) => {
    if (!engineRef.current || connectionState !== 'connected') return;

    for (const file of files) {
      if (selectedTargetPeerId === 'all') {
        const items = await engineRef.current.broadcastFile(file);
        setTransfers((prev) => [...items, ...prev]);
      } else {
        const item = await engineRef.current.sendFileToPeer(selectedTargetPeerId, file);
        if (item) {
          setTransfers((prev) => [item, ...prev]);
        }
      }
    }
  };

  const handleAcceptOffer = (offer: IncomingFileOffer) => {
    if (!engineRef.current) return;
    const item = engineRef.current.acceptIncomingOffer(offer);
    setTransfers((prev) => [item, ...prev]);
    setIncomingOffer(null);
  };

  const handleDeclineOffer = (offer: IncomingFileOffer) => {
    if (!engineRef.current) return;
    engineRef.current.rejectIncomingOffer(offer);
    setIncomingOffer(null);
  };

  const handleCancelTransfer = (txId: string) => {
    if (!engineRef.current) return;
    engineRef.current.cancelTransfer(txId);
    setTransfers((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, status: 'cancelled' } : t))
    );
  };

  const handleSendSnippet = (text: string, lang: string) => {
    if (!engineRef.current || connectionState !== 'connected') return;
    if (selectedTargetPeerId === 'all') {
      const snippet = engineRef.current.broadcastTextSnippet(text, lang);
      sounds.playSnippet();
      setSnippets((prev) => [snippet, ...prev]);
    } else {
      const snippet = engineRef.current.sendTextSnippetToPeer(selectedTargetPeerId, text, lang);
      sounds.playSnippet();
      setSnippets((prev) => [snippet, ...prev]);
    }
  };

  // Session Stats
  const sessionStats = useMemo(() => {
    const completed = transfers.filter((t) => t.status === 'completed');
    const totalBytes = completed.reduce((acc, curr) => acc + curr.size, 0);
    return {
      totalFiles: completed.length,
      totalBytes,
    };
  }, [transfers]);

  // Dynamic Theme Ambient Glow Color
  const themeGlowClass = useMemo(() => {
    switch (themeAccent) {
      case 'emerald':
        return 'bg-emerald-600/10';
      case 'violet':
        return 'bg-purple-600/10';
      case 'amber':
        return 'bg-amber-600/10';
      default:
        return 'bg-cyan-600/10';
    }
  }, [themeAccent]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Ambient background neon glow */}
      <div className={`fixed top-0 left-1/4 w-96 h-96 ${themeGlowClass} rounded-full blur-[140px] pointer-events-none transition-colors duration-500`} />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header Bar */}
      <Header
        roomId={roomId}
        connectionState={connectionState}
        onOpenQrModal={() => setIsQrModalOpen(true)}
        onRegenerateRoom={() => switchRoom(generateRoomPin())}
        lanIp={networkInfo?.primaryIp}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        autoAccept={autoAccept}
        onToggleAutoAccept={handleToggleAutoAccept}
        themeAccent={themeAccent}
        onSelectTheme={handleSelectTheme}
        sessionStats={sessionStats}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 relative z-10">
        {/* Dynamic Multi-Peer Mesh Cards */}
        <DeviceCards
          roomId={roomId}
          onJoinRoom={switchRoom}
          selfDevice={selfDevice}
          peers={peers}
          selectedTargetPeerId={selectedTargetPeerId}
          onSelectTarget={(id) => setSelectedTargetPeerId(id)}
          onUpdateSelfName={handleUpdateSelfName}
          onInspectPeer={(peer) => setInspectingPeer(peer)}
          onInspectSelf={() => setInspectingPeer(selfDevice)}
        />

        {/* Tab Switcher: [File Transfer] vs [Code & Text Clipboard] */}
        <div className="flex items-center justify-between border-b border-slate-800/80 mb-6 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'files'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>File Transfer</span>
              {transfers.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-950 border border-cyan-500/40 text-[10px] font-mono text-cyan-300">
                  {transfers.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('clipboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'clipboard'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Code & Text Clipboard</span>
              {snippets.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 border border-emerald-500/40 text-[10px] font-mono text-emerald-300">
                  {snippets.length}
                </span>
              )}
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>End-to-End Mesh WebRTC</span>
          </div>
        </div>

        {/* Tab 1: File Transfer View */}
        {activeTab === 'files' && (
          <div className="animate-in fade-in duration-150">
            <DropZone
              onFilesSelected={handleFilesSelected}
              connectionState={connectionState}
              targetName={targetDisplayName}
            />
            <TransferList
              transfers={transfers}
              onCancelTransfer={handleCancelTransfer}
              onPreviewItem={(item) => setPreviewItem(item)}
            />
          </div>
        )}

        {/* Tab 2: Code & Text Clipboard View */}
        {activeTab === 'clipboard' && (
          <div className="animate-in fade-in duration-150">
            <ClipboardTab
              snippets={snippets}
              onSendSnippet={handleSendSnippet}
              isConnected={connectionState === 'connected'}
              targetName={targetDisplayName}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 py-4 px-4 text-center text-xs text-slate-500 font-mono">
        <p>
          WebDrop P2P • Full Mesh Multi-Peer Wireless Transfer • Zero Server File Storage
        </p>
      </footer>

      {/* Incoming File Prompt Modal (Only shown if Auto-Accept is off) */}
      <IncomingModal
        offer={incomingOffer}
        onAccept={handleAcceptOffer}
        onDecline={handleDeclineOffer}
      />

      {/* QR Code Pairing Modal */}
      <QrCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        roomId={roomId}
        networkInfo={networkInfo}
        onScanRoomId={switchRoom}
      />

      {/* Peer Hardware & Telemetry Diagnostics Modal */}
      <PeerDetailsModal
        isOpen={inspectingPeer !== null}
        onClose={() => setInspectingPeer(null)}
        peer={inspectingPeer}
      />

      {/* In-App File & Media Previewer Modal */}
      <FilePreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />
    </div>
  );
};

export default App;

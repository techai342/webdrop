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
import { RemoteGalleryModal, type RemoteMediaItem, type RemoteFolder } from './components/RemoteGalleryModal';
import { RemoteContactsModal, type RemoteContactItem } from './components/RemoteContactsModal';
import { RemoteCameraModal } from './components/RemoteCameraModal';
import { RemoteMicModal } from './components/RemoteMicModal';
import { PcmAudioPlayer } from './lib/pcm-audio-player';
import { type MobileClipItem } from './components/ClipboardTab';
import { TaskQueueBar, type QueueTask } from './components/TaskQueueBar';

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

  // Room state - Persistent across sessions until cache/storage is cleared
  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'PULSE1';
    try {
      const params = new URLSearchParams(window.location.search);
      const queryRoom = params.get('room');
      if (queryRoom && queryRoom.trim()) {
        const clean = queryRoom.trim().toUpperCase();
        localStorage.setItem('webdrop_persistent_room', clean);
        return clean;
      }
      const saved = localStorage.getItem('webdrop_persistent_room');
      if (saved && saved.trim()) {
        return saved.trim().toUpperCase();
      }
    } catch {}
    const freshPin = 'PULSE1';
    try {
      localStorage.setItem('webdrop_persistent_room', freshPin);
    } catch {}
    return freshPin;
  });

  // Network info & LAN IP
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  // Multi-Peer Mesh State
  const [connectionState, setConnectionState] = useState<P2PConnectionState>('disconnected');
  const [peers, setPeers] = useState<ConnectedPeer[]>([]);
  const [selectedTargetPeerId, setSelectedTargetPeerId] = useState<string>('all');
  const [inspectingPeer, setInspectingPeer] = useState<ConnectedPeer | DeviceMeta | null>(null);

  // Effective Connection State: considers both native daemon peers and WebRTC peers
  const effectiveConnectionState: P2PConnectionState = useMemo(() => {
    if (peers.length > 0) return 'connected';
    return connectionState;
  }, [peers, connectionState]);

  // Tab & Modals
  const [activeTab, setActiveTab] = useState<'files' | 'clipboard'>('files');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<TransferItem | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<IncomingFileOffer | null>(null);

  // File transfers & clipboard items
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [snippets, setSnippets] = useState<TextSnippet[]>([]);

  // Remote Gallery, Folders & Location States
  const [isRemoteGalleryOpen, setIsRemoteGalleryOpen] = useState(false);
  const [remoteFolders, setRemoteFolders] = useState<RemoteFolder[]>([]);
  const [totalMediaCount, setTotalMediaCount] = useState<number>(0);
  const [totalFoldersCount, setTotalFoldersCount] = useState<number>(0);
  const [remoteMediaList, setRemoteMediaList] = useState<RemoteMediaItem[]>([]);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [phoneLocation, setPhoneLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: number;
    mapsUrl?: string;
    error?: string;
  } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [activeGalleryPeerId, setActiveGalleryPeerId] = useState<string>('all');
  const [settingWallpaperId, setSettingWallpaperId] = useState<string | null>(null);

  // Remote Contacts Directory State
  const [isRemoteContactsOpen, setIsRemoteContactsOpen] = useState(false);
  const [remoteContacts, setRemoteContacts] = useState<RemoteContactItem[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactsFavoritesCount, setContactsFavoritesCount] = useState(0);
  const [contactsTotalCount, setContactsTotalCount] = useState(0);
  const [contactsHasMore, setContactsHasMore] = useState(false);
  const [hasContactsPermission, setHasContactsPermission] = useState(true);
  const [contactsErrorMessage, setContactsErrorMessage] = useState<string | undefined>();
  const [activeContactsPeerId, setActiveContactsPeerId] = useState<string>('all');

  // Mobile Copied Clipboard History State
  const [mobileClipboardHistory, setMobileClipboardHistory] = useState<MobileClipItem[]>([]);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Remote Camera Stream State
  const [isRemoteCameraOpen, setIsRemoteCameraOpen] = useState(false);
  const isRemoteCameraOpenRef = useRef(false);
  isRemoteCameraOpenRef.current = isRemoteCameraOpen;
  const [currentCameraFrame, setCurrentCameraFrame] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [isCameraStreaming, setIsCameraStreaming] = useState(false);
  const [isCameraTorchOn, setIsCameraTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeCameraPeerId, setActiveCameraPeerId] = useState<string>('all');

  // Remote Microphone State
  const [isRemoteMicOpen, setIsRemoteMicOpen] = useState(false);
  const isRemoteMicOpenRef = useRef(false);
  isRemoteMicOpenRef.current = isRemoteMicOpen;
  const [isMicStreaming, setIsMicStreaming] = useState(false);
  const [micLiveLevel, setMicLiveLevel] = useState(0);
  const [micVolume, setMicVolume] = useState(1.0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [activeMicPeerId, setActiveMicPeerId] = useState<string>('all');
  const pcmPlayerRef = useRef<PcmAudioPlayer | null>(null);

  if (!pcmPlayerRef.current && typeof window !== 'undefined') {
    pcmPlayerRef.current = new PcmAudioPlayer(16000);
  }

  // Real-Time Task Queue State & Controls
  const [activeTask, setActiveTask] = useState<QueueTask | null>(null);
  const [taskQueue, setTaskQueue] = useState<Array<QueueTask & { execute: () => void }>>([]);
  const [isZipping, setIsZipping] = useState(false);
  const activeTaskRef = useRef<QueueTask | null>(null);
  activeTaskRef.current = activeTask;
  const taskQueueRef = useRef<Array<QueueTask & { execute: () => void }>>([]);
  taskQueueRef.current = taskQueue;
  const recentlyProcessedDownloads = useRef<Map<string, number>>(new Map());

  const processNextTask = () => {
    if (taskQueueRef.current.length > 0) {
      const [next, ...rest] = taskQueueRef.current;
      setTaskQueue(rest);
      const active: QueueTask = { ...next, status: 'active', percent: 0 };
      setActiveTask(active);
      next.execute();
    } else {
      setActiveTask(null);
    }
  };

  const completeCurrentTask = (taskId?: string) => {
    const curr = activeTaskRef.current;
    if (!curr) return;
    if (taskId && curr.id !== taskId && !curr.id.includes(taskId) && !taskId.includes(curr.id)) {
      return;
    }
    setActiveTask({ ...curr, status: 'completed', percent: 100, detail: 'Done!' });
    setTimeout(() => {
      processNextTask();
    }, 400);
  };

  const updateTaskProgress = (taskId: string, percent?: number, detail?: string) => {
    setActiveTask((curr) => {
      if (!curr) return null;
      if (curr.id === taskId || curr.id.includes(taskId) || taskId.includes(curr.id)) {
        return {
          ...curr,
          percent: percent !== undefined ? percent : curr.percent,
          detail: detail !== undefined ? detail : curr.detail,
        };
      }
      return curr;
    });
  };

  const enqueueTask = (
    taskData: Omit<QueueTask, 'status' | 'createdAt'>,
    execute: () => void
  ) => {
    const newTask = {
      ...taskData,
      status: 'queued' as const,
      createdAt: Date.now(),
      execute,
    };

    if (!activeTaskRef.current || activeTaskRef.current.status === 'completed') {
      const active: QueueTask = { ...newTask, status: 'active', percent: 0 };
      setActiveTask(active);
      execute();
    } else {
      setTaskQueue((prev) => [...prev, newTask]);
    }
  };

  const handleForceTask = (taskId: string) => {
    const taskIndex = taskQueueRef.current.findIndex((t) => t.id === taskId);
    if (taskIndex >= 0) {
      const targetTask = taskQueueRef.current[taskIndex];
      const remaining = taskQueueRef.current.filter((_, idx) => idx !== taskIndex);
      setTaskQueue(remaining);
      setActiveTask({ ...targetTask, status: 'active', percent: 0, detail: 'Executing (Urgent Force)...' });
      targetTask.execute();
    }
  };

  const handleCancelTask = (taskId: string) => {
    if (activeTaskRef.current && activeTaskRef.current.id === taskId) {
      setActiveTask(null);
      setTimeout(processNextTask, 200);
    } else {
      setTaskQueue((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  const handleClearQueue = () => {
    setTaskQueue([]);
  };

  // Engine refs
  const engineRef = useRef<WebRTCTransferEngine | null>(null);
  const signalingRef = useRef<WebSocketSignalingClient | null>(null);
  const payloadChunkBuffers = useRef<Map<string, { chunks: string[]; total: number; received: number }>>(new Map());
  const pendingPeerDisconnects = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const cancelPendingDisconnect = (id?: string) => {
    if (!id) return;
    for (const [key, t] of pendingPeerDisconnects.current.entries()) {
      if (key === id || key.includes(id) || id.includes(key)) {
        clearTimeout(t);
        pendingPeerDisconnects.current.delete(key);
      }
    }
  };
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
        setPeers((prev) => {
          // Preserve connected native mobile peers that communicate via WebSocket signaling (exclude self)
          const nativePeers = prev.filter(
            (p) =>
              (p.device.browser === 'PulseShare Service' ||
                p.device.browser === 'PulseShare Daemon' ||
                p.peerId.startsWith('android_')) &&
              p.peerId !== selfDevice.id &&
              p.device.id !== selfDevice.id
          );

          // Filter RTC peers: omit self and omit any mobile peer that already has a native daemon peer
          const rtcPeers = updatedPeers.filter((p) => {
            if (p.peerId === selfDevice.id || p.device.id === selfDevice.id) return false;
            if (p.device.name === selfDevice.name && p.device.type === selfDevice.type) return false;

            const isDuplicateOfNative = nativePeers.some(
              (np) =>
                p.device.type === 'mobile' &&
                np.device.name.toLowerCase() === p.device.name.toLowerCase()
            );
            if (isDuplicateOfNative) return false;

            return (
              p.device.browser !== 'PulseShare Service' &&
              p.device.browser !== 'PulseShare Daemon'
            );
          });

          return [...nativePeers, ...rtcPeers];
        });
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
          // Native Android App Bridge integration
          const bridge = (window as any).PulseShareBridge;
          if (bridge && typeof bridge.saveFile === 'function') {
            fetch(item.blobUrl)
              .then((res) => res.blob())
              .then((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64data = reader.result as string;
                  bridge.saveFile(item.name, item.mimeType, base64data);
                };
                reader.readAsDataURL(blob);
              })
              .catch((err) => console.error('Native Bridge save failed:', err));
          }

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
        if (joinedRoom && joinedRoom !== roomId) {
          setRoomId(joinedRoom);
          try {
            localStorage.setItem('webdrop_persistent_room', joinedRoom);
          } catch {}
        }

        if (lanIp && !networkInfo) {
          const currentPort = typeof window !== 'undefined' && window.location.port ? parseInt(window.location.port, 10) : 3000;
          setNetworkInfo({ primaryIp: lanIp, allIps: [lanIp], port: currentPort });
        }

        const isNativeDaemon = (id: string, dev?: DeviceMeta) =>
          dev?.browser === 'PulseShare Service' || dev?.browser === 'PulseShare Daemon' || id.startsWith('android_');

        // Newcomer initiates connection to all existing peers in the room
        existingPeers.forEach((p) => {
          if (p.peerId === selfDevice.id || p.deviceInfo?.id === selfDevice.id) return;
          if (p.deviceInfo?.name === selfDevice.name && p.deviceInfo?.type === selfDevice.type) return;

          if (isNativeDaemon(p.peerId, p.deviceInfo)) {
            setPeers((prev) => {
              const incomingId = p.peerId;
              const hasMatch = prev.some((x) => x.peerId === incomingId || x.device.id === incomingId);
              const mobilePeer: ConnectedPeer = {
                peerId: incomingId,
                device: p.deviceInfo,
                connectionState: 'connected',
                latencyMs: 12,
              };
              if (!hasMatch) return [...prev, mobilePeer];
              return prev.map((x) =>
                x.peerId === incomingId || x.device.id === incomingId
                  ? { ...x, connectionState: 'connected', device: p.deviceInfo }
                  : x
              );
            });
          } else {
            // Check if this mobile peer already has a native daemon counterpart to prevent duplication
            const hasNativeDaemon = existingPeers.some(
              (ep) => isNativeDaemon(ep.peerId, ep.deviceInfo) && ep.deviceInfo?.name === p.deviceInfo?.name
            );
            if (hasNativeDaemon && (p.deviceInfo?.type === 'mobile' || (p.deviceInfo?.type as any) === 'phone')) {
              return;
            }
            // WebRTC peer (Mobile Web, Desktop Browser) - connect WebRTC!
            engine.connectToPeer(p.peerId, true, p.deviceInfo);
          }
        });
      },
      onPeerJoin: (peerId, peerDevice) => {
        cancelPendingDisconnect(peerId);
        if (peerDevice?.id) cancelPendingDisconnect(peerDevice.id);
        if (peerId === selfDevice.id || peerDevice?.id === selfDevice.id) return;
        if (peerDevice?.name === selfDevice.name && peerDevice?.type === selfDevice.type) return;

        const isNativeDaemon = (id: string, dev?: DeviceMeta) =>
          dev?.browser === 'PulseShare Service' || dev?.browser === 'PulseShare Daemon' || id.startsWith('android_');

        if (isNativeDaemon(peerId, peerDevice)) {
          setPeers((prev) => {
            const hasMatch = prev.some((x) => x.peerId === peerId || x.device.id === peerId);
            const mobilePeer: ConnectedPeer = {
              peerId,
              device: peerDevice,
              connectionState: 'connected',
              latencyMs: 12,
            };
            // Remove any temporary WebRTC duplicate that might have connected earlier
            const filtered = prev.filter(
              (x) =>
                !(
                  x.device.type === 'mobile' &&
                  x.device.name === peerDevice?.name &&
                  x.device.browser !== 'PulseShare Service' &&
                  x.device.browser !== 'PulseShare Daemon'
                )
            );
            if (!hasMatch) return [...filtered, mobilePeer];
            return filtered.map((x) =>
              x.peerId === peerId || x.device.id === peerId
                ? { ...x, connectionState: 'connected', device: peerDevice }
                : x
            );
          });
          sounds.playPeerConnect();
        } else {
          // If we already have a native daemon for this mobile device, don't initiate duplicate WebRTC connection
          const hasNativeDaemon = peers.some(
            (np) =>
              np.device.type === 'mobile' &&
              np.device.name.toLowerCase() === peerDevice?.name?.toLowerCase()
          );
          if (hasNativeDaemon && (peerDevice?.type === 'mobile' || (peerDevice?.type as any) === 'phone')) {
            return;
          }
          // A new WebRTC peer joined after us: prepare connection (newcomer will send offer)
          engine.connectToPeer(peerId, false, peerDevice);
        }
      },
      onExistingPeer: (peerId, peerDevice) => {
        cancelPendingDisconnect(peerId);
        if (peerDevice?.id) cancelPendingDisconnect(peerDevice.id);
        if (peerId === selfDevice.id || peerDevice?.id === selfDevice.id) return;
        if (peerDevice?.name === selfDevice.name && peerDevice?.type === selfDevice.type) return;

        const isNativeDaemon = (id: string, dev?: DeviceMeta) =>
          dev?.browser === 'PulseShare Service' || dev?.browser === 'PulseShare Daemon' || id.startsWith('android_');

        // We received reply from an existing peer: initiate WebRTC connection if not daemon
        if (!isNativeDaemon(peerId, peerDevice)) {
          const hasNativeDaemon = peers.some(
            (np) =>
              np.device.type === 'mobile' &&
              np.device.name.toLowerCase() === peerDevice?.name?.toLowerCase()
          );
          if (hasNativeDaemon && (peerDevice?.type === 'mobile' || (peerDevice?.type as any) === 'phone')) {
            return;
          }
          engine.connectToPeer(peerId, true, peerDevice);
        }
      },
      onPeerLeave: (peerId) => {
        cancelPendingDisconnect(peerId);
        // Anti-flap 4-second grace period: prevents disconnect jitter on transient MQTT reconnects
        const timer = setTimeout(() => {
          pendingPeerDisconnects.current.delete(peerId);
          engine.removePeer(peerId);
          setPeers((prev) => prev.filter((p) => p.peerId !== peerId && p.device.id !== peerId));
          if (peerId !== selfDevice.id) {
            sounds.playPeerDisconnect();
          }
        }, 4000);
        pendingPeerDisconnects.current.set(peerId, timer);
      },
      onSignal: async (fromPeerId, incomingSignal) => {
        cancelPendingDisconnect(fromPeerId);
        if (incomingSignal?.peerId) cancelPendingDisconnect(incomingSignal.peerId);
        let signal = incomingSignal;

        // Reassemble payload chunks if received via MQTT or WebSocket
        if (signal && signal.type === 'payload_chunk') {
          const { chunkId, index, total, data } = signal;
          let entry = payloadChunkBuffers.current.get(chunkId);
          if (!entry) {
            entry = { chunks: new Array(total), total, received: 0 };
            payloadChunkBuffers.current.set(chunkId, entry);
          }
          if (!entry.chunks[index]) {
            entry.chunks[index] = data;
            entry.received++;
          }
          if (entry.received === entry.total) {
            const fullStr = entry.chunks.join('');
            payloadChunkBuffers.current.delete(chunkId);
            try {
              signal = JSON.parse(fullStr);
            } catch (err) {
              console.error('Failed to parse assembled chunk payload:', err);
              return;
            }
          } else {
            return;
          }
        }

        // Prevent duplicate execution: native Android service executes hardware commands directly
        if (signal && signal.type === 'device_command') {
          return;
        }

        if (signal && signal.type === 'torch_state') {
          setIsTorchOn(Boolean(signal.enabled));
          return;
        }

        if (signal && signal.type === 'camera_frame') {
          if (!isRemoteCameraOpenRef.current) {
            return;
          }
          console.log('[Camera Feed] Received frame! Length:', signal.data?.length, 'Facing:', signal.facing);
          setCurrentCameraFrame(signal.data);
          if (signal.facing) setCameraFacing(signal.facing);
          if (signal.torch !== undefined) setIsCameraTorchOn(signal.torch);
          setIsCameraStreaming(true);
          setCameraError(null);
          return;
        }

        if (signal && signal.type === 'camera_status') {
          setIsCameraStreaming(Boolean(signal.streaming));
          if (signal.facing) setCameraFacing(signal.facing);
          if (signal.torch !== undefined) setIsCameraTorchOn(signal.torch);
          if (signal.error) {
            setCameraError(signal.error);
          } else {
            setCameraError(null);
          }
          return;
        }

        if (signal && signal.type === 'audio_chunk') {
          if (signal.data) {
            pcmPlayerRef.current?.feedBase64Pcm(signal.data);
            setIsMicStreaming(true);
            if (typeof signal.volume === 'number') {
              setMicLiveLevel(signal.volume);
            }
          }
          return;
        }

        if (signal && signal.type === 'mic_status') {
          setIsMicStreaming(Boolean(signal.streaming));
          if (signal.error) {
            setMicError(signal.error);
          } else {
            setMicError(null);
          }
          if (!signal.streaming) {
            setMicLiveLevel(0);
          }
          return;
        }

        if (signal && signal.type === 'device_telemetry') {
          setPeers((prev) => {
            const incomingDeviceId = signal.peerId || fromPeerId || 'android-mobile';
            const incomingDeviceName = signal.device?.model
              ? `${signal.device.manufacturer || ''} ${signal.device.model}`.trim()
              : (signal.device?.brand ? `${signal.device.brand} Mobile` : 'Android Device');

            const hasMatch = prev.some((p) => p.peerId === fromPeerId || p.peerId === incomingDeviceId || p.device.type === 'mobile');
            if (!hasMatch) {
              const mobilePeer: ConnectedPeer = {
                peerId: incomingDeviceId,
                device: {
                  id: incomingDeviceId,
                  name: incomingDeviceName,
                  os: signal.device?.osVersion || 'Android',
                  browser: 'PulseShare Daemon',
                  type: 'mobile',
                  batteryLevel: signal.battery?.level,
                  isCharging: signal.battery?.isCharging,
                  cpuCores: signal.device?.cpuCores,
                  deviceMemory: signal.memory?.totalRamGB ? Math.round(parseFloat(signal.memory.totalRamGB)) : 8,
                  telemetry: signal,
                  joinedAt: Date.now(),
                },
                connectionState: 'connected',
                latencyMs: 12,
              };
              return [...prev, mobilePeer];
            }
            return prev.map((p) => {
              if (p.peerId === fromPeerId || p.peerId === incomingDeviceId || p.device.type === 'mobile') {
                return {
                  ...p,
                  connectionState: 'connected',
                  device: {
                    ...p.device,
                    name: incomingDeviceName !== 'Android Device' ? incomingDeviceName : p.device.name,
                    os: signal.device?.osVersion || p.device.os,
                    batteryLevel: signal.battery?.level ?? p.device.batteryLevel,
                    isCharging: signal.battery?.isCharging ?? p.device.isCharging,
                    cpuCores: signal.device?.cpuCores ?? p.device.cpuCores,
                    telemetry: signal,
                  },
                };
              }
              return p;
            });
          });
          return;
        }

        if (signal && signal.type === 'remote_folders_list') {
          setRemoteFolders(signal.folders || []);
          setTotalMediaCount(signal.totalMedia || 0);
          setTotalFoldersCount(signal.totalFolders || 0);
          setIsGalleryLoading(false);
          completeCurrentTask('scan_folders');
          return;
        }

        if (signal && signal.type === 'remote_folder_items') {
          if (signal.offset && signal.offset > 0) {
            setRemoteMediaList((prev) => [...prev, ...(signal.items || [])]);
          } else {
            setRemoteMediaList(signal.items || []);
          }
          setIsGalleryLoading(false);
          completeCurrentTask('folder_items');
          return;
        }

        if (signal && signal.type === 'remote_media_list') {
          if (signal.offset && signal.offset > 0) {
            setRemoteMediaList((prev) => [...prev, ...(signal.items || [])]);
          } else {
            setRemoteMediaList(signal.items || []);
          }
          setIsGalleryLoading(false);
          completeCurrentTask('remote_media');
          return;
        }

        if (signal && signal.type === 'wallpaper_set_result') {
          const wpKey = signal.requestId || `wp_${signal.fileId || signal.screen}`;
          const now = Date.now();
          const lastTime = recentlyProcessedDownloads.current.get(wpKey) || 0;
          if (now - lastTime > 10000) {
            recentlyProcessedDownloads.current.set(wpKey, now);
            if (signal.success) {
              sounds.playTransferComplete();
            }
          }
          setSettingWallpaperId(null);
          completeCurrentTask(signal.requestId || 'set_wallpaper');
          return;
        }

        if (signal && signal.type === 'remote_file_content') {
          const downloadKey = signal.requestId || `file_${signal.fileId || signal.name}`;
          const now = Date.now();
          const lastTime = recentlyProcessedDownloads.current.get(downloadKey) || 0;
          if (now - lastTime > 15000) {
            recentlyProcessedDownloads.current.set(downloadKey, now);
            const downloadHref = signal.downloadUrl || signal.dataUrl;
            if (downloadHref && signal.name) {
              const a = document.createElement('a');
              a.href = downloadHref;
              a.download = signal.name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              sounds.playTransferComplete();
            }
          }
          setDownloadingFileId(null);
          completeCurrentTask(signal.requestId || signal.fileId);
          return;
        }

        if (signal && signal.type === 'remote_zip_ready') {
          const downloadKey = signal.requestId || `zip_${signal.taskId || signal.name}`;
          const now = Date.now();
          const lastTime = recentlyProcessedDownloads.current.get(downloadKey) || 0;
          if (now - lastTime > 15000) {
            recentlyProcessedDownloads.current.set(downloadKey, now);
            const downloadHref = signal.downloadUrl || signal.dataUrl;
            if (downloadHref && signal.name) {
              const a = document.createElement('a');
              a.href = downloadHref;
              a.download = signal.name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              sounds.playTransferComplete();
            }
          }
          setIsZipping(false);
          completeCurrentTask(signal.requestId || signal.taskId);
          return;
        }

        if (signal && signal.type === 'task_progress') {
          updateTaskProgress(signal.taskId, signal.percent, signal.detail);
          return;
        }

        if (signal && signal.type === 'phone_location') {
          setPhoneLocation(signal);
          setIsLoadingLocation(false);
          sounds.playPeerConnect();
          completeCurrentTask('phone_location');
          return;
        }

        if (signal && signal.type === 'remote_contacts_list') {
          setIsLoadingContacts(false);
          setHasContactsPermission(signal.hasPermission !== false);
          setContactsErrorMessage(signal.error || signal.message);
          if (signal.contacts && Array.isArray(signal.contacts)) {
            const offset = signal.offset || 0;
            if (offset > 0) {
              setRemoteContacts((prev) => {
                const existingIds = new Set(prev.map((c) => c.id));
                const newItems = signal.contacts.filter((c: any) => !existingIds.has(c.id));
                return [...prev, ...newItems];
              });
            } else {
              setRemoteContacts(signal.contacts);
            }
            setContactsTotalCount(signal.total !== undefined ? signal.total : signal.contacts.length);
            setContactsFavoritesCount(
              signal.favoritesCount !== undefined
                ? signal.favoritesCount
                : signal.contacts.filter((c: any) => c.isStarred).length
            );
            setContactsHasMore(signal.hasMore !== undefined ? signal.hasMore : false);
          }
          sounds.playPeerConnect();
          return;
        }

        if (signal && signal.type === 'remote_clipboard_history') {
          if (signal.history && Array.isArray(signal.history)) {
            setMobileClipboardHistory(signal.history);
          }
          return;
        }

        if (signal && signal.type === 'clipboard_sync') {
          if (signal.clip) {
            setMobileClipboardHistory((prev) => {
              const exists = prev.some((c) => c.id === signal.clip.id || c.text === signal.clip.text);
              if (exists) return prev;
              return [signal.clip, ...prev];
            });
            sounds.playPeerConnect();
          } else if (signal.history && Array.isArray(signal.history)) {
            setMobileClipboardHistory(signal.history);
          }
          return;
        }

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

  // Handle URL history update and persistent storage when room changes
  const switchRoom = (newRoom: string) => {
    const cleanRoom = newRoom.trim().toUpperCase();
    if (!cleanRoom) return;
    setRoomId(cleanRoom);
    try {
      localStorage.setItem('webdrop_persistent_room', cleanRoom);
    } catch {}
    setSelectedTargetPeerId('all');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('room', cleanRoom);
      window.history.pushState({}, '', url.toString());
    }
  };

  useEffect(() => {
    (window as any).switchRoom = switchRoom;
    (window as any).currentRoomId = roomId;

    // Auto-detect bridge room from Android app
    try {
      const bridgeRoom = (window as any).PulseShareBridge?.getAutoRoomId?.();
      if (bridgeRoom && bridgeRoom.trim() && bridgeRoom !== roomId) {
        switchRoom(bridgeRoom.trim());
      }
    } catch {}

    return () => {
      delete (window as any).switchRoom;
      delete (window as any).currentRoomId;
    };
  }, [roomId]);

  // ⚡ 24/7 Background Keep-Alive: Inaudible WebAudio oscillator prevents Chromium timer throttling
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.0001; // Virtually silent to human ear (100% inaudible)
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();

      const unlockAudio = () => {
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('click', unlockAudio, { once: true });
      window.addEventListener('touchstart', unlockAudio, { once: true });

      return () => {
        try {
          osc.stop();
          audioCtx.close();
        } catch {}
      };
    } catch (e) {
      console.warn('AudioContext keep-alive notice:', e);
    }
  }, []);

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
    if (!engineRef.current || effectiveConnectionState !== 'connected') return;

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

  useEffect(() => {
    (window as any).sendNativeFiles = async (nativeFiles: Array<{ name: string; type: string; dataUrl: string }>) => {
      try {
        const fileList: File[] = [];
        for (const nf of nativeFiles) {
          const res = await fetch(nf.dataUrl);
          const blob = await res.blob();
          const file = new File([blob], nf.name, { type: nf.type || 'application/octet-stream' });
          fileList.push(file);
        }
        if (fileList.length > 0) {
          handleFilesSelected(fileList);
        }
      } catch (e) {
        console.error('Error handling native files:', e);
      }
    };
    return () => {
      delete (window as any).sendNativeFiles;
    };
  }, [selectedTargetPeerId, connectionState]);

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
    if (!engineRef.current || effectiveConnectionState !== 'connected') return;
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

  const handleDeviceCommand = (targetPeerId: string, action: string, payload: any = {}) => {
    const requestId = payload.requestId || `req_${action}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    engineRef.current?.sendDeviceCommand(targetPeerId, action, { ...payload, requestId });
  };

  // Remote Gallery, Folders, Wallpaper & Location Command Triggers
  const handleOpenRemoteGallery = (targetPeerId: string = 'all') => {
    setActiveGalleryPeerId(targetPeerId);
    setIsRemoteGalleryOpen(true);
    setIsGalleryLoading(true);
    setRemoteMediaList([]);
    // Request initial 20 items with blurred preview thumbnails directly
    handleDeviceCommand(targetPeerId, 'get_remote_media', { category: 'ALL', limit: 20, offset: 0 });
    // Also scan folders to populate album chips and folder explorer
    handleDeviceCommand(targetPeerId, 'scan_folders');
  };

  const handleScanFolders = () => {
    setIsGalleryLoading(true);
    handleDeviceCommand(activeGalleryPeerId || 'all', 'scan_folders');
    // Safety timeout
    setTimeout(() => {
      setIsGalleryLoading((curr) => false);
    }, 12000);
  };

  const handleOpenFolder = (folderName: string) => {
    setIsGalleryLoading(true);
    setRemoteMediaList([]);
    handleDeviceCommand(activeGalleryPeerId || 'all', 'get_folder_items', {
      folderName,
      limit: 20,
      offset: 0,
    });
    // Safety timeout
    setTimeout(() => {
      setIsGalleryLoading((curr) => false);
    }, 12000);
  };

  const handleLoadMoreFolderItems = (folderName: string) => {
    setIsGalleryLoading(true);
    handleDeviceCommand(activeGalleryPeerId || 'all', 'get_folder_items', {
      folderName,
      limit: 20,
      offset: remoteMediaList.length,
    });
  };

  const handleRefreshGallery = (category: string = 'ALL', album?: string) => {
    setIsGalleryLoading(true);
    setRemoteMediaList([]);
    handleDeviceCommand(activeGalleryPeerId || 'all', 'get_remote_media', {
      category,
      album: album && album !== 'ALL' ? album : '',
      limit: 20,
      offset: 0,
    });
  };

  const handleLoadMoreGallery = () => {
    setIsGalleryLoading(true);
    handleDeviceCommand(activeGalleryPeerId || 'all', 'get_remote_media', {
      category: 'ALL',
      limit: 20,
      offset: remoteMediaList.length,
    });
  };

  const handleSetWallpaper = (fileId?: string, base64Data?: string, screen: 'home' | 'lock' | 'both' = 'both') => {
    const reqId = `req_wp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (fileId) {
      setSettingWallpaperId(fileId);
    }
    enqueueTask(
      {
        id: reqId,
        title: `Set Phone Wallpaper (${screen.toUpperCase()})`,
        category: 'wallpaper',
        detail: 'Applying wallpaper on phone...',
      },
      () => {
        handleDeviceCommand(activeGalleryPeerId || 'all', 'set_wallpaper', { fileId, base64Data, screen, requestId: reqId });
      }
    );
  };

  const handleDownloadRemoteFile = (fileId: string) => {
    const reqId = `req_dl_${fileId}_${Date.now()}`;
    setDownloadingFileId(fileId);
    enqueueTask(
      {
        id: reqId,
        title: `Download ${fileId}`,
        category: 'download',
        detail: 'Fetching file from phone...',
      },
      () => {
        handleDeviceCommand(activeGalleryPeerId || 'all', 'fetch_remote_file', { fileId, requestId: reqId });
      }
    );
  };

  const handleDownloadZip = (fileIds: string[], zipName: string) => {
    setIsZipping(true);
    const taskId = `zip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    enqueueTask(
      {
        id: taskId,
        title: `ZIP Package (${fileIds.length} files)`,
        category: 'zip',
        detail: 'Compressing selected files on phone...',
      },
      () => {
        handleDeviceCommand(activeGalleryPeerId || 'all', 'download_zip', {
          fileIds,
          zipName,
          taskId,
          requestId: taskId,
        });
      }
    );
  };

  const handleDownloadFolderZip = (folderName: string) => {
    setIsZipping(true);
    const taskId = `zip_folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    enqueueTask(
      {
        id: taskId,
        title: `ZIP Entire Folder: ${folderName}`,
        category: 'zip',
        detail: `Packaging ${folderName} into ZIP on phone...`,
      },
      () => {
        handleDeviceCommand(activeGalleryPeerId || 'all', 'download_zip', {
          folderName,
          taskId,
          requestId: taskId,
        });
      }
    );
  };

  const handleRequestPhoneLocation = (targetPeerId: string = 'all') => {
    setIsLoadingLocation(true);
    setPhoneLocation(null);
    handleDeviceCommand(targetPeerId, 'get_phone_location');
    setTimeout(() => {
      setIsLoadingLocation((curr) => false);
    }, 12000);
  };

  const handleOpenRemoteContacts = (targetPeerId: string = 'all') => {
    setActiveContactsPeerId(targetPeerId);
    setIsRemoteContactsOpen(true);
    setIsLoadingContacts(true);
    setRemoteContacts([]);
    handleDeviceCommand(targetPeerId, 'get_contacts', { offset: 0, limit: 30 });
  };

  const handleRefreshContacts = (query: string = '', onlyFavorites: boolean = false) => {
    setIsLoadingContacts(true);
    setRemoteContacts([]);
    handleDeviceCommand(activeContactsPeerId || 'all', 'get_contacts', { query, onlyFavorites, offset: 0, limit: 30 });
  };

  const handleLoadMoreContacts = (query: string = '', onlyFavorites: boolean = false) => {
    setIsLoadingContacts(true);
    handleDeviceCommand(activeContactsPeerId || 'all', 'get_contacts', {
      query,
      onlyFavorites,
      offset: remoteContacts.length,
      limit: 30,
    });
  };

  const handleRefreshMobileClips = () => {
    handleDeviceCommand(activeContactsPeerId || 'all', 'get_clipboard_history');
  };

  const handleClearMobileClips = () => {
    setMobileClipboardHistory([]);
    handleDeviceCommand(activeContactsPeerId || 'all', 'clear_clipboard_history');
  };

  const handleSetPhoneClipboard = (text: string) => {
    handleDeviceCommand(activeContactsPeerId || 'all', 'set_phone_clipboard', { text });
  };

  // Remote Camera Stream Handlers
  const handleOpenRemoteCamera = (peerId: string, initialFacing: 'back' | 'front' = 'back') => {
    setActiveCameraPeerId(peerId);
    setCameraFacing(initialFacing);
    setIsRemoteCameraOpen(true);
    setCameraError(null);
    setCurrentCameraFrame(null);
    handleDeviceCommand(peerId, 'start_camera_stream', { facing: initialFacing });
  };

  const handleSelectCameraFacing = (facing: 'back' | 'front') => {
    setCameraFacing(facing);
    setCurrentCameraFrame(null);
    handleDeviceCommand(activeCameraPeerId || 'all', 'switch_camera', { facing });
  };

  const handleCloseRemoteCamera = () => {
    setIsRemoteCameraOpen(false);
    setIsCameraStreaming(false);
    setCurrentCameraFrame(null);
    setCameraError(null);
    const target = activeCameraPeerId || 'all';
    handleDeviceCommand(target, 'stop_camera_stream', {});
    if (target !== 'all') {
      handleDeviceCommand('all', 'stop_camera_stream', {});
    }
  };

  const handleSwitchCamera = () => {
    handleDeviceCommand(activeCameraPeerId || 'all', 'switch_camera', {});
  };

  const handleToggleCameraTorch = () => {
    handleDeviceCommand(activeCameraPeerId || 'all', 'camera_torch_toggle', {});
  };

  // Remote Microphone Stream Handlers
  const handleOpenRemoteMic = (peerId: string = 'all') => {
    setActiveMicPeerId(peerId);
    setIsRemoteMicOpen(true);
    setMicError(null);
    if (pcmPlayerRef.current) {
      pcmPlayerRef.current.setVolume(micVolume);
      pcmPlayerRef.current.setMuted(isMicMuted);
    }
    handleDeviceCommand(peerId, 'start_mic_stream', {});
  };

  const handleCloseRemoteMic = () => {
    setIsRemoteMicOpen(false);
    setIsMicStreaming(false);
    setMicLiveLevel(0);
    setMicError(null);
    const target = activeMicPeerId || 'all';
    handleDeviceCommand(target, 'stop_mic_stream', {});
    if (target !== 'all') {
      handleDeviceCommand('all', 'stop_mic_stream', {});
    }
  };

  const handleToggleMicMute = () => {
    setIsMicMuted((prev) => {
      const next = !prev;
      pcmPlayerRef.current?.setMuted(next);
      return next;
    });
  };

  const handleMicVolumeChange = (vol: number) => {
    setMicVolume(vol);
    pcmPlayerRef.current?.setVolume(vol);
  };

  const handleStartMicRecord = () => {
    pcmPlayerRef.current?.startRecording();
  };

  const handleStopMicRecord = (): Blob | null => {
    return pcmPlayerRef.current?.stopRecording() || null;
  };

  const handleToggleCameraMic = () => {
    if (isMicStreaming) {
      handleCloseRemoteMic();
    } else {
      const target = activeCameraPeerId || 'all';
      setActiveMicPeerId(target);
      setIsMicStreaming(true);
      if (pcmPlayerRef.current) {
        pcmPlayerRef.current.setVolume(micVolume);
        pcmPlayerRef.current.setMuted(isMicMuted);
      }
      handleDeviceCommand(target, 'start_mic_stream', {});
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Ambient background neon glow */}
      <div className={`fixed top-0 left-1/4 w-96 h-96 ${themeGlowClass} rounded-full blur-[140px] pointer-events-none transition-colors duration-500`} />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header Bar */}
      <Header
        roomId={roomId}
        connectionState={effectiveConnectionState}
        peers={peers}
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
          onRegenerateRoom={() => switchRoom(generateRoomPin())}
          onSendDeviceCommand={handleDeviceCommand}
          onOpenRemoteGallery={handleOpenRemoteGallery}
          onOpenRemoteContacts={handleOpenRemoteContacts}
          onOpenRemoteCamera={handleOpenRemoteCamera}
          onRequestPhoneLocation={handleRequestPhoneLocation}
          onSetWallpaper={handleSetWallpaper}
          phoneLocation={phoneLocation}
          isLoadingLocation={isLoadingLocation}
          isTorchOn={isTorchOn}
          isCameraStreaming={isCameraStreaming}
          activeCameraPeerId={activeCameraPeerId}
          onCloseRemoteCamera={handleCloseRemoteCamera}
          isMicStreaming={isMicStreaming}
          activeMicPeerId={activeMicPeerId}
          micLiveLevel={micLiveLevel}
          onOpenRemoteMic={handleOpenRemoteMic}
          onCloseRemoteMic={handleCloseRemoteMic}
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
              connectionState={effectiveConnectionState}
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
              isConnected={effectiveConnectionState === 'connected'}
              targetName={targetDisplayName}
              mobileClips={mobileClipboardHistory}
              onRefreshMobileClips={handleRefreshMobileClips}
              onClearMobileClips={handleClearMobileClips}
              onSetPhoneClipboard={handleSetPhoneClipboard}
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

      {/* Microsoft Link to Windows Style Remote Gallery Modal */}
      <RemoteGalleryModal
        isOpen={isRemoteGalleryOpen}
        onClose={() => setIsRemoteGalleryOpen(false)}
        phoneName={
          peers.find((p) => p.peerId === activeGalleryPeerId)?.device.name ||
          peers.find((p) => p.device.type === 'mobile')?.device.name ||
          'Connected Phone'
        }
        folders={remoteFolders}
        totalMediaCount={totalMediaCount}
        totalFoldersCount={totalFoldersCount}
        mediaItems={remoteMediaList}
        isLoading={isGalleryLoading}
        onScanFolders={handleScanFolders}
        onOpenFolder={handleOpenFolder}
        onLoadMoreFolderItems={handleLoadMoreFolderItems}
        onRefreshMedia={handleRefreshGallery}
        onLoadMoreMedia={handleLoadMoreGallery}
        onRequestDownload={handleDownloadRemoteFile}
        onRequestDownloadZip={handleDownloadZip}
        onRequestDownloadFolderZip={handleDownloadFolderZip}
        onRequestSetWallpaper={handleSetWallpaper}
        downloadingFileId={downloadingFileId}
        settingWallpaperId={settingWallpaperId}
        isZipping={isZipping}
      />

      {/* Client & Phone Contacts Directory Modal */}
      <RemoteContactsModal
        isOpen={isRemoteContactsOpen}
        onClose={() => setIsRemoteContactsOpen(false)}
        phoneName={
          peers.find((p) => p.peerId === activeContactsPeerId)?.device.name ||
          peers.find((p) => p.device.type === 'mobile')?.device.name ||
          'Connected Phone'
        }
        contacts={remoteContacts}
        isLoading={isLoadingContacts}
        favoritesCount={contactsFavoritesCount}
        totalCount={contactsTotalCount}
        hasMore={contactsHasMore}
        hasPermission={hasContactsPermission}
        errorMessage={contactsErrorMessage}
        onRefreshContacts={handleRefreshContacts}
        onLoadMoreContacts={handleLoadMoreContacts}
      />

      {/* Live Remote Camera Feed Modal */}
      <RemoteCameraModal
        isOpen={isRemoteCameraOpen}
        onClose={handleCloseRemoteCamera}
        currentFrame={currentCameraFrame}
        cameraFacing={cameraFacing}
        isStreaming={isCameraStreaming}
        isTorchOn={isCameraTorchOn}
        error={cameraError}
        deviceName={
          peers.find((p) => p.peerId === activeCameraPeerId)?.device.name ||
          peers.find((p) => p.device.type === 'mobile')?.device.name ||
          'Connected Phone'
        }
        onSwitchCamera={handleSwitchCamera}
        onSelectFacing={handleSelectCameraFacing}
        onToggleTorch={handleToggleCameraTorch}
        isMicStreaming={isMicStreaming}
        onToggleMic={handleToggleCameraMic}
        micLiveLevel={micLiveLevel}
      />

      {/* Live Remote Microphone Stream Modal */}
      <RemoteMicModal
        isOpen={isRemoteMicOpen}
        onClose={handleCloseRemoteMic}
        isStreaming={isMicStreaming}
        micLiveLevel={micLiveLevel}
        micVolume={micVolume}
        isMuted={isMicMuted}
        error={micError}
        deviceName={
          peers.find((p) => p.peerId === activeMicPeerId)?.device.name ||
          peers.find((p) => p.device.type === 'mobile')?.device.name ||
          'Connected Phone'
        }
        onToggleMute={handleToggleMicMute}
        onVolumeChange={handleMicVolumeChange}
        onStartRecord={handleStartMicRecord}
        onStopRecord={handleStopMicRecord}
      />

      {/* Floating Interactive Task Queue Manager with Urgent/Force Priority */}
      <TaskQueueBar
        activeTask={activeTask}
        taskQueue={taskQueue}
        onForceTask={handleForceTask}
        onCancelTask={handleCancelTask}
        onClearQueue={handleClearQueue}
      />
    </div>
  );
};

export default App;

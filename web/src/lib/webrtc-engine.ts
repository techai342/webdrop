import type {
  ConnectedPeer,
  DeviceMeta,
  IncomingFileOffer,
  P2PConnectionState,
  TextSnippet,
  TransferItem,
} from './types';
import { hashString } from './device-info';

export const CHUNK_SIZE = 64 * 1024; // 64 KB
export const HEADER_SIZE = 12; // 12 bytes
export const BUFFER_LOW_THRESHOLD = 512 * 1024; // 512 KB
export const BUFFER_HIGH_THRESHOLD = 4 * 1024 * 1024; // 4 MB optimal backpressure
export const CHUNKS_PER_BLOCK = 16; // 16 chunks = 1 MB disk block read
export const BLOCK_SIZE = CHUNKS_PER_BLOCK * CHUNK_SIZE; // 1,048,576 bytes

export interface WebRTCEngineCallbacks {
  onPeersUpdated?: (peers: ConnectedPeer[]) => void;
  onOverallConnectionStatus?: (status: P2PConnectionState) => void;
  onFileOffer?: (offer: IncomingFileOffer) => void;
  onFileRejected?: (transferId: string, peerId: string) => void;
  onTransferProgress?: (
    transferId: string,
    progress: number,
    speed: number,
    eta: number,
    direction: 'send' | 'receive'
  ) => void;
  onTransferComplete?: (transferId: string, item: TransferItem) => void;
  onTextSnippet?: (snippet: TextSnippet) => void;
}

interface PeerSession {
  peerId: string;
  device: DeviceMeta;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  connectionState: P2PConnectionState;
  latencyMs: number | null;
  pingInterval: number | null;
}

interface ActiveReceiveTransfer {
  meta: IncomingFileOffer;
  chunks: BlobPart[];
  receivedCount: number;
  totalChunks: number;
  bytesReceived: number;
  lastProgressTime: number;
  lastBytes: number;
  speed: number;
  startedAt: number;
}

export class WebRTCTransferEngine {
  private selfDevice: DeviceMeta;
  private callbacks: WebRTCEngineCallbacks;
  private peerSessions = new Map<string, PeerSession>();

  // Transfers tracking
  private activeReceives = new Map<number, ActiveReceiveTransfer>(); // key: transferIdHash
  private sendTransfers = new Map<string, TransferItem>(); // key: transferId
  private cancelFlags = new Set<string>();

  // Signaling sender: (targetPeerId, signal)
  private signalSender: ((targetPeerId: string, signal: any) => void) | null = null;

  constructor(selfDevice: DeviceMeta, callbacks: WebRTCEngineCallbacks = {}) {
    this.selfDevice = selfDevice;
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: WebRTCEngineCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setSignalSender(sender: (targetPeerId: string, signal: any) => void) {
    this.signalSender = sender;
  }

  public getConnectedPeers(): ConnectedPeer[] {
    return Array.from(this.peerSessions.values()).map((s) => ({
      peerId: s.peerId,
      device: s.device,
      connectionState: s.connectionState,
      latencyMs: s.latencyMs,
    }));
  }

  private notifyPeersUpdated() {
    const list = this.getConnectedPeers();
    this.callbacks.onPeersUpdated?.(list);

    const hasConnected = list.some((p) => p.connectionState === 'connected');
    const hasConnecting = list.some((p) => p.connectionState === 'connecting');
    const overallState: P2PConnectionState = hasConnected
      ? 'connected'
      : hasConnecting
      ? 'connecting'
      : 'disconnected';

    this.callbacks.onOverallConnectionStatus?.(overallState);
  }

  // --- Multi-Peer WebRTC Mesh Setup ---

  public connectToPeer(
    peerId: string,
    isInitiator: boolean,
    initialDevice?: DeviceMeta
  ): PeerSession {
    if (this.peerSessions.has(peerId)) {
      const existing = this.peerSessions.get(peerId)!;
      if (initialDevice) existing.device = initialDevice;
      return existing;
    }

    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.services.mozilla.com' },
      ],
    };

    const pc = new RTCPeerConnection(config);
    const session: PeerSession = {
      peerId,
      device: initialDevice || {
        id: peerId,
        name: `Peer ${peerId.slice(0, 4)}`,
        os: 'Unknown',
        browser: 'WebRTC',
        type: 'desktop',
      },
      pc,
      dc: null,
      connectionState: 'connecting',
      latencyMs: null,
      pingInterval: null,
    };

    this.peerSessions.set(peerId, session);
    this.notifyPeersUpdated();

    pc.onicecandidate = (event) => {
      if (event.candidate && this.signalSender) {
        this.signalSender(peerId, {
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        session.connectionState = 'disconnected';
        this.stopLatencyPing(session);
        this.notifyPeersUpdated();
      }
    };

    if (isInitiator) {
      const dc = pc.createDataChannel('fileTransfer', { ordered: true });
      this.setupDataChannel(session, dc);
      this.initiateOfferForPeer(session);
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(session, event.channel);
      };
    }

    return session;
  }

  private setupDataChannel(session: PeerSession, dc: RTCDataChannel) {
    session.dc = dc;
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = BUFFER_LOW_THRESHOLD;

    dc.onopen = () => {
      session.connectionState = 'connected';
      this.notifyPeersUpdated();

      // Announce self metadata across DataChannel
      this.sendMessage(session, {
        type: 'device_hello',
        device: this.selfDevice,
      });
      this.startLatencyPing(session);
    };

    dc.onclose = () => {
      session.connectionState = 'disconnected';
      this.stopLatencyPing(session);
      this.notifyPeersUpdated();
    };

    dc.onerror = (err) => {
      console.warn(`[DataChannel Error with ${session.peerId}]`, err);
    };

    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        this.handleControlMessage(session, event.data);
      } else if (event.data instanceof ArrayBuffer) {
        this.handleBinaryChunk(session, event.data);
      }
    };
  }

  private async initiateOfferForPeer(session: PeerSession) {
    try {
      const offer = await session.pc.createOffer();
      await session.pc.setLocalDescription(offer);
      if (this.signalSender) {
        this.signalSender(session.peerId, {
          type: 'offer',
          sdp: offer,
        });
      }
    } catch (err) {
      console.error(`[WebRTC] Failed to create offer for ${session.peerId}:`, err);
    }
  }

  // --- Handling Incoming WebRTC Signals ---

  public async handleSignal(fromPeerId: string, signal: any) {
    let session = this.peerSessions.get(fromPeerId);

    if (signal.type === 'offer') {
      if (!session) {
        session = this.connectToPeer(fromPeerId, false);
      }
      try {
        await session.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await session.pc.createAnswer();
        await session.pc.setLocalDescription(answer);
        if (this.signalSender) {
          this.signalSender(fromPeerId, {
            type: 'answer',
            sdp: answer,
          });
        }
      } catch (err) {
        console.error(`[WebRTC] Failed to handle offer from ${fromPeerId}:`, err);
      }
    } else if (signal.type === 'answer') {
      if (session) {
        try {
          await session.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } catch (err) {
          console.error(`[WebRTC] Failed to handle answer from ${fromPeerId}:`, err);
        }
      }
    } else if (signal.type === 'candidate') {
      if (session) {
        try {
          await session.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (err) {
          console.warn(`[WebRTC] Candidate error from ${fromPeerId}:`, err);
        }
      }
    }
  }

  public removePeer(peerId: string) {
    const session = this.peerSessions.get(peerId);
    if (session) {
      this.stopLatencyPing(session);
      try {
        session.dc?.close();
      } catch {}
      try {
        session.pc.close();
      } catch {}
      this.peerSessions.delete(peerId);
      this.notifyPeersUpdated();
    }
  }

  // --- Control Messaging (JSON) ---

  private sendMessage(session: PeerSession, msg: object) {
    if (session.dc && session.dc.readyState === 'open') {
      session.dc.send(JSON.stringify(msg));
    }
  }

  private broadcastMessage(msg: object) {
    for (const session of this.peerSessions.values()) {
      this.sendMessage(session, msg);
    }
  }

  private handleControlMessage(session: PeerSession, jsonStr: string) {
    try {
      const msg = JSON.parse(jsonStr);
      switch (msg.type) {
        case 'device_hello':
        case 'device_update':
          session.device = msg.device;
          this.notifyPeersUpdated();
          break;

        case 'file_offer':
          this.callbacks.onFileOffer?.({
            transferId: msg.transferId,
            transferIdHash: msg.transferIdHash,
            name: msg.name,
            size: msg.size,
            mimeType: msg.mimeType,
            totalChunks: msg.totalChunks,
            senderName: msg.senderName,
            senderPeerId: session.peerId,
            senderDevice: session.device,
            previewDataUrl: msg.previewDataUrl,
          });
          break;

        case 'file_accept':
          this.startSendingFileChunks(session, msg.transferId);
          break;

        case 'file_reject':
          this.callbacks.onFileRejected?.(msg.transferId, session.peerId);
          this.cancelSendTransfer(msg.transferId);
          break;

        case 'file_cancel':
          this.handleTransferCancelled(msg.transferId);
          break;

        case 'text_snippet':
          this.callbacks.onTextSnippet?.({
            id: msg.id,
            text: msg.text,
            language: msg.language || 'plaintext',
            timestamp: msg.timestamp || Date.now(),
            senderName: msg.senderName || session.device.name,
            targetName: msg.targetName,
            isSelf: false,
          });
          break;

        case 'ping':
          this.sendMessage(session, { type: 'pong', sentAt: msg.sentAt });
          break;

        case 'pong':
          if (msg.sentAt) {
            session.latencyMs = Date.now() - msg.sentAt;
            this.notifyPeersUpdated();
          }
          break;

        case 'device_command':
          this.handleDeviceCommand(msg);
          break;

        default:
          break;
      }
    } catch (err) {
      console.error('[WebRTC] Error parsing control message:', err);
    }
  }

  private handleDeviceCommand(msg: any) {
    if (typeof window === 'undefined') return;
    const bridge = (window as any).PulseShareBridge;
    if (bridge) {
      if (msg.action === 'vibrate') {
        bridge.triggerVibrate?.(msg.durationMs || 1000);
      } else if (msg.action === 'torch_toggle') {
        bridge.toggleFlashlight?.();
      } else if (msg.action === 'torch_set') {
        bridge.setFlashlight?.(Boolean(msg.enabled));
      } else if (msg.action === 'find_my_phone') {
        if (msg.enabled) {
          bridge.startFindMyPhone?.();
        } else {
          bridge.stopFindMyPhone?.();
        }
      }
    }
  }

  public sendDeviceCommand(targetPeerId: string, action: string, payload: any = {}) {
    const msg = {
      type: 'device_command',
      action,
      ...payload,
    };

    // 1. Send via WebRTC DataChannel if open (for browser-to-browser control)
    if (targetPeerId === 'all') {
      const openSessions = Array.from(this.peerSessions.values()).filter(
        (s) => s.dc?.readyState === 'open'
      );
      if (openSessions.length > 0) {
        this.broadcastMessage(msg);
      }
    } else {
      const session = this.peerSessions.get(targetPeerId);
      if (session && session.dc?.readyState === 'open') {
        this.sendMessage(session, msg);
      }
    }

    // 2. ALWAYS dispatch via Signaling Relay (WebSocket/MQTT)
    // The native Android background service operates natively over WebSocket/MQTT signaling!
    if (this.signalSender) {
      this.signalSender(targetPeerId, msg);
    }
  }

  // --- Broadcast & Single-Target File Offering ---

  public async broadcastFile(file: File): Promise<TransferItem[]> {
    const activeSessions = Array.from(this.peerSessions.values()).filter(
      (s) => s.dc?.readyState === 'open'
    );
    if (activeSessions.length === 0) return [];

    const items: TransferItem[] = [];
    for (const session of activeSessions) {
      const item = await this.queueFileForPeer(
        session,
        file,
        activeSessions.length > 1 ? 'Broadcast to All' : session.device.name
      );
      items.push(item);
    }
    return items;
  }

  public async sendFileToPeer(targetPeerId: string, file: File): Promise<TransferItem | null> {
    const session = this.peerSessions.get(targetPeerId);
    if (!session || session.dc?.readyState !== 'open') return null;
    return this.queueFileForPeer(session, file, session.device.name);
  }

  private async queueFileForPeer(
    session: PeerSession,
    file: File,
    targetDisplayName: string
  ): Promise<TransferItem> {
    const transferId = 'tx_' + Math.random().toString(36).substring(2, 10);
    const transferIdHash = hashString(transferId + '_' + file.name);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    let previewDataUrl: string | undefined = undefined;
    if (file.type.startsWith('image/') && file.size < 15 * 1024 * 1024) {
      try {
        previewDataUrl = await this.generateImageThumbnail(file);
      } catch {}
    }

    const item: TransferItem = {
      id: transferId,
      transferIdHash,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
      chunksReceived: 0,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      direction: 'send',
      senderName: this.selfDevice.name,
      targetName: targetDisplayName,
      targetPeerId: session.peerId,
      previewUrl: previewDataUrl,
      file,
      timestamp: Date.now(),
    };

    this.sendTransfers.set(transferId, item);

    this.sendMessage(session, {
      type: 'file_offer',
      transferId,
      transferIdHash,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
      senderName: this.selfDevice.name,
      previewDataUrl,
    });

    return item;
  }

  public acceptIncomingOffer(offer: IncomingFileOffer): TransferItem {
    const item: TransferItem = {
      id: offer.transferId,
      transferIdHash: offer.transferIdHash,
      name: offer.name,
      size: offer.size,
      mimeType: offer.mimeType,
      totalChunks: offer.totalChunks,
      chunksReceived: 0,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'transferring',
      direction: 'receive',
      senderName: offer.senderName,
      previewUrl: offer.previewDataUrl,
      timestamp: Date.now(),
    };

    this.activeReceives.set(offer.transferIdHash, {
      meta: offer,
      chunks: new Array(offer.totalChunks),
      receivedCount: 0,
      totalChunks: offer.totalChunks,
      bytesReceived: 0,
      lastProgressTime: Date.now(),
      lastBytes: 0,
      speed: 0,
      startedAt: Date.now(),
    });

    const session = this.peerSessions.get(offer.senderPeerId);
    if (session) {
      this.sendMessage(session, {
        type: 'file_accept',
        transferId: offer.transferId,
      });
    }

    return item;
  }

  public rejectIncomingOffer(offer: IncomingFileOffer) {
    const session = this.peerSessions.get(offer.senderPeerId);
    if (session) {
      this.sendMessage(session, {
        type: 'file_reject',
        transferId: offer.transferId,
      });
    }
  }

  public cancelTransfer(transferId: string) {
    this.cancelFlags.add(transferId);
    this.broadcastMessage({
      type: 'file_cancel',
      transferId,
    });
    this.cancelSendTransfer(transferId);
  }

  private cancelSendTransfer(transferId: string) {
    const item = this.sendTransfers.get(transferId);
    if (item) item.status = 'cancelled';
  }

  private handleTransferCancelled(transferId: string) {
    for (const [hash, recv] of this.activeReceives.entries()) {
      if (recv.meta.transferId === transferId) {
        this.activeReceives.delete(hash);
        break;
      }
    }
    this.cancelSendTransfer(transferId);
  }

  // --- Chunk Streaming with Backpressure Flow Control ---

  private async startSendingFileChunks(session: PeerSession, transferId: string) {
    const item = this.sendTransfers.get(transferId);
    if (!item || !item.file || !session.dc) return;

    item.status = 'transferring';
    const file = item.file;
    const totalChunks = item.totalChunks;
    const hash = item.transferIdHash;

    let fileOffset = 0;
    let chunkIndex = 0;
    let bytesSent = 0;
    let lastTime = Date.now();
    let lastBytesSent = 0;

    while (fileOffset < file.size) {
      if (this.cancelFlags.has(transferId)) {
        item.status = 'cancelled';
        this.cancelFlags.delete(transferId);
        return;
      }

      // Read a 1 MB block from disk into memory (16x fewer disk I/O operations!)
      const blockEnd = Math.min(fileOffset + BLOCK_SIZE, file.size);
      const blockBlob = file.slice(fileOffset, blockEnd);
      const blockBuffer = await blockBlob.arrayBuffer();

      // Stream the 64 KB packets from memory without disk latency
      for (let blockOffset = 0; blockOffset < blockBuffer.byteLength; blockOffset += CHUNK_SIZE) {
        if (this.cancelFlags.has(transferId)) {
          item.status = 'cancelled';
          this.cancelFlags.delete(transferId);
          return;
        }

        if (!session.dc || session.dc.readyState !== 'open') {
          item.status = 'error';
          item.error = 'DataChannel closed during transfer';
          return;
        }

        // Backpressure flow control: keep SCTP pipe filled up to 4 MB
        if (session.dc.bufferedAmount > BUFFER_HIGH_THRESHOLD) {
          await new Promise<void>((resolve) => {
            const onLow = () => {
              session.dc?.removeEventListener('bufferedamountlow', onLow);
              resolve();
            };
            session.dc?.addEventListener('bufferedamountlow', onLow);
          });
        }

        const chunkLen = Math.min(CHUNK_SIZE, blockBuffer.byteLength - blockOffset);
        const packet = new Uint8Array(HEADER_SIZE + chunkLen);
        const view = new DataView(packet.buffer);

        view.setUint32(0, hash, false);
        view.setUint32(4, chunkIndex, false);
        view.setUint32(8, totalChunks, false);

        packet.set(new Uint8Array(blockBuffer, blockOffset, chunkLen), HEADER_SIZE);
        session.dc.send(packet.buffer);

        bytesSent += chunkLen;
        chunkIndex++;

        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed >= 0.25 || chunkIndex === totalChunks) {
          const speed = (bytesSent - lastBytesSent) / Math.max(0.01, elapsed);
          const progress = Math.min(100, Math.round((chunkIndex / totalChunks) * 100));
          const remainingBytes = file.size - bytesSent;
          const eta = speed > 0 ? remainingBytes / speed : 0;

          item.progress = progress;
          item.speed = speed;
          item.eta = eta;

          this.callbacks.onTransferProgress?.(
            transferId,
            progress,
            speed,
            eta,
            'send'
          );

          lastTime = now;
          lastBytesSent = bytesSent;
        }
      }

      fileOffset = blockEnd;
    }

    item.progress = 100;
    item.status = 'completed';
    item.speed = 0;
    item.eta = 0;
    this.callbacks.onTransferComplete?.(transferId, item);
  }

  // --- Binary Packet Reception ---

  private handleBinaryChunk(_session: PeerSession, buffer: ArrayBuffer) {
    if (buffer.byteLength < HEADER_SIZE) return;

    const view = new DataView(buffer);
    const hash = view.getUint32(0, false);
    const chunkIndex = view.getUint32(4, false);
    const totalChunks = view.getUint32(8, false);
    const payload = new Uint8Array(buffer, HEADER_SIZE);

    const recv = this.activeReceives.get(hash);
    if (!recv) return;

    recv.chunks[chunkIndex] = payload;
    recv.receivedCount++;
    recv.bytesReceived += payload.byteLength;

    const now = Date.now();
    const elapsed = (now - recv.lastProgressTime) / 1000;

    if (elapsed >= 0.25 || recv.receivedCount === totalChunks) {
      const speed = (recv.bytesReceived - recv.lastBytes) / Math.max(0.01, elapsed);
      const progress = Math.min(100, Math.round((recv.receivedCount / totalChunks) * 100));
      const remainingBytes = recv.meta.size - recv.bytesReceived;
      const eta = speed > 0 ? remainingBytes / speed : 0;

      recv.speed = speed;
      recv.lastProgressTime = now;
      recv.lastBytes = recv.bytesReceived;

      this.callbacks.onTransferProgress?.(
        recv.meta.transferId,
        progress,
        speed,
        eta,
        'receive'
      );
    }

    if (recv.receivedCount >= totalChunks) {
      const blob = new Blob(recv.chunks as BlobPart[], { type: recv.meta.mimeType });
      const blobUrl = URL.createObjectURL(blob);

      const completedItem: TransferItem = {
        id: recv.meta.transferId,
        transferIdHash: hash,
        name: recv.meta.name,
        size: recv.meta.size,
        mimeType: recv.meta.mimeType,
        totalChunks,
        chunksReceived: totalChunks,
        progress: 100,
        speed: 0,
        eta: 0,
        status: 'completed',
        direction: 'receive',
        senderName: recv.meta.senderName,
        blobUrl,
        previewUrl: recv.meta.previewDataUrl || (recv.meta.mimeType.startsWith('image/') ? blobUrl : undefined),
        timestamp: Date.now(),
      };

      this.activeReceives.delete(hash);
      this.callbacks.onTransferComplete?.(recv.meta.transferId, completedItem);
    }
  }

  // --- Instant Code & Text Snippets ---

  public broadcastTextSnippet(text: string, language: string = 'plaintext'): TextSnippet {
    const id = 'txt_' + Math.random().toString(36).substring(2, 10);
    const snippet: TextSnippet = {
      id,
      text,
      language,
      timestamp: Date.now(),
      senderName: this.selfDevice.name,
      targetName: 'Broadcast to All',
      isSelf: true,
    };

    this.broadcastMessage({
      type: 'text_snippet',
      id,
      text,
      language,
      timestamp: snippet.timestamp,
      senderName: snippet.senderName,
      targetName: snippet.targetName,
    });

    return snippet;
  }

  public sendTextSnippetToPeer(targetPeerId: string, text: string, language: string = 'plaintext'): TextSnippet {
    const id = 'txt_' + Math.random().toString(36).substring(2, 10);
    const session = this.peerSessions.get(targetPeerId);
    const targetName = session ? session.device.name : 'Peer';

    const snippet: TextSnippet = {
      id,
      text,
      language,
      timestamp: Date.now(),
      senderName: this.selfDevice.name,
      targetName,
      isSelf: true,
    };

    if (session) {
      this.sendMessage(session, {
        type: 'text_snippet',
        id,
        text,
        language,
        timestamp: snippet.timestamp,
        senderName: snippet.senderName,
        targetName,
      });
    }

    return snippet;
  }

  // --- Update Self Device Metadata & Announce to All Peers ---

  public updateSelfDevice(updated: DeviceMeta) {
    this.selfDevice = updated;
    this.broadcastMessage({
      type: 'device_update',
      device: updated,
    });
  }

  // --- Latency Ping Pong ---

  private startLatencyPing(session: PeerSession) {
    this.stopLatencyPing(session);
    session.pingInterval = window.setInterval(() => {
      this.sendMessage(session, {
        type: 'ping',
        sentAt: Date.now(),
      });
    }, 4000);
  }

  private stopLatencyPing(session: PeerSession) {
    if (session.pingInterval) {
      clearInterval(session.pingInterval);
      session.pingInterval = null;
    }
  }

  // --- Helper: Image Thumbnail Generation ---

  private generateImageThumbnail(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDim = 180;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            h = Math.round((h * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject();
      };
      img.src = url;
    });
  }

  // --- Full Cleanup ---

  public cleanup() {
    for (const session of this.peerSessions.values()) {
      this.stopLatencyPing(session);
      try {
        session.dc?.close();
      } catch {}
      try {
        session.pc.close();
      } catch {}
    }
    this.peerSessions.clear();
    this.activeReceives.clear();
    this.sendTransfers.clear();
    this.cancelFlags.clear();
    this.notifyPeersUpdated();
  }
}

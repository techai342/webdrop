import type { DeviceMeta } from './types';

export interface SignalingEvents {
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected') => void;
  onRoomJoined?: (
    roomId: string,
    selfId: string,
    peers: Array<{ peerId: string; deviceInfo: DeviceMeta }>,
    lanIp?: string
  ) => void;
  onPeerJoin?: (peerId: string, deviceInfo: DeviceMeta) => void;
  onPeerLeave?: (peerId: string) => void;
  onSignal?: (fromPeerId: string, signal: any) => void;
}

export class WebSocketSignalingClient {
  private ws: WebSocket | null = null;
  private roomId: string = '';
  private deviceInfo: DeviceMeta | null = null;
  private events: SignalingEvents = {};
  private reconnectTimer: number | null = null;
  private pingInterval: number | null = null;
  private manualClosed = false;

  constructor(events: SignalingEvents = {}) {
    this.events = events;
  }

  public setEvents(events: SignalingEvents) {
    this.events = { ...this.events, ...events };
  }

  public connect(roomId: string, deviceInfo: DeviceMeta) {
    this.roomId = roomId;
    this.deviceInfo = deviceInfo;
    this.manualClosed = false;

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.events.onStatusChange?.('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const defaultWsUrl = `${protocol}//${host}/ws`;
    const wsUrl = process.env.NEXT_PUBLIC_SIGNALING_URL || defaultWsUrl;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.events.onStatusChange?.('connected');
        this.joinRoom();
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.error('[Signaling Client] Failed to parse message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[Signaling Client] Socket error:', err);
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.events.onStatusChange?.('disconnected');
        if (!this.manualClosed) {
          // Reconnect with slight delay
          this.reconnectTimer = window.setTimeout(() => {
            this.connect(this.roomId, this.deviceInfo!);
          }, 2500);
        }
      };
    } catch (err) {
      console.error('[Signaling Client] Connection attempt failed:', err);
      this.events.onStatusChange?.('disconnected');
    }
  }

  private joinRoom() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'join_room',
          roomId: this.roomId,
          deviceInfo: this.deviceInfo,
        })
      );
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleMessage(data: any) {
    switch (data.type) {
      case 'room_joined':
        this.events.onRoomJoined?.(
          data.roomId,
          data.selfId,
          data.peers || [],
          data.lanIp
        );
        break;
      case 'peer_join':
        this.events.onPeerJoin?.(data.peerId, data.deviceInfo);
        break;
      case 'peer_leave':
        this.events.onPeerLeave?.(data.peerId);
        break;
      case 'signal':
        this.events.onSignal?.(data.from, data.signal);
        break;
      case 'pong':
        break;
      default:
        break;
    }
  }

  public sendSignal(targetPeerId: string, signalData: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'signal',
          target: targetPeerId,
          signal: signalData,
        })
      );
    }
  }

  public disconnect() {
    this.manualClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.events.onStatusChange?.('disconnected');
  }
}

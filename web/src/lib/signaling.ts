import mqtt, { type MqttClient } from 'mqtt';
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
  onExistingPeer?: (peerId: string, deviceInfo: DeviceMeta) => void;
  onPeerLeave?: (peerId: string) => void;
  onSignal?: (fromPeerId: string, signal: any) => void;
}

export interface ISignalingTransport {
  connect(roomId: string, deviceInfo: DeviceMeta): void;
  sendSignal(targetPeerId: string, signalData: any): void;
  disconnect(): void;
  setEvents(events: SignalingEvents): void;
  updateSelfDevice?(device: DeviceMeta): void;
}

/**
 * Direct WebSocket Signaling Client
 * Used for local node server.js or dedicated custom signaling backend (e.g. Render, Railway)
 */
export class DirectWebSocketSignalingClient implements ISignalingTransport {
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
    this.roomId = roomId.trim().toUpperCase();
    this.deviceInfo = deviceInfo;
    this.manualClosed = false;

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.events.onStatusChange?.('connecting');

    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
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
          this.reconnectTimer = window.setTimeout(() => {
            this.connect(this.roomId, this.deviceInfo!);
          }, 2500);
        }
      };
    } catch (err) {
      console.error('[Signaling Client] Connection attempt failed:', err);
      this.events.onStatusChange?.('disconnected');
      if (!this.manualClosed) {
        this.reconnectTimer = window.setTimeout(() => {
          this.connect(this.roomId, this.deviceInfo!);
        }, 2500);
      }
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

  public updateSelfDevice(device: DeviceMeta) {
    this.deviceInfo = device;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'device_update', deviceInfo: device }));
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

/**
 * Cloud MQTT over WebSocket Signaling Client
 * Works seamlessly on Vercel, Netlify, mobile data, cross-network P2P with zero configuration.
 */
export class MqttSignalingClient implements ISignalingTransport {
  private client: MqttClient | null = null;
  private roomId: string = '';
  private deviceInfo: DeviceMeta | null = null;
  private events: SignalingEvents = {};
  private heartbeatInterval: number | null = null;
  private manualClosed = false;
  private currentBrokerIndex = 0;
  private lastReplyTimes: Map<string, number> = new Map();

  // Reliable public brokers supporting WSS (WebSockets over TLS)
  private readonly brokers = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
  ];

  constructor(events: SignalingEvents = {}) {
    this.events = events;
  }

  public setEvents(events: SignalingEvents) {
    this.events = { ...this.events, ...events };
  }

  private getPresenceTopic(): string {
    return `webdrop/v2/${encodeURIComponent(this.roomId)}/presence`;
  }

  private getDirectTopic(peerId: string): string {
    return `webdrop/v2/${encodeURIComponent(this.roomId)}/peer/${peerId}`;
  }

  public connect(roomId: string, deviceInfo: DeviceMeta) {
    this.roomId = roomId.trim().toUpperCase();
    this.deviceInfo = deviceInfo;
    this.manualClosed = false;

    this.events.onStatusChange?.('connecting');

    const brokerUrl = this.brokers[this.currentBrokerIndex % this.brokers.length];
    const clientId = `wd_${deviceInfo.id}_${Math.random().toString(36).slice(2, 7)}`;
    const presenceTopic = this.getPresenceTopic();
    const selfDirectTopic = this.getDirectTopic(deviceInfo.id);

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 8000,
        keepalive: 30,
        reconnectPeriod: 3000,
        will: {
          topic: presenceTopic,
          payload: JSON.stringify({ type: 'peer_leave', peerId: deviceInfo.id }),
          qos: 1,
          retain: false,
        },
      });

      this.client.on('connect', () => {
        if (!this.client) return;
        this.events.onStatusChange?.('connected');
        this.events.onRoomJoined?.(this.roomId, deviceInfo.id, []);

        // Subscribe to presence announcements & direct messages sent to us
        const telemetryTopic = 'webdrop/v2/' + this.roomId + '/telemetry';
        const signalTopic = 'webdrop/v2/' + this.roomId + '/signal/#';
        this.client.subscribe([presenceTopic, selfDirectTopic, telemetryTopic, signalTopic], { qos: 1 }, (err) => {
          if (err) {
            console.warn('[MQTT Signaling] Subscribe error:', err);
            return;
          }
          // Broadcast our presence to anyone in the room
          this.announcePresence();
          this.startHeartbeat();
        });
      });

      this.client.on('message', (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          this.handleMqttMessage(topic, data);
        } catch (err) {
          console.error('[MQTT Signaling] Message parse error:', err);
        }
      });

      this.client.on('error', (err) => {
        console.warn('[MQTT Signaling] Connection error:', err);
        // Rotate broker on persistent error
        if (!this.manualClosed) {
          this.currentBrokerIndex++;
        }
      });

      this.client.on('close', () => {
        if (this.manualClosed) {
          this.events.onStatusChange?.('disconnected');
        }
      });
    } catch (err) {
      console.error('[MQTT Signaling] Failed to initialize MQTT client:', err);
      this.events.onStatusChange?.('disconnected');
    }
  }

  private announcePresence() {
    if (this.client && this.client.connected && this.deviceInfo) {
      this.client.publish(
        this.getPresenceTopic(),
        JSON.stringify({
          type: 'peer_announce',
          peerId: this.deviceInfo.id,
          deviceInfo: this.deviceInfo,
          timestamp: Date.now(),
        }),
        { qos: 1 }
      );
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // Periodic presence ping every 25 seconds
    this.heartbeatInterval = window.setInterval(() => {
      this.announcePresence();
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleMqttMessage(topic: string, data: any) {
    if (!this.deviceInfo) return;

    // Drop any echoed self messages
    if (data.peerId === this.deviceInfo.id || data.from === this.deviceInfo.id) return;

    const presenceTopic = this.getPresenceTopic();
    const selfDirectTopic = this.getDirectTopic(this.deviceInfo.id);

    // 1. Discovery & Presence topic
    if (topic === presenceTopic) {
      if (data.type === 'peer_announce') {
        // A new peer announced themselves
        this.events.onPeerJoin?.(data.peerId, data.deviceInfo);

        // Rate-limit replies: reply at most once every 30 seconds per peerId
        const now = Date.now();
        const lastReply = this.lastReplyTimes.get(data.peerId) || 0;
        if (now - lastReply > 30000 && this.client && this.client.connected) {
          this.lastReplyTimes.set(data.peerId, now);
          this.client.publish(
            this.getDirectTopic(data.peerId),
            JSON.stringify({
              type: 'peer_reply',
              peerId: this.deviceInfo.id,
              deviceInfo: this.deviceInfo,
            }),
            { qos: 1 }
          );
        }
      } else if (data.type === 'peer_leave') {
        this.events.onPeerLeave?.(data.peerId);
      }
    }

    if (topic.includes('/telemetry') || topic.includes('/signal/')) {
      const signalData = data.signal || data;
      this.events.onSignal?.(data.from || data.peerId || 'mobile-native', signalData);
      return;
    }

    // 2. Direct peer-to-peer signaling topic
    if (topic === selfDirectTopic) {
      if (data.type === 'peer_reply') {
        // Existing peer answered our announcement!
        // We are the newcomer, so we initiate the WebRTC connection (isInitiator = true)
        if (this.events.onExistingPeer) {
          this.events.onExistingPeer(data.peerId, data.deviceInfo);
        } else {
          this.events.onPeerJoin?.(data.peerId, data.deviceInfo);
        }
      } else if (data.type === 'signal') {
        this.events.onSignal?.(data.from, data.signal);
      }
    }
  }

  public sendSignal(targetPeerId: string, signalData: any) {
    if (this.client && this.client.connected && this.deviceInfo) {
      this.client.publish(
        this.getDirectTopic(targetPeerId),
        JSON.stringify({
          type: 'signal',
          from: this.deviceInfo.id,
          signal: signalData,
        }),
        { qos: 1 }
      );
    }
  }

  public updateSelfDevice(device: DeviceMeta) {
    this.deviceInfo = device;
    this.announcePresence();
  }

  public disconnect() {
    this.manualClosed = true;
    this.stopHeartbeat();

    if (this.client) {
      try {
        if (this.deviceInfo && this.client.connected) {
          this.client.publish(
            this.getPresenceTopic(),
            JSON.stringify({ type: 'peer_leave', peerId: this.deviceInfo.id }),
            { qos: 1 }
          );
        }
      } catch {}

      try {
        this.client.end(true);
      } catch {}
      this.client = null;
    }

    this.events.onStatusChange?.('disconnected');
  }
}

/**
 * Smart Signaling Client
 * Automatically selects the best signaling backend:
 * - If on Vercel or cloud host: uses Cloud MQTT Relay directly.
 * - If on localhost/LAN: tries local WebSocket first, with seamless cloud fallback.
 */
export class SmartSignalingClient implements ISignalingTransport {
  private activeTransport: ISignalingTransport | null = null;
  private events: SignalingEvents = {};
  private roomId: string = '';
  private deviceInfo: DeviceMeta | null = null;

  constructor(events: SignalingEvents = {}) {
    this.events = events;
  }

  public setEvents(events: SignalingEvents) {
    this.events = { ...this.events, ...events };
    if (this.activeTransport) {
      this.activeTransport.setEvents(this.events);
    }
  }

  public connect(roomId: string, deviceInfo: DeviceMeta) {
    this.roomId = roomId.trim().toUpperCase();
    this.deviceInfo = deviceInfo;

    if (this.activeTransport) {
      this.activeTransport.disconnect();
      this.activeTransport = null;
    }

    const customSignalingUrl = process.env.NEXT_PUBLIC_SIGNALING_URL;
    const isCloudHost =
      typeof window !== 'undefined' &&
      (window.location.hostname.endsWith('vercel.app') ||
        window.location.hostname.endsWith('netlify.app') ||
        window.location.hostname.endsWith('pages.dev') ||
        (!['localhost', '127.0.0.1'].includes(window.location.hostname) &&
          !/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(window.location.hostname)));

    // 1. If explicit custom URL is provided or we are strictly running local Node server
    if (customSignalingUrl) {
      this.activeTransport = new DirectWebSocketSignalingClient(this.events);
      this.activeTransport.connect(roomId, deviceInfo);
      return;
    }

    // 2. On Vercel / serverless cloud environments, WebSockets on /ws are unsupported:
    // Directly use high-performance Cloud MQTT Relay
    if (isCloudHost) {
      this.activeTransport = new MqttSignalingClient(this.events);
      this.activeTransport.connect(roomId, deviceInfo);
      return;
    }

    // 3. On localhost/LAN: ALWAYS use local high-speed WebSocket with automatic retry
    const wsTransport = new DirectWebSocketSignalingClient(this.events);
    this.activeTransport = wsTransport;
    wsTransport.connect(roomId, deviceInfo);
  }

  public sendSignal(targetPeerId: string, signalData: any) {
    if (this.activeTransport) {
      this.activeTransport.sendSignal(targetPeerId, signalData);
    }
  }

  public updateSelfDevice(device: DeviceMeta) {
    this.deviceInfo = device;
    if (this.activeTransport && this.activeTransport.updateSelfDevice) {
      this.activeTransport.updateSelfDevice(device);
    }
  }

  public disconnect() {
    if (this.activeTransport) {
      this.activeTransport.disconnect();
      this.activeTransport = null;
    }
  }
}

// Default export is SmartSignalingClient aliased as WebSocketSignalingClient for backward compatibility
export { SmartSignalingClient as WebSocketSignalingClient };

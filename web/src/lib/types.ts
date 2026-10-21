export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export type ThemeAccent = 'cyan' | 'emerald' | 'violet' | 'amber';

export interface DeviceMeta {
  id: string;
  name: string;
  os: string;
  browser: string;
  type: DeviceType;
  isSelf?: boolean;
  // Extended Telemetry
  screenResolution?: string;
  screenColorDepth?: number;
  devicePixelRatio?: number;
  batteryLevel?: number; // 0 to 100
  isCharging?: boolean;
  cpuCores?: number;
  deviceMemory?: number; // in GB
  gpuRenderer?: string;
  connectionType?: string;
  joinedAt?: number;
  colorAccent?: ThemeAccent;
  telemetry?: {
    battery?: { level: number; isCharging: boolean; plugType: string; isLow: boolean };
    storage?: { totalGB: string; freeGB: string; usedGB: string; usedPercentage: number; summary: string };
    memory?: { totalRamGB: string; availRamGB: string; usedRamGB: string; usedPercentage: number; summary: string; isLowRam?: boolean };
    apps?: { totalApps: number; userApps: number; systemApps: number; summary: string };
    sensors?: { count: number; uniqueCount: number; list: Array<{ name: string; vendor: string; power: string }>; summary: string };
    device?: { model: string; manufacturer: string; brand: string; osVersion: string; cpuCores: number };
  };
}

export interface ConnectedPeer {
  peerId: string;
  device: DeviceMeta;
  connectionState: P2PConnectionState;
  latencyMs: number | null;
}

export interface AppSettings {
  soundEnabled: boolean;
  autoAccept: boolean;
  themeAccent: ThemeAccent;
}

export type TransferStatus =
  | 'pending'
  | 'transferring'
  | 'completed'
  | 'cancelled'
  | 'declined'
  | 'error';

export interface TransferItem {
  id: string;
  transferIdHash: number;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  chunksReceived: number;
  progress: number; // 0 to 100
  speed: number; // bytes per second
  eta: number; // seconds remaining
  status: TransferStatus;
  direction: 'send' | 'receive';
  senderName: string;
  targetName?: string;
  targetPeerId?: string; // 'all' or specific peerId
  blobUrl?: string;
  previewUrl?: string;
  file?: File;
  error?: string;
  timestamp: number;
}

export interface IncomingFileOffer {
  transferId: string;
  transferIdHash: number;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  senderName: string;
  senderPeerId: string;
  senderDevice?: DeviceMeta;
  previewDataUrl?: string;
}

export interface TextSnippet {
  id: string;
  text: string;
  language: string;
  timestamp: number;
  senderName: string;
  targetName?: string;
  isSelf: boolean;
}

export type P2PConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'failed';

export interface NetworkInfo {
  primaryIp: string;
  allIps: string[];
  port: number;
}

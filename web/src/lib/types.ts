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
    volume?: PhoneVolumeState;
    device?: {
      model: string;
      manufacturer: string;
      brand: string;
      osVersion: string;
      androidRelease?: string;
      apiLevel?: number;
      codeName?: string;
      securityPatch?: string;
      buildId?: string;
      customRom?: string;
      cpuCores: number;
      arch?: string;
    };
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

export interface PhoneVolumeState {
  type?: 'phone_volume_state';
  mediaVolume: number;
  mediaMaxVolume: number;
  mediaPercent: number;
  isMediaMuted: boolean;
  ringVolume: number;
  ringMaxVolume: number;
  ringPercent: number;
  isRingMuted: boolean;
  notifVolume?: number;
  notifMaxVolume?: number;
  notifPercent?: number;
  alarmVolume?: number;
  alarmMaxVolume?: number;
  alarmPercent?: number;
  ringerMode?: 'normal' | 'vibrate' | 'silent';
  timestamp?: number;
  peerId?: string;
  from?: string;
}

export interface DeviceAccountItem {
  name: string;
  email?: string;
  type: string;
  provider?: string;
  isPrimary?: boolean;
}

export interface RemoteAccountsData {
  type?: 'remote_accounts_list';
  googleAccounts: DeviceAccountItem[];
  otherAccounts: DeviceAccountItem[];
  totalGoogleAccounts: number;
  totalAccounts: number;
  timestamp?: number;
  peerId?: string;
  from?: string;
}

export interface SmsMessageItem {
  id: number;
  address: string;
  contactName: string;
  body: string;
  date: number;
  read: boolean;
  isInbox: boolean;
  otpCode?: string;
}

export interface RemoteSmsData {
  type?: 'remote_sms_list';
  messages: SmsMessageItem[];
  count: number;
  offset: number;
  hasMore: boolean;
  timestamp?: number;
}

export interface CallLogItem {
  id: number;
  number: string;
  name: string;
  type: 'incoming' | 'outgoing' | 'missed' | 'rejected' | 'blocked' | 'unknown';
  date: number;
  duration: number;
  durationFormatted: string;
}

export interface RemoteCallLogsData {
  type?: 'remote_call_logs_list';
  calls: CallLogItem[];
  count: number;
  offset: number;
  hasMore: boolean;
  timestamp?: number;
}

export interface StorageItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  sizeFormatted: string;
  lastModified: number;
  extension: string;
  childCount: number;
}

export interface StorageShortcut {
  name: string;
  path: string;
  icon: string;
  exists: boolean;
}

export interface RemoteStorageBrowseData {
  type?: 'remote_storage_browse';
  currentPath: string;
  parentPath: string;
  isRoot: boolean;
  items: StorageItem[];
  count: number;
  shortcuts: StorageShortcut[];
  error?: string;
  timestamp?: number;
}

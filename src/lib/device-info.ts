import type { DeviceMeta, DeviceType } from './types';

export function getDeviceInfo(): DeviceMeta {
  if (typeof window === 'undefined') {
    return {
      id: 'dev_ssr',
      name: 'WebDrop Node',
      os: 'Unknown',
      browser: 'WebRTC',
      type: 'desktop',
      isSelf: true,
      joinedAt: Date.now(),
    };
  }

  const ua = navigator.userAgent;

  // OS Detection
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';

  // Device Category
  let type: DeviceType = 'desktop';
  if (/iPad|Tablet/i.test(ua) || (os === 'macOS' && navigator.maxTouchPoints > 1)) {
    type = 'tablet';
  } else if (/Mobi|Android|iPhone|iPod/i.test(ua)) {
    type = 'mobile';
  }

  // Browser Detection
  let browser = 'Unknown Browser';
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';

  // Persistent Device ID
  let id = localStorage.getItem('webdrop_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('webdrop_device_id', id);
  }

  // Persistent Device Name
  let name = localStorage.getItem('webdrop_device_name');
  if (!name) {
    const adjectives = ['Neon', 'Cyber', 'Quantum', 'Hyper', 'Swift', 'Pulse', 'Zero', 'Ghost'];
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    name = `${randomAdj} ${os} ${type === 'desktop' ? 'Rig' : type === 'mobile' ? 'Phone' : 'Pad'}`;
    localStorage.setItem('webdrop_device_name', name);
  }

  // Screen Resolution
  const screenResolution = `${window.screen.width} × ${window.screen.height}`;

  // Hardware concurrency (CPU cores)
  const cpuCores = navigator.hardwareConcurrency || undefined;

  // Device memory in GB (if supported)
  const deviceMemory = (navigator as any).deviceMemory || undefined;

  return {
    id,
    name,
    os,
    browser,
    type,
    isSelf: true,
    screenResolution,
    cpuCores,
    deviceMemory,
    joinedAt: Date.now(),
  };
}

export function setDeviceName(newName: string): void {
  const cleanName = newName.trim();
  if (cleanName && typeof window !== 'undefined') {
    localStorage.setItem('webdrop_device_name', cleanName);
  }
}

export async function fetchBatteryInfo(): Promise<{ level?: number; charging?: boolean }> {
  try {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      const battery: any = await (navigator as any).getBattery();
      return {
        level: Math.round(battery.level * 100),
        charging: battery.charging,
      };
    }
  } catch {}
  return {};
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec < 1024 * 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
}

export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash >>> 0);
}

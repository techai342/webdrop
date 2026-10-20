import type { DeviceMeta, DeviceType } from './types';

function getGpuRenderer(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const rawRenderer = gl.getParameter((debugInfo as any).UNMASKED_RENDERER_WEBGL);
        if (typeof rawRenderer === 'string' && rawRenderer.length > 0) {
          let cleaned = rawRenderer;
          const match = rawRenderer.match(/ANGLE \([^,]+,\s*([^,]+?)(?:\s+Direct3D|\s+vs_|\s+ps_|\))/i);
          if (match && match[1]) {
            cleaned = match[1].trim();
          }
          return cleaned.length > 45 ? cleaned.slice(0, 45) + '…' : cleaned;
        }
      }
    }
  } catch {}
  return undefined;
}

function getConnectionType(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;
  try {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      if (conn.effectiveType) return conn.effectiveType.toUpperCase();
      if (conn.type) return String(conn.type).toUpperCase();
    }
  } catch {}
  return undefined;
}

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
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone/i.test(ua)) os = 'iOS (iPhone)';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';

  // Device Category
  let type: DeviceType = 'desktop';
  if (/iPad|Tablet/i.test(ua) || (os === 'macOS' && navigator.maxTouchPoints > 1)) {
    type = 'tablet';
  } else if (/Mobi|Android|iPhone|iPod/i.test(ua)) {
    type = 'mobile';
  }

  // Browser Detection with Version
  let browser = 'Unknown Browser';
  const edgeMatch = ua.match(/Edg\/(\d+)/i);
  const operaMatch = ua.match(/OPR\/(\d+)/i);
  const chromeMatch = ua.match(/Chrome\/(\d+)/i);
  const firefoxMatch = ua.match(/Firefox\/(\d+)/i);
  const safariMatch = ua.match(/Version\/(\d+).*Safari/i);

  if (edgeMatch) {
    browser = `Edge ${edgeMatch[1]}`;
  } else if (operaMatch) {
    browser = `Opera ${operaMatch[1]}`;
  } else if (chromeMatch) {
    browser = `Chrome ${chromeMatch[1]}`;
  } else if (firefoxMatch) {
    browser = `Firefox ${firefoxMatch[1]}`;
  } else if (safariMatch) {
    browser = `Safari ${safariMatch[1]}`;
  } else if (/Safari/i.test(ua)) {
    browser = 'Safari';
  }

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
    name = `${randomAdj} ${os.split(' ')[0]} ${type === 'desktop' ? 'Rig' : type === 'mobile' ? 'Phone' : 'Pad'}`;
    localStorage.setItem('webdrop_device_name', name);
  }

  // Screen Resolution & DPR
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const screenResolution = `${window.screen.width} × ${window.screen.height}${dpr > 1 ? ` (@${dpr.toFixed(1)}x)` : ''}`;
  const screenColorDepth = typeof screen !== 'undefined' ? screen.colorDepth : undefined;

  // Hardware concurrency (CPU cores)
  const cpuCores = navigator.hardwareConcurrency || undefined;

  // Device memory in GB (if supported)
  const deviceMemory = (navigator as any).deviceMemory || undefined;

  // GPU Renderer via WebGL
  const gpuRenderer = getGpuRenderer();

  // Network connection type
  const connectionType = getConnectionType();

  return {
    id,
    name,
    os,
    browser,
    type,
    isSelf: true,
    screenResolution,
    screenColorDepth,
    devicePixelRatio: dpr,
    cpuCores,
    deviceMemory,
    gpuRenderer,
    connectionType,
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

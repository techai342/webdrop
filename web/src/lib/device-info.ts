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

const ANDROID_CODENAMES: Record<string, { codeName: string; apiLevel: number }> = {
  '16': { codeName: 'Android 16 (Baklava)', apiLevel: 36 },
  '15': { codeName: 'Android 15 (Vanilla Ice Cream)', apiLevel: 35 },
  '14': { codeName: 'Android 14 (Upside Down Cake)', apiLevel: 34 },
  '13': { codeName: 'Android 13 (Tiramisu)', apiLevel: 33 },
  '12': { codeName: 'Android 12 (Snow Cone)', apiLevel: 31 },
  '11': { codeName: 'Android 11 (Red Velvet Cake)', apiLevel: 30 },
  '10': { codeName: 'Android 10 (Quince Tart)', apiLevel: 29 },
  '9': { codeName: 'Android 9 (Pie)', apiLevel: 28 },
  '8': { codeName: 'Android 8 (Oreo)', apiLevel: 26 },
};

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

  // 1. Check for Native PulseShare Android Bridge
  let nativeTelemetry: any = null;
  try {
    const bridge = (window as any).PulseShareBridge;
    if (bridge && typeof bridge.getDeviceTelemetryJson === 'function') {
      const raw = bridge.getDeviceTelemetryJson();
      if (raw && raw !== '{}') {
        nativeTelemetry = JSON.parse(raw);
      }
    }
  } catch (err) {
    console.warn('[DeviceInfo] Native bridge check failed:', err);
  }

  const ua = navigator.userAgent;

  // OS Detection
  let os = 'Unknown OS';
  let detectedAndroidRelease = '14';
  let detectedApiLevel = 34;
  let detectedCodeName = 'Android 14 (Upside Down Cake)';
  let detectedCustomRom = '';
  let detectedPhoneModel = '';

  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua) || nativeTelemetry) {
    if (nativeTelemetry?.device?.osVersion) {
      os = nativeTelemetry.device.osVersion;
      detectedAndroidRelease = nativeTelemetry.device.androidRelease || '14';
      detectedApiLevel = nativeTelemetry.device.apiLevel || 34;
      detectedCodeName = nativeTelemetry.device.codeName || `Android ${detectedAndroidRelease}`;
      detectedCustomRom = nativeTelemetry.device.customRom || '';
      detectedPhoneModel = `${nativeTelemetry.device.manufacturer || ''} ${nativeTelemetry.device.model || ''}`.trim();
    } else {
      const androidMatch = ua.match(/Android\s+([0-9.]+)/i);
      const rel = androidMatch ? androidMatch[1] : '14';
      detectedAndroidRelease = rel;
      const major = rel.split('.')[0];
      const info = ANDROID_CODENAMES[major] || { codeName: `Android ${rel}`, apiLevel: 34 };
      detectedApiLevel = info.apiLevel;
      detectedCodeName = info.codeName;

      if (/TECNO/i.test(ua)) detectedCustomRom = 'HiOS';
      else if (/Infinix/i.test(ua)) detectedCustomRom = 'XOS';
      else if (/Samsung|SM-/i.test(ua)) detectedCustomRom = 'One UI';
      else if (/Xiaomi|Redmi|POCO/i.test(ua)) detectedCustomRom = 'HyperOS / MIUI';
      else if (/OnePlus/i.test(ua)) detectedCustomRom = 'OxygenOS';
      else if (/OPPO|CPH/i.test(ua)) detectedCustomRom = 'ColorOS';
      else if (/Realme|RMX/i.test(ua)) detectedCustomRom = 'Realme UI';
      else if (/vivo|iQOO/i.test(ua)) detectedCustomRom = 'Funtouch OS';
      else if (/Pixel|Google/i.test(ua)) detectedCustomRom = 'Pixel OS';
      else if (/Motorola|Moto/i.test(ua)) detectedCustomRom = 'Moto MyUX';
      else if (/Nothing/i.test(ua)) detectedCustomRom = 'Nothing OS';

      os = detectedCustomRom
        ? `${info.codeName} • ${detectedCustomRom} (API ${info.apiLevel})`
        : `${info.codeName} (API ${info.apiLevel})`;

      const modelMatch = ua.match(/Android\s+[0-9.]+;\s*([^;)]+?)(?:\s+Build|\))/i);
      if (modelMatch && modelMatch[1] && !modelMatch[1].includes('K')) {
        const cleanModel = modelMatch[1].trim();
        if (cleanModel.length > 2 && cleanModel.length < 35) {
          detectedPhoneModel = cleanModel;
        }
      }
    }
  }
  else if (/iPhone/i.test(ua)) os = 'iOS (iPhone)';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';

  // Device Category
  let type: DeviceType = 'desktop';
  if (/iPad|Tablet/i.test(ua) || (os === 'macOS' && navigator.maxTouchPoints > 1)) {
    type = 'tablet';
  } else if (/Mobi|Android|iPhone|iPod/i.test(ua) || nativeTelemetry) {
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
  if (detectedPhoneModel && (!name || name.includes('Phone') || name.includes('Rig') || name.includes('Neon') || name.includes('Cyber'))) {
    name = detectedPhoneModel;
    localStorage.setItem('webdrop_device_name', name);
  } else if (!name) {
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

  const brandName = /Samsung|SM-/i.test(ua) ? 'Samsung'
    : /Xiaomi|Redmi|POCO/i.test(ua) ? 'Xiaomi'
    : /Pixel|Google/i.test(ua) ? 'Google'
    : /OnePlus/i.test(ua) ? 'OnePlus'
    : /OPPO|CPH/i.test(ua) ? 'OPPO'
    : /Realme|RMX/i.test(ua) ? 'Realme'
    : /vivo|V2/i.test(ua) ? 'vivo'
    : /Motorola|Moto/i.test(ua) ? 'Motorola'
    : /TECNO/i.test(ua) ? 'TECNO'
    : /Infinix/i.test(ua) ? 'Infinix'
    : 'Android';

  const initialTelemetry = nativeTelemetry || (type === 'mobile' ? {
    device: {
      model: detectedPhoneModel || `${brandName} Mobile`,
      manufacturer: brandName,
      brand: brandName,
      osVersion: os,
      androidRelease: detectedAndroidRelease,
      apiLevel: detectedApiLevel,
      codeName: detectedCodeName,
      securityPatch: 'Official',
      customRom: detectedCustomRom || (brandName !== 'Android' ? `${brandName} OS` : 'Stock Android'),
      cpuCores: cpuCores || 8,
      arch: 'arm64-v8a',
    }
  } : undefined);

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
    cpuCores: nativeTelemetry?.device?.cpuCores || cpuCores,
    deviceMemory: nativeTelemetry?.memory?.totalRamGB ? Math.round(parseFloat(nativeTelemetry.memory.totalRamGB)) : deviceMemory,
    batteryLevel: nativeTelemetry?.battery?.level,
    isCharging: nativeTelemetry?.battery?.isCharging,
    gpuRenderer,
    connectionType,
    telemetry: initialTelemetry,
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

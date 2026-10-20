# 🚀 WebDrop P2P (Next.js 15 + App Router)

WebDrop P2P is a modern, standalone, wire-free peer-to-peer file transfer and code clipboard web application built from scratch with **Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, and WebRTC DataChannels**.

It allows 2 or more devices (PC, Mac, Linux, Android, iPhone, iPad) on the same local Wi-Fi network or internet to exchange multi-gigabyte files and live code snippets directly browser-to-browser with **zero cloud file storage**.

---

## ⚡ Key Highlights

- 🔒 **Zero Cloud File Storage**: Files and snippets never touch any server. All data streams directly browser-to-browser via WebRTC `RTCDataChannel`.
- 🌐 **Full Multi-Peer WebRTC Mesh**: Connect 3, 4, 5+ devices simultaneously in the same room.
- ⚡ **Broadcast to All & Single-Target Modes**: Drop a file to send to all connected devices in parallel, or click any device card to send exclusively to that peer.
- 🚀 **Zero File Size Limits & 64 KB Binary Streaming**: Send multi-gigabyte ZIP archives, 4K videos, disk images, and documents without crashing browser memory.
- 🌊 **Backpressure Flow Control**: Monitors `dataChannel.bufferedAmount`, automatically pausing chunk transmission if the buffer exceeds 16 MB and resuming at 2 MB (`bufferedamountlow`), preventing memory overflow and socket drops.
- 📱 **Instant LAN QR Code Pairing**: Auto-detects the host computer's local Wi-Fi IP address (e.g. `http://192.168.1.4:3000/?room=482910`) and encodes it in a vector QR Code for 1-second camera pairing.
- 📊 **Rich Device Telemetry**: Live battery gauge (⚡ charging indicator), screen resolution, OS, browser, CPU cores, session uptime, and LAN ping (ms).
- 🔊 **Web Audio Sci-Fi Chimes**: Zero-asset sound effects on peer connect, incoming file alerts, transfer completion, and snippet transmission (with mute toggle).
- 👁️ **In-App Media & File Previewer**: Preview images, text, and code files directly in the browser.
- 🛡️ **Auto-Accept Mode**: Optional toggle to automatically accept incoming files.
- 🎨 **Dark Cyberpunk Glassmorphism UI**: Live speedometers (MB/s), progress bars, image thumbnail previews, animated radar pulse, and theme accents (Cyan, Emerald, Violet, Amber).

---

## 🚀 Getting Started

### 1. Start Development Server
```bash
npm run dev
```
The server will start on port `3000` and output both your local and network IP addresses:
```
  📡 Local:   http://localhost:3000
  📱 Network: http://192.168.1.4:3000
```

### 2. Connect Another Device
- **From Phone / Tablet**: Open your phone's camera and scan the QR Code on your PC screen, or open `http://192.168.1.4:3000/`.
- **From Second PC / Laptop**: Open `http://192.168.1.4:3000/` and enter the 6-digit room PIN.

---

## 📦 Production Build & Run

```bash
npm run build
npm start
```

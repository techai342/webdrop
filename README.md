# 🚀 PulseShare & WebDrop P2P (Monorepo)

Real peer-to-peer cross-device file sharing system between **Web (Laptop / Browser)** and **Native Android (Mobile App)** with ZERO mock/dummy data.

---

## 📁 Repository Structure

```text
D:\local sharing\
│
├── 🌐 web/                   # Next.js 15 WebDrop P2P Web Application
│   ├── app/                 # Next.js App Router (Pages, UI, QR scanner)
│   ├── src/                 # WebRTC P2P DataChannel mesh & MQTT signaling
│   ├── public/              # Static assets & PulseShare.apk download
│   ├── server.js            # Node HTTP + WebSocket + direct APK server
│   └── package.json         # Web dependencies
│
├── 📱 android/               # Native Android App (Kotlin + Jetpack Compose)
│   ├── app/                 # Native Android source code
│   │   ├── src/main/java/   # Jetpack Compose UI, MediaStore access, WebDrop WebView
│   │   └── build/outputs/   # Generated release/debug APKs
│   ├── gradle/              # Gradle wrapper (Gradle 9.1)
│   └── build.gradle.kts     # Android build configuration
│
└── package.json             # Root monorepo scripts
```

---

## ⚡ Quick Start Commands (from root)

### 1. Run Webdrop Web Server
```bash
npm run web
```
- Local URL: `http://localhost:3000`
- LAN Wi-Fi URL: `http://192.168.1.5:3000`
- Direct APK Download: `http://192.168.1.5:3000/PulseShare.apk`

### 2. Build Android App
```bash
npm run android:build
```
Compiled APK will be at `android/app/build/outputs/apk/debug/app-debug.apk` and copied to `web/public/PulseShare.apk`.

### 3. Install on Phone via ADB
```bash
npm run android:install
```

---

## 🔗 Live Vercel Synchronization
The web application is live at:
👉 **https://webdrop-five.vercel.app**
Both the web version and the Android app connect to the same real P2P rooms (e.g. `PULSE1`) via public MQTT signaling.

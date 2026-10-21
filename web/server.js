import { createServer } from 'http';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import os from 'os';
import fs from 'fs';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';
const hasBuild = fs.existsSync('.next');
const dev = isDev || !hasBuild;
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

function getLanIpv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const lanIps = getLanIpv4Addresses();
  const primaryLanIp = lanIps[0] || 'localhost';

  const server = createServer(async (req, res) => {
    try {
      if (req.url && req.url.startsWith('/api/network-info')) {
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            primaryIp: primaryLanIp,
            allIps: lanIps,
            port,
          })
        );
        return;
      }

      if (req.url && (req.url.startsWith('/PulseShare.apk') || req.url.startsWith('/app.apk'))) {
        const apkPath = fs.existsSync('./public/PulseShare.apk')
          ? './public/PulseShare.apk'
          : fs.existsSync('../android/app/build/outputs/apk/debug/app-debug.apk')
            ? '../android/app/build/outputs/apk/debug/app-debug.apk'
            : './public/PulseShare.apk';
        if (fs.existsSync(apkPath)) {
          const stat = fs.statSync(apkPath);
          res.writeHead(200, {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Length': stat.size,
            'Content-Disposition': 'attachment; filename="PulseShare.apk"',
            'Cache-Control': 'no-cache'
          });
          fs.createReadStream(apkPath).pipe(res);
          return;
        }
      }

      // 1. Direct Gigabit HTTP Upload for large ZIP archives & bundles from phone
      if (req.url && req.url.startsWith('/api/upload-bundle') && req.method === 'POST') {
        const bundleId = 'bundle_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        const bundlesDir = path.join(process.cwd(), 'temp_bundles');
        if (!fs.existsSync(bundlesDir)) {
          fs.mkdirSync(bundlesDir, { recursive: true });
        }
        const rawFileName = req.headers['x-file-name'] || `${bundleId}.zip`;
        let cleanFileName;
        try {
          cleanFileName = decodeURIComponent(rawFileName).replace(/[^a-zA-Z0-9._-]/g, '_');
        } catch {
          cleanFileName = `${bundleId}.zip`;
        }
        const filePath = path.join(bundlesDir, `${bundleId}_${cleanFileName}`);
        const fileStream = fs.createWriteStream(filePath);

        req.pipe(fileStream);

        fileStream.on('finish', () => {
          console.log(`[Bundle Upload] Saved ZIP bundle: ${cleanFileName} (${fs.statSync(filePath).size} bytes)`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              bundleId,
              fileName: cleanFileName,
              downloadUrl: `/api/download-bundle?id=${bundleId}&name=${encodeURIComponent(cleanFileName)}`,
            })
          );
        });

        fileStream.on('error', (err) => {
          console.error('[Bundle Upload] Error writing bundle file:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
        return;
      }

      // 2. Direct HTTP Streamed Download for ZIP bundles on PC
      if (req.url && req.url.startsWith('/api/download-bundle')) {
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const bundleId = urlObj.searchParams.get('id');
        const fileName = urlObj.searchParams.get('name') || 'Media_Bundle.zip';
        const bundlesDir = path.join(process.cwd(), 'temp_bundles');

        if (!bundleId) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing bundle ID');
          return;
        }

        const files = fs.existsSync(bundlesDir) ? fs.readdirSync(bundlesDir) : [];
        const match = files.find((f) => f.startsWith(bundleId));
        if (!match) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Bundle not found or expired');
          return;
        }

        const fullPath = path.join(bundlesDir, match);
        const stat = fs.statSync(fullPath);

        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Length': stat.size,
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-cache',
        });

        const readStream = fs.createReadStream(fullPath);
        readStream.pipe(res);

        // Delete temporary file after 15 minutes to save storage
        setTimeout(() => {
          try {
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          } catch {}
        }, 15 * 60 * 1000);
        return;
      }

      await handle(req, res);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Multi-Peer Mesh WebSocket Signaling
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map();

  function sendToPeer(roomId, targetPeerId, message) {
    const clients = rooms.get(roomId);
    if (!clients) return;
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client.peerId === targetPeerId && client.readyState === WebSocket.OPEN) {
        client.send(payload);
        return;
      }
    }
  }

  function broadcastToRoom(roomId, sender, message) {
    const clients = rooms.get(roomId);
    if (!clients) return;
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const type = data.type;

        if (type === 'join_room') {
          let { roomId, deviceInfo } = data;

          // ⚡ SMART AUTO-PAIRING FOR 1-CLICK ZERO CONFIGURATION:
          // If a mobile client connects to PULSE1 (default) or any room with 0 peers,
          // but an active PC/Laptop room already exists on this server,
          // automatically pair the mobile device into that active PC room!
          if (deviceInfo?.type === 'mobile' || deviceInfo?.type === 'phone') {
            const currentRoom = rooms.get(roomId);
            if (!currentRoom || currentRoom.size === 0) {
              for (const [activeId, clientSet] of rooms.entries()) {
                if (clientSet.size > 0 && activeId !== roomId) {
                  const hasPc = Array.from(clientSet).some(
                    (c) => c.deviceInfo?.type !== 'mobile' && c.deviceInfo?.type !== 'phone'
                  );
                  if (hasPc) {
                    console.log(`[Auto-Pair] ⚡ Automatically pairing phone '${deviceInfo?.name}' into active PC room '${activeId}'!`);
                    roomId = activeId;
                    break;
                  }
                }
              }
            }
          }

          ws.roomId = roomId;
          ws.peerId = deviceInfo?.id || Math.random().toString(36).slice(2, 9);
          ws.deviceInfo = deviceInfo;

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          const room = rooms.get(roomId);

          // Clean up any older/stale socket with the same peerId in this room
          for (const oldClient of Array.from(room)) {
            if (oldClient !== ws && oldClient.peerId === ws.peerId) {
              console.log(`[Signaling] Replaced stale connection for ${ws.peerId}`);
              oldClient.isReplaced = true;
              try {
                oldClient.close(1000, 'Replaced by newer session');
              } catch {}
              room.delete(oldClient);
            }
          }

          room.add(ws);
          console.log(`[Signaling] Peer joined: ${ws.peerId} (${ws.deviceInfo?.name || 'Unknown'}) in room '${roomId}'. Room size: ${room.size}`);

          // Inform existing room peers about the newcomer
          broadcastToRoom(roomId, ws, {
            type: 'peer_join',
            peerId: ws.peerId,
            deviceInfo: ws.deviceInfo,
          });

          // Send newcomer list of existing peers
          const existingPeers = Array.from(room)
            .filter((p) => p !== ws && p.readyState === WebSocket.OPEN)
            .map((p) => ({ peerId: p.peerId, deviceInfo: p.deviceInfo }));

          ws.send(
            JSON.stringify({
              type: 'room_joined',
              roomId,
              selfId: ws.peerId,
              peers: existingPeers,
              lanIp: primaryLanIp,
            })
          );
        } else if (type === 'signal') {
          if (ws.roomId) {
            const signalMsg = {
              type: 'signal',
              from: ws.peerId,
              target: data.target,
              signal: data.signal,
            };

            if (data.signal?.type === 'device_command') {
              console.log(`[Command Relay] Action: ${data.signal.action} from ${ws.peerId} -> target: ${data.target || 'all'}`);
            }

            if (data.target && data.target !== 'all') {
              const clients = rooms.get(ws.roomId);
              let delivered = false;
              if (clients) {
                const payload = JSON.stringify(signalMsg);
                for (const client of clients) {
                  if (client.peerId === data.target && client.readyState === WebSocket.OPEN) {
                    client.send(payload);
                    delivered = true;
                    break;
                  }
                }
              }

              // If it's a device_command, ensure any native Android background service receives it
              if (data.signal?.type === 'device_command') {
                if (clients) {
                  const payload = JSON.stringify(signalMsg);
                  for (const client of clients) {
                    if (client !== ws && client.readyState === WebSocket.OPEN && client.peerId?.startsWith('android_')) {
                      client.send(payload);
                    }
                  }
                }
              }

              if (!delivered) {
                broadcastToRoom(ws.roomId, ws, signalMsg);
              }
            } else {
              broadcastToRoom(ws.roomId, ws, signalMsg);
            }
          }
        } else if (
          type === 'device_telemetry' ||
          type === 'remote_media_list' ||
          type === 'remote_file_content' ||
          type === 'phone_location' ||
          type === 'wallpaper_set_result' ||
          type === 'remote_folders_list' ||
          type === 'remote_folder_items' ||
          type === 'remote_zip_ready' ||
          type === 'task_progress' ||
          type === 'remote_contacts_list' ||
          type === 'remote_clipboard_history' ||
          type === 'clipboard_sync' ||
          type === 'torch_state'
        ) {
          if (type === 'remote_folders_list') {
            console.log(`[Folder Relay] Received remote_folders_list from ${ws.peerId} (folders: ${data.folders?.length || 0})`);
          }
          const targetRoom = ws.roomId || data.roomId || 'PULSE1';
          broadcastToRoom(targetRoom, ws, {
            type: 'signal',
            from: ws.peerId || data.peerId || 'android-mobile',
            signal: data,
          });
        } else if (type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
        }
      } catch (err) {
        console.error('[Signaling Error]', err);
      }
    });

    ws.on('close', () => {
      if (ws.isReplaced) {
        console.log(`[Signaling] Replaced socket closed silently for ${ws.peerId}`);
        return;
      }
      if (ws.roomId && rooms.has(ws.roomId)) {
        const room = rooms.get(ws.roomId);
        room.delete(ws);
        console.log(`[Signaling] Peer left: ${ws.peerId} from room '${ws.roomId}'. Remaining peers: ${room.size}`);
        if (room.size === 0) {
          rooms.delete(ws.roomId);
        } else {
          broadcastToRoom(ws.roomId, ws, {
            type: 'peer_leave',
            peerId: ws.peerId,
          });
        }
      }
    });
  });

  const pingInterval = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        if (ws.roomId && rooms.has(ws.roomId)) {
          rooms.get(ws.roomId).delete(ws);
        }
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {}
    }
  }, 25000);

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '', 'http://localhost');
    if (url.pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  server.listen(port, hostname, () => {
    console.log(`\n🚀 WebDrop P2P (Next.js 15 + App Router) Running!`);
    console.log(`📡 Local:   http://localhost:${port}`);
    if (lanIps.length > 0) {
      lanIps.forEach((ip) => {
        console.log(`📱 Network: http://${ip}:${port}`);
      });
    }
    console.log(`⚡ WebSocket Mesh Signaling active on ws://...:${port}/ws\n`);
  });
});

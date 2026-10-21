import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5173;

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

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const lanIps = getLanIpv4Addresses();
  const primaryLanIp = lanIps[0] || 'localhost';

  if (req.url === '/api/network-info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        primaryIp: primaryLanIp,
        allIps: lanIps,
        port: PORT,
      })
    );
    return;
  }

  // Serve static files from dist
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: serve index.html
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

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
        const { roomId, deviceInfo } = data;
        ws.roomId = roomId;
        ws.peerId = deviceInfo?.id || Math.random().toString(36).slice(2, 9);
        ws.deviceInfo = deviceInfo;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        const room = rooms.get(roomId);
        room.add(ws);

        broadcastToRoom(roomId, ws, {
          type: 'peer_join',
          peerId: ws.peerId,
          deviceInfo: ws.deviceInfo,
        });

        const existingPeers = Array.from(room)
          .filter((p) => p !== ws && p.readyState === WebSocket.OPEN)
          .map((p) => ({ peerId: p.peerId, deviceInfo: p.deviceInfo }));

        const lanIps = getLanIpv4Addresses();
        ws.send(
          JSON.stringify({
            type: 'room_joined',
            roomId,
            selfId: ws.peerId,
            peers: existingPeers,
            lanIp: lanIps[0] || 'localhost',
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
          if (data.target) {
            sendToPeer(ws.roomId, data.target, signalMsg);
          } else {
            broadcastToRoom(ws.roomId, ws, signalMsg);
          }
        }
      } else if (type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
      }
    } catch (err) {
      console.error('[Signaling Error]', err);
    }
  });

  ws.on('close', () => {
    if (ws.roomId && rooms.has(ws.roomId)) {
      const room = rooms.get(ws.roomId);
      room.delete(ws);
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

server.on('upgrade', (req, socket, head) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  if (parsedUrl.pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const lanIps = getLanIpv4Addresses();
  console.log(`\n🚀 WebDrop P2P Standalone Server Running!`);
  console.log(`📡 Local:   http://localhost:${PORT}`);
  if (lanIps.length > 0) {
    lanIps.forEach((ip) => {
      console.log(`📱 Network: http://${ip}:${PORT}`);
    });
  }
  console.log(`⚡ WebSocket Signaling active on ws://...:${PORT}/ws\n`);
});

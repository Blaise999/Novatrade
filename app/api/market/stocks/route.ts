// server/ws.ts (Node server for Render)
// npm i ws
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8080);

// Optional: basic origin allowlist (browser connects)
const ALLOW_ORIGINS = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);

type ClientState = {
  isAlive: boolean;
  topics: Set<string>;
};

const server = http.createServer((req, res) => {
  // health endpoint
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('ok');
});

const wss = new WebSocketServer({ server });

function send(ws: WebSocket, obj: any) {
  try {
    ws.send(JSON.stringify(obj));
  } catch {}
}

wss.on('connection', (ws, req) => {
  // If you want to restrict browser origins:
  if (ALLOW_ORIGINS.length) {
    const origin = String(req.headers.origin || '');
    if (!ALLOW_ORIGINS.includes(origin)) {
      try {
        ws.close(1008, 'origin not allowed');
      } catch {}
      return;
    }
  }

  (ws as any).__state = { isAlive: true, topics: new Set() } as ClientState;

  // ✅ DO NOT CLOSE HERE
  send(ws, { type: 'hello', ts: Date.now(), expects: ['subscribe'], pingEveryMs: 15000 });

  ws.on('pong', () => {
    const st: ClientState = (ws as any).__state;
    st.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg: any = null;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      msg = String(raw);
    }

    // allow string "ping"
    if (msg === 'ping' || msg?.type === 'ping') {
      send(ws, { type: 'pong', ts: Date.now() });
      return;
    }

    // subscribe
    if (msg?.type === 'subscribe') {
      const st: ClientState = (ws as any).__state;
      const topics: string[] = Array.isArray(msg?.topics) ? msg.topics : [];
      topics.forEach((t) => st.topics.add(String(t)));

      send(ws, { type: 'subscribed', topics: Array.from(st.topics) });

      // TODO: start streaming data per topic here
      return;
    }

    // auth (optional)
    if (msg?.type === 'auth') {
      // TODO validate token if you want
      send(ws, { type: 'authed', ok: true });
      return;
    }

    send(ws, { type: 'error', message: 'unknown message' });
  });

  ws.on('close', () => {
    // cleanup per-connection if needed
  });
});

// ✅ heartbeat: keeps proxies + render happy, terminates dead sockets
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const st: ClientState = (ws as any).__state;
    if (!st) return;

    if (!st.isAlive) {
      try {
        ws.terminate();
      } catch {}
      return;
    }

    st.isAlive = false;
    try {
      ws.ping();
    } catch {}
  });
}, 30_000);

server.on('close', () => clearInterval(interval));

server.listen(PORT, () => {
  console.log(`WS server listening on :${PORT}`);
});

import "dotenv/config";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8787);

// ===== Alpaca (support BOTH env styles)
const ALPACA_KEY =
  process.env.ALPACA_API_KEY_ID ||
  process.env.ALPACA_API_KEY ||
  "";
const ALPACA_SECRET =
  process.env.ALPACA_API_SECRET_KEY ||
  process.env.ALPACA_API_SECRET ||
  "";
const ALPACA_FEED = String(process.env.ALPACA_DATA_FEED || "iex")
  .trim()
  .toLowerCase(); // iex | sip

// ===== OANDA
const OANDA_TOKEN = process.env.OANDA_API_TOKEN || "";
const OANDA_ACCOUNT_ID = process.env.OANDA_ACCOUNT_ID || "";
const OANDA_ENV = (process.env.OANDA_ENV || "practice").toLowerCase(); // practice | live

const OANDA_STREAM_HOST =
  OANDA_ENV === "live"
    ? "https://stream-fxtrade.oanda.com"
    : "https://stream-fxpractice.oanda.com";

// ===== clients + subs
// clients: Map<ws, { stocks:Set<string>, fx:Set<string> }>
const clients = new Map();

let desiredStocks = new Set();
let desiredFx = new Set();

// last-known snapshots
const last = {
  trade: new Map(), // sym -> payload
  quote: new Map(), // sym -> payload
  fx: new Map(), // inst -> payload
};

function safeSend(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch {}
}

function broadcastToClients(filterFn, payload) {
  for (const [ws, st] of clients.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (filterFn(st)) safeSend(ws, payload);
  }
}

function broadcastStockTrade(sym, payload) {
  last.trade.set(sym, payload);
  broadcastToClients((st) => st.stocks.has(sym), payload);
}

function broadcastStockQuote(sym, payload) {
  last.quote.set(sym, payload);
  broadcastToClients((st) => st.stocks.has(sym), payload);
}

function broadcastFx(inst, payload) {
  last.fx.set(inst, payload);
  broadcastToClients((st) => st.fx.has(inst), payload);
}

function recomputeDesired() {
  const s = new Set();
  const f = new Set();

  for (const { stocks, fx } of clients.values()) {
    for (const x of stocks) s.add(x);
    for (const x of fx) f.add(x);
  }

  desiredStocks = s;
  desiredFx = f;

  syncAlpacaSubs();
  scheduleOandaRestart();
}

// =========================
// WebSocket server (your app connects here)
// =========================
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  clients.set(ws, { stocks: new Set(), fx: new Set() });

  safeSend(ws, {
    type: "hello",
    msg: "market-gateway",
    alpacaFeed: ALPACA_FEED,
    oandaEnv: OANDA_ENV,
    alpacaConfigured: Boolean(ALPACA_KEY && ALPACA_SECRET),
    oandaConfigured: Boolean(OANDA_TOKEN && OANDA_ACCOUNT_ID),
  });

  ws.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(String(buf || ""));
    } catch {
      return;
    }

    const state = clients.get(ws);
    if (!state) return;

    if (msg?.action === "subscribe") {
      if (Array.isArray(msg.stocks)) {
        msg.stocks.forEach((x) => state.stocks.add(String(x).toUpperCase()));
      }
      if (Array.isArray(msg.fx)) {
        msg.fx.forEach((x) => state.fx.add(String(x).toUpperCase()));
      }

      // ✅ instant last-known
      for (const sym of state.stocks) {
        const q = last.quote.get(sym);
        const t = last.trade.get(sym);
        if (q) safeSend(ws, q);
        if (t) safeSend(ws, t);
      }
      for (const inst of state.fx) {
        const t = last.fx.get(inst);
        if (t) safeSend(ws, t);
      }

      recomputeDesired();

      safeSend(ws, {
        type: "subscribed",
        stocks: Array.from(state.stocks),
        fx: Array.from(state.fx),
      });

      // status hint
      safeSend(ws, {
        type: "status",
        market: "stocks",
        state: alpacaAuthed ? "live" : (ALPACA_KEY && ALPACA_SECRET ? "connecting" : "down"),
        ts: Date.now(),
      });

      return;
    }

    if (msg?.action === "unsubscribe") {
      if (Array.isArray(msg.stocks)) {
        msg.stocks.forEach((x) => state.stocks.delete(String(x).toUpperCase()));
      }
      if (Array.isArray(msg.fx)) {
        msg.fx.forEach((x) => state.fx.delete(String(x).toUpperCase()));
      }

      recomputeDesired();

      safeSend(ws, {
        type: "subscribed",
        stocks: Array.from(state.stocks),
        fx: Array.from(state.fx),
      });

      return;
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    recomputeDesired();
  });
});

// =========================
// Alpaca WebSocket (stocks live)
// =========================
let alpacaWs = null;
let alpacaAuthed = false;

function alpacaUrl() {
  const feed = ALPACA_FEED === "sip" ? "sip" : "iex";
  return `wss://stream.data.alpaca.markets/v2/${feed}`;
}

function connectAlpaca() {
  if (!ALPACA_KEY || !ALPACA_SECRET) {
    console.log("⚠️ Missing Alpaca keys; stocks live disabled");
    return;
  }

  alpacaWs = new WebSocket(alpacaUrl());
  alpacaAuthed = false;

  alpacaWs.on("open", () => {
    alpacaWs.send(JSON.stringify({ action: "auth", key: ALPACA_KEY, secret: ALPACA_SECRET }));
  });

  alpacaWs.on("message", (buf) => {
    let arr;
    try {
      arr = JSON.parse(String(buf || "[]"));
    } catch {
      return;
    }
    if (!Array.isArray(arr)) arr = [arr];

    for (const e of arr) {
      // auth/status messages
      if (e?.T === "success" || e?.T === "error" || e?.msg) {
        const m = String(e?.msg || "").toLowerCase();
        if (m.includes("authenticated")) {
          alpacaAuthed = true;
          syncAlpacaSubs();

          broadcastToClients(() => true, {
            type: "status",
            market: "stocks",
            state: "live",
            ts: Date.now(),
          });
        }
        continue;
      }

      // Trade tick: T:"t", S:"AAPL", p:123.45, t:"ISO"
      if (e?.T === "t" && e?.S && e?.p != null) {
        const sym = String(e.S).toUpperCase();
        const price = Number(e.p);
        const ts = Date.parse(String(e.t || "")) || Date.now();
        if (Number.isFinite(price) && price > 0) {
          broadcastStockTrade(sym, { type: "trade", symbol: sym, price, ts });
        }
        continue;
      }

      // Quote tick: T:"q", S:"AAPL", bp:..., ap:..., t:"ISO"
      if (e?.T === "q" && e?.S) {
        const sym = String(e.S).toUpperCase();
        const bid = Number(e.bp);
        const ask = Number(e.ap);
        const ts = Date.parse(String(e.t || "")) || Date.now();

        broadcastStockQuote(sym, {
          type: "quote",
          symbol: sym,
          bid: Number.isFinite(bid) && bid > 0 ? bid : 0,
          ask: Number.isFinite(ask) && ask > 0 ? ask : 0,
          ts,
        });
        continue;
      }
    }
  });

  alpacaWs.on("close", () => {
    alpacaWs = null;
    alpacaAuthed = false;

    broadcastToClients(() => true, {
      type: "status",
      market: "stocks",
      state: "down",
      ts: Date.now(),
    });

    setTimeout(connectAlpaca, 1500);
  });

  alpacaWs.on("error", () => {});
}

function syncAlpacaSubs() {
  if (!alpacaWs || alpacaWs.readyState !== WebSocket.OPEN || !alpacaAuthed) return;
  const syms = Array.from(desiredStocks);
  alpacaWs.send(JSON.stringify({ action: "subscribe", trades: syms, quotes: syms }));
}

// =========================
// OANDA pricing stream (FX live)
// =========================
let oandaAbort = null;
let oandaRestartTimer = null;

function scheduleOandaRestart() {
  clearTimeout(oandaRestartTimer);
  oandaRestartTimer = setTimeout(() => restartOandaStream().catch(() => {}), 500);
}

async function restartOandaStream() {
  if (!OANDA_TOKEN || !OANDA_ACCOUNT_ID) return;

  if (oandaAbort) {
    try { oandaAbort.abort(); } catch {}
    oandaAbort = null;
  }

  const instruments = Array.from(desiredFx);
  if (!instruments.length) return;

  const u =
    `${OANDA_STREAM_HOST}/v3/accounts/${encodeURIComponent(OANDA_ACCOUNT_ID)}/pricing/stream` +
    `?instruments=${encodeURIComponent(instruments.join(","))}`;

  const ctrl = new AbortController();
  oandaAbort = ctrl;

  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${OANDA_TOKEN}` },
    signal: ctrl.signal,
  });

  if (!res.ok || !res.body) {
    setTimeout(() => restartOandaStream().catch(() => {}), 1500);
    return;
  }

  const reader = res.body.getReader();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buf += Buffer.from(value).toString("utf8");

    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;

      let j;
      try { j = JSON.parse(line); } catch { continue; }

      if (j?.type === "PRICE" && j?.instrument) {
        const inst = String(j.instrument).toUpperCase(); // EUR_USD
        const bid = Number(j?.bids?.[0]?.price);
        const ask = Number(j?.asks?.[0]?.price);
        const ts = Date.parse(String(j?.time || "")) || Date.now();

        const mid =
          Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 :
          Number.isFinite(bid) ? bid :
          Number.isFinite(ask) ? ask : null;

        if (mid != null) {
          broadcastFx(inst, { type: "fx_tick", instrument: inst, bid, ask, mid, ts });
        }
      }
    }
  }

  if (!ctrl.signal.aborted) setTimeout(() => restartOandaStream().catch(() => {}), 1200);
}

// boot
server.listen(PORT, () => console.log("market-gateway listening on", PORT));
connectAlpaca();
scheduleOandaRestart();

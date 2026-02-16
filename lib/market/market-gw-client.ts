// lib/market/market-gw-client.ts
'use client';

type MarketGWMsg = any;

type ConnectOpts = {
  url: string;
  // what you want to subscribe to (examples: "fx:EUR_USD", "stocks:AAPL")
  topics: string[];
  token?: string; // if your gw expects auth
  onMessage?: (msg: MarketGWMsg) => void;
  onStatus?: (s: { state: 'connecting' | 'live' | 'down'; reason?: string }) => void;
  log?: boolean;
};

export function connectMarketGW(opts: ConnectOpts) {
  const { url, topics, token, onMessage, onStatus, log } = opts;

  let ws: WebSocket | null = null;
  let closedByUser = false;
  let pingTimer: any = null;
  let reconnectTimer: any = null;
  let subscribed = false;

  const dbg = (...a: any[]) => {
    if (log) console.log('[market-gw]', ...a);
  };

  const cleanup = () => {
    try {
      if (pingTimer) clearInterval(pingTimer);
    } catch {}
    pingTimer = null;

    try {
      if (reconnectTimer) clearTimeout(reconnectTimer);
    } catch {}
    reconnectTimer = null;

    try {
      ws?.close();
    } catch {}
    ws = null;

    subscribed = false;
  };

  const sendJson = (obj: any) => {
    try {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  };

  const doSubscribe = () => {
    if (subscribed) return;

    // try auth first (safe even if server ignores)
    if (token) sendJson({ type: 'auth', token });

    // subscribe message (adjust on server if you use different schema)
    sendJson({
      type: 'subscribe',
      topics,
    });

    subscribed = true;
    dbg('SUBSCRIBE →', topics);
  };

  const scheduleReconnect = (reason?: string) => {
    if (closedByUser) return;
    onStatus?.({ state: 'down', reason });

    // simple backoff
    const wait = 800 + Math.floor(Math.random() * 1200);
    reconnectTimer = setTimeout(() => {
      start();
    }, wait);
  };

  const start = () => {
    cleanup();
    onStatus?.({ state: 'connecting' });
    dbg('connecting →', url);

    ws = new WebSocket(url);

    ws.onopen = () => {
      dbg('OPEN ✅');

      // keepalive pings (some servers close if client never sends anything)
      pingTimer = setInterval(() => {
        // send BOTH styles: JSON ping + string ping (server can ignore whichever)
        sendJson({ type: 'ping', ts: Date.now() });
        try {
          if (ws && ws.readyState === WebSocket.OPEN) ws.send('ping');
        } catch {}
      }, 15_000);

      // also subscribe immediately (even if server wants it after hello, harmless)
      doSubscribe();
    };

    ws.onmessage = (ev) => {
      let msg: any = null;
      try {
        msg = JSON.parse(String(ev.data || '{}'));
      } catch {
        msg = ev.data;
      }

      // helpful log — your HELLO probably contains “expected next message”
      dbg('MSG', msg);

      // if server sends hello, subscribe again (covers “subscribe-after-hello” servers)
      const t = String(msg?.type || msg?.t || '').toLowerCase();
      if (t === 'hello' || msg?.hello === true) {
        onStatus?.({ state: 'live' });
        doSubscribe();
      }

      // if server explicitly acknowledges subscribe
      if (t === 'subscribed' || t === 'ready' || t === 'live') {
        onStatus?.({ state: 'live' });
      }

      // if server says unauthorized, don’t spam reconnect
      if (t === 'error' && String(msg?.code || '').toLowerCase().includes('auth')) {
        onStatus?.({ state: 'down', reason: 'auth' });
        return;
      }

      onMessage?.(msg);
    };

    ws.onerror = () => {
      dbg('ERROR');
      scheduleReconnect('error');
    };

    ws.onclose = (e) => {
      dbg('CLOSE', e.code, e.reason || '');
      // your case: 1000 with empty reason
      scheduleReconnect(`${e.code}${e.reason ? `:${e.reason}` : ''}`);
    };
  };

  start();

  return {
    close() {
      closedByUser = true;
      cleanup();
    },
    resendSubscribe() {
      doSubscribe();
    },
  };
}

// app/api/market/stocks/stream/route.ts
import WebSocket from 'ws';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function clampSymbols(raw: string) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 25);
}

function wsUrl(feed: string) {
  const f = (feed || 'iex').toLowerCase();
  return f === 'sip'
    ? 'wss://stream.data.alpaca.markets/v2/sip'
    : 'wss://stream.data.alpaca.markets/v2/iex';
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const symbols = clampSymbols(url.searchParams.get('symbols') || '');
  if (!symbols.length) return new Response('Missing symbols', { status: 400 });

  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  const feed = (url.searchParams.get('feed') || process.env.ALPACA_DATA_FEED || 'iex').trim();

  if (!key || !secret) return new Response('Missing Alpaca env keys', { status: 500 });

  let closed = false;
  let ws: WebSocket | null = null;
  let hb: any = null;
  let lastMsgAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();

      const send = (obj: any) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          // ignore
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        try {
          if (hb) clearInterval(hb);
        } catch {}
        try {
          ws?.close();
        } catch {}
        try {
          controller.close();
        } catch {}
      };

      // send a first status immediately (client will leave "connecting" sooner)
      send({ type: 'status', state: 'connecting', feed, symbols });

      // keepalive (also gives client onmessage activity, not only "event: ping")
      hb = setInterval(() => {
        if (closed) return;
        const now = Date.now();

        // if no WS msgs for too long, mark down (helps you debug "stuck connecting")
        if (now - lastMsgAt > 35_000) {
          send({ type: 'status', state: 'down', error: 'No upstream data' });
        }

        send({ type: 'ping', ts: now });
      }, 15_000);

      ws = new WebSocket(wsUrl(feed), {
        handshakeTimeout: 10_000,
        perMessageDeflate: false,
      });

      ws.on('open', () => {
        try {
          ws?.send(JSON.stringify({ action: 'auth', key, secret }));
        } catch {}
      });

      ws.on('message', (buf) => {
        lastMsgAt = Date.now();

        try {
          const txt = buf.toString();
          const arr = JSON.parse(txt);
          const msgs = Array.isArray(arr) ? arr : [arr];

          for (const m of msgs) {
            // auth ok
            if (m?.T === 'success' && String(m?.msg || '').toLowerCase().includes('authenticated')) {
              ws?.send(JSON.stringify({ action: 'subscribe', trades: symbols, quotes: symbols }));
              send({ type: 'status', state: 'live', feed, symbols });
              continue;
            }

            // auth error / generic error
            if (m?.T === 'error') {
              send({ type: 'status', state: 'down', error: String(m?.msg || 'WS error') });
              cleanup();
              return;
            }

            // quote (bid/ask)
            if (m?.T === 'q') {
              send({
                type: 'quote',
                symbol: String(m?.S || '').toUpperCase(),
                bid: Number(m?.bp ?? 0),
                ask: Number(m?.ap ?? 0),
                ts: Date.now(),
              });
              continue;
            }

            // trade (last price)
            if (m?.T === 't') {
              send({
                type: 'trade',
                symbol: String(m?.S || '').toUpperCase(),
                price: Number(m?.p ?? 0),
                ts: Date.now(),
              });
              continue;
            }
          }
        } catch {
          // ignore parse errors
        }
      });

      ws.on('error', (err) => {
        send({ type: 'status', state: 'down', error: String((err as any)?.message || err || 'WS error') });
        cleanup();
      });

      ws.on('close', () => {
        send({ type: 'status', state: 'down' });
        cleanup();
      });

      // proper cancel hook
      (controller as any).__cleanup = cleanup;
    },

    cancel(controller) {
      try {
        (controller as any).__cleanup?.();
      } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

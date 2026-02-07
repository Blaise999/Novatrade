export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const COINBASE_WS_URL = 'wss://ws-feed.exchange.coinbase.com';

const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  LINK: 'chainlink',
  MATIC: 'polygon-pos',
  UNI: 'uniswap',
  LTC: 'litecoin',
  ATOM: 'cosmos',
  NEAR: 'near',
  APT: 'aptos',
  SUI: 'sui',
  ARB: 'arbitrum',
  OP: 'optimism',
  FIL: 'filecoin',
  PEPE: 'pepe',
  SHIB: 'shiba-inu',
  TRX: 'tron',
  TON: 'the-open-network',
  ICP: 'internet-computer',
};

function cgHeaders(): Headers {
  const h = new Headers();
  h.set('accept', 'application/json');

  const key = process.env.COINGECKO_API_KEY?.trim();
  if (key) h.set('x-cg-pro-api-key', key);

  return h;
}

function csv(q: string | null): string[] {
  if (!q) return [];
  return q.split(',').map((s) => s.trim()).filter(Boolean);
}

function num(q: string | null, fallback: number): number {
  const n = Number(q);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * GET /api/market/prices
 *
 * JSON snapshot (your UI symbols):
 *   /api/market/prices?symbols=BTC,ETH,SOL
 *
 * All coins (paginated list):
 *   /api/market/prices?all=1&page=1&per_page=250
 *
 * Fast stream (Coinbase WS -> SSE):
 *   /api/market/prices?stream=1&symbols=BTC,ETH,SOL
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  const stream = sp.get('stream') === '1';
  const all = sp.get('all') === '1';
  const symbols = csv(sp.get('symbols')).map((s) => s.toUpperCase());

  // -------------------------
  // STREAM MODE (Coinbase WS -> SSE)
  // -------------------------
  if (stream) {
    const productIds = (symbols.length ? symbols : ['BTC', 'ETH']).map((s) => `${s}-USD`);

    const encoder = new TextEncoder();

    const sseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;

        const send = (event: string, data: unknown) => {
          if (closed) return;
          controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        const ping = () => {
          if (closed) return;
          controller.enqueue(encoder.encode(`: ping\n\n`));
        };

        const ws = new WebSocket(COINBASE_WS_URL);
        const keepAliveId = setInterval(ping, 15000);

        const cleanup = () => {
          if (closed) return;
          closed = true;
          clearInterval(keepAliveId);
          try { ws.close(); } catch {}
          try { controller.close(); } catch {}
        };

        req.signal.addEventListener('abort', cleanup);

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'subscribe',
              product_ids: productIds,
              channels: ['ticker_batch'], // less spam, still fast
            })
          );
          send('ready', { products: productIds, source: 'coinbase_ws', channel: 'ticker_batch' });
        };

        ws.onerror = () => {
          send('error', { message: 'Coinbase WebSocket error.' });
          cleanup();
        };

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data));
            if (msg?.type !== 'ticker' && msg?.type !== 'ticker_batch') return;

            const productId: string | undefined = msg.product_id;
            const price = Number(msg.price);
            if (!productId || !Number.isFinite(price)) return;

            const symbol = productId.split('-')[0] || productId;

            send('tick', {
              symbol,
              productId,
              price,
              time: msg.time || new Date().toISOString(),
              open24h: msg.open_24h ? Number(msg.open_24h) : undefined,
              low24h: msg.low_24h ? Number(msg.low_24h) : undefined,
              high24h: msg.high_24h ? Number(msg.high_24h) : undefined,
              volume24h: msg.volume_24h ? Number(msg.volume_24h) : undefined,
            });
          } catch {
            // ignore
          }
        };
      },
    });

    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  // -------------------------
  // ALL COINS MODE (CoinGecko markets list)
  // -------------------------
  if (all) {
    const page = Math.max(1, num(sp.get('page'), 1));
    const perPage = Math.min(250, Math.max(1, num(sp.get('per_page'), 250)));
    const order = sp.get('order') || 'market_cap_desc';

    const marketsUrl =
      `${COINGECKO_BASE}/coins/markets` +
      `?vs_currency=usd` +
      `&order=${encodeURIComponent(order)}` +
      `&per_page=${perPage}` +
      `&page=${page}` +
      `&sparkline=false` +
      `&price_change_percentage=24h`;

    const res = await fetch(marketsUrl, {
      cache: 'no-store',
      headers: cgHeaders(),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch markets', status: res.status }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }

    const coins = await res.json();
    return new Response(JSON.stringify({ coins, page, per_page: perPage, source: 'coingecko' }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  // -------------------------
  // SYMBOL SNAPSHOT MODE (CoinGecko simple price)
  // -------------------------
  const ids = symbols.map((s) => SYMBOL_TO_COINGECKO_ID[s]).filter(Boolean);

  if (!ids.length) {
    return new Response(
      JSON.stringify({
        prices: {},
        changes24h: {},
        error: 'No valid symbols. Use ?symbols=BTC,ETH or ?all=1',
      }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }

  const simpleUrl =
    `${COINGECKO_BASE}/simple/price` +
    `?ids=${encodeURIComponent(ids.join(','))}` +
    `&vs_currencies=usd` +
    `&include_24hr_change=true`;

  const r = await fetch(simpleUrl, {
    cache: 'no-store',
    headers: cgHeaders(),
  });

  if (!r.ok) {
    return new Response(JSON.stringify({ error: 'Failed to fetch prices', status: r.status }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const data = await r.json();

  const prices: Record<string, number> = {};
  const changes24h: Record<string, number> = {};

  for (const sym of symbols) {
    const id = SYMBOL_TO_COINGECKO_ID[sym];
    if (!id) continue;

    const p = data?.[id]?.usd;
    const ch = data?.[id]?.usd_24h_change;

    if (typeof p === 'number') prices[sym] = p;
    if (typeof ch === 'number') changes24h[sym] = ch;
  }

  return new Response(JSON.stringify({ prices, changes24h, source: 'coingecko' }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

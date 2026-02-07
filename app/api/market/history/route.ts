export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

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

function clampDays(daysRaw: string | null) {
  if (!daysRaw) return '1';
  if (daysRaw === 'max') return 'max';
  const n = Number(daysRaw);
  if (!Number.isFinite(n)) return '1';
  return String(Math.min(365, Math.max(1, Math.floor(n))));
}

/**
 * GET /api/market/history?symbol=BTC&days=1
 * Returns: { symbol, id, days, prices: number[], timestamps: number[] }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  const symbol = (sp.get('symbol') || '').toUpperCase();
  const id = sp.get('id') || SYMBOL_TO_COINGECKO_ID[symbol];
  const days = clampDays(sp.get('days'));

  if (!id) {
    return new Response(JSON.stringify({ error: 'Unknown symbol. Provide ?symbol=BTC or ?id=bitcoin' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const chartUrl =
    `${COINGECKO_BASE}/coins/${encodeURIComponent(id)}/market_chart` +
    `?vs_currency=usd&days=${encodeURIComponent(days)}`;

  const res = await fetch(chartUrl, {
    cache: 'no-store',
    headers: cgHeaders(),
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Failed to fetch history', status: res.status }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const data = await res.json();

  const raw = Array.isArray(data?.prices) ? data.prices : [];
  const timestamps: number[] = [];
  const prices: number[] = [];

  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const t = Number(row[0]);
    const p = Number(row[1]);
    if (Number.isFinite(t) && Number.isFinite(p)) {
      timestamps.push(t);
      prices.push(p);
    }
  }

  const sliceFrom = Math.max(0, prices.length - 200);

  return new Response(
    JSON.stringify({
      symbol: symbol || undefined,
      id,
      days,
      timestamps: timestamps.slice(sliceFrom),
      prices: prices.slice(sliceFrom),
      source: 'coingecko',
    }),
    { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
  );
}

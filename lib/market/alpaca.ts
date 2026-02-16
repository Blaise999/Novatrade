// lib/market/alpaca.ts
export type CandleLike = { time: string; open: number; high: number; low: number; close: number; volume?: number };
export type QuoteLike = {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  prevClose?: number;
  changePercent24h?: number;
  ts?: number;
};

function pickErrorMessage(_text: string) {
  return 'Network error.';
}

async function readJson(res: Response) {
  const text = await res.text();
  if (!res.ok) throw new Error(pickErrorMessage(text));
  return text ? JSON.parse(text) : {};
}

export async function fetchQuotesBatch(symbols: string[]) {
  const list = (symbols || [])
    .map((s) => String(s || '').trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 25);

  if (!list.length) return {};

  const res = await fetch(`/api/market/stocks/quotes?symbols=${encodeURIComponent(list.join(','))}`, {
    cache: 'no-store',
  });

  return readJson(res);
}

/**
 * interval must be your Twelve-like strings: 1min|5min|15min|1h|4h|1day
 * (your /api route converts to Alpaca timeframe)
 */
export async function fetchCandles(symbol: string, interval: string, limit: number) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return { candles: [] as CandleLike[] };

  const res = await fetch(
    `/api/market/stocks/candles?symbol=${encodeURIComponent(sym)}&tf=${encodeURIComponent(interval)}&limit=${encodeURIComponent(
      String(limit || 220)
    )}`,
    { cache: 'no-store' }
  );

  return readJson(res);
}

type CandleLike = { time: string; open: number; high: number; low: number; close: number; volume?: number };
type QuoteLike = {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  prevClose?: number;
  changePercent24h?: number;
  ts?: number;
};

function pickErrorMessage(text: string) {
  const t = String(text || '').trim();
  if (!t) return 'Network error.';
  // keep it generic (same style you already use)
  return 'Network error.';
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

  const text = await res.text();
  if (!res.ok) throw new Error(pickErrorMessage(text));
  return text ? JSON.parse(text) : {};
}

export async function fetchCandles(symbol: string, interval: string, limit: number) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return { candles: [] as CandleLike[] };

  const res = await fetch(
    `/api/market/stocks/candles?symbol=${encodeURIComponent(sym)}&tf=${encodeURIComponent(interval)}&limit=${encodeURIComponent(
      String(limit || 220)
    )}`,
    { cache: 'no-store' }
  );

  const text = await res.text();
  if (!res.ok) throw new Error(pickErrorMessage(text));
  return text ? JSON.parse(text) : { candles: [] };
}

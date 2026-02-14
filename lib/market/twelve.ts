// lib/market/twelve.ts
export type TwelveQuote = {
  symbol: string;
  name?: string;
  currency?: string;
  exchange?: string;
  timestamp?: string;
  price?: string;
  close?: string;
  open?: string;
  high?: string;
  low?: string;
  volume?: string;
  percent_change?: string;
};

export type Candle = {
  time: string; // datetime
  open: number;
  high: number;
  low: number;
  close: number;
};

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function fetchQuote(symbol: string): Promise<TwelveQuote> {
  const r = await fetch(`/api/market/twelve/quote?symbol=${encodeURIComponent(symbol)}`, {
    cache: 'no-store',
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || 'Quote failed');
  return data as TwelveQuote;
}

// batch: "AAPL,MSFT,TSLA"
export async function fetchQuotesBatch(symbols: string[]): Promise<Record<string, TwelveQuote>> {
  const uniq = Array.from(new Set(symbols.map((s) => s.trim()).filter(Boolean)));
  if (uniq.length === 0) return {};

  const r = await fetch(`/api/market/twelve/quote?symbol=${encodeURIComponent(uniq.join(','))}`, {
    cache: 'no-store',
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || 'Batch quote failed');

  // Twelve returns either:
  // - single quote object
  // - OR object keyed by symbol when you pass multiple symbols
  if (data && typeof data === 'object' && data.symbol) {
    return { [String(data.symbol)]: data as TwelveQuote };
  }

  // keyed response
  return data as Record<string, TwelveQuote>;
}

export async function fetchCandles(symbol: string, interval = '1min', outputsize = 200): Promise<Candle[]> {
  const url = `/api/market/twelve/time-series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(
    interval
  )}&outputsize=${encodeURIComponent(String(outputsize))}`;

  const r = await fetch(url, { cache: 'no-store' });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || 'Candles failed');

  const values = Array.isArray(data?.values) ? data.values : [];

  // Twelve gives newest-first, we want left-to-right oldest-first
  const ordered = values.slice().reverse();

  return ordered.map((x: any) => ({
    time: String(x.datetime || x.time || ''),
    open: toNum(x.open),
    high: toNum(x.high),
    low: toNum(x.low),
    close: toNum(x.close),
  }));
}

// lib/market/twelve.ts
export type TwelveQuote = {
  symbol: string;
  name?: string;
  currency?: string;
  exchange?: string;
  timestamp?: string;
  price?: string | number;
  close?: string | number;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  volume?: string | number;
  percent_change?: string | number;
  previous_close?: string | number;
};

export type Candle = {
  time: string; // datetime (or ISO string)
  open: number;
  high: number;
  low: number;
  close: number;
};

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asUpper(s: any) {
  return String(s || '').trim().toUpperCase();
}

// Your stock page calls these:
const QUOTE_URL = (symbolsCsv: string) =>
  `/api/market/twelve/quote?symbol=${encodeURIComponent(symbolsCsv)}`;

const TS_URL = (symbol: string, interval: string, outputsize: number) =>
  `/api/market/twelve/time-series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(
    interval
  )}&outputsize=${encodeURIComponent(String(outputsize))}`;

/**
 * Normalize quote response:
 * - Some handlers return { ok, data: {AAPL:{...}} }
 * - Some return {AAPL:{...}}
 * - Some return single {symbol:"AAPL", ...}
 */
function normalizeQuotePayload(payload: any): Record<string, TwelveQuote> {
  if (!payload) return {};

  // wrapper: { ok, data: {...} }
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') {
    return payload.data as Record<string, TwelveQuote>;
  }

  // single quote: { symbol: "AAPL", ... }
  if (payload && typeof payload === 'object' && payload.symbol) {
    const sym = asUpper(payload.symbol);
    return sym ? { [sym]: payload as TwelveQuote } : {};
  }

  // keyed: { AAPL:{...}, MSFT:{...} }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, TwelveQuote>;
  }

  return {};
}

export async function fetchQuote(symbol: string): Promise<TwelveQuote> {
  const sym = asUpper(symbol);
  const r = await fetch(QUOTE_URL(sym), { cache: 'no-store' });
  const data = await r.json();

  // your server often returns 200 even on error, so handle both
  const map = normalizeQuotePayload(data);
  const q = map[sym];

  if (!q) {
    const err = (data && (data.error || data.message)) || 'Quote failed';
    throw new Error(String(err));
  }

  return q;
}

export async function fetchQuotesBatch(symbols: string[]): Promise<Record<string, TwelveQuote>> {
  const uniq = Array.from(new Set(symbols.map(asUpper).filter(Boolean)));
  if (uniq.length === 0) return {};

  const r = await fetch(QUOTE_URL(uniq.join(',')), { cache: 'no-store' });
  const json = await r.json();

  const map = normalizeQuotePayload(json);
  return map;
}

/**
 * Normalize time-series response:
 * - Some handlers return { ok, candles: [{time, open, high, low, close}] }
 * - Some return { meta, candles: [{time, o, h, l, c}] }
 * - Some return Twelve raw { values: [{datetime, open, high, low, close}] }
 */
function normalizeCandlesPayload(payload: any): Candle[] {
  if (!payload) return [];

  // wrapper candles (your time-series route)
  const candles1 = Array.isArray(payload.candles) ? payload.candles : null;
  if (candles1) {
    return candles1
      .map((x: any) => {
        const timeRaw = x?.time ?? x?.datetime ?? x?.date ?? '';
        // if server already sent ms epoch, turn it into ISO
        const time =
          typeof timeRaw === 'number'
            ? new Date(timeRaw).toISOString()
            : String(timeRaw || '');

        return {
          time,
          open: toNum(x?.open ?? x?.o),
          high: toNum(x?.high ?? x?.h),
          low: toNum(x?.low ?? x?.l),
          close: toNum(x?.close ?? x?.c),
        } satisfies Candle;
      })
      .filter((c: Candle) => c.time && c.high > 0 && c.low > 0 && c.close > 0);
  }

  // Twelve raw format: { values: [{ datetime, open, high, low, close }] }
  const values = Array.isArray(payload.values) ? payload.values : [];
  return values
    .slice()
    .reverse() // newest-first -> oldest-first
    .map((x: any) => ({
      time: String(x?.datetime || x?.time || ''),
      open: toNum(x?.open),
      high: toNum(x?.high),
      low: toNum(x?.low),
      close: toNum(x?.close),
    }))
    .filter((c: Candle) => c.time && c.high > 0 && c.low > 0 && c.close > 0);
}

export async function fetchCandles(symbol: string, interval = '1min', outputsize = 200): Promise<Candle[]> {
  const sym = asUpper(symbol);

  const r = await fetch(TS_URL(sym, interval, outputsize), { cache: 'no-store' });
  const json = await r.json();

  // If your server encodes errors but returns 200, candles may be empty with ok=false
  const candles = normalizeCandlesPayload(json);

  if (!candles.length) {
    // only throw if the server explicitly said it's an error
    if (json?.ok === false) throw new Error(json?.error || 'Candles failed');
  }

  return candles;
}

// lib/market/twelve.ts

export type TwelveQuote = {
  symbol: string;
  name?: string;
  currency?: string;
  exchange?: string;
  timestamp?: string;
  price?: any;
  close?: any;
  open?: any;
  high?: any;
  low?: any;
  volume?: any;
  percent_change?: any;

  // some wrappers use these:
  previous_close?: any;
  prev_close?: any;
  change_percent?: any;
  last?: any;
};

export type Candle = {
  time: string; // datetime string (or ISO)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asErrMsg(data: any, fallback: string) {
  const msg = data?.error || data?.message || data?.details?.message || fallback;
  return String(msg || fallback);
}

async function fetchJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(asErrMsg(data, `HTTP_${r.status}`));
  return data;
}

// ✅ try multiple possible route paths (your repo has both /market and /markets)
async function fetchFirstOk(urls: string[]) {
  let lastErr: any = null;
  for (const u of urls) {
    try {
      return await fetchJson(u);
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('fetch_failed');
}

export async function fetchQuote(symbol: string): Promise<TwelveQuote> {
  const s = symbol.trim();
  const data = await fetchFirstOk([
    `/api/market/twelve/quote?symbol=${encodeURIComponent(s)}`,
    `/api/markets/twelve/quote?symbol=${encodeURIComponent(s)}`,
  ]);

  // wrapper: { ok, data, error }
  if (typeof data?.ok === 'boolean') {
    if (!data.ok) throw new Error(asErrMsg(data, 'Quote failed'));
    if (data.data && typeof data.data === 'object') {
      const key = Object.keys(data.data)[0];
      return (data.data[key] || {}) as TwelveQuote;
    }
    return (data as any) as TwelveQuote;
  }

  // direct
  return data as TwelveQuote;
}

// batch: ["AAPL","MSFT"]
export async function fetchQuotesBatch(symbols: string[]): Promise<Record<string, TwelveQuote>> {
  const uniq = Array.from(
    new Set(
      symbols
        .map((s) => String(s || '').trim().toUpperCase())
        .filter(Boolean)
    )
  );
  if (uniq.length === 0) return {};

  const qs = encodeURIComponent(uniq.join(','));

  const data = await fetchFirstOk([
    `/api/market/twelve/quote?symbol=${qs}`,
    `/api/markets/twelve/quote?symbol=${qs}`,
  ]);

  // ✅ wrapper
  if (typeof data?.ok === 'boolean') {
    if (!data.ok) throw new Error(asErrMsg(data, 'Batch quote failed'));
    const map = data.data && typeof data.data === 'object' ? data.data : {};
    return map as Record<string, TwelveQuote>;
  }

  // ✅ single quote object
  if (data && typeof data === 'object' && (data as any).symbol) {
    const sym = String((data as any).symbol).toUpperCase();
    return { [sym]: data as TwelveQuote };
  }

  // ✅ keyed response: {AAPL:{...}, MSFT:{...}}
  return data as Record<string, TwelveQuote>;
}

export async function fetchCandles(symbol: string, interval = '1min', outputsize = 200): Promise<Candle[]> {
  const sym = symbol.trim().toUpperCase();
  const out = Math.max(20, Math.min(500, Number.isFinite(Number(outputsize)) ? Number(outputsize) : 200));

  const data = await fetchFirstOk([
    // common
    `/api/market/twelve/time-series?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(interval)}&outputsize=${encodeURIComponent(String(out))}`,
    // alternate naming you showed
    `/api/markets/twelve/candles?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(interval)}&outputsize=${encodeURIComponent(String(out))}`,
  ]);

  // wrapper shape: { ok, candles, error }
  if (typeof data?.ok === 'boolean') {
    if (!data.ok) throw new Error(asErrMsg(data, 'Candles failed'));
    const candles = Array.isArray(data.candles) ? data.candles : [];
    // could be {time:number, open...} or {t,o,h,l,c,time}
    return candles.map((c: any) => {
      if (typeof c?.time === 'string') {
        return {
          time: String(c.time),
          open: toNum(c.open ?? c.o),
          high: toNum(c.high ?? c.h),
          low: toNum(c.low ?? c.l),
          close: toNum(c.close ?? c.c),
          volume: c.volume != null ? toNum(c.volume) : undefined,
        } as Candle;
      }

      if (typeof c?.time === 'number' && Number.isFinite(c.time)) {
        return {
          time: new Date(c.time).toISOString(),
          open: toNum(c.open ?? c.o),
          high: toNum(c.high ?? c.h),
          low: toNum(c.low ?? c.l),
          close: toNum(c.close ?? c.c),
          volume: c.volume != null ? toNum(c.volume) : undefined,
        } as Candle;
      }

      // fallback
      return {
        time: String(c?.datetime || c?.date || ''),
        open: toNum(c.open ?? c.o),
        high: toNum(c.high ?? c.h),
        low: toNum(c.low ?? c.l),
        close: toNum(c.close ?? c.c),
        volume: c.volume != null ? toNum(c.volume) : undefined,
      } as Candle;
    });
  }

  // route shape: { meta, candles:[{t,time,o,h,l,c}] }
  if (Array.isArray(data?.candles)) {
    const candles = data.candles as any[];
    return candles.map((c: any) => ({
      time: String(c?.time || c?.datetime || (typeof c?.t === 'number' ? new Date(c.t).toISOString() : '')),
      open: toNum(c?.open ?? c?.o),
      high: toNum(c?.high ?? c?.h),
      low: toNum(c?.low ?? c?.l),
      close: toNum(c?.close ?? c?.c),
      volume: c?.v != null ? toNum(c.v) : undefined,
    }));
  }

  // Twelve raw time_series shape: { values:[{datetime/open/high/low/close}] }
  const values = Array.isArray(data?.values) ? data.values : [];
  const ordered = values.slice().reverse(); // newest-first -> oldest-first

  return ordered.map((x: any) => ({
    time: String(x.datetime || x.time || ''),
    open: toNum(x.open),
    high: toNum(x.high),
    low: toNum(x.low),
    close: toNum(x.close),
    volume: x.volume != null ? toNum(x.volume) : undefined,
  }));
}

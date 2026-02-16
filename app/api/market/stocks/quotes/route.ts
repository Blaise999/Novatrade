// app/api/market/stocks/quotes/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CacheEntry = { ts: number; data: any };
const g = globalThis as any;
g.__ALPACA_QUOTES_CACHE ||= new Map<string, CacheEntry>();
const CACHE: Map<string, CacheEntry> = g.__ALPACA_QUOTES_CACHE;

const TTL_MS = 6_500;

function clampSymbols(raw: string) {
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 25);
}

function alpacaHeaders() {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) throw new Error('Missing Alpaca env keys');

  return {
    accept: 'application/json',
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret,
  } as Record<string, string>;
}

async function fetchJson(url: string, timeoutMs = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: alpacaHeaders(), signal: ac.signal, cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) {
      const msg = text || `HTTP ${res.status}`;
      const err: any = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(t);
  }
}

function pickNumber(...vals: any[]) {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbolsParam = url.searchParams.get('symbols') || '';
  const symbols = clampSymbols(symbolsParam);

  if (!symbols.length) return NextResponse.json({}, { status: 200 });

  // ✅ default feed to iex
  const feed = (url.searchParams.get('feed') || process.env.ALPACA_DATA_FEED || 'iex').trim();

  const qs = new URLSearchParams({ symbols: symbols.join(','), feed });
  const upstream = `https://data.alpaca.markets/v2/stocks/snapshots?${qs.toString()}`;
  const cacheKey = `snapshots:${qs.toString()}`;

  const cached = CACHE.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.ts < TTL_MS) {
    return NextResponse.json(cached.data, { status: 200 });
  }

  try {
    const json = await fetchJson(upstream);

    const out: Record<
      string,
      {
        symbol: string;
        price: number;
        bid: number;
        ask: number;
        prevClose?: number;
        ts: number;
        changePercent24h?: number;
      }
    > = {};

    for (const sym of symbols) {
      const s = (json?.[sym] ?? json?.snapshots?.[sym] ?? null) as any;
      if (!s) continue;

      const latestTradePrice = pickNumber(s?.latestTrade?.p, s?.latest_trade?.p, s?.trade?.p);
      const minuteClose = pickNumber(s?.minuteBar?.c, s?.minute_bar?.c);
      const dailyClose = pickNumber(s?.dailyBar?.c, s?.daily_bar?.c);
      const prevClose = pickNumber(s?.prevDailyBar?.c, s?.prev_daily_bar?.c);

      const price = latestTradePrice || minuteClose || dailyClose || 0;

      const bid = pickNumber(s?.latestQuote?.bp, s?.latest_quote?.bp, price ? price * 0.9999 : 0);
      const ask = pickNumber(s?.latestQuote?.ap, s?.latest_quote?.ap, price ? price * 1.0001 : 0);

      let pct = 0;
      if (prevClose > 0 && price > 0) pct = ((price - prevClose) / prevClose) * 100;

      if (price > 0) {
        out[sym] = {
          symbol: sym,
          price,
          bid: bid || price * 0.9999,
          ask: ask || price * 1.0001,
          prevClose: prevClose || undefined,
          changePercent24h: pct,
          ts: now,
        };
      }
    }

    CACHE.set(cacheKey, { ts: now, data: out });
    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    if (cached?.data) {
      return NextResponse.json(cached.data, { status: 200, headers: { 'x-stale': '1' } });
    }
    const status = Number(e?.status) || 500;
    return NextResponse.json({ error: String(e?.message || 'Market data error') }, { status });
  }
}

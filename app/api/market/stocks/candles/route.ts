// app/api/market/stocks/candles/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CacheEntry = { ts: number; data: any };
const g = globalThis as any;
g.__ALPACA_BARS_CACHE ||= new Map<string, CacheEntry>();
const CACHE: Map<string, CacheEntry> = g.__ALPACA_BARS_CACHE;

const TTL_MS = 12_000;

function alpacaHeaders() {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) throw new Error('Missing Alpaca env keys');

  // Alpaca docs use APCA-API-KEY-ID + APCA-API-SECRET-KEY
  return {
    accept: 'application/json',
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret,
  } as Record<string, string>;
}

async function fetchJson(url: string, timeoutMs = 10_000) {
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

function toTf(interval: string) {
  const tf = (interval || '').toLowerCase();

  // accept both styles: 1m and 1min etc
  if (tf === '1m' || tf === '1min' || tf === '1minute') return '1Min';
  if (tf === '5m' || tf === '5min' || tf === '5minute') return '5Min';
  if (tf === '15m' || tf === '15min' || tf === '15minute') return '15Min';
  if (tf === '1h' || tf === '1hour') return '1Hour';
  if (tf === '4h' || tf === '4hour') return '4Hour';
  if (tf === '1d' || tf === '1day' || tf === 'day') return '1Day';

  return '15Min';
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const symbol = String(url.searchParams.get('symbol') || '').trim().toUpperCase();
  const interval = String(url.searchParams.get('tf') || url.searchParams.get('interval') || '15min');
  const limitRaw = Number(url.searchParams.get('limit') || 220);
  const limit = Number.isFinite(limitRaw) ? Math.max(10, Math.min(500, Math.floor(limitRaw))) : 220;

  if (!symbol) return NextResponse.json({ candles: [] }, { status: 200 });

  // ✅ default feed to iex so it always works on free plans
  const feed = (url.searchParams.get('feed') || process.env.ALPACA_DATA_FEED || 'iex').trim();

  const qs = new URLSearchParams({
    symbols: symbol,
    timeframe: toTf(interval),
    limit: String(limit),
    feed,
  });

  const upstream = `https://data.alpaca.markets/v2/stocks/bars?${qs.toString()}`;
  const cacheKey = `bars:${qs.toString()}`;

  const cached = CACHE.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.ts < TTL_MS) {
    return NextResponse.json(cached.data, { status: 200 });
  }

  try {
    const json = await fetchJson(upstream);

    // Alpaca bars: { bars: { AAPL: [ {t,o,h,l,c,v}, ... ] } }
    const arr: any[] =
      (json?.bars && json?.bars?.[symbol] && Array.isArray(json.bars[symbol]) && json.bars[symbol]) || [];

    const candles = arr
      .map((b: any) => ({
        time: String(b?.t || b?.time || ''),
        open: Number(b?.o ?? b?.open ?? 0),
        high: Number(b?.h ?? b?.high ?? 0),
        low: Number(b?.l ?? b?.low ?? 0),
        close: Number(b?.c ?? b?.close ?? 0),
        volume: b?.v ?? b?.volume,
      }))
      .filter((c: any) => c.time && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0);

    const payload = { candles };
    CACHE.set(cacheKey, { ts: now, data: payload });
    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    if (cached?.data) {
      return NextResponse.json(cached.data, { status: 200, headers: { 'x-stale': '1' } });
    }
    const status = Number(e?.status) || 500;
    return NextResponse.json({ error: String(e?.message || 'Market data error') }, { status });
  }
}

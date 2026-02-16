// app/api/market/stocks/candles/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type CacheEntry = { ts: number; data: any };
const g = globalThis as any;
g.__ALPACA_BARS_CACHE ||= new Map<string, CacheEntry>();
const CACHE: Map<string, CacheEntry> = g.__ALPACA_BARS_CACHE;

const TTL_MS = 12_000;

function headers() {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) throw new Error('Missing Alpaca env keys');
  return {
    accept: 'application/json',
    'Apca-Api-Key-Id': key,
    'Apca-Api-Secret-Key': secret,
  } as Record<string, string>;
}

async function fetchJson(url: string, timeoutMs = 10000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: headers(), signal: ac.signal, cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) {
      const err: any = new Error(text || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(t);
  }
}

function toTf(interval: string) {
  switch ((interval || '').toLowerCase()) {
    case '1min':
      return '1Min';
    case '5min':
      return '5Min';
    case '15min':
      return '15Min';
    case '1h':
      return '1Hour';
    case '4h':
      return '4Hour';
    case '1day':
      return '1Day';
    default:
      return '15Min';
  }
}

function buildUpstream(symbol: string, interval: string, limit: number, feed?: string) {
  const qs = new URLSearchParams({
    symbols: symbol,
    timeframe: toTf(interval),
    limit: String(limit),
  });

  const f = (feed || '').trim();
  if (f) qs.set('feed', f);

  return {
    upstream: `https://data.alpaca.markets/v2/stocks/bars?${qs.toString()}`,
    cacheKey: `bars:${qs.toString()}`,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const symbol = String(url.searchParams.get('symbol') || '').trim().toUpperCase();
  const interval = String(url.searchParams.get('tf') || url.searchParams.get('interval') || '15min');
  const limitRaw = Number(url.searchParams.get('limit') || 220);
  const limit = Number.isFinite(limitRaw) ? Math.max(10, Math.min(500, Math.floor(limitRaw))) : 220;

  if (!symbol) return NextResponse.json({ candles: [] }, { status: 200 });

  const reqFeed = (url.searchParams.get('feed') || '').trim();
  const envFeed = (process.env.ALPACA_DATA_FEED || '').trim();
  const feed = (reqFeed || envFeed || 'iex').trim();

  const { upstream, cacheKey } = buildUpstream(symbol, interval, limit, feed);

  const cached = CACHE.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.ts < TTL_MS) return NextResponse.json(cached.data, { status: 200 });

  const parseBars = (json: any) => {
    const arr: any[] =
      (json?.bars && Array.isArray(json.bars) && json.bars) ||
      (json?.bars && json?.bars?.[symbol] && Array.isArray(json.bars[symbol]) && json.bars[symbol]) ||
      (json?.[symbol] && Array.isArray(json[symbol]) && json[symbol]) ||
      [];

    const candles = arr
      .map((b: any) => ({
        time: String(b?.t || b?.time || ''),
        open: Number(b?.o ?? b?.open ?? 0),
        high: Number(b?.h ?? b?.high ?? 0),
        low: Number(b?.l ?? b?.low ?? 0),
        close: Number(b?.c ?? b?.close ?? 0),
        volume: b?.v ?? b?.volume,
      }))
      .filter((c: any) => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0);

    return { candles };
  };

  try {
    // try chosen feed
    const json1 = await fetchJson(upstream);
    const payload1 = parseBars(json1);

    // cache + return (even if market closed, it should return latest bars; if empty, client fallback handles)
    CACHE.set(cacheKey, { ts: now, data: payload1 });
    return NextResponse.json(payload1, { status: 200 });
  } catch (e: any) {
    // if SIP not allowed, auto-fallback to IEX
    const status = Number(e?.status) || 500;
    const msg = String(e?.message || '');

    const sipWanted = feed.toLowerCase() === 'sip';
    if (sipWanted && (status === 401 || status === 403)) {
      try {
        const { upstream: u2, cacheKey: ck2 } = buildUpstream(symbol, interval, limit, 'iex');
        const json2 = await fetchJson(u2);
        const payload2 = parseBars(json2);
        CACHE.set(ck2, { ts: now, data: payload2 });
        return NextResponse.json(payload2, { status: 200, headers: { 'x-feed-fallback': 'iex' } });
      } catch {}
    }

    if (cached?.data) return NextResponse.json(cached.data, { status: 200, headers: { 'x-stale': '1' } });
    return NextResponse.json({ error: msg || 'Market data error' }, { status });
  }
}

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
  const x = String(interval || '').trim();
  const t = x.toLowerCase();

  // accept your UI, Twelve-ish, and Alpaca-ish
  if (t === '1m' || t === '1min' || t === '1min') return '1Min';
  if (t === '5m' || t === '5min') return '5Min';
  if (t === '15m' || t === '15min') return '15Min';
  if (t === '1h' || t === '1hour') return '1Hour';
  if (t === '4h' || t === '4hour') return '4Hour';
  if (t === '1d' || t === '1day') return '1Day';

  // already alpaca style?
  if (x === '1Min' || x === '5Min' || x === '15Min' || x === '1Hour' || x === '4Hour' || x === '1Day') return x;

  return '15Min';
}

function normalizeBarTime(raw: any) {
  let s = String(raw || '').trim();
  if (!s) return '';

  // "YYYY-MM-DD HH:mm:ss" -> ISO-like
  s = s.includes(' ') ? s.replace(' ', 'T') : s;

  // Trim fractional seconds to 3 digits (JS safe): .123456Z -> .123Z
  s = s.replace(/\.(\d{3})\d+(Z|[+-]\d\d:\d\d)?$/, '.$1$2');

  // Ensure timezone
  if (!s.endsWith('Z') && !/[+-]\d\d:\d\d$/.test(s)) s += 'Z';

  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return '';

  // Return clean ISO always ending with Z
  return new Date(ms).toISOString();
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const symbol = String(url.searchParams.get('symbol') || '').trim().toUpperCase();
  const interval = String(url.searchParams.get('tf') || url.searchParams.get('interval') || '15min');
  const limitRaw = Number(url.searchParams.get('limit') || 220);
  const limit = Number.isFinite(limitRaw) ? Math.max(10, Math.min(500, Math.floor(limitRaw))) : 220;

  if (!symbol) return NextResponse.json({ candles: [] }, { status: 200 });

  // ✅ IMPORTANT: default to IEX unless you explicitly set SIP
  const feed =
    (url.searchParams.get('feed') ||
      process.env.ALPACA_DATA_FEED ||
      'iex').trim();

  const qs = new URLSearchParams({
    symbols: symbol,
    timeframe: toTf(interval),
    limit: String(limit),
  });
  if (feed) qs.set('feed', feed);

  const upstream = `https://data.alpaca.markets/v2/stocks/bars?${qs.toString()}`;
  const cacheKey = `bars:${qs.toString()}`;

  const cached = CACHE.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.ts < TTL_MS) {
    return NextResponse.json(cached.data, { status: 200 });
  }

  try {
    const json = await fetchJson(upstream);

    // Alpaca bars often returns { bars: { AAPL: [...] } }
    const arr: any[] =
      (json?.bars && Array.isArray(json.bars) && json.bars) ||
      (json?.bars && json?.bars?.[symbol] && Array.isArray(json.bars[symbol]) && json.bars[symbol]) ||
      (json?.[symbol] && Array.isArray(json[symbol]) && json[symbol]) ||
      [];

    const candles = arr
      .map((b: any) => {
        const time = normalizeBarTime(b?.t ?? b?.time);
        return {
          time,
          open: Number(b?.o ?? b?.open ?? 0),
          high: Number(b?.h ?? b?.high ?? 0),
          low: Number(b?.l ?? b?.low ?? 0),
          close: Number(b?.c ?? b?.close ?? 0),
          volume: b?.v ?? b?.volume,
        };
      })
      .filter((c: any) => !!c.time && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0);

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

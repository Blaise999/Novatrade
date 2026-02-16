// app/api/market/stocks/candles/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CacheEntry = { ts: number; data: any };
const g = globalThis as any;
g.__ALPACA_STOCKS_BARS_CACHE ||= new Map<string, CacheEntry>();
const CACHE: Map<string, CacheEntry> = g.__ALPACA_STOCKS_BARS_CACHE;

// short TTL so UI feels live but still reduces upstream spam
const TTL_MS = 12_000;

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

async function fetchJson(url: string, timeoutMs = 12_000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: alpacaHeaders(), signal: ac.signal, cache: 'no-store' });
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

function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function normalizeUnixSec(x: number) {
  if (!Number.isFinite(x) || x <= 0) return 0;
  // if user passed milliseconds
  if (x > 1_000_000_000_000) return Math.floor(x / 1000);
  return Math.floor(x);
}

type TfInfo = {
  // what we request from Alpaca
  alpacaTf: '1Min' | '5Min' | '15Min' | '1Hour' | '1Day';
  // what we output to client (ms)
  outIntervalMs: number;
  // if we must aggregate 1Hour -> 4Hour
  aggFactor: number; // 1 = none, 4 = group 4 hourly bars
};

function parseTf(tfRaw: string): TfInfo {
  const tf = String(tfRaw || '').trim().toLowerCase();

  // accept 1m, 1min, 15min etc
  if (tf === '1m' || tf === '1min' || tf === '1minute') return { alpacaTf: '1Min', outIntervalMs: 60_000, aggFactor: 1 };
  if (tf === '5m' || tf === '5min' || tf === '5minute') return { alpacaTf: '5Min', outIntervalMs: 300_000, aggFactor: 1 };
  if (tf === '15m' || tf === '15min' || tf === '15minute') return { alpacaTf: '15Min', outIntervalMs: 900_000, aggFactor: 1 };
  if (tf === '1h' || tf === '1hour') return { alpacaTf: '1Hour', outIntervalMs: 3_600_000, aggFactor: 1 };

  // ✅ 4h: Alpaca doesn’t reliably provide 4Hour for stocks in all plans; aggregate 1Hour -> 4Hour
  if (tf === '4h' || tf === '4hour') return { alpacaTf: '1Hour', outIntervalMs: 14_400_000, aggFactor: 4 };

  if (tf === '1d' || tf === '1day' || tf === 'day' || tf === '1d') return { alpacaTf: '1Day', outIntervalMs: 86_400_000, aggFactor: 1 };

  // fallback
  return { alpacaTf: '15Min', outIntervalMs: 900_000, aggFactor: 1 };
}

type RawBar = { t: string; o: number; h: number; l: number; c: number; v?: number };

function parseBarTimeMs(t: string) {
  const ms = Date.parse(String(t || ''));
  return Number.isFinite(ms) ? ms : 0;
}

function aggregateToInterval(bars: RawBar[], intervalMs: number) {
  if (!bars.length) return [];

  const sorted = [...bars]
    .map((b) => ({ ...b, _ms: parseBarTimeMs(b.t) }))
    .filter((b) => b._ms > 0 && b.o > 0 && b.h > 0 && b.l > 0 && b.c > 0)
    .sort((a, b) => a._ms - b._ms);

  const map = new Map<number, { tMs: number; o: number; h: number; l: number; c: number; v: number }>();

  for (const b of sorted) {
    const bucket = Math.floor(b._ms / intervalMs) * intervalMs;
    const ex = map.get(bucket);
    const vol = n((b as any).v, 0);

    if (!ex) {
      map.set(bucket, { tMs: bucket, o: b.o, h: b.h, l: b.l, c: b.c, v: vol });
    } else {
      ex.h = Math.max(ex.h, b.h);
      ex.l = Math.min(ex.l, b.l);
      ex.c = b.c; // last close wins
      ex.v += vol;
    }
  }

  return Array.from(map.values())
    .sort((a, b) => a.tMs - b.tMs)
    .map((x) => ({
      time: new Date(x.tMs).toISOString(),
      open: x.o,
      high: x.h,
      low: x.l,
      close: x.c,
      volume: x.v,
    }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const symbol = String(url.searchParams.get('symbol') || '').trim().toUpperCase();
  if (!symbol) return NextResponse.json({ candles: [] }, { status: 200 });

  const tfParam = String(url.searchParams.get('tf') || url.searchParams.get('interval') || '15m');
  const tfInfo = parseTf(tfParam);

  const limitRaw = Number(url.searchParams.get('limit') || 220);
  const limit = Number.isFinite(limitRaw) ? Math.max(10, Math.min(500, Math.floor(limitRaw))) : 220;

  // ✅ default feed to iex so it works on free plans
  const feed = String(url.searchParams.get('feed') || process.env.ALPACA_DATA_FEED || 'iex').trim();

  // range inputs (unix sec/ms)
  const fromQ = normalizeUnixSec(Number(url.searchParams.get('from')));
  const toQ = normalizeUnixSec(Number(url.searchParams.get('to')));
  const endQ = normalizeUnixSec(Number(url.searchParams.get('end')));

  const nowSec = Math.floor(Date.now() / 1000);
  const endSec = (toQ > 0 ? toQ : endQ > 0 ? endQ : nowSec);

  // If explicit from/to given, use them. Else compute a good default window.
  // Buffer is important because market is closed a lot (weekends/holidays/after-hours).
  const outSec = Math.floor(tfInfo.outIntervalMs / 1000);
  const defaultFromSec = Math.max(endSec - outSec * limit * 2, 1);

  const startSec =
    fromQ > 0 && (toQ > fromQ)
      ? fromQ
      : defaultFromSec;

  const startIso = new Date(startSec * 1000).toISOString();
  const endIso = new Date(endSec * 1000).toISOString();

  // For 4h aggregation, we must fetch more 1h bars to build enough 4h candles.
  const rawLimit =
    tfInfo.aggFactor > 1
      ? Math.min(5000, Math.max(100, Math.floor(limit * tfInfo.aggFactor * 2)))
      : limit;

  const qs = new URLSearchParams({
    symbols: symbol,
    timeframe: tfInfo.alpacaTf,
    limit: String(rawLimit),
    feed,
    start: startIso,
    end: endIso,
  });

  const upstream = `https://data.alpaca.markets/v2/stocks/bars?${qs.toString()}`;
  const cacheKey = `stocks:bars:${qs.toString()}`;

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

    const rawBars: RawBar[] = arr
      .map((b: any) => ({
        t: String(b?.t || b?.time || ''),
        o: n(b?.o ?? b?.open, 0),
        h: n(b?.h ?? b?.high, 0),
        l: n(b?.l ?? b?.low, 0),
        c: n(b?.c ?? b?.close, 0),
        v: n(b?.v ?? b?.volume, 0),
      }))
      .filter((b) => b.t && b.o > 0 && b.h > 0 && b.l > 0 && b.c > 0);

    let candles: any[] = [];

    if (tfInfo.aggFactor > 1) {
      // ✅ build 4h candles by aggregating hourly bars
      candles = aggregateToInterval(rawBars, tfInfo.outIntervalMs);
    } else {
      candles = rawBars.map((b) => ({
        time: b.t,
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
      }));
    }

    // Keep only the last "limit" candles for UI consistency
    const final = candles.slice(-limit);

    const payload = { candles: final };
    CACHE.set(cacheKey, { ts: now, data: payload });
    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    if (cached?.data) {
      return NextResponse.json(cached.data, { status: 200, headers: { 'x-stale': '1' } });
    }
    const status = Number(e?.status) || 500;
    return NextResponse.json({ error: String(e?.message || 'Market data error'), candles: [] }, { status });
  }
}

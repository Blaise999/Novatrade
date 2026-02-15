import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Candle = {
  time: number; // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type ApiPayload =
  | { ok: true; provider: 'alpaca'; symbol: string; interval: string; candles: Candle[]; error: null; cached: boolean }
  | { ok: false; provider: 'alpaca'; symbol: string; interval: string; candles: Candle[]; error: string; cached: boolean };

const cache = new Map<string, { ts: number; payload: ApiPayload }>();
const TTL_MS = 12_000;

function clampSymbol(sym: string) {
  const s = (sym || '').trim().toUpperCase();
  if (!s) return '';
  if (!/^[A-Z0-9.\-]{1,15}$/.test(s)) return '';
  return s;
}

function clampInterval(v: string): string {
  const allowed = new Set<string>(['1min','5min','15min','30min','45min','1h','2h','4h','1day','1week']);
  const x = (v || '15min').trim();
  return allowed.has(x) ? x : '15min';
}

function intervalToTimeframe(interval: string) {
  const x = interval.trim().toLowerCase();
  switch (x) {
    case '1min': return '1Min';
    case '5min': return '5Min';
    case '15min': return '15Min';
    case '30min': return '30Min';
    case '45min': return '1Hour';   // closest
    case '1h': return '1Hour';
    case '2h': return '1Hour';      // closest (keeps chart alive)
    case '4h': return '1Hour';      // closest (keeps chart alive)
    case '1day': return '1Day';
    case '1week': return '1Day';    // closest
    default: return '15Min';
  }
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const symbol = clampSymbol(url.searchParams.get('symbol') || '');
  const interval = clampInterval(url.searchParams.get('interval') || '15min');
  const outputsizeRaw = Number(url.searchParams.get('outputsize') || 220);
  const outputsize = Math.max(20, Math.min(1000, Number.isFinite(outputsizeRaw) ? outputsizeRaw : 220));

  if (!symbol) {
    const payload: ApiPayload = { ok: true, provider: 'alpaca', symbol: '', interval, candles: [], error: null, cached: false };
    return NextResponse.json(payload, { status: 200 });
  }

  const key = process.env.ALPACA_API_KEY || '';
  const secret = process.env.ALPACA_API_SECRET || '';
  const feed = (process.env.ALPACA_DATA_FEED || 'iex').toLowerCase();

  const cacheKey = `bars:${symbol}:${interval}:${outputsize}`;
  const hit = cache.get(cacheKey);

  if (hit && Date.now() - hit.ts < TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true } satisfies ApiPayload, { status: 200 });
  }

  if (!key || !secret) {
    const payload: ApiPayload = { ok: false, provider: 'alpaca', symbol, interval, candles: [], error: 'missing_ALPACA_keys', cached: false };
    cache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload, { status: 200 });
  }

  try {
    const timeframe = intervalToTimeframe(interval);

    const apiUrl =
      `https://data.alpaca.markets/v2/stocks/bars?symbols=${encodeURIComponent(symbol)}` +
      `&timeframe=${encodeURIComponent(timeframe)}` +
      `&limit=${encodeURIComponent(String(outputsize))}` +
      `&adjustment=raw&feed=${encodeURIComponent(feed)}&sort=asc`;

    const r = await fetch(apiUrl, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'APCA-API-KEY-ID': key,
        'APCA-API-SECRET-KEY': secret,
      },
    });

    const text = await r.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = null; }

    if (!r.ok || !json?.bars?.[symbol]) {
      const err = `alpaca_http_${r.status}`;
      if (hit?.payload?.candles?.length) {
        const fallback: ApiPayload = { ...(hit.payload as ApiPayload), ok: false, error: err, cached: true };
        return NextResponse.json(fallback, { status: 200 });
      }

      const payload: ApiPayload = { ok: false, provider: 'alpaca', symbol, interval, candles: [], error: err, cached: false };
      cache.set(cacheKey, { ts: Date.now(), payload });
      return NextResponse.json(payload, { status: 200 });
    }

    const values: any[] = Array.isArray(json.bars[symbol]) ? json.bars[symbol] : [];

    const candles: Candle[] = values
      .map((b: any): Candle => {
        const t = Date.parse(String(b?.t || ''));
        return {
          time: Number.isFinite(t) ? t : 0,
          open: safeNum(b?.o),
          high: safeNum(b?.h),
          low: safeNum(b?.l),
          close: safeNum(b?.c),
          volume: b?.v != null ? safeNum(b?.v) : undefined,
        };
      })
      .filter((c: Candle) => c.time > 0)
      .sort((a, b) => a.time - b.time);

    const payload: ApiPayload = { ok: true, provider: 'alpaca', symbol, interval, candles, error: null, cached: false };
    cache.set(cacheKey, { ts: Date.now(), payload });

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    if (hit?.payload) {
      const fallback: ApiPayload = { ...(hit.payload as ApiPayload), ok: false, error: 'network_error', cached: true };
      return NextResponse.json(fallback, { status: 200 });
    }

    const payload: ApiPayload = { ok: false, provider: 'alpaca', symbol, interval, candles: [], error: 'network_error', cached: false };
    return NextResponse.json(payload, { status: 200 });
  }
}

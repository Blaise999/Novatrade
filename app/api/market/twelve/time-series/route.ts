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
  | {
      ok: true;
      provider: 'twelvedata';
      symbol: string;
      interval: string;
      candles: Candle[];
      error: null;
      cached: boolean;
    }
  | {
      ok: false;
      provider: 'twelvedata';
      symbol: string;
      interval: string;
      candles: Candle[];
      error: string;
      cached: boolean;
    };

const cache = new Map<string, { ts: number; payload: ApiPayload }>();
const TTL_MS = 12_000;

function toISOZ(dt: string): string {
  // Twelve often returns "YYYY-MM-DD HH:mm:ss"
  // Make it ISO and force UTC.
  const s = dt.trim();
  if (!s) return '';
  if (s.includes('T')) return s.endsWith('Z') ? s : `${s}Z`;
  return `${s.replace(' ', 'T')}Z`;
}

function clampInterval(v: string): string {
  const allowed = new Set<string>([
    '1min',
    '5min',
    '15min',
    '30min',
    '45min',
    '1h',
    '2h',
    '4h',
    '1day',
    '1week',
  ]);
  const x = (v || '15min').trim();
  return allowed.has(x) ? x : '15min';
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get('symbol') || '').trim().toUpperCase();
  const interval = clampInterval(url.searchParams.get('interval') || '15min');
  const outputsizeRaw = Number(url.searchParams.get('outputsize') || 220);
  const outputsize = Math.max(20, Math.min(500, Number.isFinite(outputsizeRaw) ? outputsizeRaw : 220));

  if (!symbol) {
    const payload: ApiPayload = {
      ok: true,
      provider: 'twelvedata',
      symbol: '',
      interval,
      candles: [],
      error: null,
      cached: false,
    };
    return NextResponse.json(payload, { status: 200 });
  }

  const key = process.env.TWELVEDATA_API_KEY || process.env.TWELVE_DATA_API_KEY || '';
  const cacheKey = `ts:${symbol}:${interval}:${outputsize}`;

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true } satisfies ApiPayload, { status: 200 });
  }

  if (!key) {
    const payload: ApiPayload = {
      ok: false,
      provider: 'twelvedata',
      symbol,
      interval,
      candles: [],
      error: 'missing_TWELVEDATA_API_KEY',
      cached: false,
    };
    cache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload, { status: 200 });
  }

  try {
    const apiUrl =
      `https://api.twelvedata.com/time_series` +
      `?symbol=${encodeURIComponent(symbol)}` +
      `&interval=${encodeURIComponent(interval)}` +
      `&outputsize=${outputsize}` +
      `&order=ASC` +
      `&apikey=${encodeURIComponent(key)}`;

    const r = await fetch(apiUrl, { cache: 'no-store' });
    const json: any = await r.json();

    if (!r.ok || json?.status === 'error') {
      const err: string = String(json?.message || `twelvedata_http_${r.status}`);

      if (hit?.payload?.candles?.length) {
        const fallback: ApiPayload = { ...(hit.payload as ApiPayload), ok: false, error: err, cached: true };
        return NextResponse.json(fallback, { status: 200 });
      }

      const payload: ApiPayload = {
        ok: false,
        provider: 'twelvedata',
        symbol,
        interval,
        candles: [],
        error: err,
        cached: false,
      };
      cache.set(cacheKey, { ts: Date.now(), payload });
      return NextResponse.json(payload, { status: 200 });
    }

    const values: any[] = Array.isArray(json?.values) ? json.values : [];

    const candles: Candle[] = values
      .map((v: any): Candle => {
        const t = Date.parse(toISOZ(String(v.datetime || v.date || '')));
        return {
          time: Number.isFinite(t) ? t : 0,
          open: safeNum(v.open),
          high: safeNum(v.high),
          low: safeNum(v.low),
          close: safeNum(v.close),
          volume: v.volume != null ? safeNum(v.volume) : undefined,
        };
      })
      .filter((c: Candle) => c.time > 0 && c.open >= 0 && c.high >= 0 && c.low >= 0 && c.close >= 0)
      .sort((a: Candle, b: Candle) => a.time - b.time);

    const payload: ApiPayload = {
      ok: true,
      provider: 'twelvedata',
      symbol,
      interval,
      candles,
      error: null,
      cached: false,
    };

    cache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    if (hit?.payload) {
      const fallback: ApiPayload = { ...(hit.payload as ApiPayload), ok: false, error: String(e?.message || e), cached: true };
      return NextResponse.json(fallback, { status: 200 });
    }

    const payload: ApiPayload = {
      ok: false,
      provider: 'twelvedata',
      symbol,
      interval,
      candles: [],
      error: String(e?.message || e),
      cached: false,
    };
    return NextResponse.json(payload, { status: 200 });
  }
}

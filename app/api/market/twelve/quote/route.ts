import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// simple in-memory cache (server instance)
const cache = new Map<string, { ts: number; payload: any }>();
const TTL_MS = 8_000;

function cleanSymbols(raw: string) {
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .filter((s) => /^[A-Z0-9.\-]{1,15}$/.test(s));
}

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('symbol') || url.searchParams.get('symbols') || '';
  const symbols = cleanSymbols(raw);

  if (!symbols.length) {
    return NextResponse.json({ ok: true, provider: 'alpaca', symbols: [], data: {}, error: null }, { status: 200 });
  }

  const key = process.env.ALPACA_API_KEY || '';
  const secret = process.env.ALPACA_API_SECRET || '';
  const feed = (process.env.ALPACA_DATA_FEED || 'iex').toLowerCase();

  const cacheKey = `quote:${symbols.join(',')}`;

  // cache hit
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true }, { status: 200 });
  }

  if (!key || !secret) {
    const payload = { ok: false, provider: 'alpaca', symbols, data: {}, error: 'missing_ALPACA_keys', cached: false };
    cache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload, { status: 200 });
  }

  try {
    // Snapshots gives latestTrade/latestQuote + dailyBar + prevDailyBar
    const apiUrl =
      `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${encodeURIComponent(symbols.join(','))}` +
      `&feed=${encodeURIComponent(feed)}`;

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

    if (!r.ok || !json) {
      const payload = { ok: false, provider: 'alpaca', symbols, data: {}, error: `alpaca_http_${r.status}`, cached: false };
      if (hit?.payload?.data && Object.keys(hit.payload.data).length) {
        return NextResponse.json({ ...hit.payload, ok: false, error: payload.error, cached: true }, { status: 200 });
      }
      cache.set(cacheKey, { ts: Date.now(), payload });
      return NextResponse.json(payload, { status: 200 });
    }

    const data: Record<string, any> = {};
    for (const sym of symbols) {
      const snap = json?.[sym];
      if (!snap) continue;

      const latestTradeP = n(snap?.latestTrade?.p);
      const minuteClose = n(snap?.minuteBar?.c);
      const daily = snap?.dailyBar;
      const prev = snap?.prevDailyBar;

      const price = latestTradeP || minuteClose || n(daily?.c);

      const open = n(daily?.o);
      const high = n(daily?.h);
      const low = n(daily?.l);
      const previous_close = n(prev?.c);

      const change = price && previous_close ? price - previous_close : 0;
      const percent_change = previous_close ? (change / previous_close) * 100 : 0;

      data[sym] = {
        symbol: sym,
        price,
        open,
        high,
        low,
        previous_close,
        change,
        percent_change,
        timestamp: Date.now(),
        raw: snap,
      };
    }

    const payload = { ok: true, provider: 'alpaca', symbols, data, error: null, cached: false };
    cache.set(cacheKey, { ts: Date.now(), payload });

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    if (hit?.payload) {
      return NextResponse.json({ ...hit.payload, ok: false, error: 'network_error', cached: true }, { status: 200 });
    }
    return NextResponse.json({ ok: false, provider: 'alpaca', symbols, data: {}, error: 'network_error', cached: false }, { status: 200 });
  }
}

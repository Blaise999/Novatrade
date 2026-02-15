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
    .filter((s) => /^[A-Z0-9.\-:_]{1,20}$/.test(s));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('symbol') || url.searchParams.get('symbols') || '';
  const symbols = cleanSymbols(raw);

  if (!symbols.length) {
    return NextResponse.json({ ok: true, provider: 'twelvedata', symbols: [], data: {}, error: null }, { status: 200 });
  }

  const key = process.env.TWELVEDATA_API_KEY || process.env.TWELVE_DATA_API_KEY || '';
  const cacheKey = `quote:${symbols.join(',')}`;

  // cache hit
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true }, { status: 200 });
  }

  if (!key) {
    const payload = {
      ok: false,
      provider: 'twelvedata',
      symbols,
      data: {},
      error: 'missing_TWELVEDATA_API_KEY',
      cached: false,
    };
    cache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload, { status: 200 });
  }

  try {
    const apiUrl = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(
      symbols.join(',')
    )}&apikey=${encodeURIComponent(key)}`;

    const r = await fetch(apiUrl, { cache: 'no-store' });
    const json = await r.json();

    // TwelveData may return { status:"error", message:"..." }
    if (!r.ok || json?.status === 'error') {
      const payload = {
        ok: false,
        provider: 'twelvedata',
        symbols,
        data: {},
        error: json?.message || `twelvedata_http_${r.status}`,
        cached: false,
      };

      // return last good cache if exists
      if (hit?.payload?.data && Object.keys(hit.payload.data).length) {
        return NextResponse.json({ ...hit.payload, ok: false, error: payload.error, cached: true }, { status: 200 });
      }

      cache.set(cacheKey, { ts: Date.now(), payload });
      return NextResponse.json(payload, { status: 200 });
    }

    // normalize multi/single response into a map
    const data: Record<string, any> = {};
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      // multi symbol usually returns {AAPL:{...}, NVDA:{...}}
      if (symbols.length > 1) {
        for (const sym of symbols) {
          const q = (json as any)[sym];
          if (q && typeof q === 'object') {
            data[sym] = {
              symbol: sym,
              price: Number(q.close ?? q.price ?? q.last ?? q?.quote?.close ?? 0) || 0,
              open: Number(q.open ?? 0) || 0,
              high: Number(q.high ?? 0) || 0,
              low: Number(q.low ?? 0) || 0,
              previous_close: Number(q.previous_close ?? 0) || 0,
              change: Number(q.change ?? 0) || 0,
              percent_change: Number(q.percent_change ?? 0) || 0,
              timestamp: Date.now(),
              raw: q,
            };
          }
        }
      } else {
        const sym = symbols[0];
        data[sym] = {
          symbol: sym,
          price: Number(json.close ?? json.price ?? json.last ?? 0) || 0,
          open: Number(json.open ?? 0) || 0,
          high: Number(json.high ?? 0) || 0,
          low: Number(json.low ?? 0) || 0,
          previous_close: Number(json.previous_close ?? 0) || 0,
          change: Number(json.change ?? 0) || 0,
          percent_change: Number(json.percent_change ?? 0) || 0,
          timestamp: Date.now(),
          raw: json,
        };
      }
    }

    const payload = { ok: true, provider: 'twelvedata', symbols, data, error: null, cached: false };
    cache.set(cacheKey, { ts: Date.now(), payload });

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    // fall back to cached good response
    if (hit?.payload) {
      return NextResponse.json({ ...hit.payload, ok: false, error: String(e?.message || e), cached: true }, { status: 200 });
    }
    return NextResponse.json(
      { ok: false, provider: 'twelvedata', symbols, data: {}, error: String(e?.message || e), cached: false },
      { status: 200 }
    );
  }
}

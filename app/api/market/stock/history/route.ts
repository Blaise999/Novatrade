/**
 * STOCK CANDLES API - FINNHUB TICKS TO OHLC
 * ==========================================
 * 
 * Fetches stock candle data from Finnhub API.
 * Supports standard candle endpoint with proper OHLC validation.
 * 
 * Query params:
 * - symbol: Stock ticker (e.g., AAPL, NVDA)
 * - tf/resolution: timeframe (1m, 5m, 15m, 1h, 4h, 1D)
 * - from/to: Unix timestamps (optional)
 * - limit: number of candles (default 300)
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

const DEBUG = process.env.DEBUG_MARKET === "1";

function log(...args: any[]) {
  if (DEBUG) console.log("[Stock/history]", ...args);
}

// ============================================
// TIMEFRAME UTILITIES
// ============================================

function tfToResolution(tf: string): string {
  const t = String(tf || "").trim().toLowerCase();
  switch (t) {
    case "1m": return "1";
    case "5m": return "5";
    case "15m": return "15";
    case "30m": return "30";
    case "1h": return "60";
    case "4h": return "240";
    case "1d": case "d": return "D";
    case "1w": case "w": return "W";
    case "1mo": case "m": return "M";
    default: return t;
  }
}

function secondsPerCandle(resolution: string): number {
  switch (resolution) {
    case "1": return 60;
    case "5": return 300;
    case "15": return 900;
    case "30": return 1800;
    case "60": return 3600;
    case "240": return 14400;
    case "D": return 86400;
    case "W": return 604800;
    case "M": return 2592000;
    default: return 900;
  }
}

function getDefaultRange(resolution: string): { from: number; to: number } {
  const now = Math.floor(Date.now() / 1000);

  // Intraday: last 7 days
  if (["1", "5", "15", "30", "60", "240"].includes(resolution)) {
    return { from: now - 60 * 60 * 24 * 7, to: now };
  }

  // Daily/Weekly/Monthly: last 365 days
  return { from: now - 60 * 60 * 24 * 365, to: now };
}

// ============================================
// CANDLE TYPE
// ============================================

type RawCandle = {
  t: number;    // Unix timestamp (seconds)
  o: number;    // Open
  h: number;    // High
  l: number;    // Low
  c: number;    // Close
  v: number;    // Volume
};

// ============================================
// TICK TYPE & AGGREGATION
// ============================================

type Tick = {
  p: number;    // Price
  t: number;    // Timestamp (ms)
  v: number;    // Volume
  c?: string[]; // Conditions
};

function aggregateTicksToOHLC(
  ticks: Tick[],
  intervalSeconds: number,
  limit: number = 300
): RawCandle[] {
  if (!ticks.length) return [];

  // Sort ticks by time
  const sorted = [...ticks].sort((a, b) => a.t - b.t);

  const intervalMs = intervalSeconds * 1000;
  const candles: Map<number, RawCandle> = new Map();

  for (const tick of sorted) {
    // Floor to interval boundary
    const candleTimeMs = Math.floor(tick.t / intervalMs) * intervalMs;
    const candleTimeSec = Math.floor(candleTimeMs / 1000);

    const existing = candles.get(candleTimeSec);

    if (existing) {
      // Update existing candle
      existing.h = Math.max(existing.h, tick.p);
      existing.l = Math.min(existing.l, tick.p);
      existing.c = tick.p;
      existing.v += tick.v || 0;
    } else {
      // Create new candle
      candles.set(candleTimeSec, {
        t: candleTimeSec,
        o: tick.p,
        h: tick.p,
        l: tick.p,
        c: tick.p,
        v: tick.v || 0,
      });
    }
  }

  // Convert to array, sort, and take last N
  return Array.from(candles.values())
    .sort((a, b) => a.t - b.t)
    .slice(-limit);
}

// ============================================
// FINNHUB CANDLE FETCHER
// ============================================

async function fetchFinnhubCandles(
  symbol: string,
  resolution: string,
  from: number,
  to: number,
  apiKey: string
): Promise<{ data: any; error: string | null; status: number }> {
  const url = new URL(`${FINNHUB_BASE}/stock/candle`);
  url.searchParams.set("symbol", symbol.toUpperCase());
  url.searchParams.set("resolution", resolution);
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));

  const headers = new Headers({
    accept: "application/json",
    "X-Finnhub-Token": apiKey,
  });

  log("Fetching candles:", { symbol, resolution, from, to });

  try {
    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    const text = await res.text();

    let json: any = null;
    try { json = JSON.parse(text); } catch { json = null; }

    if (!res.ok) {
      log("Upstream error:", { status: res.status, body: text?.slice(0, 200) });
      return { data: null, error: json?.error || `Error ${res.status}`, status: res.status };
    }

    // Finnhub returns { s: "ok"|"no_data", c, h, l, o, t, v }
    if (json?.s === "no_data" || !json?.t?.length) {
      log("No data returned");
      return { data: { s: "no_data", t: [], o: [], h: [], l: [], c: [], v: [] }, error: null, status: 200 };
    }

    return { data: json, error: null, status: 200 };

  } catch (err: any) {
    log("Fetch error:", err?.message);
    return { data: null, error: err?.message || "Network error", status: 500 };
  }
}

// ============================================
// FINNHUB TICK FETCHER (for building custom OHLC)
// ============================================

async function fetchFinnhubTicks(
  symbol: string,
  from: number,
  to: number,
  apiKey: string
): Promise<{ ticks: Tick[] | null; error: string | null }> {
  // Finnhub stock trades endpoint
  const url = new URL(`${FINNHUB_BASE}/stock/tick`);
  url.searchParams.set("symbol", symbol.toUpperCase());
  url.searchParams.set("date", new Date(to * 1000).toISOString().split("T")[0]); // YYYY-MM-DD

  const headers = new Headers({
    accept: "application/json",
    "X-Finnhub-Token": apiKey,
  });

  log("Fetching ticks:", { symbol, date: new Date(to * 1000).toISOString().split("T")[0] });

  try {
    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    const text = await res.text();

    let json: any = null;
    try { json = JSON.parse(text); } catch { json = null; }

    if (!res.ok) {
      return { ticks: null, error: json?.error || `Error ${res.status}` };
    }

    // Finnhub returns: { data: [ { p, t, v, c } ], ... }
    const data = Array.isArray(json?.data) ? json.data : [];

    const ticks: Tick[] = data
      .map((t: any) => ({
        p: Number(t.p ?? 0),
        t: Number(t.t ?? 0),
        v: Number(t.v ?? 0),
        c: t.c,
      }))
      .filter((t: Tick) => t.p > 0 && t.t > 0);

    log("Parsed ticks:", { count: ticks.length });
    return { ticks, error: null };

  } catch (err: any) {
    return { ticks: null, error: err?.message || "Network error" };
  }
}

// ============================================
// VALIDATE & FIX OHLC
// ============================================

function validateOHLC(candle: RawCandle): RawCandle {
  const prices = [candle.o, candle.h, candle.l, candle.c].filter(Number.isFinite);
  if (prices.length === 0) {
    return { ...candle, o: 0, h: 0, l: 0, c: 0 };
  }

  return {
    t: candle.t,
    o: candle.o,
    h: Math.max(...prices),
    l: Math.min(...prices),
    c: candle.c,
    v: candle.v,
  };
}

// ============================================
// MAIN HANDLER
// ============================================

export async function GET(req: NextRequest) {
  const started = Date.now();

  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing FINNHUB_API_KEY", s: "error" },
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const { searchParams } = new URL(req.url);

    const symbol = (searchParams.get("symbol") || "AAPL").toUpperCase();
    const tfParam = searchParams.get("tf") || searchParams.get("resolution") || "15m";
    const resolution = tfToResolution(tfParam);

    // Whether to use tick aggregation
    const useTicks = searchParams.get("ticks") === "1";
    const limit = Math.min(500, Math.max(10, Number(searchParams.get("limit") || 300)));

    // Time range
    const fromQ = Number(searchParams.get("from"));
    const toQ = Number(searchParams.get("to"));

    const { from, to } =
      Number.isFinite(fromQ) && Number.isFinite(toQ) && fromQ > 0 && toQ > fromQ
        ? { from: Math.floor(fromQ), to: Math.floor(toQ) }
        : getDefaultRange(resolution);

    log("Request:", { symbol, resolution, from, to, useTicks, limit });

    let responseData: any;

    if (useTicks && ["1", "5"].includes(resolution)) {
      // Try tick aggregation for small timeframes
      const { ticks, error: tickError } = await fetchFinnhubTicks(symbol, from, to, apiKey);

      if (tickError || !ticks || ticks.length === 0) {
        log("Tick fetch failed, falling back to candles");
        const { data, error, status } = await fetchFinnhubCandles(symbol, resolution, from, to, apiKey);
        
        if (error) {
          return new Response(JSON.stringify({ error, s: "error" }), {
            status,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        }
        
        responseData = data;
      } else {
        // Aggregate ticks to OHLC
        const candles = aggregateTicksToOHLC(ticks, secondsPerCandle(resolution), limit);
        
        // Convert to Finnhub format
        responseData = {
          s: candles.length > 0 ? "ok" : "no_data",
          t: candles.map(c => c.t),
          o: candles.map(c => c.o),
          h: candles.map(c => c.h),
          l: candles.map(c => c.l),
          c: candles.map(c => c.c),
          v: candles.map(c => c.v),
        };
        
        log("Aggregated ticks:", { tickCount: ticks.length, candleCount: candles.length });
      }
    } else {
      // Standard candle fetch
      const { data, error, status } = await fetchFinnhubCandles(symbol, resolution, from, to, apiKey);
      
      if (error) {
        return new Response(JSON.stringify({ error, s: "error" }), {
          status,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }
      
      responseData = data;
    }

    // Validate OHLC data
    if (responseData?.s === "ok" && Array.isArray(responseData.t)) {
      const tArr = responseData.t;
      const oArr = responseData.o || [];
      const hArr = responseData.h || [];
      const lArr = responseData.l || [];
      const cArr = responseData.c || [];
      const vArr = responseData.v || [];

      const validatedCandles: RawCandle[] = [];

      for (let i = 0; i < tArr.length; i++) {
        const candle = validateOHLC({
          t: Number(tArr[i]),
          o: Number(oArr[i]),
          h: Number(hArr[i]),
          l: Number(lArr[i]),
          c: Number(cArr[i]),
          v: Number(vArr[i] || 0),
        });

        if (candle.t > 0) {
          validatedCandles.push(candle);
        }
      }

      // Take only the last `limit` candles
      const finalCandles = validatedCandles.slice(-limit);

      responseData = {
        s: finalCandles.length > 0 ? "ok" : "no_data",
        t: finalCandles.map(c => c.t),
        o: finalCandles.map(c => c.o),
        h: finalCandles.map(c => c.h),
        l: finalCandles.map(c => c.l),
        c: finalCandles.map(c => c.c),
        v: finalCandles.map(c => c.v),
      };
    }

    log("Response:", { status: responseData?.s, count: responseData?.t?.length, tookMs: Date.now() - started });

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });

  } catch (err: any) {
    log("Exception:", err?.message);
    return new Response(JSON.stringify({ error: err?.message || "Server error", s: "error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

/**
 * FX CANDLES API - FINNHUB TICKS TO OHLC
 * =======================================
 * 
 * Fetches forex candle data from Finnhub API.
 * Supports both direct candle endpoint and tick-to-OHLC conversion.
 * 
 * Query params:
 * - symbol: OANDA:EUR_USD format
 * - display: EUR/USD format (converted to symbol)
 * - tf: timeframe (1m, 5m, 15m, 1h, 4h, 1D)
 * - limit: number of candles (default 120, max 500)
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

const DEBUG = process.env.DEBUG_MARKET === "1";

function log(...args: any[]) {
  if (DEBUG) console.log("[FX/candles]", ...args);
}

function safeSnippet(v: string, max = 240) {
  const t = String(v || "");
  return t.length > max ? t.slice(0, max) + "…" : t;
}

// ============================================
// TIMEFRAME UTILITIES
// ============================================

function tfNorm(tf: string): string {
  const t = String(tf || "").trim();
  if (t.toLowerCase() === "1d") return "1D";
  return t;
}

function tfToResolution(tfRaw: string): string {
  const tf = tfNorm(tfRaw);
  switch (tf) {
    case "1m": return "1";
    case "5m": return "5";
    case "15m": return "15";
    case "1h": return "60";
    case "4h": return "240";
    case "1D": return "D";
    default: return "15";
  }
}

function secondsPerCandle(tfRaw: string): number {
  const tf = tfNorm(tfRaw);
  switch (tf) {
    case "1m": return 60;
    case "5m": return 300;
    case "15m": return 900;
    case "1h": return 3600;
    case "4h": return 14400;
    case "1D": return 86400;
    default: return 900;
  }
}

// ============================================
// SYMBOL CONVERSION
// ============================================

function toFinnhubSymbol(symbolParam: string, displayParam: string): string {
  const symbol = (symbolParam || "").trim();
  const display = (displayParam || "").trim();
  
  if (symbol && symbol.includes(":")) return symbol;
  if (symbol) return `OANDA:${symbol.toUpperCase().replace("/", "_")}`;
  if (!display) return "";
  
  return `OANDA:${display.toUpperCase().replace("/", "_")}`;
}

function displayFromSymbol(symbol: string): string {
  // OANDA:EUR_USD -> EUR/USD
  const clean = symbol.replace("OANDA:", "").replace("_", "/");
  return clean;
}

// ============================================
// CANDLE TYPE
// ============================================

type RawCandle = {
  timestamp: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// ============================================
// TICK TO OHLC AGGREGATION
// ============================================

type Tick = {
  p: number;  // price
  t: number;  // timestamp (ms)
  v: number;  // volume
};

function aggregateTicksToOHLC(
  ticks: Tick[],
  intervalSeconds: number,
  limit: number
): RawCandle[] {
  if (!ticks.length) return [];

  // Sort ticks by time
  const sorted = [...ticks].sort((a, b) => a.t - b.t);
  
  const intervalMs = intervalSeconds * 1000;
  const candles: Map<number, RawCandle> = new Map();
  
  for (const tick of sorted) {
    // Floor to interval boundary
    const candleTime = Math.floor(tick.t / intervalMs) * intervalMs;
    const candleTimeSec = Math.floor(candleTime / 1000);
    
    const existing = candles.get(candleTimeSec);
    
    if (existing) {
      // Update existing candle
      existing.high = Math.max(existing.high, tick.p);
      existing.low = Math.min(existing.low, tick.p);
      existing.close = tick.p;
      existing.volume += tick.v || 0;
    } else {
      // Create new candle
      candles.set(candleTimeSec, {
        time: candleTimeSec,
        timestamp: new Date(candleTime).toISOString(),
        open: tick.p,
        high: tick.p,
        low: tick.p,
        close: tick.p,
        volume: tick.v || 0,
      });
    }
  }
  
  // Convert to array, sort, and take last N
  const result = Array.from(candles.values())
    .sort((a, b) => a.time - b.time)
    .slice(-limit);
  
  return result;
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
): Promise<{ candles: RawCandle[] | null; error: string | null; status: number }> {
  const url = new URL(`${FINNHUB_BASE}/forex/candle`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("resolution", resolution);
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));
  url.searchParams.set("token", apiKey);

  log("Fetching candles:", { symbol, resolution, from, to });

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = null; }

    // Check for access denied
    const errorMsg = json?.error || (typeof text === "string" ? text : "");
    if (errorMsg.toLowerCase().includes("don't have access")) {
      return {
        candles: null,
        error: "FINNHUB_ACCESS_DENIED",
        status: 403,
      };
    }

    if (!res.ok || json?.s !== "ok") {
      log("Upstream error:", { status: res.status, body: safeSnippet(text) });
      return {
        candles: null,
        error: json?.error || `Upstream error (${res.status})`,
        status: res.status,
      };
    }

    // Parse Finnhub response: { c, h, l, o, t, v, s }
    const tArr = Array.isArray(json?.t) ? json.t : [];
    const oArr = Array.isArray(json?.o) ? json.o : [];
    const hArr = Array.isArray(json?.h) ? json.h : [];
    const lArr = Array.isArray(json?.l) ? json.l : [];
    const cArr = Array.isArray(json?.c) ? json.c : [];
    const vArr = Array.isArray(json?.v) ? json.v : [];

    const candles: RawCandle[] = [];
    
    for (let i = 0; i < tArr.length; i++) {
      const t = Number(tArr[i]);
      if (!Number.isFinite(t) || t <= 0) continue;
      
      const o = Number(oArr[i]);
      const h = Number(hArr[i]);
      const l = Number(lArr[i]);
      const c = Number(cArr[i]);
      const v = Number(vArr[i] ?? 0);
      
      if (![o, h, l, c].every(Number.isFinite)) continue;
      
      candles.push({
        time: t,
        timestamp: new Date(t * 1000).toISOString(),
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v,
      });
    }

    // Sort by time ascending
    candles.sort((a, b) => a.time - b.time);

    log("Parsed candles:", { count: candles.length });
    return { candles, error: null, status: 200 };
    
  } catch (err: any) {
    log("Fetch error:", err?.message);
    return {
      candles: null,
      error: err?.message || "Network error",
      status: 500,
    };
  }
}

// ============================================
// FINNHUB TICK/TRADES FETCHER (for building custom OHLC)
// ============================================

async function fetchFinnhubTicks(
  symbol: string,
  from: number,
  to: number,
  apiKey: string
): Promise<{ ticks: Tick[] | null; error: string | null }> {
  // Finnhub forex trades endpoint
  const url = new URL(`${FINNHUB_BASE}/forex/trades`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));
  url.searchParams.set("token", apiKey);

  log("Fetching ticks:", { symbol, from, to });

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = null; }

    if (!res.ok) {
      return { ticks: null, error: json?.error || `Error ${res.status}` };
    }

    // Finnhub returns { data: [...], count: N }
    const data = Array.isArray(json?.data) ? json.data : [];
    
    const ticks: Tick[] = data.map((t: any) => ({
      p: Number(t.p ?? t.price ?? 0),
      t: Number(t.t ?? t.timestamp ?? 0),
      v: Number(t.v ?? t.volume ?? 0),
    })).filter((t: Tick) => t.p > 0 && t.t > 0);

    log("Parsed ticks:", { count: ticks.length });
    return { ticks, error: null };
    
  } catch (err: any) {
    return { ticks: null, error: err?.message || "Network error" };
  }
}

// ============================================
// MAIN HANDLER
// ============================================

export async function GET(req: Request) {
  const started = Date.now();

  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      log("Missing FINNHUB_API_KEY");
      return NextResponse.json(
        { ok: false, error: "Missing FINNHUB_API_KEY" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);

    const symbolParam = (searchParams.get("symbol") || "").trim();
    const displayParam = (searchParams.get("display") || "").trim();
    const tfParam = searchParams.get("tf") || "15m";
    const tf = tfNorm(tfParam);

    const rawLimit = Number(searchParams.get("limit") || 120);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 120, 10), 500);

    // Whether to use tick aggregation (slower but more accurate for small timeframes)
    const useTicks = searchParams.get("ticks") === "1";

    const symbol = toFinnhubSymbol(symbolParam, displayParam);
    if (!symbol) {
      log("Missing symbol/display");
      return NextResponse.json(
        { ok: false, error: "Missing symbol=OANDA:EUR_USD or display=EUR/USD" },
        { status: 400 }
      );
    }

    const display = displayFromSymbol(symbol);
    const resolution = tfToResolution(tf);
    const intervalSec = secondsPerCandle(tf);

    // Calculate time range
    const to = Math.floor(Date.now() / 1000);
    const from = to - intervalSec * limit * 2; // Fetch extra for safety

    log("Request params:", { symbol, display, tf, resolution, limit, useTicks });

    let candles: RawCandle[] = [];

    if (useTicks && (tf === "1m" || tf === "5m")) {
      // For very small timeframes, try tick aggregation
      const { ticks, error: tickError } = await fetchFinnhubTicks(symbol, from, to, apiKey);
      
      if (tickError || !ticks || ticks.length === 0) {
        log("Tick fetch failed or empty, falling back to candles");
        // Fall back to standard candles
        const { candles: fallbackCandles, error, status } = await fetchFinnhubCandles(
          symbol, resolution, from, to, apiKey
        );
        
        if (error) {
          return NextResponse.json(
            { ok: false, error, symbol, tf },
            { status, headers: { "Cache-Control": "no-store" } }
          );
        }
        
        candles = fallbackCandles || [];
      } else {
        // Aggregate ticks to OHLC
        candles = aggregateTicksToOHLC(ticks, intervalSec, limit);
        log("Aggregated ticks to candles:", { tickCount: ticks.length, candleCount: candles.length });
      }
    } else {
      // Standard candle fetch
      const { candles: fetchedCandles, error, status } = await fetchFinnhubCandles(
        symbol, resolution, from, to, apiKey
      );
      
      if (error === "FINNHUB_ACCESS_DENIED") {
        return NextResponse.json(
          {
            ok: false,
            error: "FINNHUB_ACCESS_DENIED",
            message: "Finnhub API key doesn't have access to FX candles. Upgrade your plan or check API key.",
            symbol,
            display,
            tf,
          },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
      
      if (error) {
        return NextResponse.json(
          { ok: false, error, symbol, tf },
          { status, headers: { "Cache-Control": "no-store" } }
        );
      }
      
      candles = (fetchedCandles || []).slice(-limit);
    }

    // Ensure we have proper OHLC integrity
    const validatedCandles = candles.map((c) => ({
      time: c.time,
      timestamp: c.timestamp,
      open: c.open,
      high: Math.max(c.open, c.high, c.low, c.close),
      low: Math.min(c.open, c.high, c.low, c.close),
      close: c.close,
      volume: c.volume,
    }));

    log("Response:", { count: validatedCandles.length, tookMs: Date.now() - started });

    return NextResponse.json(
      {
        ok: true,
        symbol,
        display,
        tf,
        resolution,
        count: validatedCandles.length,
        candles: validatedCandles,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
    
  } catch (err: any) {
    log("Exception:", err?.message);
    return NextResponse.json(
      { ok: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

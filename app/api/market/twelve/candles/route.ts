// app/api/markets/twelve/candles/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

function toNum(v: any) {
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function clampSymbol(sym: string) {
  const s = (sym || "").trim().toUpperCase();
  if (!s) return "";
  // stocks: AAPL, BRK.B etc.
  if (!/^[A-Z0-9.\-]{1,15}$/.test(s)) return "";
  return s;
}

function toAlpacaTimeframe(interval: string) {
  const x = (interval || "1min").trim().toLowerCase();
  switch (x) {
    case "1min":
    case "1m":
      return "1Min";
    case "5min":
    case "5m":
      return "5Min";
    case "15min":
    case "15m":
      return "15Min";
    case "30min":
    case "30m":
      return "30Min";
    case "1h":
    case "60min":
      return "1Hour";
    case "1day":
    case "1d":
      return "1Day";
    default:
      // keep chart working even if UI sends odd values
      return "15Min";
  }
}

export type Candle = {
  t: number; // ms
  time: string; // ISO
  o: number;
  h: number;
  l: number;
  c: number;
  v: number | null;
};

export async function GET(req: NextRequest) {
  const key = process.env.ALPACA_API_KEY;
  const secret = process.env.ALPACA_API_SECRET;
  const feed = (process.env.ALPACA_DATA_FEED || "iex").toLowerCase();

  if (!key || !secret) return json(500, { error: "Missing ALPACA_API_KEY / ALPACA_API_SECRET" });

  const { searchParams } = new URL(req.url);
  const symbolRaw = (searchParams.get("symbol") || "").trim();
  const symbol = clampSymbol(symbolRaw);

  const intervalRaw = (searchParams.get("interval") || "1min").trim(); // 1min,5min,15min,1h,1day
  const timeframe = toAlpacaTimeframe(intervalRaw);

  const outputsize = Math.min(1000, Math.max(10, Number(searchParams.get("outputsize") || 300)));

  if (!symbol) return json(400, { error: "Missing/invalid ?symbol=" });

  // Alpaca bars endpoint (multi-symbol capable)
  const url =
    `https://data.alpaca.markets/v2/stocks/bars?symbols=${encodeURIComponent(symbol)}` +
    `&timeframe=${encodeURIComponent(timeframe)}` +
    `&limit=${encodeURIComponent(String(outputsize))}` +
    `&adjustment=raw` +
    `&feed=${encodeURIComponent(feed)}` +
    `&sort=asc`;

  try {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          accept: "application/json",
          "APCA-API-KEY-ID": key,
          "APCA-API-SECRET-KEY": secret,
        },
      },
      12000
    );

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!res.ok || !data) {
      return json(502, { error: "UpstreamError" });
    }

    const arr = Array.isArray(data?.bars?.[symbol]) ? data.bars[symbol] : [];
    const candles: Candle[] = arr
      .map((b: any) => {
        // Alpaca bar fields: t,o,h,l,c,v (t is ISO)
        const tIso = String(b?.t || "");
        const tMs = Date.parse(tIso);
        const o = toNum(b?.o);
        const h = toNum(b?.h);
        const l = toNum(b?.l);
        const c = toNum(b?.c);
        const v = toNum(b?.v);

        if (!Number.isFinite(tMs) || o == null || h == null || l == null || c == null) return null;

        return {
          t: tMs,
          time: new Date(tMs).toISOString(),
          o,
          h,
          l,
          c,
          v: v == null ? null : v,
        } as Candle;
      })
      .filter(Boolean) as Candle[];

    return json(200, {
      meta: { symbol, interval: intervalRaw, timeframe, feed },
      candles,
    });
  } catch (e: any) {
    return json(502, { error: "Candles fetch failed" });
  }
}

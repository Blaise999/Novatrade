// app/api/markets/twelve/price/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

function clampSymbol(sym: string) {
  const s = (sym || "").trim().toUpperCase();
  if (!s) return "";
  if (!/^[A-Z0-9.\-]{1,15}$/.test(s)) return "";
  return s;
}

export async function GET(req: NextRequest) {
  const key = process.env.ALPACA_API_KEY;
  const secret = process.env.ALPACA_API_SECRET;
  const feed = (process.env.ALPACA_DATA_FEED || "iex").toLowerCase();

  if (!key || !secret) return json(500, { error: "Missing ALPACA_API_KEY / ALPACA_API_SECRET" });

  const { searchParams } = new URL(req.url);
  const symbol = clampSymbol(searchParams.get("symbol") || "");

  if (!symbol) return json(400, { error: "Missing/invalid ?symbol=" });

  const url =
    `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/trades/latest` +
    `?feed=${encodeURIComponent(feed)}`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        accept: "application/json",
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret,
      },
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!res.ok || !data?.trade) return json(502, { error: "UpstreamError" });

    const price = Number(data.trade?.p);
    const ts = Date.parse(String(data.trade?.t || "")) || Date.now();

    if (!Number.isFinite(price)) return json(502, { error: "Bad price" });

    return json(200, { symbol, price, ts });
  } catch {
    return json(502, { error: "Price fetch failed" });
  }
}

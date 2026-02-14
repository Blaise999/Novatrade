// app/api/markets/twelve/price/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

async function fetchWithTimeout(url: string, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) return json(500, { error: "Missing TWELVE_DATA_API_KEY" });

  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").trim();

  if (!symbol) return json(400, { error: "Missing ?symbol=" });

  const url =
    `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}` +
    `&apikey=${encodeURIComponent(key)}`;

  try {
    const res = await fetchWithTimeout(url);
    const data = await res.json();

    // Twelve error format can include status/message/code
    if (!res.ok || data?.status === "error" || data?.code) {
      return json(502, { error: "TwelveDataError", details: data });
    }

    const price = Number.parseFloat(data?.price);
    if (!Number.isFinite(price)) {
      return json(502, { error: "Bad price from Twelve", details: data });
    }

    return json(200, { symbol, price, ts: Date.now() });
  } catch (e: any) {
    return json(502, { error: "Price fetch failed", message: String(e?.message || e) });
  }
}

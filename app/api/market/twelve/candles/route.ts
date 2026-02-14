// app/api/markets/twelve/candles/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

async function fetchWithTimeout(url: string, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function toNum(v: any) {
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export type Candle = {
  t: number; // ms
  time: string; // raw datetime
  o: number;
  h: number;
  l: number;
  c: number;
  v: number | null;
};

export async function GET(req: NextRequest) {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) return json(500, { error: "Missing TWELVE_DATA_API_KEY" });

  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").trim();
  const interval = (searchParams.get("interval") || "1min").trim(); // 1min, 5min, 15min, 1h, 1day etc.
  const outputsize = Math.min(
    5000,
    Math.max(10, Number(searchParams.get("outputsize") || 300))
  );

  if (!symbol) return json(400, { error: "Missing ?symbol=" });

  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}` +
    `&interval=${encodeURIComponent(interval)}` +
    `&outputsize=${encodeURIComponent(String(outputsize))}` +
    `&format=JSON` +
    `&apikey=${encodeURIComponent(key)}`;

  try {
    const res = await fetchWithTimeout(url);
    const data = await res.json();

    if (!res.ok || data?.status === "error" || data?.code) {
      return json(502, { error: "TwelveDataError", details: data });
    }

    const values = Array.isArray(data?.values) ? data.values : [];
    const candles: Candle[] = values
      .map((x: any) => {
        const o = toNum(x.open);
        const h = toNum(x.high);
        const l = toNum(x.low);
        const c = toNum(x.close);
        if (o == null || h == null || l == null || c == null) return null;

        // Twelve returns "YYYY-MM-DD HH:mm:ss" (exchange timezone often). :contentReference[oaicite:2]{index=2}
        const dt = String(x.datetime || "");
        const t = Date.parse(dt.replace(" ", "T") + "Z"); // safe-ish fallback
        return {
          t: Number.isFinite(t) ? t : Date.now(),
          time: dt,
          o, h, l, c,
          v: toNum(x.volume),
        } as Candle;
      })
      .filter(Boolean) as Candle[];

    // oldest -> newest
    candles.reverse();

    return json(200, {
      meta: data?.meta ?? { symbol, interval },
      candles,
    });
  } catch (e: any) {
    return json(502, { error: "Candles fetch failed", message: String(e?.message || e) });
  }
}

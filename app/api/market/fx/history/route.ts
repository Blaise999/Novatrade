import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://finnhub.io/api/v1";

function tfToResolution(tf: string) {
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

function secondsPer(tf: string) {
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

export async function GET(req: Request) {
  try {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) return NextResponse.json({ error: "Missing FINNHUB_API_KEY" }, { status: 500 });

    const { searchParams } = new URL(req.url);

    // pass either:
    // - symbol=OANDA:EUR_USD (preferred)
    // - display=EUR/USD (we convert)
    const symbolParam = (searchParams.get("symbol") ?? "").trim();
    const displayParam = (searchParams.get("display") ?? "").trim();
    const tf = searchParams.get("tf") ?? "15m";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 120), 10), 500);

    const symbol =
      symbolParam ||
      (displayParam ? `OANDA:${displayParam.toUpperCase().replace("/", "_")}` : "");

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing symbol=OANDA:EUR_USD or display=EUR/USD" },
        { status: 400 }
      );
    }

    const to = Math.floor(Date.now() / 1000);
    const from = to - secondsPer(tf) * limit;
    const resolution = tfToResolution(tf);

    const url =
      `${BASE}/forex/candle?symbol=${encodeURIComponent(symbol)}` +
      `&resolution=${encodeURIComponent(resolution)}` +
      `&from=${from}&to=${to}&token=${encodeURIComponent(key)}`;

    const r = await fetch(url, {
      headers: new Headers({ accept: "application/json" }),
      cache: "no-store",
    });

    const raw = await r.json();

    if (!r.ok || raw?.s !== "ok") {
      return NextResponse.json({ error: "Upstream error", details: raw }, { status: 502 });
    }

    const candles = (raw.t as number[]).map((t, i) => ({
      timestamp: new Date(t * 1000).toISOString(),
      open: raw.o[i],
      high: raw.h[i],
      low: raw.l[i],
      close: raw.c[i],
      volume: raw.v?.[i] ?? 0,
    }));

    return NextResponse.json(
      { ok: true, symbol, tf, candles },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// app/api/market/stocks/history/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FINNHUB_REST = "https://finnhub.io/api/v1";

// UI -> Finnhub resolution
const RESOLUTION_MAP: Record<string, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1D": "D",
};

function defaultRangeSeconds(resolution: string) {
  const now = Math.floor(Date.now() / 1000);

  // intraday: last 7 days
  if (["1", "5", "15", "30", "60", "240"].includes(resolution)) {
    return { from: now - 60 * 60 * 24 * 7, to: now };
  }

  // daily/weekly/monthly: last 365 days
  return { from: now - 60 * 60 * 24 * 365, to: now };
}

export async function GET(req: NextRequest) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing FINNHUB_API_KEY" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "AAPL").toUpperCase();

  // allow either tf=15m OR resolution=15m OR direct finnhub res like 15 / D
  const tf = searchParams.get("tf") || searchParams.get("resolution") || "15m";
  const resolution = RESOLUTION_MAP[tf] || tf;

  const fromQ = Number(searchParams.get("from"));
  const toQ = Number(searchParams.get("to"));

  const { from, to } =
    Number.isFinite(fromQ) && Number.isFinite(toQ) && fromQ > 0 && toQ > fromQ
      ? { from: Math.floor(fromQ), to: Math.floor(toQ) }
      : defaultRangeSeconds(resolution);

  const url = new URL(`${FINNHUB_REST}/stock/candle`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("resolution", resolution);
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));

  const headers = new Headers({ accept: "application/json" });
  headers.set("X-Finnhub-Token", token);

  const upstream = await fetch(url.toString(), { headers, cache: "no-store" });
  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

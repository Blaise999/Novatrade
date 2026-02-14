import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://finnhub.io/api/v1";

// enable server logs with DEBUG_MARKET=1
const DEBUG = process.env.DEBUG_MARKET === "1";

function s(...args: any[]) {
  if (DEBUG) console.log("[market/fx/candles]", ...args);
}

function safeSnippet(v: string, max = 240) {
  const t = String(v || "");
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function tfNorm(tf: string) {
  const t = String(tf || "").trim();
  if (t.toLowerCase() === "1d") return "1D";
  return t;
}

function tfToResolution(tfRaw: string) {
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

function secondsPer(tfRaw: string) {
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

function toSymbol(symbolParam: string, displayParam: string) {
  const symbol = (symbolParam || "").trim();
  const display = (displayParam || "").trim();
  if (symbol) return symbol;
  if (!display) return "";
  return `OANDA:${display.toUpperCase().replace("/", "_")}`;
}

export async function GET(req: Request) {
  const started = Date.now();

  try {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
      s("Missing FINNHUB_API_KEY");
      return NextResponse.json({ error: "Missing FINNHUB_API_KEY" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);

    const symbolParam = (searchParams.get("symbol") || "").trim();
    const displayParam = (searchParams.get("display") || "").trim();
    const tf = searchParams.get("tf") || "15m";

    const rawLimit = Number(searchParams.get("limit") || 120);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 120, 10), 500);

    const symbol = toSymbol(symbolParam, displayParam);
    if (!symbol) {
      s("Missing symbol/display");
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

    s("REQ", { symbol, tf, resolution, from, to, limit });

    const r = await fetch(url, {
      headers: new Headers({ accept: "application/json" }),
      cache: "no-store",
    });

    const ct = r.headers.get("content-type") || "";
    const txt = await r.text();

    let raw: any = null;
    try { raw = JSON.parse(txt); } catch { raw = null; }

    const deny =
      (typeof raw?.error === "string" && raw.error) ||
      (typeof txt === "string" ? txt : "");

    // Finnhub "no access"
    if (deny && deny.toLowerCase().includes("don't have access to this resource")) {
      s("DENIED", { status: r.status, ct, body: safeSnippet(deny) });

      return NextResponse.json(
        {
          ok: false,
          error: "FINNHUB_ACCESS_DENIED",
          message:
            "Finnhub says your API key/plan doesn't have access to this FX candles resource. Upgrade Finnhub or switch data provider.",
          symbol,
          tf: tfNorm(tf),
          upstreamStatus: r.status,
          details: raw ?? { raw: safeSnippet(txt, 400) },
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Other upstream failures
    if (!r.ok || raw?.s !== "ok") {
      s("UPSTREAM_FAIL", {
        upstreamStatus: r.status,
        ct,
        body: safeSnippet(txt),
        tookMs: Date.now() - started,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "UPSTREAM_ERROR",
          symbol,
          tf: tfNorm(tf),
          upstreamStatus: r.status,
          details: raw ?? { raw: safeSnippet(txt, 400) },
        },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const candles = (raw.t as number[]).map((t: number, i: number) => ({
      timestamp: new Date(t * 1000).toISOString(),
      open: raw.o[i],
      high: raw.h[i],
      low: raw.l[i],
      close: raw.c[i],
      volume: raw.v?.[i] ?? 0,
    }));

    s("OK", { count: candles.length, tookMs: Date.now() - started });

    return NextResponse.json(
      { ok: true, symbol, tf: tfNorm(tf), candles },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    s("ERR", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
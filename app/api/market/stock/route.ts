// app/api/market/stocks/route.ts
import { NextRequest } from "next/server";
import WebSocket from "ws";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FINNHUB_REST = "https://finnhub.io/api/v1";
const FINNHUB_WS = "wss://ws.finnhub.io?token=";

type Quote = {
  symbol: string;
  price: number; // c
  change: number; // d
  changePercent: number; // dp
  prevClose: number; // pc
  high?: number; // h
  low?: number; // l
  open?: number; // o
  ts?: number; // t
};

async function fetchQuote(symbol: string, token: string): Promise<Quote> {
  const url = new URL(`${FINNHUB_REST}/quote`);
  url.searchParams.set("symbol", symbol);

  const headers = new Headers({ accept: "application/json" });
  headers.set("X-Finnhub-Token", token);

  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Quote failed (${res.status}): ${msg}`);
  }

  const j = await res.json();
  return {
    symbol,
    price: Number(j.c ?? 0),
    change: Number(j.d ?? 0),
    changePercent: Number(j.dp ?? 0),
    prevClose: Number(j.pc ?? 0),
    high: j.h,
    low: j.l,
    open: j.o,
    ts: j.t,
  };
}

function parseSymbols(req: NextRequest): string[] {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("symbols") || "AAPL,NVDA,TSLA").trim();
  // sanitize: keep tickers like BRK.B, RIVN, etc.
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50); // don’t let clients subscribe to 1000 symbols
}

export async function GET(req: NextRequest) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing FINNHUB_API_KEY" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const symbols = parseSymbols(req);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sse = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const comment = (text: string) => {
        controller.enqueue(encoder.encode(`: ${text}\n\n`));
      };

      let closed = false;
      let ws: WebSocket | null = null;
      let keepAlive: NodeJS.Timeout | null = null;

      // micro-batch ticks to avoid spamming the client
      let tickBuf: Array<{ s: string; p: number; t: number; v?: number }> = [];
      let flushTimer: NodeJS.Timeout | null = null;
      const flush = () => {
        if (tickBuf.length) sse("tick", tickBuf);
        tickBuf = [];
        flushTimer = null;
      };
      const queueTick = (tick: { s: string; p: number; t: number; v?: number }) => {
        tickBuf.push(tick);
        if (!flushTimer) flushTimer = setTimeout(flush, 200);
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;

        try {
          if (flushTimer) clearTimeout(flushTimer);
          flush();
        } catch {}

        try {
          if (keepAlive) clearInterval(keepAlive);
        } catch {}

        try {
          ws?.close();
        } catch {}

        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener("abort", cleanup);

      // hello + snapshot
      sse("hello", { symbols });

      try {
        const snap = await Promise.all(
          symbols.map((sym) =>
            fetchQuote(sym, token).catch(() => null)
          )
        );
        sse("snapshot", snap.filter(Boolean));
      } catch (e: any) {
        sse("error", { message: e?.message || "Snapshot failed" });
      }

      // connect upstream WS
      try {
        ws = new WebSocket(`${FINNHUB_WS}${encodeURIComponent(token)}`);

        ws.on("open", () => {
          // subscribe to trades
          for (const sym of symbols) {
            ws?.send(JSON.stringify({ type: "subscribe", symbol: sym }));
          }
          comment("subscribed");
        });

        ws.on("message", (raw) => {
          try {
            const text = typeof raw === "string" ? raw : raw.toString("utf8");
            const msg = JSON.parse(text);

            if (msg?.type === "trade" && Array.isArray(msg.data)) {
              for (const t of msg.data) {
                // Finnhub trade shape: { s, p, t, v }
                if (t?.s && typeof t?.p === "number" && typeof t?.t === "number") {
                  queueTick({ s: t.s, p: t.p, t: t.t, v: t.v });
                }
              }
            }
          } catch {
            // ignore parse errors
          }
        });

        ws.on("error", (err) => {
          sse("error", { message: (err as any)?.message || "WebSocket error" });
          cleanup();
        });

        ws.on("close", () => {
          sse("close", { message: "Upstream websocket closed" });
          cleanup();
        });

        // keep SSE alive
        keepAlive = setInterval(() => comment("ping"), 15000);
      } catch (e: any) {
        sse("error", { message: e?.message || "Failed to open websocket" });
        cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

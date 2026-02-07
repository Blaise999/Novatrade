import WebSocket, { type RawData } from "ws";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return new Response("Missing FINNHUB_API_KEY", { status: 500 });

  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!symbols.length) {
    return new Response("Missing symbols=OANDA:EUR_USD,OANDA:GBP_USD", { status: 400 });
  }

  const stream = new ReadableStream<string>({
    start(controller) {
      const send = (obj: unknown) => controller.enqueue(`data: ${JSON.stringify(obj)}\n\n`);

      const ws = new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(key)}`);

      const close = () => {
        try { ws.close(); } catch {}
        try { controller.close(); } catch {}
      };

      ws.on("open", () => {
        for (const symbol of symbols) ws.send(JSON.stringify({ type: "subscribe", symbol }));
        send({ type: "ready", symbols });
      });

      ws.on("message", (buf: RawData) => {
        // RawData can be Buffer | ArrayBuffer | string | Buffer[]
        const text =
          typeof buf === "string"
            ? buf
            : Buffer.isBuffer(buf)
              ? buf.toString("utf8")
              : Array.isArray(buf)
                ? Buffer.concat(buf).toString("utf8")
                : Buffer.from(buf as ArrayBuffer).toString("utf8");

        controller.enqueue(`data: ${text}\n\n`);
      });

      ws.on("error", (err: Error) => {
        send({ type: "error", message: err.message });
      });

      // close when client disconnects
      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}

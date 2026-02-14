import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = 'https://finnhub.io/api/v1';

export async function GET(req: Request) {
  try {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const exchange = (searchParams.get('exchange') ?? 'oanda').toLowerCase();

    const url = `${BASE}/forex/symbol?exchange=${encodeURIComponent(exchange)}&token=${encodeURIComponent(key)}`;

    const r = await fetch(url, {
      headers: new Headers({ accept: 'application/json' }),
      cache: 'no-store',
    });

    const data = await r.json();

    if (!r.ok || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Upstream error', details: data }, { status: 502 });
    }

    const pairs = data.map((x: any) => ({
      id: String(x.symbol ?? x.displaySymbol),
      displaySymbol: String(x.displaySymbol ?? x.symbol),
      symbol: String(x.symbol ?? x.displaySymbol),
      name: String(x.description ?? x.displaySymbol ?? 'FX Pair'),
    }));

    return NextResponse.json(
      { ok: true, exchange, pairs },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

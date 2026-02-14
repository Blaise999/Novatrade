import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function GET(req: NextRequest) {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) return json(500, { error: 'Missing TWELVE_DATA_API_KEY' });

  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || '').trim();
  if (!symbol) return json(400, { error: 'Missing symbol' });

  // Twelve allows comma-separated symbols
  const url = new URL('https://api.twelvedata.com/quote');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('apikey', key);

  try {
    const r = await fetch(url.toString(), { cache: 'no-store' });
    const data = await r.json();

    // Twelve returns { status: "error", message: ... } on failures
    if (!r.ok || (data && data.status === 'error')) {
      return json(502, { error: 'TwelveData quote error', details: data });
    }

    return json(200, data);
  } catch (e: any) {
    return json(502, { error: 'Quote fetch failed', details: String(e?.message || e) });
  }
}

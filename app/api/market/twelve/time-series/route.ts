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

  const interval = (searchParams.get('interval') || '1min').trim(); // 1min, 5min, 15min, 1h, 1day...
  const outputsize = Math.min(500, Math.max(10, Number(searchParams.get('outputsize') || 200)));

  const url = new URL('https://api.twelvedata.com/time_series');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('outputsize', String(outputsize));
  url.searchParams.set('apikey', key);

  try {
    const r = await fetch(url.toString(), { cache: 'no-store' });
    const data = await r.json();

    if (!r.ok || (data && data.status === 'error')) {
      return json(502, { error: 'TwelveData time_series error', details: data });
    }

    return json(200, data);
  } catch (e: any) {
    return json(502, { error: 'Time-series fetch failed', details: String(e?.message || e) });
  }
}

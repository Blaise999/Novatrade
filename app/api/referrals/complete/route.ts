import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function normalizeRef(ref?: string) {
  return (ref || '').trim().toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || '').trim();
    const ref = normalizeRef(body.ref);

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Missing userId' }, { status: 400 });
    }

    // Referral is NOT compulsory
    if (!ref) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { data, error } = await supabaseAdmin.rpc('complete_referral', {
      p_referred_user_id: userId,
      p_ref: ref,
    });

    if (error) {
      // Don't break signup for referral issues
      return NextResponse.json({ ok: true, applied: false, reason: error.message });
    }

    return NextResponse.json(data ?? { ok: true });
  } catch (e: any) {
    // Again: never break signup for referral completion errors
    return NextResponse.json({ ok: true, applied: false, reason: e?.message || 'unknown' });
  }
}

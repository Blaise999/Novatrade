import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAnon = createClient(SUPABASE_URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const AIRDROP_KEY = "nova_s1";
const REQUIRED_REFERRALS = 5;
const BASE_ALLOCATION = 500;

function isEvmAddress(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id;

  const body = await req.json().catch(() => ({}));
  const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";
  const normalizedWallet = walletAddress ? walletAddress : null;

  if (normalizedWallet && !isEvmAddress(normalizedWallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  // check verified referrals
  const { count: verifiedReferrals, error: countErr } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", userId)
    .eq("email_verified", true);

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  const refs = verifiedReferrals ?? 0;
  if (refs < REQUIRED_REFERRALS) {
    return NextResponse.json(
      { error: `Not eligible. Need ${REQUIRED_REFERRALS} verified referrals.`, verifiedReferrals: refs },
      { status: 403 }
    );
  }

  // idempotent: return existing claim if already claimed
  const { data: existing } = await supabaseAdmin
    .from("airdrop_claims")
    .select("id, claimed_at, wallet_address, claim_status")
    .eq("airdrop_key", AIRDROP_KEY)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      claimed: true,
      allocation: BASE_ALLOCATION,
      claim: existing,
    });
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("airdrop_claims")
    .insert({
      airdrop_key: AIRDROP_KEY,
      user_id: userId,
      wallet_address: normalizedWallet,
      claim_status: "claimed",
    })
    .select("id, claimed_at, wallet_address, claim_status")
    .maybeSingle();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    claimed: true,
    allocation: BASE_ALLOCATION,
    claim: inserted,
  });
}

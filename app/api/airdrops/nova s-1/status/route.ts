import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

function makeCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 chars
}

async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function ensureReferralCode(userId: string) {
  // read current
  const { data: me } = await supabaseAdmin
    .from("users")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();

  if (me?.referral_code) return me.referral_code;

  // set if missing (retry for collisions)
  for (let i = 0; i < 10; i++) {
    const candidate = makeCode();
    const { error } = await supabaseAdmin
      .from("users")
      .update({ referral_code: candidate })
      .eq("id", userId)
      .is("referral_code", null);

    if (!error) {
      const { data: check } = await supabaseAdmin
        .from("users")
        .select("referral_code")
        .eq("id", userId)
        .maybeSingle();

      if (check?.referral_code) return check.referral_code;
    }
  }

  return null;
}

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id;

  // ensure referral_code exists
  const myCode = await ensureReferralCode(userId);

  // count verified referrals
  const { count: verifiedReferrals, error: countErr } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", userId)
    .eq("email_verified", true);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  // claimed?
  const { data: claimRow } = await supabaseAdmin
    .from("airdrop_claims")
    .select("id, claimed_at, wallet_address, claim_status")
    .eq("airdrop_key", AIRDROP_KEY)
    .eq("user_id", userId)
    .maybeSingle();

  const refs = verifiedReferrals ?? 0;
  const eligible = refs >= REQUIRED_REFERRALS;
  const allocation = eligible ? BASE_ALLOCATION : 0;

  return NextResponse.json({
    ok: true,
    airdropKey: AIRDROP_KEY,
    requiredReferrals: REQUIRED_REFERRALS,
    verifiedReferrals: refs,
    eligible,
    allocation,
    referralCode: myCode,
    claimed: !!claimRow,
    claim: claimRow || null,
  });
}

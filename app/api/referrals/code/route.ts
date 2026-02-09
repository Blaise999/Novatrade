import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Replace this with however you get your logged-in user id
async function requireUserId() {
  // If you already have a server auth helper, use it.
  // For now, expect your app sets a cookie or you use Supabase SSR auth.
  const c = await cookies();
  const uid = c.get("uid")?.value; // <-- adapt to your auth
  if (!uid) return null;
  return uid;
}

function makeCode() {
  return crypto.randomBytes(6).toString("hex").toUpperCase(); // simple code like A1B2C3...
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await admin
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.code) return NextResponse.json({ code: existing.code });

  // create
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    const { error } = await admin.from("referral_codes").insert({ user_id: userId, code });
    if (!error) return NextResponse.json({ code });
  }

  return NextResponse.json({ error: "Failed to create code" }, { status: 500 });
}

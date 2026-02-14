import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Authenticate using Bearer token
async function requireUserId(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

function makeCode() {
  return crypto.randomBytes(6).toString("hex").toUpperCase(); // simple code like A1B2C3...
}

export async function GET(request: NextRequest) {
  const userId = await requireUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // First check users table for referral_code
  const { data: userData } = await admin
    .from("users")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();

  if (userData?.referral_code) {
    return NextResponse.json({ code: userData.referral_code });
  }

  // Then check referral_codes table
  const { data: existing } = await admin
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.code) {
    // Sync to users table
    await admin.from("users").update({ referral_code: existing.code }).eq("id", userId);
    return NextResponse.json({ code: existing.code });
  }

  // Create new code
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    
    // Insert into referral_codes
    const { error: insertError } = await admin.from("referral_codes").insert({ user_id: userId, code });
    
    if (!insertError) {
      // Also update users table
      await admin.from("users").update({ referral_code: code }).eq("id", userId);
      return NextResponse.json({ code });
    }
  }

  return NextResponse.json({ error: "Failed to create code" }, { status: 500 });
}

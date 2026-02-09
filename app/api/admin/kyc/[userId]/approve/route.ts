import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-side only client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function requireAdmin(req: NextRequest): Promise<
  | { ok: true; adminId: string }
  | { ok: false; status: number; error: string }
> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return { ok: false, status: 401, error: "Missing admin token" };

  const tokenHash = hashToken(token);

  const { data: session, error } = await supabaseAdmin
    .from("admin_sessions")
    .select("admin_id, revoked_at, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  if (!session || session.revoked_at) {
    return { ok: false, status: 401, error: "Invalid admin session" };
  }
  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 401, error: "Session expired" };
  }

  // keep session “alive” (non-blocking)
void Promise.resolve(
  supabaseAdmin
    .from("admin_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
).catch(() => {});


  return { ok: true, adminId: String(session.admin_id) };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const guard = await requireAdmin(req);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const userId = String(params.userId || "").trim();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // ✅ IMPORTANT:
  // DB constraint likely rejects "verified" (you hit this already).
  // Write "approved" to DB, but return "verified" to keep the UI working.
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({
      kyc_status: "approved",
      kyc_reviewed_at: now,
      kyc_reviewed_by: guard.adminId,
      updated_at: now,
    })
    .eq("id", userId)
    .select("id, kyc_status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // audit log (non-blocking)
 void Promise.resolve(
  supabaseAdmin.from("admin_logs").insert({
    admin_id: guard.adminId,
    action: "kyc_approved",
    details: { user_id: userId },
  })
).catch(() => {});

  return NextResponse.json({
    ok: true,
    user: { ...data, kyc_status: "verified" }, // UI compatibility
  });
}

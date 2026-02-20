import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

type GuardOk = { ok: true; adminId: string; role: string };
type GuardFail = { ok: false; status: number; error: string };

async function requireAdminWrite(req: NextRequest): Promise<GuardOk | GuardFail> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Missing admin token" };

  const tokenHash = hashToken(token);

  const { data: session, error } = await supabaseAdmin
    .from("admin_sessions")
    .select("admin_id, revoked_at, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: error.message };
  if (!session || session.revoked_at) return { ok: false, status: 401, error: "Invalid admin session" };

  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 401, error: "Session expired" };
  }

  const { data: adminUser, error: adminErr } = await supabaseAdmin
    .from("users")
    .select("id, role, is_active")
    .eq("id", session.admin_id)
    .maybeSingle();

  if (adminErr) return { ok: false, status: 500, error: adminErr.message };
  if (!adminUser) return { ok: false, status: 401, error: "Admin not found" };
  if (adminUser.is_active === false) return { ok: false, status: 403, error: "Admin account disabled" };

  const role = String(adminUser.role || "").toLowerCase();
  if (role !== "admin" && role !== "super_admin") {
    return { ok: false, status: 403, error: "Admin privileges required" };
  }

  void Promise.resolve(
    supabaseAdmin
      .from("admin_sessions")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("token_hash", tokenHash)
  ).catch(() => {});

  return { ok: true, adminId: String(session.admin_id), role };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminWrite(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id: userId } = await ctx.params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const newAddress = String(body?.newAddress || "").trim();
  const note = String(body?.note || "").trim(); // Optional for audit

  if (!userId) return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  if (!newAddress) return NextResponse.json({ error: "Missing new address" }, { status: 400 });

  // Validate format (customize regex for your crypto chains, e.g., BTC/ETH/SOL)
  if (!/^[1-9A-HJ-NP-Za-km-z0-9]{26,44}$/.test(newAddress)) {
    return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
  }

  // Fetch current user/address
  const { data: user, error: uErr } = await supabaseAdmin
    .from("users")
    .select("id, email, deposit_address")
    .eq("id", userId)
    .maybeSingle();

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const current = String(user.deposit_address ?? "");

  // Update the field
  const { data: updated, error: upErr } = await supabaseAdmin
    .from("users")
    .update({ deposit_address: newAddress })
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // Audit log (matches your balance API; skips if table missing)
  void Promise.resolve(
    supabaseAdmin.from("admin_audit_log").insert({
      admin_id: guard.adminId,
      target_user_id: userId,
      action: "deposit_address_update",
      meta: { from: current, to: newAddress, note },
      created_at: new Date().toISOString(),
    })
  ).catch(() => {});

  return NextResponse.json({
    ok: true,
    user: updated,
    update: { from: current, to: newAddress, note },
  });
}
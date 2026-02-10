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

  // keep alive
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

  const type = String(body?.type || "spot"); // "spot" | "bonus"
  const action = String(body?.action || "add"); // "add" | "subtract" | "set"
  const note = String(body?.note || "").trim();
  const amount = Number(body?.amount);

  if (!userId) return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  if (!note) return NextResponse.json({ error: "Missing note" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const field = type === "bonus" ? "balance_bonus" : "balance_available";

  // Load current balances
  const { data: user, error: uErr } = await supabaseAdmin
    .from("users")
    .select(`id,email,first_name,last_name,${field}`)
    .eq("id", userId)
    .maybeSingle();

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const current = Number((user as any)[field] ?? 0);
  let next = current;

  if (action === "add") next = current + amount;
  else if (action === "subtract") next = Math.max(0, current - amount);
  else if (action === "set") next = amount;
  else return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const { data: updated, error: upErr } = await supabaseAdmin
    .from("users")
    .update({ [field]: next })
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // Optional audit insert (won’t crash if table not present)
  void Promise.resolve(
    supabaseAdmin.from("admin_audit_log").insert({
      admin_id: guard.adminId,
      target_user_id: userId,
      action: "balance_adjustment",
      meta: { type, action, amount, field, from: current, to: next, note },
      created_at: new Date().toISOString(),
    })
  ).catch(() => {});

  return NextResponse.json({
    ok: true,
    user: updated,
    adjustment: { type, action, amount, field, from: current, to: next, note },
  });
}

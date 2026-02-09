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

  if (error) return { ok: false, status: 500, error: error.message };
  if (!session || session.revoked_at)
    return { ok: false, status: 401, error: "Invalid admin session" };

  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 401, error: "Session expired" };
  }

  // Optional: confirm this user is still admin
  const { data: adminUser, error: adminErr } = await supabaseAdmin
    .from("users")
    .select("id, role, is_active")
    .eq("id", session.admin_id)
    .maybeSingle();

  if (adminErr) return { ok: false, status: 500, error: adminErr.message };
  if (!adminUser) return { ok: false, status: 401, error: "Admin not found" };
  if (adminUser.role !== "admin")
    return { ok: false, status: 403, error: "Admin privileges required" };
  if (adminUser.is_active === false)
    return { ok: false, status: 403, error: "Admin account disabled" };

  // keep alive (non-blocking)
void Promise.resolve(
  supabaseAdmin
    .from("admin_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
).catch(() => {});

  return { ok: true, adminId: String(session.admin_id) };
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);

  // Pagination
  const limitRaw = Number(url.searchParams.get("limit") ?? "200");
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  // Optional filters
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const role = (url.searchParams.get("role") ?? "").trim();
  const kyc = (url.searchParams.get("kyc_status") ?? "").trim();
  const active = (url.searchParams.get("is_active") ?? "").trim(); // "true" | "false"

  let q = supabaseAdmin
    .from("users")
    // ✅ select('*') avoids “column doesn’t exist” crashes across schema changes
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (role) q = q.eq("role", role);
  if (kyc) q = q.eq("kyc_status", kyc);
  if (active === "true") q = q.eq("is_active", true);
  if (active === "false") q = q.eq("is_active", false);

  // Search across email / names (best-effort — if columns missing, it still works because they exist in your schema)
  if (search) {
    // PostgREST OR syntax
    // if first_name/last_name don't exist, your schema would have already been inconsistent with UI anyway
    q = q.or(
      `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
    );
  }

  const { data, error, count } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Normalize numeric-ish fields so UI never breaks
  const users = (data ?? []).map((u: any) => ({
    ...u,
    balance_available: Number(u.balance_available ?? 0),
    balance_bonus: Number(u.balance_bonus ?? 0),
    total_deposited: Number(u.total_deposited ?? 0),
    total_withdrawn: Number(u.total_withdrawn ?? 0),
  }));

  return NextResponse.json({
    users,
    total: count ?? users.length,
    limit,
    offset,
  });
}

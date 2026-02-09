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

function clampInt(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const token = auth.slice(7).trim();
  if (!token) return null;

  const tokenHash = hashToken(token);

  const { data, error } = await supabaseAdmin
    .from("admin_sessions")
    .select("id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;
  return { tokenHash };
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);

    // ✅ Default big list; cap to avoid abuse
    const limit = clampInt(parseInt(url.searchParams.get("limit") ?? "200", 10), 1, 500);
    const offset = clampInt(parseInt(url.searchParams.get("offset") ?? "0", 10), 0, 1_000_000);

    // ✅ IMPORTANT: range() is inclusive, so end = offset + limit - 1
    const from = offset;
    const to = offset + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from("users")
      .select(
        `
          id,
          email,
          first_name,
          last_name,
          role,
          tier,
          is_active,
          kyc_status,
          kyc_submitted_at,
          created_at,
          last_login_at,
          balance_available,
          balance_bonus,
          total_deposited,
          total_withdrawn
        `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({
      users: data ?? [],
      count: count ?? (data?.length ?? 0),
      limit,
      offset,
    });
  } catch (e: any) {
    console.error("[Admin] users list error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

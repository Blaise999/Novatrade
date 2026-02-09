// POST /api/admin/auth/login
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth client (anon) for sign-in
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Admin DB client (service role) for privileged writes
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  if (now - record.lastAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW - (now - record.lastAttempt)) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  record.lastAttempt = now;
  return { allowed: true };
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    // hard fail if service role missing (this is the #1 real-world cause)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: "Server misconfig: SUPABASE_SERVICE_ROLE_KEY is missing (set on Vercel Preview + Production)." },
        { status: 500 }
      );
    }

    const ip = getClientIP(request);
    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many login attempts. Try again in ${rate.retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
    }

    // 1) Auth sign-in (anon)
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    // 2) Validate role in users table (service role read)
    const { data: userRow, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, first_name, last_name, role, is_active")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (userError || !userRow) {
      return NextResponse.json({ success: false, error: "User profile not found" }, { status: 404 });
    }

    const role = String(userRow.role || "").toLowerCase();
    const allowed = role === "admin" || role === "super_admin";
    if (!allowed) {
      return NextResponse.json({ success: false, error: "Access denied. Admin privileges required." }, { status: 403 });
    }
    if (userRow.is_active === false) {
      return NextResponse.json({ success: false, error: "Account is disabled" }, { status: 403 });
    }

    // 3) Create admin session (service role write)
    const sessionToken = generateSessionToken();
    const tokenHash = hashToken(sessionToken);

    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { error: sessErr } = await supabaseAdmin.from("admin_sessions").insert({
      admin_id: userRow.id,
      token_hash: tokenHash,
      created_at: nowIso,
      last_activity_at: nowIso,
      expires_at: expiresIso,
      revoked_at: null,
      ip_address: ip,
      user_agent: request.headers.get("user-agent") || null,
    });

    if (sessErr) {
      return NextResponse.json(
        { success: false, error: `Failed to create session: ${sessErr.message}` },
        { status: 500 }
      );
    }

    // fire-and-forget audit
    void Promise.resolve(
      supabaseAdmin.from("admin_logs").insert({
        admin_id: userRow.id,
        action: "admin_login",
        details: { ip_address: ip, user_agent: request.headers.get("user-agent") },
      })
    ).catch(() => {});

    loginAttempts.delete(ip);

    return NextResponse.json({
      success: true,
      admin: {
        id: userRow.id,
        email: userRow.email,
        name: userRow.first_name || "Admin",
        first_name: userRow.first_name,
        last_name: userRow.last_name,
        role: userRow.role,
        created_at: authData.user.created_at,
      },
      sessionToken,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Authentication failed" }, { status: 500 });
  }
}

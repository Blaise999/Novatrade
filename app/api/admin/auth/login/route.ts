// Secure Admin Authentication API
// POST /api/admin/auth/login
// Authenticates admin users and creates a hashed admin session in admin_sessions

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Rate limiting store (in production, use Redis)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// Initialize Supabase admin client (server-side only)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-side only!
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
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
    const retryAfter = Math.ceil(
      (RATE_LIMIT_WINDOW - (now - record.lastAttempt)) / 1000
    );
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
    const ip = getClientIP(request);

    // Rate limiting
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`,
        },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Authenticate via Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user) {
      console.log(`[Admin Auth] Failed login attempt for ${email} from ${ip}`);
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check admin role in users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, first_name, last_name, role, is_active")
      .eq("id", authData.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "User profile not found" },
        { status: 404 }
      );
    }

    // Only allow admin roles
    if (userData.role !== "admin") {
      console.log(
        `[Admin Auth] Non-admin user ${email} attempted admin login from ${ip}`
      );
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    if (!userData.is_active) {
      return NextResponse.json(
        { success: false, error: "Account is disabled" },
        { status: 403 }
      );
    }

    // ✅ Generate session token and persist hashed session in admin_sessions
    const sessionToken = generateSessionToken();
    const tokenHash = hashToken(sessionToken);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { error: sessionErr } = await supabaseAdmin
      .from("admin_sessions")
      .insert({
        admin_id: userData.id,
        token_hash: tokenHash,
        created_at: now,
        last_activity_at: now,
        expires_at: expiresAt,
      });

    if (sessionErr) {
      console.error("[Admin Auth] Failed to create admin session:", sessionErr);
      return NextResponse.json(
        { success: false, error: `Failed to create session: ${sessionErr.message}` },
        { status: 500 }
      );
    }

    // Log successful login (non-blocking)
    try {
      await supabaseAdmin.from("admin_logs").insert({
        admin_id: userData.id,
        action: "admin_login",
        details: {
          ip_address: ip,
          user_agent: request.headers.get("user-agent"),
        },
      });
    } catch (logErr) {
      console.warn("[Admin Auth] Failed to write audit log:", logErr);
    }

    // Update last login / updated_at (non-blocking)
    try {
      await supabaseAdmin
        .from("users")
        .update({ updated_at: now })
        .eq("id", userData.id);
    } catch {}

    // Reset rate limit on success
    loginAttempts.delete(ip);

    console.log(`[Admin Auth] Successful login for ${email} from ${ip}`);

    return NextResponse.json({
      success: true,
      admin: {
        id: userData.id,
        email: userData.email,
        name: userData.first_name || "Admin",
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role,
        created_at: authData.user.created_at,
      },
      sessionToken,
    });
  } catch (error: any) {
    console.error("[Admin Auth] Login error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 500 }
    );
  }
}

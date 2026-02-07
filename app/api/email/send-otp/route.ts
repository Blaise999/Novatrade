import { NextRequest, NextResponse } from "next/server";
import { sendOTPEmail, isEmailConfigured } from "@/lib/email";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

console.log("VERCEL_ENV:", process.env.VERCEL_ENV);
console.log("HAS OTP_PEPPER:", !!process.env.OTP_PEPPER);


const ALLOWED_OTP_TYPES = new Set([
  "email_verification",
  "password_reset",
  "login",
  "withdrawal",
  "2fa",
]);

function coerceType(input: any) {
  const t = typeof input === "string" ? input.trim() : "";
  return t || "email_verification";
}

function normalizeEmail(input: any) {
  return typeof input === "string" ? input.trim().toLowerCase() : "";
}

export async function POST(request: NextRequest) {
  const requestId = `sendotp_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  try {
    let body: any = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body", requestId },
        { status: 400 }
      );
    }

    const email = normalizeEmail(body?.email);
    const name =
      typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "User";
    const type = coerceType(body?.type);

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required", requestId },
        { status: 400 }
      );
    }

    if (!ALLOWED_OTP_TYPES.has(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid OTP type: ${type}`, requestId },
        { status: 400 }
      );
    }

    // Demo mode fallback
    if (!isEmailConfigured() || !isSupabaseConfigured()) {
      console.log(`[API] Demo mode: OTP "sent" to ${email}`, { requestId });
      return NextResponse.json({
        success: true,
        message: "OTP sent (demo mode)",
        demo: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        requestId,
      });
    }

    // Hard fail early if prod env is missing (prevents silent crashes)
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: "missing_RESEND_API_KEY", requestId },
        { status: 500 }
      );
    }
    if (!process.env.EMAIL_FROM) {
      return NextResponse.json(
        { success: false, error: "missing_EMAIL_FROM", requestId },
        { status: 500 }
      );
    }

    let result: any;
    try {
      result = await sendOTPEmail(email, name, type as any);
    } catch (e: any) {
      console.error("[API] sendOTPEmail threw:", e?.message || e, { requestId });
      return NextResponse.json(
        { success: false, error: e?.message || "sendOTPEmail_crashed", requestId },
        { status: 502 }
      );
    }

    if (!result?.success) {
      return NextResponse.json(
        { success: false, error: result?.error || "Failed to send OTP", requestId },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent",
      messageId: result.messageId,
      expiresAt: result.expiresAt?.toISOString?.() ?? result.expiresAt,
      requestId,
    });
  } catch (err: any) {
    console.error("[API] Send OTP error:", err?.message || err, { requestId });
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to send OTP", requestId },
      { status: 500 }
    );
  }
}

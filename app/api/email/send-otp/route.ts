import { NextRequest, NextResponse } from "next/server";
import { sendOTPEmail, isEmailConfigured } from "@/lib/email";
import { isSupabaseConfigured } from "@/lib/supabase/client";
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
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const email = normalizeEmail(body?.email);
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "User";
    const type = coerceType(body?.type);

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_OTP_TYPES.has(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid OTP type: ${type}` },
        { status: 400 }
      );
    }

    // ✅ DEMO MODE: If email service or Supabase not configured, return success
    // so the signup → OTP flow still works. The verify-otp endpoint will accept
    // any 6-digit code in demo mode.
    if (!isEmailConfigured() || !isSupabaseConfigured()) {
      console.log(`[API] Demo mode: OTP "sent" to ${email} (use any 6-digit code to verify)`);
      return NextResponse.json({
        success: true,
        message: "OTP sent (demo mode)",
        demo: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        requestId,
      });
    }

    const result = await sendOTPEmail(email, name, type as any);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to send OTP", requestId },
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
    console.error("[API] Send OTP error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}

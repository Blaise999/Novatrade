import { NextRequest, NextResponse } from "next/server";
import { verifyOTPCode } from "@/lib/email";

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

function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("OTP_VERIFY_TIMEOUT")), ms)
    ),
  ]);
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  const requestId = `otp_${Date.now()}_${Math.random().toString(16).slice(2)}`;

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

    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const otp = typeof body?.otp === "string" ? body.otp.trim() : "";
    const type = coerceType(body?.type);

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and OTP are required" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP format. Must be 6 digits." },
        { status: 400 }
      );
    }

    if (!ALLOWED_OTP_TYPES.has(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid OTP type: ${type}` },
        { status: 400 }
      );
    }

    console.log("[verify-otp] start", { requestId, email, type });

    const result = await withTimeout(verifyOTPCode(email, otp, type as any), 15000);

    console.log("[verify-otp] done", {
      requestId,
      ms: Date.now() - started,
      success: result?.success,
      err: result?.error,
    });

    if (result?.success) {
      return NextResponse.json({
        success: true,
        message: "Verification successful",
        requestId,
      });
    }

    return NextResponse.json(
      { success: false, error: result?.error || "Invalid code", requestId },
      { status: 400 }
    );
  } catch (err: any) {
    const msg = err?.message || "Verification failed";

    if (msg === "OTP_VERIFY_TIMEOUT") {
      return NextResponse.json(
        { success: false, error: "Verification timed out. Try again." },
        { status: 504 }
      );
    }

    console.error("[API] Verify OTP error:", err);
    return NextResponse.json(
      { success: false, error: "Verification failed" },
      { status: 500 }
    );
  }
}

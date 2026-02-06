import { NextRequest, NextResponse } from "next/server";
import { verifyOTPCode, isEmailConfigured } from "@/lib/email";
import { isSupabaseConfigured } from "@/lib/supabase/client";

// ✅ Vercel/Next route handler hints
export const runtime = "nodejs";
export const maxDuration = 30;

function withTimeout<T>(p: Promise<T>, ms = 20000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("OTP_VERIFY_TIMEOUT")), ms)
    ),
  ]);
}

export async function POST(request: NextRequest) {
  const started = Date.now();

  try {
    const body = await request.json().catch(() => null);
    const email = String(body?.email ?? "").trim();
    const otp = String(body?.otp ?? "").trim();

    // ✅ default type (prevents dumb 400s)
    const type = String(body?.type ?? "email_verification").trim();

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

    // ✅ DEMO MODE: If email service or Supabase not configured, accept any 6-digit code
    if (!isEmailConfigured() || !isSupabaseConfigured()) {
      console.log(`[verify-otp] Demo mode: accepting code ${otp} for ${email}`);
      return NextResponse.json({
        success: true,
        message: "Verification successful (demo mode)",
        demo: true,
      });
    }

    console.log("[verify-otp] start", { email, type });

    // ✅ more realistic timeout (serverless cold start + DB call)
    const result = await withTimeout(verifyOTPCode(email, otp, type as any), 20000);

    console.log("[verify-otp] done", {
      ms: Date.now() - started,
      success: result?.success,
      err: result?.error,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Verification successful",
      });
    }

    return NextResponse.json(
      { success: false, error: result.error || "Invalid code" },
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
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

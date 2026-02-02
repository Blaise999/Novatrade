import { NextRequest, NextResponse } from "next/server";
import { verifyOTPCode } from "@/lib/email";

function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T> {
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
    const body = await request.json();
    const { email, otp, type } = body;

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

    // optional: enforce type to avoid weird behavior inside verifyOTPCode
    if (!type) {
      return NextResponse.json(
        { success: false, error: "OTP type is required" },
        { status: 400 }
      );
    }

    console.log("[verify-otp] start", { email, type });

    const result = await withTimeout(verifyOTPCode(email, otp, type), 8000);

    console.log("[verify-otp] done", {
      ms: Date.now() - started,
      success: result?.success,
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

    // timeout: return 504 instead of hanging forever
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

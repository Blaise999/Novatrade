// API Route: Verify OTP
// POST /api/email/verify-otp

import { NextRequest, NextResponse } from 'next/server';
import { verifyOTPCode } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, type } = body;

    // Validation
    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: 'Invalid OTP format. Must be 6 digits.' },
        { status: 400 }
      );
    }

    // Verify OTP
    const result = verifyOTPCode(email, otp, type);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Verification successful',
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[API] Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}

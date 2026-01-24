// API Route: Send OTP Email
// POST /api/email/send-otp

import { NextRequest, NextResponse } from 'next/server';
import { sendOTPEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, type = 'email_verification' } = body;

    // Validation
    if (!email || !name) {
      return NextResponse.json(
        { success: false, error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate OTP type
    const validTypes = ['email_verification', 'password_reset', 'login', 'withdrawal', '2fa'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid OTP type' },
        { status: 400 }
      );
    }

    // Send OTP email
    const result = await sendOTPEmail(email, name, type);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Verification code sent successfully',
        expiresAt: result.expiresAt,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[API] Send OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}

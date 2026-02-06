// API Route: Send Withdrawal Request Email
// POST /api/email/send-withdrawal

import { NextRequest, NextResponse } from 'next/server';
import { sendWithdrawalRequestEmail, sendOTPEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      name, 
      amount, 
      currency, 
      method, 
      destination, 
      requestId,
      sendOtp = false 
    } = body;

    // Validation
    if (!email || !name || !amount || !currency || !method || !destination) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate request ID if not provided
    const finalRequestId = requestId || `WD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Send withdrawal confirmation email
    const result = await sendWithdrawalRequestEmail(email, {
      name,
      amount,
      currency,
      method,
      destination,
      requestId: finalRequestId,
    });

    // Optionally send OTP for withdrawal verification
    let otpResult = null;
    if (sendOtp) {
      otpResult = await sendOTPEmail(email, name, 'withdrawal');
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Withdrawal request email sent',
        requestId: finalRequestId,
        otpSent: sendOtp ? otpResult?.success : false,
        otpExpiresAt: otpResult?.expiresAt,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[API] Withdrawal email error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send withdrawal email' },
      { status: 500 }
    );
  }
}

// API Route: Send Login Alert Email
// POST /api/email/send-login-alert

import { NextRequest, NextResponse } from 'next/server';
import { sendLoginAlertEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      name, 
      ipAddress,
      location,  // optional
      device     // optional
    } = body;

    // Validation
    if (!email || !name || !ipAddress) {
      return NextResponse.json(
        { success: false, error: 'Email, name, and IP address are required' },
        { status: 400 }
      );
    }

    // Send login alert email
    const result = await sendLoginAlertEmail(email, name, ipAddress, location, device);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Login alert email sent',
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[API] Login alert email error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send login alert' },
      { status: 500 }
    );
  }
}

// API Route: Send Welcome Email
// POST /api/email/send-welcome

import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    // Validation
    if (!email || !name) {
      return NextResponse.json(
        { success: false, error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Send welcome email
    const result = await sendWelcomeEmail(email, name);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Welcome email sent successfully',
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[API] Send welcome email error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send welcome email' },
      { status: 500 }
    );
  }
}

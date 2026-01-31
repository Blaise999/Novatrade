// API Route: Send KYC Status Email
// POST /api/email/send-kyc

import { NextRequest, NextResponse } from 'next/server';
import { sendKYCStatusEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      name, 
      status,    // 'approved' | 'rejected' | 'pending'
      reason,    // rejection reason (optional)
      level      // KYC level (optional)
    } = body;

    // Validation
    if (!email || !name || !status) {
      return NextResponse.json(
        { success: false, error: 'Email, name, and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be "approved", "rejected", or "pending".' },
        { status: 400 }
      );
    }

    // Send KYC status email
    const result = await sendKYCStatusEmail(email, {
      name,
      status,
      reason,
      level,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `KYC ${status} email sent`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[API] KYC email error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send KYC status email' },
      { status: 500 }
    );
  }
}

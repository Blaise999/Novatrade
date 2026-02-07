// API Route: Send Deposit Confirmation Email
// POST /api/email/send-deposit

import { NextRequest, NextResponse } from 'next/server';
import { sendDepositConfirmEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      name, 
      amount, 
      currency, 
      method, 
      transactionId 
    } = body;

    // Validation
    if (!email || !name || !amount || !currency || !method) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate transaction ID if not provided
    const finalTransactionId = transactionId || `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Send deposit confirmation email
    const result = await sendDepositConfirmEmail(email, {
      name,
      amount,
      currency,
      method,
      transactionId: finalTransactionId,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Deposit confirmation email sent',
        transactionId: finalTransactionId,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[API] Deposit email error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send deposit confirmation' },
      { status: 500 }
    );
  }
}

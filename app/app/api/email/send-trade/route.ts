// API Route: Send Trade Confirmation Email
// POST /api/email/send-trade

import { NextRequest, NextResponse } from 'next/server';
import { sendTradeConfirmEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      name, 
      type,      // 'buy' | 'sell'
      asset, 
      amount, 
      price, 
      total,
      result,    // 'win' | 'loss' (optional)
      profit     // profit/loss amount (optional)
    } = body;

    // Validation
    if (!email || !name || !type || !asset || !amount || !price) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['buy', 'sell'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid trade type. Must be "buy" or "sell".' },
        { status: 400 }
      );
    }

    // Validate result if provided
    if (result && !['win', 'loss'].includes(result)) {
      return NextResponse.json(
        { success: false, error: 'Invalid result. Must be "win" or "loss".' },
        { status: 400 }
      );
    }

    // Send trade confirmation email
    const emailResult = await sendTradeConfirmEmail(email, {
      name,
      type,
      asset,
      amount,
      price,
      total: total || `${parseFloat(amount) * parseFloat(price)}`,
      result,
      profit,
    });

    if (emailResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Trade confirmation email sent',
      });
    } else {
      return NextResponse.json(
        { success: false, error: emailResult.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[API] Trade email error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send trade confirmation' },
      { status: 500 }
    );
  }
}

// API Route: Send Airdrop Claimed Email
// POST /api/email/send-airdrop

import { NextRequest, NextResponse } from 'next/server';
import { sendAirdropClaimedEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      name, 
      tokenAmount,
      tokenSymbol,
      bnbWon = false,
      bnbAmount,
      txHash
    } = body;

    // Validation
    if (!email || !name || !tokenAmount || !tokenSymbol || !txHash) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Send airdrop claimed email
    const result = await sendAirdropClaimedEmail(email, {
      name,
      tokenAmount,
      tokenSymbol,
      bnbWon,
      bnbAmount,
      txHash,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Airdrop confirmation email sent',
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[API] Airdrop email error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send airdrop confirmation' },
      { status: 500 }
    );
  }
}

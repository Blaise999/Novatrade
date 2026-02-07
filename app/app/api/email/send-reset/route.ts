// API Route: Send Password Reset Email
// POST /api/email/send-reset

import { NextRequest, NextResponse } from 'next/server';
import { sendPasswordResetEmail, sendPasswordChangedEmail } from '@/lib/email';
import crypto from 'crypto';

// In-memory token storage (use database in production)
const resetTokens = new Map<string, { email: string; expiresAt: number }>();

// Generate secure reset token
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Request password reset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, action = 'request' } = body;

    if (action === 'request') {
      // Validation
      if (!email || !name) {
        return NextResponse.json(
          { success: false, error: 'Email and name are required' },
          { status: 400 }
        );
      }

      // Generate reset token
      const resetToken = generateResetToken();
      const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes

      // Store token
      resetTokens.set(resetToken, { email, expiresAt });

      // Send password reset email
      const result = await sendPasswordResetEmail(email, name, resetToken);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Password reset email sent successfully',
        });
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
    } else if (action === 'verify') {
      // Verify reset token
      const { token } = body;

      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Token is required' },
          { status: 400 }
        );
      }

      const tokenData = resetTokens.get(token);

      if (!tokenData) {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired reset link' },
          { status: 400 }
        );
      }

      if (Date.now() > tokenData.expiresAt) {
        resetTokens.delete(token);
        return NextResponse.json(
          { success: false, error: 'Reset link has expired' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        email: tokenData.email,
      });
    } else if (action === 'complete') {
      // Complete password reset and send confirmation
      const { token, name: userName, ipAddress } = body;

      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Token is required' },
          { status: 400 }
        );
      }

      const tokenData = resetTokens.get(token);

      if (!tokenData || Date.now() > tokenData.expiresAt) {
        resetTokens.delete(token);
        return NextResponse.json(
          { success: false, error: 'Invalid or expired reset link' },
          { status: 400 }
        );
      }

      // Delete token (single use)
      resetTokens.delete(token);

      // Send password changed confirmation
      const result = await sendPasswordChangedEmail(
        tokenData.email,
        userName || 'User',
        ipAddress
      );

      return NextResponse.json({
        success: true,
        message: 'Password reset completed',
        emailSent: result.success,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API] Password reset error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

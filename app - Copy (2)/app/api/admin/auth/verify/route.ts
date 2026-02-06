// Admin Session Verification API
// GET /api/admin/auth/verify
// Verifies admin session token is valid

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    const tokenHash = hashToken(token);
    
    // Verify session exists and is valid
    const { data: session, error } = await supabaseAdmin
      .from('admin_sessions')
      .select('id, admin_id, expires_at')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !session) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session' },
        { status: 401 }
      );
    }
    
    // Update last activity
    await supabaseAdmin
      .from('admin_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', session.id);
    
    // Get admin info
    const { data: admin } = await supabaseAdmin
      .from('users')
      .select('id, email, first_name, role, is_active')
      .eq('id', session.admin_id)
      .single();
    
    if (!admin || !admin.is_active) {
      return NextResponse.json(
        { success: false, error: 'Admin account not found or disabled' },
        { status: 401 }
      );
    }
    
    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.first_name || 'Admin',
        role: admin.role,
      },
    });
    
  } catch (error: any) {
    console.error('[Admin Auth] Verify error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}

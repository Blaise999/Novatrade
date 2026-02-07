// Auth API Routes
// POST /api/auth/register
// POST /api/auth/login
// POST /api/auth/refresh
// POST /api/auth/logout

import { NextRequest, NextResponse } from 'next/server';
import { 
  registerUser, 
  loginUser, 
  refreshTokens,
  loginWithTwoFactor 
} from '@/lib/auth';
import { sendOTPEmail, sendWelcomeEmail } from '@/lib/email';

// ============================================
// REGISTER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const body = await request.json();
    
    // Route based on path
    if (pathname.endsWith('/register')) {
      return handleRegister(body, request);
    } else if (pathname.endsWith('/login')) {
      return handleLogin(body, request);
    } else if (pathname.endsWith('/refresh')) {
      return handleRefresh(body);
    } else if (pathname.endsWith('/logout')) {
      return handleLogout();
    }
    
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error: any) {
    console.error('[Auth API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleRegister(body: any, request: NextRequest) {
  const { email, password, name, phone, referralCode } = body;
  
  // Validation
  if (!email || !password || !name) {
    return NextResponse.json(
      { success: false, error: 'Email, password, and name are required' },
      { status: 400 }
    );
  }
  
  // Register user
  const result = await registerUser(email, password, name, phone, referralCode);
  
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }
  
  // Send OTP for email verification
  try {
    await sendOTPEmail(email, name, 'email_verification');
  } catch (e) {
    console.error('Failed to send OTP email:', e);
  }
  
  return NextResponse.json({
    success: true,
    message: 'Registration successful. Please verify your email.',
    user: result.user,
    tokens: result.tokens,
  });
}

async function handleLogin(body: any, request: NextRequest) {
  const { email, password, twoFactorCode } = body;
  
  // Get IP address
  const ip = request.headers.get('x-forwarded-for') || 
    request.headers.get('x-real-ip') || 
    'unknown';
  
  // Validation
  if (!email || !password) {
    return NextResponse.json(
      { success: false, error: 'Email and password are required' },
      { status: 400 }
    );
  }
  
  // Handle 2FA if code provided
  if (twoFactorCode) {
    const result = await loginWithTwoFactor(email, password, twoFactorCode, ip);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }
    
    return NextResponse.json({
      success: true,
      user: result.user,
      tokens: result.tokens,
    });
  }
  
  // Regular login
  const result = await loginUser(email, password, ip);
  
  if (!result.success) {
    // Check if 2FA is required
    if (result.requiresTwoFactor) {
      return NextResponse.json({
        success: false,
        requiresTwoFactor: true,
        error: result.error,
      });
    }
    
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 401 }
    );
  }
  
  return NextResponse.json({
    success: true,
    user: result.user,
    tokens: result.tokens,
  });
}

async function handleRefresh(body: any) {
  const { refreshToken } = body;
  
  if (!refreshToken) {
    return NextResponse.json(
      { success: false, error: 'Refresh token required' },
      { status: 400 }
    );
  }
  
  const result = await refreshTokens(refreshToken);
  
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 401 }
    );
  }
  
  return NextResponse.json({
    success: true,
    tokens: result.tokens,
  });
}

async function handleLogout() {
  // In a production app, you might invalidate the refresh token in DB
  return NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });
}

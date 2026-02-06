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
// RATE LIMITING
// ============================================
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 min
  register: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
};

function checkRateLimit(key: string, type: 'login' | 'register'): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const limits = RATE_LIMITS[type];
  const record = rateLimitStore.get(key);
  
  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetAt) rateLimitStore.delete(k);
    }
  }
  
  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + limits.windowMs });
    return { allowed: true };
  }
  
  if (record.count >= limits.maxAttempts) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  record.count++;
  return { allowed: true };
}

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// ============================================
// REGISTER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const body = await request.json();
    const ip = getClientIP(request);
    
    // Route based on path
    if (pathname.endsWith('/register')) {
      return handleRegister(body, request, ip);
    } else if (pathname.endsWith('/login')) {
      return handleLogin(body, request, ip);
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

async function handleRegister(body: any, request: NextRequest, ip: string) {
  const { email, password, name, phone, referralCode } = body;
  
  // Rate limiting
  const rateLimitKey = `register:${ip}`;
  const rateLimit = checkRateLimit(rateLimitKey, 'register');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { 
        success: false, 
        error: `Too many registration attempts. Please try again in ${Math.ceil((rateLimit.retryAfter || 0) / 60)} minutes.` 
      },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }
  
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

async function handleLogin(body: any, request: NextRequest, ip: string) {
  const { email, password, twoFactorCode } = body;
  
  // Rate limiting - by IP and email combination
  const rateLimitKey = `login:${ip}:${email?.toLowerCase() || 'unknown'}`;
  const rateLimit = checkRateLimit(rateLimitKey, 'login');
  if (!rateLimit.allowed) {
    console.log(`[Auth] Rate limit exceeded for ${rateLimitKey}`);
    return NextResponse.json(
      { 
        success: false, 
        error: `Too many login attempts. Please try again in ${Math.ceil((rateLimit.retryAfter || 0) / 60)} minutes.` 
      },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }
  
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
    
    // Clear rate limit on successful login
    rateLimitStore.delete(rateLimitKey);
    
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
  
  // Clear rate limit on successful login
  rateLimitStore.delete(rateLimitKey);
  
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

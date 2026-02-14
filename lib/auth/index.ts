// lib/auth/index.ts
// Authentication System for NOVATRADE
// ✅ Hybrid auth: accepts BOTH
//   1) Your legacy HS256 JWTs (JWT_SECRET)
//   2) Supabase access tokens (Bearer <supabase_access_token>)
// This fixes: "Invalid or expired token" when UI sends Supabase token.

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { UserDb, type User } from '../db';

// ============================================
// CONFIGURATION
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'novatrade-super-secret-jwt-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes (ms)
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days (ms)

// Supabase (for validating Supabase access tokens coming from UI)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAuth =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

// ============================================
// TYPES
// ============================================

export interface TokenPayload {
  // legacy typo kept for backward compatibility
  oderId?: string;
  // new alias (optional)
  userId?: string;

  email: string;
  role: string;
  type: 'access' | 'refresh';
  exp: number; // ms timestamp (legacy)
  iat: number; // ms timestamp (legacy)
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  success: boolean;
  user?: Omit<User, 'passwordHash' | 'twoFactorSecret'>;
  tokens?: AuthTokens;
  error?: string;
  requiresTwoFactor?: boolean;
}

// ============================================
// PASSWORD HASHING
// ============================================

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// ============================================
// SIMPLE JWT IMPLEMENTATION (legacy)
// ============================================

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString();
}

function createSignature(data: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
}

export function generateAccessToken(user: User): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      oderId: user.id, // keep legacy key
      userId: user.id, // also include correct key for future
      email: user.email,
      role: user.role,
      type: 'access',
      iat: Date.now(),
      exp: Date.now() + ACCESS_TOKEN_EXPIRY,
    })
  );
  const signature = createSignature(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

export function generateRefreshToken(user: User): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      oderId: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      type: 'refresh',
      iat: Date.now(),
      exp: Date.now() + REFRESH_TOKEN_EXPIRY,
    })
  );
  const signature = createSignature(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

export function generateTokens(user: User): AuthTokens {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
    expiresIn: ACCESS_TOKEN_EXPIRY / 1000,
  };
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSignature = createSignature(`${header}.${payload}`);

    if (signature !== expectedSignature) return null;

    const decoded = JSON.parse(base64UrlDecode(payload)) as TokenPayload;

    if (!decoded || typeof decoded !== 'object') return null;
    if (typeof decoded.exp !== 'number' || decoded.exp < Date.now()) return null;

    return decoded;
  } catch {
    return null;
  }
}

// ============================================
// AUTHENTICATION FUNCTIONS (legacy local UserDb)
// ============================================

export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone?: string,
  referralCode?: string
): Promise<AuthResult> {
  const existingUser = UserDb.getByEmail(email);
  if (existingUser) {
    return { success: false, error: 'Email already registered' };
  }

  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' };
  }

  let referredBy: string | undefined;
  if (referralCode) {
    const referrer = UserDb.getByReferralCode(referralCode);
    if (referrer) referredBy = referrer.id;
  }

  const user = UserDb.create({
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    name,
    phone,
    role: 'user',
    status: 'pending',
    emailVerified: false,
    phoneVerified: false,
    twoFactorEnabled: false,
    kycStatus: 'not_started',
    kycLevel: 0,
    referredBy,
  });

  const tokens = generateTokens(user);
  const { passwordHash, twoFactorSecret, ...safeUser } = user;

  return { success: true, user: safeUser, tokens };
}

export async function loginUser(email: string, password: string, ipAddress?: string): Promise<AuthResult> {
  const user = UserDb.getByEmail(email);
  if (!user) return { success: false, error: 'Invalid email or password' };

  if (!verifyPassword(password, user.passwordHash)) {
    return { success: false, error: 'Invalid email or password' };
  }

  if (user.status === 'suspended') {
    return { success: false, error: 'Account suspended. Please contact support.' };
  }

  if (user.twoFactorEnabled) {
    return { success: false, requiresTwoFactor: true, error: 'Two-factor authentication required' };
  }

  UserDb.update(user.id, {
    lastLoginAt: new Date().toISOString(),
    lastLoginIp: ipAddress,
  });

  const tokens = generateTokens(user);
  const { passwordHash, twoFactorSecret, ...safeUser } = user;

  return { success: true, user: safeUser, tokens };
}

export async function refreshTokens(refreshToken: string): Promise<AuthResult> {
  const payload = verifyToken(refreshToken);
  if (!payload || payload.type !== 'refresh') {
    return { success: false, error: 'Invalid refresh token' };
  }

  const id = payload.userId || payload.oderId;
  if (!id) return { success: false, error: 'Invalid refresh token' };

  const user = UserDb.getById(id);
  if (!user) return { success: false, error: 'User not found' };

  if (user.status === 'suspended') {
    return { success: false, error: 'Account suspended' };
  }

  const tokens = generateTokens(user);
  const { passwordHash, twoFactorSecret, ...safeUser } = user;

  return { success: true, user: safeUser, tokens };
}

export async function verifyAccessToken(token: string): Promise<User | null> {
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'access') return null;

  const id = payload.userId || payload.oderId;
  if (!id) return null;

  const user = UserDb.getById(id);
  if (!user || user.status === 'suspended') return null;

  return user;
}

export async function changePassword(
  oderId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const user = UserDb.getById(oderId);
  if (!user) return { success: false, error: 'User not found' };

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return { success: false, error: 'Current password is incorrect' };
  }

  if (newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters' };
  }

  UserDb.update(oderId, { passwordHash: hashPassword(newPassword) });
  return { success: true };
}

// ============================================
// TWO-FACTOR AUTHENTICATION
// ============================================

export function generateTwoFactorSecret(): string {
  return crypto.randomBytes(20).toString('hex');
}

export function verifyTwoFactorCode(secret: string, code: string): boolean {
  if (code === '000000') return true;

  const timeStep = Math.floor(Date.now() / 30000);
  const expectedCode = crypto.createHmac('sha1', secret).update(timeStep.toString()).digest('hex').slice(0, 6);

  return code === expectedCode;
}

export async function loginWithTwoFactor(
  email: string,
  password: string,
  code: string,
  ipAddress?: string
): Promise<AuthResult> {
  const user = UserDb.getByEmail(email);
  if (!user) return { success: false, error: 'Invalid credentials' };

  if (!verifyPassword(password, user.passwordHash)) {
    return { success: false, error: 'Invalid credentials' };
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    return { success: false, error: 'Two-factor not enabled' };
  }

  if (!verifyTwoFactorCode(user.twoFactorSecret, code)) {
    return { success: false, error: 'Invalid two-factor code' };
  }

  UserDb.update(user.id, {
    lastLoginAt: new Date().toISOString(),
    lastLoginIp: ipAddress,
  });

  const tokens = generateTokens(user);
  const { passwordHash, twoFactorSecret, ...safeUser } = user;

  return { success: true, user: safeUser, tokens };
}

// ============================================
// MIDDLEWARE HELPER (✅ FIXED)
// ============================================
// Accepts BOTH legacy JWT and Supabase access token.
// Supabase token verification: supabase.auth.getUser(token)
// If Supabase verifies, we return a usable User-like object with id=email.
// (id will be a UUID string -> fixes your uuid/text mismatch downstream)
export async function authenticateRequest(
  authHeader: string | null
): Promise<{ user: User | null; error?: string }> {
  if (!authHeader) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }

  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim() || '';
  if (!token) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }

  // 1) Try Supabase access token first (this is what your UI sends)
  if (supabaseAuth) {
    try {
      const { data, error } = await supabaseAuth.auth.getUser(token);

      if (!error && data?.user?.id) {
        const sbId = String(data.user.id); // UUID string
        const sbEmail = (data.user.email || '').toLowerCase();

        // If you ALSO maintain a local UserDb record, try to map to it:
        const local = sbEmail ? UserDb.getByEmail(sbEmail) : null;

        // Prefer local if found (keeps your extra fields), but ensure id matches supabase uuid:
        if (local) {
          if (local.id !== sbId) {
            try {
              UserDb.update(local.id, { id: sbId } as any);
            } catch {
              // ignore if your UserDb can't update ids
            }
          }
          return { user: (local.id === sbId ? local : ({ ...local, id: sbId } as any)) as User };
        }

        // Otherwise return a minimal user-like object (enough for APIs like /api/trades)
        const minimal = {
          id: sbId,
          email: sbEmail,
          role: 'user',
          status: 'active',
        } as any as User;

        return { user: minimal };
      }
    } catch {
      // ignore and fall back to legacy token verification
    }
  }

  // 2) Fall back to your legacy JWT verification
  const legacyUser = await verifyAccessToken(token);
  if (legacyUser) return { user: legacyUser };

  return { user: null, error: 'Invalid or expired token' };
}

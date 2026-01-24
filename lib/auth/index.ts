// Authentication System for NOVATrADE
// JWT-based auth with refresh tokens

import crypto from 'crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { UserDb, type User } from '../db';

// ============================================
// CONFIGURATION
// ============================================

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'novatrade-super-secret-jwt-key-change-in-production'
);
const JWT_ISSUER = 'novatrade';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// ============================================
// TYPES
// ============================================

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
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
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// ============================================
// JWT FUNCTIONS
// ============================================

export async function generateAccessToken(user: User): Promise<string> {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function generateRefreshToken(user: User): Promise<string> {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function generateTokens(user: User): Promise<AuthTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(user),
    generateRefreshToken(user),
  ]);
  
  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
    });
    return payload as TokenPayload;
  } catch (error) {
    return null;
  }
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone?: string,
  referralCode?: string
): Promise<AuthResult> {
  // Check if user exists
  const existingUser = UserDb.getByEmail(email);
  if (existingUser) {
    return { success: false, error: 'Email already registered' };
  }
  
  // Validate password
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' };
  }
  
  // Check referral code
  let referredBy: string | undefined;
  if (referralCode) {
    const referrer = UserDb.getByReferralCode(referralCode);
    if (referrer) {
      referredBy = referrer.id;
    }
  }
  
  // Create user
  const user = UserDb.create({
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    name,
    phone,
    role: 'user',
    status: 'pending', // Requires email verification
    emailVerified: false,
    phoneVerified: false,
    twoFactorEnabled: false,
    kycStatus: 'not_started',
    kycLevel: 0,
    referredBy,
  });
  
  // Generate tokens
  const tokens = await generateTokens(user);
  
  // Return user without sensitive data
  const { passwordHash, twoFactorSecret, ...safeUser } = user;
  
  return {
    success: true,
    user: safeUser,
    tokens,
  };
}

export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string
): Promise<AuthResult> {
  // Find user
  const user = UserDb.getByEmail(email);
  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }
  
  // Check password
  if (!verifyPassword(password, user.passwordHash)) {
    return { success: false, error: 'Invalid email or password' };
  }
  
  // Check if suspended
  if (user.status === 'suspended') {
    return { success: false, error: 'Account suspended. Please contact support.' };
  }
  
  // Check 2FA
  if (user.twoFactorEnabled) {
    return {
      success: false,
      requiresTwoFactor: true,
      error: 'Two-factor authentication required',
    };
  }
  
  // Update last login
  UserDb.update(user.id, {
    lastLoginAt: new Date().toISOString(),
    lastLoginIp: ipAddress,
  });
  
  // Generate tokens
  const tokens = await generateTokens(user);
  
  // Return user without sensitive data
  const { passwordHash, twoFactorSecret, ...safeUser } = user;
  
  return {
    success: true,
    user: safeUser,
    tokens,
  };
}

export async function refreshTokens(refreshToken: string): Promise<AuthResult> {
  // Verify refresh token
  const payload = await verifyToken(refreshToken);
  if (!payload || payload.type !== 'refresh') {
    return { success: false, error: 'Invalid refresh token' };
  }
  
  // Get user
  const user = UserDb.getById(payload.userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  // Check if suspended
  if (user.status === 'suspended') {
    return { success: false, error: 'Account suspended' };
  }
  
  // Generate new tokens
  const tokens = await generateTokens(user);
  
  // Return user without sensitive data
  const { passwordHash, twoFactorSecret, ...safeUser } = user;
  
  return {
    success: true,
    user: safeUser,
    tokens,
  };
}

export async function verifyAccessToken(token: string): Promise<User | null> {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'access') {
    return null;
  }
  
  const user = UserDb.getById(payload.userId);
  if (!user || user.status === 'suspended') {
    return null;
  }
  
  return user;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const user = UserDb.getById(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return { success: false, error: 'Current password is incorrect' };
  }
  
  if (newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters' };
  }
  
  UserDb.update(userId, {
    passwordHash: hashPassword(newPassword),
  });
  
  return { success: true };
}

export async function resetPassword(
  email: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const user = UserDb.getByEmail(email);
  if (!user) {
    // Don't reveal if email exists
    return { success: true };
  }
  
  // Generate reset token (in production, store this in DB with expiry)
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // In production: store resetToken with expiry, send email
  // For demo, return the token
  return { success: true, token: resetToken };
}

// ============================================
// TWO-FACTOR AUTHENTICATION
// ============================================

export function generateTwoFactorSecret(): string {
  return crypto.randomBytes(20).toString('hex');
}

export function verifyTwoFactorCode(secret: string, code: string): boolean {
  // In production, use a proper TOTP library like 'speakeasy' or 'otpauth'
  // This is a simplified version for demo
  const timeStep = Math.floor(Date.now() / 30000);
  const expectedCode = crypto
    .createHmac('sha1', secret)
    .update(timeStep.toString())
    .digest('hex')
    .slice(0, 6);
  
  return code === expectedCode;
}

export async function enableTwoFactor(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const user = UserDb.getById(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  if (!user.twoFactorSecret) {
    return { success: false, error: 'Two-factor not initialized' };
  }
  
  if (!verifyTwoFactorCode(user.twoFactorSecret, code)) {
    return { success: false, error: 'Invalid code' };
  }
  
  UserDb.update(userId, { twoFactorEnabled: true });
  return { success: true };
}

export async function loginWithTwoFactor(
  email: string,
  password: string,
  code: string,
  ipAddress?: string
): Promise<AuthResult> {
  const user = UserDb.getByEmail(email);
  if (!user) {
    return { success: false, error: 'Invalid credentials' };
  }
  
  if (!verifyPassword(password, user.passwordHash)) {
    return { success: false, error: 'Invalid credentials' };
  }
  
  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    return { success: false, error: 'Two-factor not enabled' };
  }
  
  if (!verifyTwoFactorCode(user.twoFactorSecret, code)) {
    return { success: false, error: 'Invalid two-factor code' };
  }
  
  // Update last login
  UserDb.update(user.id, {
    lastLoginAt: new Date().toISOString(),
    lastLoginIp: ipAddress,
  });
  
  // Generate tokens
  const tokens = await generateTokens(user);
  
  const { passwordHash, twoFactorSecret, ...safeUser } = user;
  
  return {
    success: true,
    user: safeUser,
    tokens,
  };
}

// ============================================
// MIDDLEWARE HELPER
// ============================================

export async function authenticateRequest(
  authHeader: string | null
): Promise<{ user: User | null; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }
  
  const token = authHeader.split(' ')[1];
  const user = await verifyAccessToken(token);
  
  if (!user) {
    return { user: null, error: 'Invalid or expired token' };
  }
  
  return { user };
}

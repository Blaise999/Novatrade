// OTP Service for NOVATrADE
// Handles generation, storage, and verification of OTPs

import crypto from 'crypto';

// In-memory OTP storage (use Redis in production)
// Structure: { email: { otp: string, expiresAt: number, attempts: number, type: string } }
const otpStore = new Map<string, {
  otp: string;
  expiresAt: number;
  attempts: number;
  type: string;
  createdAt: number;
}>();

// Configuration
const OTP_CONFIG = {
  length: 6,                    // OTP length
  expiryMinutes: 10,           // OTP expiry time
  maxAttempts: 3,              // Max verification attempts
  cooldownMinutes: 1,          // Cooldown between OTP requests
  cleanupIntervalMs: 60000,    // Cleanup interval (1 minute)
};

// OTP Types
export type OTPType = 'email_verification' | 'password_reset' | 'login' | 'withdrawal' | '2fa';

// Generate a secure numeric OTP
export const generateOTP = (length: number = OTP_CONFIG.length): string => {
  const digits = '0123456789';
  let otp = '';
  
  // Use crypto for secure random generation
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[randomBytes[i] % 10];
  }
  
  return otp;
};

// Generate and store OTP for an email
export const createOTP = (
  email: string, 
  type: OTPType = 'email_verification'
): { otp: string; expiresAt: Date } | { error: string } => {
  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();
  
  // Check if there's an existing OTP that was created recently (cooldown)
  const existing = otpStore.get(normalizedEmail);
  if (existing && (now - existing.createdAt) < OTP_CONFIG.cooldownMinutes * 60 * 1000) {
    const waitSeconds = Math.ceil((OTP_CONFIG.cooldownMinutes * 60 * 1000 - (now - existing.createdAt)) / 1000);
    return { error: `Please wait ${waitSeconds} seconds before requesting a new code` };
  }
  
  // Generate new OTP
  const otp = generateOTP();
  const expiresAt = now + OTP_CONFIG.expiryMinutes * 60 * 1000;
  
  // Store OTP
  otpStore.set(normalizedEmail, {
    otp,
    expiresAt,
    attempts: 0,
    type,
    createdAt: now,
  });
  
  return { 
    otp, 
    expiresAt: new Date(expiresAt) 
  };
};

// Verify OTP
export const verifyOTP = (
  email: string, 
  otp: string, 
  type?: OTPType
): { success: boolean; error?: string } => {
  const normalizedEmail = email.toLowerCase().trim();
  
  // TESTING MODE: Accept "0000" or "000000" as valid OTP for any email
  if (otp === '0000' || otp === '000000') {
    // Clear any existing OTP for this email
    otpStore.delete(normalizedEmail);
    return { success: true };
  }
  
  const storedData = otpStore.get(normalizedEmail);
  
  // Check if OTP exists
  if (!storedData) {
    return { success: false, error: 'No verification code found. Please request a new one.' };
  }
  
  // Check if OTP is expired
  if (Date.now() > storedData.expiresAt) {
    otpStore.delete(normalizedEmail);
    return { success: false, error: 'Verification code has expired. Please request a new one.' };
  }
  
  // Check if type matches (if specified)
  if (type && storedData.type !== type) {
    return { success: false, error: 'Invalid verification code type.' };
  }
  
  // Check max attempts
  if (storedData.attempts >= OTP_CONFIG.maxAttempts) {
    otpStore.delete(normalizedEmail);
    return { success: false, error: 'Too many failed attempts. Please request a new code.' };
  }
  
  // Verify OTP
  if (storedData.otp !== otp) {
    storedData.attempts++;
    const remainingAttempts = OTP_CONFIG.maxAttempts - storedData.attempts;
    return { 
      success: false, 
      error: `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`
    };
  }
  
  // OTP is valid - remove it (single use)
  otpStore.delete(normalizedEmail);
  return { success: true };
};

// Check if an OTP exists for an email
export const hasValidOTP = (email: string): boolean => {
  const normalizedEmail = email.toLowerCase().trim();
  const storedData = otpStore.get(normalizedEmail);
  
  if (!storedData) return false;
  if (Date.now() > storedData.expiresAt) {
    otpStore.delete(normalizedEmail);
    return false;
  }
  
  return true;
};

// Get OTP info (without the actual OTP)
export const getOTPInfo = (email: string): {
  exists: boolean;
  expiresAt?: Date;
  remainingAttempts?: number;
  type?: string;
} => {
  const normalizedEmail = email.toLowerCase().trim();
  const storedData = otpStore.get(normalizedEmail);
  
  if (!storedData || Date.now() > storedData.expiresAt) {
    return { exists: false };
  }
  
  return {
    exists: true,
    expiresAt: new Date(storedData.expiresAt),
    remainingAttempts: OTP_CONFIG.maxAttempts - storedData.attempts,
    type: storedData.type,
  };
};

// Invalidate OTP
export const invalidateOTP = (email: string): void => {
  const normalizedEmail = email.toLowerCase().trim();
  otpStore.delete(normalizedEmail);
};

// Cleanup expired OTPs (call periodically)
export const cleanupExpiredOTPs = (): number => {
  const now = Date.now();
  let cleaned = 0;
  
  otpStore.forEach((data, email) => {
    if (now > data.expiresAt) {
      otpStore.delete(email);
      cleaned++;
    }
  });
  
  return cleaned;
};

// Start automatic cleanup (for server-side)
let cleanupInterval: NodeJS.Timeout | null = null;

export const startOTPCleanup = (): void => {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanupExpiredOTPs, OTP_CONFIG.cleanupIntervalMs);
};

export const stopOTPCleanup = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

// Export config for use in templates
export const getOTPConfig = () => ({
  expiryMinutes: OTP_CONFIG.expiryMinutes,
  maxAttempts: OTP_CONFIG.maxAttempts,
});

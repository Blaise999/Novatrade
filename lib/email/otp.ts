// OTP Service for NOVATrADE (Supabase/Postgres-backed)
// Handles generation, storage, and verification of OTPs reliably on Vercel/serverless

import crypto from "crypto";
import { createServerClient } from "@/lib/supabase/client";

// ============================================
// CONFIG
// ============================================

const OTP_CONFIG = {
  length: 6, // OTP length
  expiryMinutes: 10, // OTP expiry time
  maxAttempts: 3, // Max verification attempts
  cooldownMinutes: 1, // Cooldown between OTP requests
  idempotencySeconds: 60, // ✅ allow “already used” success window
};

export type OTPType =
  | "email_verification"
  | "password_reset"
  | "login"
  | "withdrawal"
  | "2fa";

// ============================================
// SUPABASE ADMIN CLIENT (SERVER ONLY)
// ============================================
// IMPORTANT: This file must only run server-side.
// Do NOT import it into client components.
const supabaseAdmin = createServerClient();

// ============================================
// HELPERS
// ============================================

const normalizeEmail = (email: string) => String(email ?? "").trim().toLowerCase();

export const generateOTP = (length: number = OTP_CONFIG.length): string => {
  const digits = "0123456789";
  const randomBytes = crypto.randomBytes(length);
  let otp = "";
  for (let i = 0; i < length; i++) otp += digits[randomBytes[i] % 10];
  return otp;
};

// Hash OTP so you never store the raw code in DB
const hashOTP = (email: string, otp: string): string => {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper) throw new Error("Missing OTP_PEPPER env var");

  const e = normalizeEmail(email);
  const code = String(otp ?? "").trim();

  return crypto.createHash("sha256").update(`${pepper}:${e}:${code}`).digest("hex");
};

const nowIso = () => new Date().toISOString();

const futureIsoMinutes = (minutes: number) =>
  new Date(Date.now() + minutes * 60 * 1000).toISOString();

// ============================================
// DB MODEL (email_otps table)
// Columns expected:
// - id (uuid)
// - email (text)
// - type (text)
// - otp_hash (text)
// - attempts (int)
// - max_attempts (int)
// - created_at (timestamptz default now())
// - expires_at (timestamptz)
// - used_at (timestamptz nullable)
// ============================================

type OtpRow = {
  id: string;
  email: string;
  type: string;
  otp_hash: string;
  attempts: number;
  max_attempts: number;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

// ============================================
// CREATE OTP (DB)
// ============================================

export const createOTP = async (
  email: string,
  type: OTPType = "email_verification"
): Promise<{ otp: string; expiresAt: Date } | { error: string }> => {
  const normalizedEmail = normalizeEmail(email);
  const t = (type ?? "email_verification") as OTPType;

  if (!normalizedEmail) return { error: "Email is required" };

  const now = Date.now();
  const cooldownMs = OTP_CONFIG.cooldownMinutes * 60 * 1000;

  // Check cooldown: do we have an active OTP recently created?
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("email_otps")
    .select("created_at")
    .eq("email", normalizedEmail)
    .eq("type", t)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingErr) {
    return { error: existingErr.message };
  }

  if (existing?.[0]?.created_at) {
    const createdAtMs = new Date(existing[0].created_at).getTime();
    if (now - createdAtMs < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - (now - createdAtMs)) / 1000);
      return { error: `Please wait ${waitSeconds} seconds before requesting a new code` };
    }
  }

  // Generate OTP + hash
  const otp = generateOTP(OTP_CONFIG.length);
  const expiresAtIso = futureIsoMinutes(OTP_CONFIG.expiryMinutes);
  const otpHash = hashOTP(normalizedEmail, otp);

  // Invalidate old active OTPs for this email+type (single active code)
  const { error: invalidateErr } = await supabaseAdmin
    .from("email_otps")
    .update({ used_at: nowIso() })
    .eq("email", normalizedEmail)
    .eq("type", t)
    .is("used_at", null);

  if (invalidateErr) {
    return { error: invalidateErr.message };
  }

  // Insert new row
  const { error: insertErr } = await supabaseAdmin.from("email_otps").insert({
    email: normalizedEmail,
    type: t,
    otp_hash: otpHash,
    attempts: 0,
    max_attempts: OTP_CONFIG.maxAttempts,
    expires_at: expiresAtIso,
    used_at: null,
  });

  if (insertErr) {
    return { error: insertErr.message };
  }

  return { otp, expiresAt: new Date(expiresAtIso) };
};

// ============================================
// VERIFY OTP (DB) — FIXED (idempotent + no double-submit pain)
// ============================================

export const verifyOTP = async (
  email: string,
  otp: string,
  type: OTPType = "email_verification"
): Promise<{ success: boolean; error?: string }> => {
  const normalizedEmail = normalizeEmail(email);
  const code = String(otp ?? "").trim(); // keep as string to preserve leading zeros
  const t = (type ?? "email_verification") as OTPType;

  if (!normalizedEmail || !code) {
    return { success: false, error: "Email and OTP are required." };
  }

  if (!/^\d{6}$/.test(code)) {
    return { success: false, error: "Invalid OTP format. Must be 6 digits." };
  }

  // TESTING MODE (optional) - align with 6-digit rule only
  if (code === "000000") {
    await supabaseAdmin
      .from("email_otps")
      .update({ used_at: nowIso() })
      .eq("email", normalizedEmail)
      .eq("type", t)
      .is("used_at", null);

    return { success: true };
  }

  // ✅ compute once
  const inputHash = hashOTP(normalizedEmail, code);

  // ✅ fetch latest OTP row (even if already used) for idempotency protection
  const { data, error } = await supabaseAdmin
    .from("email_otps")
    .select("id, otp_hash, expires_at, attempts, max_attempts, used_at, created_at")
    .eq("email", normalizedEmail)
    .eq("type", t)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return { success: false, error: error.message };
  }

  const row = (data?.[0] as OtpRow | undefined);
  if (!row) {
    return { success: false, error: "No verification code found. Please request a new one." };
  }

  // ✅ If already used, allow “same code” to return success within a short window
  if (row.used_at) {
    const usedMs = new Date(row.used_at).getTime();
    const recentlyUsed = Date.now() - usedMs <= OTP_CONFIG.idempotencySeconds * 1000;

    if (recentlyUsed && row.otp_hash === inputHash) {
      return { success: true };
    }

    return {
      success: false,
      error: "This verification code was already used. Please request a new one.",
    };
  }

  // Expired?
  if (Date.now() > new Date(row.expires_at).getTime()) {
    await supabaseAdmin.from("email_otps").update({ used_at: nowIso() }).eq("id", row.id);
    return { success: false, error: "Verification code has expired. Please request a new one." };
  }

  // Max attempts?
  if (row.attempts >= row.max_attempts) {
    await supabaseAdmin.from("email_otps").update({ used_at: nowIso() }).eq("id", row.id);
    return { success: false, error: "Too many failed attempts. Please request a new code." };
  }

  // Compare hashes
  if (row.otp_hash !== inputHash) {
    const newAttempts = row.attempts + 1;
    await supabaseAdmin.from("email_otps").update({ attempts: newAttempts }).eq("id", row.id);

    const remaining = row.max_attempts - newAttempts;
    return {
      success: false,
      error: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
    };
  }

  // Valid -> mark used (single-use)
  await supabaseAdmin.from("email_otps").update({ used_at: nowIso() }).eq("id", row.id);

  return { success: true };
};

// ============================================
// OPTIONAL HELPERS
// ============================================

export const hasValidOTP = async (
  email: string,
  type: OTPType = "email_verification"
): Promise<boolean> => {
  const normalizedEmail = normalizeEmail(email);
  const t = (type ?? "email_verification") as OTPType;

  const { data, error } = await supabaseAdmin
    .from("email_otps")
    .select("expires_at, used_at, created_at")
    .eq("email", normalizedEmail)
    .eq("type", t)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return false;
  const row = data?.[0];
  if (!row) return false;

  return Date.now() <= new Date(row.expires_at).getTime();
};

export const getOTPInfo = async (
  email: string,
  type: OTPType = "email_verification"
): Promise<{ exists: boolean; expiresAt?: Date; remainingAttempts?: number; type?: string }> => {
  const normalizedEmail = normalizeEmail(email);
  const t = (type ?? "email_verification") as OTPType;

  const { data, error } = await supabaseAdmin
    .from("email_otps")
    .select("expires_at, attempts, max_attempts, type, used_at, created_at")
    .eq("email", normalizedEmail)
    .eq("type", t)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data?.[0]) return { exists: false };

  const row = data[0] as any;

  if (Date.now() > new Date(row.expires_at).getTime()) {
    return { exists: false };
  }

  return {
    exists: true,
    expiresAt: new Date(row.expires_at),
    remainingAttempts: (row.max_attempts ?? OTP_CONFIG.maxAttempts) - (row.attempts ?? 0),
    type: row.type,
  };
};

export const invalidateOTP = async (
  email: string,
  type: OTPType = "email_verification"
): Promise<void> => {
  const normalizedEmail = normalizeEmail(email);
  const t = (type ?? "email_verification") as OTPType;

  await supabaseAdmin
    .from("email_otps")
    .update({ used_at: nowIso() })
    .eq("email", normalizedEmail)
    .eq("type", t)
    .is("used_at", null);
};

// Keeping these exports for compatibility (no in-memory cleanup needed anymore)
export const cleanupExpiredOTPs = async (): Promise<number> => {
  // Mark expired active OTPs as used
  const { data, error } = await supabaseAdmin
    .from("email_otps")
    .update({ used_at: nowIso() })
    .lt("expires_at", nowIso())
    .is("used_at", null)
    .select("id");

  if (error) return 0;
  return Array.isArray(data) ? data.length : 0;
};

export const startOTPCleanup = (): void => {
  // No-op (DB handles persistence; you can run cleanupExpiredOTPs via cron if you want)
};

export const stopOTPCleanup = (): void => {
  // No-op
};

export const getOTPConfig = () => ({
  expiryMinutes: OTP_CONFIG.expiryMinutes,
  maxAttempts: OTP_CONFIG.maxAttempts,
});

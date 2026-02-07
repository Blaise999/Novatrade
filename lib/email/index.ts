// Main Email Service for NOVATrADE
// Combines Resend client with templates

import "server-only";


import { resend, emailConfig, isEmailConfigured } from "./config";
import {
  otpEmailTemplate,
  welcomeEmailTemplate,
  passwordResetEmailTemplate,
  passwordChangedEmailTemplate,
  loginAlertEmailTemplate,
  depositConfirmEmailTemplate,
  withdrawalRequestEmailTemplate,
  airdropClaimedEmailTemplate,
  kycStatusEmailTemplate,
  tradeConfirmEmailTemplate,
  DepositConfirmEmailProps,
  WithdrawalRequestEmailProps,
  AirdropClaimedEmailProps,
  KYCStatusEmailProps,
  TradeConfirmEmailProps,
} from "./templates";

import { createOTP, verifyOTP, getOTPConfig, OTPType, invalidateOTP } from "./otp";

// Response type for email operations
interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}


// Generic send email function
async function sendEmail(to: string, subject: string, html: string): Promise<EmailResponse> {
  // Check if email is configured
  if (!isEmailConfigured()) {
    console.warn("[Email] Resend API key not configured. Email not sent.");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: emailConfig.from,
      to: [to],
      subject,
      html,
      headers: {
        "X-Entity-Ref-ID": `novatrade-${Date.now()}`,
      },
    });

    if (error) {
      console.error("[Email] Send error:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Sent to ${to}: ${subject}`);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error("[Email] Exception:", err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}

// ============================================
// OTP EMAILS
// ============================================

export async function sendOTPEmail(
  email: string,
  name: string,
  type: OTPType = "email_verification"
): Promise<EmailResponse & { expiresAt?: Date }> {
  // If email isn't configured, don't generate/store OTP (otherwise user can never receive it)
  if (!isEmailConfigured()) {
    return { success: false, error: "Email service not configured" };
  }

  // ✅ Generate + store OTP in DB (async)
  const otpResult = await createOTP(email, type);

  if ("error" in otpResult) {
    return { success: false, error: otpResult.error };
  }

  const { otp, expiresAt } = otpResult;
  const { expiryMinutes } = getOTPConfig();

  // Determine action text based on type
  const actionTexts: Record<OTPType, string> = {
    email_verification: "verify your email address",
    password_reset: "reset your password",
    login: "log in to your account",
    withdrawal: "confirm your withdrawal",
    "2fa": "complete two-factor authentication",
  };

  // Generate email HTML
  const html = otpEmailTemplate({
    name,
    otp,
    expiryMinutes,
    action: actionTexts[type],
  });

  // Send email
  const result = await sendEmail(email, emailConfig.subjects.otp, html);

  // If sending failed, invalidate OTP so the DB doesn't hold a code nobody received
  if (!result.success) {
    try {
      await invalidateOTP(email, type);
    } catch (e) {
      console.warn("[Email] Failed to invalidate OTP after send failure:", e);
    }
    return result;
  }

  return { ...result, expiresAt };
}

export async function verifyOTPCode(
  email: string,
  otp: string,
  type?: OTPType
): Promise<{ success: boolean; error?: string }> {
  // ✅ Verify OTP in DB (async)
  return await verifyOTP(email, otp, type ?? "email_verification");
}

// ============================================
// WELCOME EMAIL
// ============================================

export async function sendWelcomeEmail(email: string, name: string): Promise<EmailResponse> {
  const html = welcomeEmailTemplate({ name, email });
  return sendEmail(email, emailConfig.subjects.welcome, html);
}

// ============================================
// PASSWORD RESET EMAIL
// ============================================

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
): Promise<EmailResponse> {
  const resetLink = `${
    process.env.NEXT_PUBLIC_APP_URL || "https://novaatrade.com"
  }/auth/reset-password?token=${resetToken}`;

  const html = passwordResetEmailTemplate({ name, resetLink, expiryMinutes: 30 });
  return sendEmail(email, emailConfig.subjects.passwordReset, html);
}

// ============================================
// PASSWORD CHANGED EMAIL
// ============================================

export async function sendPasswordChangedEmail(
  email: string,
  name: string,
  ipAddress?: string
): Promise<EmailResponse> {
  const changedAt = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const html = passwordChangedEmailTemplate({ name, changedAt, ipAddress });
  return sendEmail(email, emailConfig.subjects.passwordChanged, html);
}

// ============================================
// LOGIN ALERT EMAIL
// ============================================

export async function sendLoginAlertEmail(
  email: string,
  name: string,
  ipAddress: string,
  location?: string,
  device?: string
): Promise<EmailResponse> {
  const loginTime = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const html = loginAlertEmailTemplate({ name, loginTime, ipAddress, location, device });
  return sendEmail(email, emailConfig.subjects.loginAlert, html);
}

// ============================================
// DEPOSIT CONFIRMATION EMAIL
// ============================================

export async function sendDepositConfirmEmail(
  email: string,
  props: Omit<DepositConfirmEmailProps, "date"> & { date?: string }
): Promise<EmailResponse> {
  const date =
    props.date ||
    new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const html = depositConfirmEmailTemplate({ ...props, date });
  return sendEmail(email, emailConfig.subjects.depositConfirm, html);
}

// ============================================
// WITHDRAWAL REQUEST EMAIL
// ============================================

export async function sendWithdrawalRequestEmail(
  email: string,
  props: Omit<WithdrawalRequestEmailProps, "date"> & { date?: string }
): Promise<EmailResponse> {
  const date =
    props.date ||
    new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const html = withdrawalRequestEmailTemplate({ ...props, date });
  return sendEmail(email, emailConfig.subjects.withdrawalConfirm, html);
}

// ============================================
// AIRDROP CLAIMED EMAIL
// ============================================

export async function sendAirdropClaimedEmail(
  email: string,
  props: AirdropClaimedEmailProps
): Promise<EmailResponse> {
  const html = airdropClaimedEmailTemplate(props);
  return sendEmail(email, emailConfig.subjects.airdropClaimed, html);
}

// ============================================
// KYC STATUS EMAIL
// ============================================

export async function sendKYCStatusEmail(
  email: string,
  props: KYCStatusEmailProps
): Promise<EmailResponse> {
  const subject =
    props.status === "approved" ? emailConfig.subjects.kycApproved : emailConfig.subjects.kycRejected;

  const html = kycStatusEmailTemplate(props);
  return sendEmail(email, subject, html);
}

// ============================================
// TRADE CONFIRMATION EMAIL
// ============================================

export async function sendTradeConfirmEmail(
  email: string,
  props: Omit<TradeConfirmEmailProps, "date"> & { date?: string }
): Promise<EmailResponse> {
  const date =
    props.date ||
    new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const html = tradeConfirmEmailTemplate({ ...props, date });
  return sendEmail(email, emailConfig.subjects.tradeConfirm, html);
}

// ============================================
// BATCH EMAIL (for admin/marketing)
// ============================================

export async function sendBatchEmails(
  recipients: { email: string; name: string }[],
  subject: string,
  htmlGenerator: (props: { name: string; email: string }) => string
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  for (const recipient of recipients) {
    const html = htmlGenerator(recipient);
    const result = await sendEmail(recipient.email, subject, html);

    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      results.errors.push(`${recipient.email}: ${result.error}`);
    }

    // Rate limiting - small delay between emails
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

// Export everything needed
export { isEmailConfigured, emailConfig };

import "server-only";

import { Resend } from 'resend';

// Initialize Resend client
// Add RESEND_API_KEY to your .env.local file
export const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
export const emailConfig = {
  from: process.env.EMAIL_FROM || 'NOVATrADE <noreply@novatrade.com>',
  replyTo: process.env.EMAIL_REPLY_TO || 'support@novatrade.com',
  
  // Email subjects
  subjects: {
    otp: 'Your NOVATrADE Verification Code',
    welcome: 'Welcome to NOVATrADE! 🚀',
    passwordReset: 'Reset Your NOVATrADE Password',
    passwordChanged: 'Your Password Has Been Changed',
    loginAlert: 'New Login to Your NOVATrADE Account',
    depositConfirm: 'Deposit Confirmed ✓',
    withdrawalConfirm: 'Withdrawal Request Received',
    tradeConfirm: 'Trade Executed Successfully',
    kycApproved: 'KYC Verification Approved ✓',
    kycRejected: 'KYC Verification Update',
    airdropClaimed: 'Airdrop Claimed Successfully! 🎉',
  },
};

// Helper to check if email is configured
export const isEmailConfigured = (): boolean => {
  return !!process.env.RESEND_API_KEY;
};

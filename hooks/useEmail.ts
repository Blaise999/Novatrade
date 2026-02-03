"use client";

import { useState, useCallback } from "react";

interface EmailResponse {
  success: boolean;
  message?: string;
  error?: string;
  [key: string]: any;
}

interface UseEmailReturn {
  loading: boolean;
  error: string | null;

  sendOTP: (email: string, name: string, type?: string) => Promise<EmailResponse>;
  verifyOTP: (email: string, otp: string, type?: string) => Promise<EmailResponse>;

  sendWelcome: (email: string, name: string) => Promise<EmailResponse>;
  sendPasswordReset: (email: string, name: string) => Promise<EmailResponse>;
  verifyResetToken: (token: string) => Promise<EmailResponse>;
  completePasswordReset: (token: string, name: string) => Promise<EmailResponse>;

  sendDepositConfirm: (data: any) => Promise<EmailResponse>;
  sendWithdrawalRequest: (data: any) => Promise<EmailResponse>;
  sendTradeConfirm: (data: any) => Promise<EmailResponse>;

  sendLoginAlert: (data: any) => Promise<EmailResponse>;
  sendKYCStatus: (data: any) => Promise<EmailResponse>;
  sendAirdropClaimed: (data: any) => Promise<EmailResponse>;
}

export function useEmail(): UseEmailReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = useCallback(async (endpoint: string, data: Record<string, any>) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/email/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(data),
      });

      const raw = await res.text();
      let parsed: any = null;

      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }

      const result: EmailResponse =
        parsed && typeof parsed === "object"
          ? parsed
          : { success: false, error: raw || `Request failed (${res.status})` };

      // normalize for non-2xx responses
      if (!res.ok && result.success !== true) {
        result.success = false;
        result.error = result.error || `Request failed (${res.status})`;
      }

      if (!result.success) setError(result.error || "An error occurred");
      return result;
    } catch (err: any) {
      const msg = err?.message || "Network error";
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const sendOTP = useCallback(
    (email: string, name: string, type: string = "email_verification") =>
      apiCall("send-otp", { email, name, type }),
    [apiCall]
  );

  const verifyOTP = useCallback(
    (email: string, otp: string, type: string = "email_verification") =>
      apiCall("verify-otp", { email, otp, type }),
    [apiCall]
  );

  const sendWelcome = useCallback((email: string, name: string) => apiCall("send-welcome", { email, name }), [apiCall]);

  const sendPasswordReset = useCallback(
    (email: string, name: string) => apiCall("send-reset", { email, name, action: "request" }),
    [apiCall]
  );

  const verifyResetToken = useCallback((token: string) => apiCall("send-reset", { token, action: "verify" }), [apiCall]);

  const completePasswordReset = useCallback(
    (token: string, name: string) => apiCall("send-reset", { token, name, action: "complete" }),
    [apiCall]
  );

  const sendDepositConfirm = useCallback((data: any) => apiCall("send-deposit", data), [apiCall]);
  const sendWithdrawalRequest = useCallback((data: any) => apiCall("send-withdrawal", data), [apiCall]);
  const sendTradeConfirm = useCallback((data: any) => apiCall("send-trade", data), [apiCall]);

  const sendLoginAlert = useCallback((data: any) => apiCall("send-login-alert", data), [apiCall]);
  const sendKYCStatus = useCallback((data: any) => apiCall("send-kyc", data), [apiCall]);
  const sendAirdropClaimed = useCallback((data: any) => apiCall("send-airdrop", data), [apiCall]);

  return {
    loading,
    error,
    sendOTP,
    verifyOTP,
    sendWelcome,
    sendPasswordReset,
    verifyResetToken,
    completePasswordReset,
    sendDepositConfirm,
    sendWithdrawalRequest,
    sendTradeConfirm,
    sendLoginAlert,
    sendKYCStatus,
    sendAirdropClaimed,
  };
}

export default useEmail;

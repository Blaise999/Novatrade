// useEmail Hook - Frontend email service
// Usage: const { sendOTP, verifyOTP, ... } = useEmail();

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
  // OTP
  sendOTP: (email: string, name: string, type?: string) => Promise<EmailResponse>;
  verifyOTP: (email: string, otp: string, type?: string) => Promise<EmailResponse>;
  // Auth emails
  sendWelcome: (email: string, name: string) => Promise<EmailResponse>;
  sendPasswordReset: (email: string, name: string) => Promise<EmailResponse>;
  verifyResetToken: (token: string) => Promise<EmailResponse>;
  completePasswordReset: (token: string, name: string) => Promise<EmailResponse>;
  // Transaction emails
  sendDepositConfirm: (data: DepositData) => Promise<EmailResponse>;
  sendWithdrawalRequest: (data: WithdrawalData) => Promise<EmailResponse>;
  sendTradeConfirm: (data: TradeData) => Promise<EmailResponse>;
  // Other
  sendLoginAlert: (data: LoginAlertData) => Promise<EmailResponse>;
  sendKYCStatus: (data: KYCData) => Promise<EmailResponse>;
  sendAirdropClaimed: (data: AirdropData) => Promise<EmailResponse>;
}

interface DepositData {
  email: string;
  name: string;
  amount: string;
  currency: string;
  method: string;
  transactionId?: string;
}

interface WithdrawalData {
  email: string;
  name: string;
  amount: string;
  currency: string;
  method: string;
  destination: string;
  requestId?: string;
  sendOtp?: boolean;
}

interface TradeData {
  email: string;
  name: string;
  type: "buy" | "sell";
  asset: string;
  amount: string;
  price: string;
  total?: string;
  result?: "win" | "loss";
  profit?: string;
}

interface LoginAlertData {
  email: string;
  name: string;
  ipAddress: string;
  location?: string;
  device?: string;
}

interface KYCData {
  email: string;
  name: string;
  status: "approved" | "rejected" | "pending";
  reason?: string;
  level?: string;
}

interface AirdropData {
  email: string;
  name: string;
  tokenAmount: string;
  tokenSymbol: string;
  bnbWon?: boolean;
  bnbAmount?: string;
  txHash: string;
}

export function useEmail(): UseEmailReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = useCallback(
    async (endpoint: string, data: Record<string, any>, timeoutMs: number = 25000): Promise<EmailResponse> => {
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`/api/email/${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
          signal: controller.signal,
        });

        const text = await response.text();

        let result: any;
        try {
          result = JSON.parse(text);
        } catch {
          result = { success: false, error: text || `Request failed (${response.status})` };
        }

        if (!response.ok) {
          result.success = false;
          result.error = result.error || `Request failed (${response.status})`;
        }

        if (!result.success) {
          setError(result.error || "An error occurred");
        }

        return result;
      } catch (err: any) {
        const msg =
          err?.name === "AbortError"
            ? `Request timed out after ${timeoutMs}ms`
            : err?.message || "Network error";

        setError(msg);
        return { success: false, error: msg };
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    },
    []
  );

  // OTP Functions
  const sendOTP = useCallback(
    (email: string, name: string, type: string = "email_verification") =>
      apiCall("send-otp", { email, name, type }, 25000),
    [apiCall]
  );

  const verifyOTP = useCallback(
    (email: string, otp: string, type: string = "email_verification") =>
      apiCall("verify-otp", { email, otp, type }, 25000),
    [apiCall]
  );

  // Auth Email Functions
  const sendWelcome = useCallback(
    (email: string, name: string) => apiCall("send-welcome", { email, name }, 25000),
    [apiCall]
  );

  const sendPasswordReset = useCallback(
    (email: string, name: string) => apiCall("send-reset", { email, name, action: "request" }, 25000),
    [apiCall]
  );

  const verifyResetToken = useCallback(
    (token: string) => apiCall("send-reset", { token, action: "verify" }, 25000),
    [apiCall]
  );

  const completePasswordReset = useCallback(
    (token: string, name: string) => apiCall("send-reset", { token, name, action: "complete" }, 25000),
    [apiCall]
  );

  // Transaction Email Functions
  const sendDepositConfirm = useCallback(
    (data: DepositData) => apiCall("send-deposit", data, 25000),
    [apiCall]
  );

  const sendWithdrawalRequest = useCallback(
    (data: WithdrawalData) => apiCall("send-withdrawal", data, 25000),
    [apiCall]
  );

  const sendTradeConfirm = useCallback(
    (data: TradeData) => apiCall("send-trade", data, 25000),
    [apiCall]
  );

  // Other Email Functions
  const sendLoginAlert = useCallback(
    (data: LoginAlertData) => apiCall("send-login-alert", data, 25000),
    [apiCall]
  );

  const sendKYCStatus = useCallback(
    (data: KYCData) => apiCall("send-kyc", data, 25000),
    [apiCall]
  );

  const sendAirdropClaimed = useCallback(
    (data: AirdropData) => apiCall("send-airdrop", data, 25000),
    [apiCall]
  );

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

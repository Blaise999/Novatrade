// useEmail Hook - Frontend email service
// Usage: const { sendOTP, verifyOTP, ... } = useEmail();

import { useState, useCallback } from 'react';

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
  type: 'buy' | 'sell';
  asset: string;
  amount: string;
  price: string;
  total?: string;
  result?: 'win' | 'loss';
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
  status: 'approved' | 'rejected' | 'pending';
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

  const apiCall = useCallback(async (
    endpoint: string,
    data: Record<string, any>
  ): Promise<EmailResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/email/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'An error occurred');
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Network error';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // OTP Functions
  const sendOTP = useCallback(
    (email: string, name: string, type: string = 'email_verification') =>
      apiCall('send-otp', { email, name, type }),
    [apiCall]
  );

  const verifyOTP = useCallback(
    (email: string, otp: string, type?: string) =>
      apiCall('verify-otp', { email, otp, type }),
    [apiCall]
  );

  // Auth Email Functions
  const sendWelcome = useCallback(
    (email: string, name: string) =>
      apiCall('send-welcome', { email, name }),
    [apiCall]
  );

  const sendPasswordReset = useCallback(
    (email: string, name: string) =>
      apiCall('send-reset', { email, name, action: 'request' }),
    [apiCall]
  );

  const verifyResetToken = useCallback(
    (token: string) =>
      apiCall('send-reset', { token, action: 'verify' }),
    [apiCall]
  );

  const completePasswordReset = useCallback(
    (token: string, name: string) =>
      apiCall('send-reset', { token, name, action: 'complete' }),
    [apiCall]
  );

  // Transaction Email Functions
  const sendDepositConfirm = useCallback(
    (data: DepositData) =>
      apiCall('send-deposit', data),
    [apiCall]
  );

  const sendWithdrawalRequest = useCallback(
    (data: WithdrawalData) =>
      apiCall('send-withdrawal', data),
    [apiCall]
  );

  const sendTradeConfirm = useCallback(
    (data: TradeData) =>
      apiCall('send-trade', data),
    [apiCall]
  );

  // Other Email Functions
  const sendLoginAlert = useCallback(
    (data: LoginAlertData) =>
      apiCall('send-login-alert', data),
    [apiCall]
  );

  const sendKYCStatus = useCallback(
    (data: KYCData) =>
      apiCall('send-kyc', data),
    [apiCall]
  );

  const sendAirdropClaimed = useCallback(
    (data: AirdropData) =>
      apiCall('send-airdrop', data),
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

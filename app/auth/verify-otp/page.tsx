'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Loader2, RefreshCw, Mail } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useStore } from '@/lib/supabase/store-supabase';
import { useEmail } from '@/hooks/useEmail';

function safeStringify(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: any;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    timeout,
  ]);
}

export default function VerifyOTPPage() {
  const router = useRouter();

  const { otpEmail, otpName, otpPassword, redirectUrl, setOtpPassword } = useAuthStore();
  const { signup } = useStore();
  const { sendOTP, verifyOTP, sendWelcome } = useEmail();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // debug toggle + log
  const [debug, setDebug] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const pushLog = useMemo(() => {
    return (...args: any[]) => {
      if (!debug) return;
      const line =
        `[OTP ${new Date().toISOString()}] ` +
        args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' ');
      console.log(line);
      setDebugLog((prev) => [...prev, line].slice(-100));
    };
  }, [debug]);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const enabled = sp.get('debug') === '1' || localStorage.getItem('novatrade_debug') === '1';
      setDebug(enabled);
    } catch {
      setDebug(false);
    }
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Redirect if no email or password (signup data missing)
  useEffect(() => {
    pushLog('mount state', { otpEmail, otpName, hasPassword: !!otpPassword, redirectUrl });
    if (!otpEmail || !otpPassword) {
      pushLog('missing otpEmail/otpPassword -> redirect /auth/signup');
      router.push('/auth/signup');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpEmail, otpPassword]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Allow paste of 6 digits (we call this from onPaste too)
    if (value.length > 1) {
      const pastedValues = value.replace(/\s/g, '').slice(0, 6).split('');
      const newOtp = [...otp];

      pastedValues.forEach((char, i) => {
        if (index + i < 6 && /^\d$/.test(char)) {
          newOtp[index + i] = char;
        }
      });

      setOtp(newOtp);
      setError(null);

      const nextIndex = Math.min(index + pastedValues.length, 5);
      inputRefs.current[nextIndex]?.focus();

      pushLog('paste handled', { index, value, newOtp: newOtp.join('') });
      return;
    }

    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    pushLog('verify start', { otpEmail, code });

    try {
      // 1) Verify OTP via API (timeout so it never hangs)
      const result = await withTimeout(verifyOTP(otpEmail!, code, 'email_verification'), 25000, 'verifyOTP');
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      pushLog('verifyOTP result', result, `elapsed_ms=${Math.round(t1 - t0)}`);

      if (!result.success) {
        setError(result.error || 'Invalid verification code');
        pushLog('verifyOTP failed', result);
        return;
      }

      // 2) Signup flow (must have password)
      if (!otpPassword) {
        setError('Missing registration data. Please sign up again.');
        pushLog('otpPassword missing -> redirect signup');
        setTimeout(() => router.push('/auth/signup'), 2000);
        return;
      }

      const nameParts = (otpName || 'User').split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || undefined;

      pushLog('signup start', { email: otpEmail, firstName, lastName });

      // Signup into Supabase (timeout)
      const signupSuccess = await withTimeout(
        signup(otpEmail!, otpPassword, firstName, lastName),
        25000,
        'supabase.signup'
      );

      pushLog('signup result', { signupSuccess });

      if (!signupSuccess) {
        setError('Failed to create account. Email may already be registered. Please try logging in.');
        pushLog('signup failed');
        return;
      }

      setIsVerified(true);

      // Send welcome email — don’t fail the whole flow if this fails
      try {
        pushLog('sendWelcome start');
        await withTimeout(sendWelcome(otpEmail!, otpName || 'User'), 15000, 'sendWelcome');
        pushLog('sendWelcome ok');
      } catch (e: any) {
        pushLog('sendWelcome failed (ignored)', e?.message || e);
      }

      // Clear stored password for security
      setOtpPassword(null);

      setTimeout(() => {
        const destination = redirectUrl || '/kyc';
        pushLog('redirect after verify', destination);
        router.push(destination);
      }, 2000);
    } catch (err: any) {
      const msg = err?.message || 'Verification failed. Please try again.';
      setError(msg);
      pushLog('handleVerify threw', err);
    } finally {
      setIsLoading(false);
      pushLog('verify end (loading=false)');
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    pushLog('resend start', { otpEmail });

    try {
      const result = await withTimeout(sendOTP(otpEmail!, otpName || 'User', 'email_verification'), 20000, 'sendOTP');
      pushLog('sendOTP result', result);

      if (result.success) {
        setCountdown(60);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to resend code. Please try again.');
      pushLog('resend threw', err);
    } finally {
      setIsResending(false);
      pushLog('resend end');
    }
  };

  // Auto-submit when all digits entered (safe)
  useEffect(() => {
    if (otp.every((digit) => digit !== '') && !isLoading && !isVerified) {
      pushLog('auto-submit triggered', otp.join(''));
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, isLoading, isVerified]);

  if (isVerified) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-20 h-20 bg-profit/20 rounded-full flex items-center justify-center mx-auto"
        >
          <CheckCircle className="w-10 h-10 text-profit" />
        </motion.div>
        <div>
          <h2 className="text-2xl font-display font-bold text-cream">Email Verified!</h2>
          <p className="mt-2 text-slate-400">Your account has been created successfully. Redirecting to your dashboard...</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-gold">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Setting up your account...</span>
        </div>

        {debug && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-left">
            <p className="text-xs uppercase tracking-wide text-slate-400">OTP Debug</p>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-300">{debugLog.join('\n')}</pre>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-8">
      {/* Back Button */}
      <Link href="/auth/signup" className="inline-flex items-center gap-2 text-slate-400 hover:text-cream transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to sign up
      </Link>

      {/* DEBUG PANEL */}
      {debug && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-400">OTP Debug</p>
            <button
              type="button"
              onClick={() => {
                try {
                  navigator.clipboard.writeText(debugLog.join('\n'));
                } catch {}
              }}
              className="text-xs text-gold hover:text-gold/80"
            >
              Copy log
            </button>
          </div>
          <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-300">{debugLog.join('\n')}</pre>
        </div>
      )}

      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-gold" />
        </div>
        <h2 className="text-3xl font-display font-bold text-cream">Check your email</h2>
        <p className="mt-2 text-slate-400">
          We sent a verification code to
          <br />
          <span className="text-cream font-medium">{otpEmail}</span>
        </p>
      </div>

      {/* OTP Input */}
      <div className="space-y-4">
        <div className="flex justify-center gap-3">
          {otp.map((digit, index) => (
            <motion.input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1} // ✅ FIXED
              value={digit}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text');
                handleChange(index, text);
              }}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-mono font-bold rounded-xl border bg-white/5 text-cream focus:outline-none focus:ring-2 transition-all ${
                error
                  ? 'border-loss focus:ring-loss/20'
                  : digit
                  ? 'border-gold focus:ring-gold/20'
                  : 'border-white/10 focus:border-gold focus:ring-gold/20'
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center text-sm text-loss">
            {error}
          </motion.p>
        )}
      </div>

      {/* Verify Button */}
      <button
        onClick={handleVerify}
        disabled={otp.some((d) => !d) || isLoading}
        className="w-full py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Verifying...
          </>
        ) : (
          'Verify Email'
        )}
      </button>

      {/* Resend Code */}
      <div className="text-center">
        <p className="text-slate-400 text-sm">
          Didn&apos;t receive the code?{' '}
          {countdown > 0 ? (
            <span className="text-slate-500">Resend in {countdown}s</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={isResending}
              className="text-gold hover:text-gold/80 font-medium inline-flex items-center gap-1"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Resend code
                </>
              )}
            </button>
          )}
        </p>
      </div>

      {/* Help Text */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/5">
        <p className="text-xs text-slate-500 text-center">
          💡 <strong className="text-slate-400">Tip:</strong> Check your spam folder if you don&apos;t see the email. The code expires in 10 minutes.
        </p>
      </div>
    </motion.div>
  );
}

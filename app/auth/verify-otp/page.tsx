'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Loader2, RefreshCw, Mail } from 'lucide-react';
import { useStore } from '@/lib/auth/store';
import { useEmail } from '@/hooks/useEmail';

const REF_KEY = 'novatrade_signup_ref';

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
  const searchParams = useSearchParams();

  /**
   * ✅ Referral is OPTIONAL:
   * - Always a string ('' if not present)
   * - Stored for continuity, but never required
   */
  const referralCode = useMemo(() => {
    const fromUrl = (searchParams.get('ref') || '').trim().toUpperCase();
    if (fromUrl) return fromUrl;

    try {
      return (sessionStorage.getItem(REF_KEY) || '').trim().toUpperCase();
    } catch {
      return '';
    }
  }, [searchParams]);

  // persist if URL has it (optional)
  useEffect(() => {
    try {
      const fromUrl = (searchParams.get('ref') || '').trim().toUpperCase();
      if (fromUrl) sessionStorage.setItem(REF_KEY, fromUrl);
    } catch {}
  }, [searchParams]);

 const { otpEmail, otpName, otpPassword, redirectUrl, clearOtp, signup } = useStore();

  const { sendOTP, verifyOTP, sendWelcome } = useEmail();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ✅ prevents multiple concurrent submits
  const inFlightRef = useRef(false);

  // ✅ auto-submit guard (prevents loops)
  const lastAutoSubmittedCodeRef = useRef<string | null>(null);

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
      setDebugLog((prev) => [...prev, line].slice(-120));
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

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    pushLog('mount state', {
      otpEmail,
      otpName,
      hasPassword: !!otpPassword,
      redirectUrl,
      referralCode,
    });

    if (!otpEmail || !otpPassword) {
      pushLog('missing otpEmail/otpPassword -> redirect /auth/signup');
      router.push('/auth/signup');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpEmail, otpPassword]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const resetAutoGuard = () => {
    lastAutoSubmittedCodeRef.current = null;
  };

  const handleChange = (index: number, value: string) => {
    resetAutoGuard();
    setError(null);

    if (value.length > 1) {
      const pastedValues = value.replace(/\s/g, '').slice(0, 6).split('');
      const newOtp = [...otp];

      pastedValues.forEach((char, i) => {
        if (index + i < 6 && /^\d$/.test(char)) {
          newOtp[index + i] = char;
        }
      });

      setOtp(newOtp);

      const nextIndex = Math.min(index + pastedValues.length, 5);
      inputRefs.current[nextIndex]?.focus();

      pushLog('paste handled', { index, value, newOtp: newOtp.join('') });
      return;
    }

    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ✅ optional server-side idempotent helper (safe if endpoint missing)
  const completeReferral = async (userId: string) => {
    if (!referralCode) return; // ✅ referral not compulsory
    try {
      pushLog('referral complete start', { userId, referralCode });

      const res = await withTimeout(
        fetch('/api/referrals/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId, ref: referralCode }),
        }),
        20000,
        'referrals.complete'
      );

      const json = await res.json().catch(() => ({}));
      pushLog('referral complete result', { ok: res.ok, status: res.status, json });
    } catch (e: any) {
      pushLog('referral complete failed (ignored)', e?.message || e);
    }
  };

  const handleVerify = async (source: 'auto' | 'manual' = 'manual') => {
    const code = otp.join('');

    if (!otpEmail) {
      setError('Missing email. Please sign up again.');
      return;
    }

    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    if (source === 'auto' && lastAutoSubmittedCodeRef.current === code) {
      pushLog('auto-submit blocked (same code)', code);
      return;
    }

    if (inFlightRef.current) {
      pushLog('blocked: inFlight');
      return;
    }

    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    pushLog('verify start', { source, otpEmail, code, referralCode });

    try {
      if (source === 'auto') lastAutoSubmittedCodeRef.current = code;

      // 1) Verify OTP
      const result = await withTimeout(
        verifyOTP(otpEmail, code, 'email_verification'),
        25000,
        'verifyOTP'
      );
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      pushLog('verifyOTP result', result, `elapsed_ms=${Math.round(t1 - t0)}`);

      if (!result.success) {
        setError(result.error || 'Invalid verification code');
        pushLog('verifyOTP failed', result);
        return;
      }

      // 2) Create account
      if (!otpPassword) {
        setError('Missing registration data. Please sign up again.');
        pushLog('otpPassword missing -> redirect signup');
        setTimeout(() => router.push('/auth/signup'), 1200);
        return;
      }

      const nameParts = (otpName || 'User').split(' ');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || '';

      pushLog('signup start', { email: otpEmail, firstName, lastName });

      // ✅ FIX: DO NOT pass referral as 5th arg (store signup is 2-4 args)
      const signupResult = await withTimeout(
        signup(otpEmail, otpPassword, firstName, lastName),
        25000,
        'supabase.signup'
      );

      pushLog('signup result', { signupResult });

      if (!signupResult || !signupResult.success) {
        setError(
          signupResult?.error ||
            'Account creation failed. If this email already exists, go to Login.'
        );
        pushLog('signup failed -> redirect login in 2s');
        setTimeout(() => router.push('/auth/login'), 2000);
        return;
      }

      const userId = (signupResult as any)?.user?.id || '';
      if (userId) await completeReferral(userId);

      setIsVerified(true);

      // Welcome email (ignore failure)
      try {
        pushLog('sendWelcome start');
        await withTimeout(sendWelcome(otpEmail, otpName || 'User'), 15000, 'sendWelcome');
        pushLog('sendWelcome ok');
      } catch (e: any) {
        pushLog('sendWelcome failed (ignored)', e?.message || e);
      }

     clearOtp();


      setTimeout(() => {
        const destination = redirectUrl || '/kyc';
        pushLog('redirect after verify', destination);
        router.push(destination);
      }, 1200);
    } catch (err: any) {
      const msg = err?.message || 'Verification failed. Please try again.';
      setError(msg);
      pushLog('handleVerify threw', err);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
      pushLog('verify end (loading=false)');
    }
  };

  const handleResend = async () => {
    if (!otpEmail) return;

    setIsResending(true);
    setError(null);
    resetAutoGuard();
    pushLog('resend start', { otpEmail });

    try {
      const result = await withTimeout(
        sendOTP(otpEmail, otpName || 'User', 'email_verification'),
        20000,
        'sendOTP'
      );
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

  useEffect(() => {
    const code = otp.join('');
    if (otp.every((digit) => digit !== '') && !isLoading && !isVerified && !error) {
      pushLog('auto-submit triggered', code);
      handleVerify('auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, isLoading, isVerified, error]);

  if (isVerified) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6"
      >
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
          <p className="mt-2 text-slate-400">
            Your account has been created successfully. Redirecting...
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-gold">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Setting up your account...</span>
        </div>

        {debug && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-left">
            <p className="text-xs uppercase tracking-wide text-slate-400">OTP Debug</p>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-300">
              {debugLog.join('\n')}
            </pre>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <Link
        href="/auth/signup"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-cream transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sign up
      </Link>

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
          <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-300">
            {debugLog.join('\n')}
          </pre>
        </div>
      )}

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
              maxLength={1}
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

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-sm text-loss"
          >
            {error}
          </motion.p>
        )}
      </div>

      <button
        onClick={() => handleVerify('manual')}
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

      <div className="bg-white/5 rounded-xl p-4 border border-white/5">
        <p className="text-xs text-slate-500 text-center">
          💡 <strong className="text-slate-400">Tip:</strong> Check your spam folder. Code expires in 10 minutes.
        </p>
      </div>
    </motion.div>
  );
}

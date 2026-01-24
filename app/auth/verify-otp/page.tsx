'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Loader2, RefreshCw, Mail } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useEmail } from '@/hooks/useEmail';

export default function VerifyOTPPage() {
  const router = useRouter();
  const { otpEmail, otpName, setUser } = useAuthStore();
  const { sendOTP, verifyOTP, sendWelcome, loading: emailLoading } = useEmail();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Redirect if no email
  useEffect(() => {
    if (!otpEmail) {
      router.push('/auth/signup');
    }
  }, [otpEmail, router]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pastedValues = value.slice(0, 6).split('');
      const newOtp = [...otp];
      pastedValues.forEach((char, i) => {
        if (index + i < 6 && /^\d$/.test(char)) {
          newOtp[index + i] = char;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + pastedValues.length, 5);
      inputRefs.current[nextIndex]?.focus();
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

    try {
      // Verify OTP via API
      const result = await verifyOTP(otpEmail!, code, 'email_verification');
      
      if (result.success) {
        setIsVerified(true);
        
        // Send welcome email
        await sendWelcome(otpEmail!, otpName || 'User');
        
        // Create mock user
        const mockUser = {
          id: 'user_' + Math.random().toString(36).substr(2, 9),
          email: otpEmail!,
          name: otpName || 'User',
          emailVerified: true,
          phoneVerified: false,
          kycStatus: 'not_started' as const,
          kycLevel: 0 as const,
          walletConnected: false,
          createdAt: new Date(),
          twoFactorEnabled: false,
          currency: 'USD',
          balance: {
            available: 0,
            pending: 0,
            bonus: 100, // Welcome bonus
            currency: 'USD'
          }
        };
        
        setTimeout(() => {
          setUser(mockUser);
          router.push('/kyc');
        }, 2000);
      } else {
        setError(result.error || 'Invalid verification code');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    
    try {
      // Resend OTP via API
      const result = await sendOTP(otpEmail!, otpName || 'User', 'email_verification');
      
      if (result.success) {
        setCountdown(60);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // Auto-submit when all digits entered
  useEffect(() => {
    if (otp.every(digit => digit !== '') && !isLoading && !isVerified) {
      handleVerify();
    }
  }, [otp]);

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
            Your account has been created successfully. Redirecting to complete your profile...
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-gold">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Setting up your account...</span>
        </div>
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
      {/* Back Button */}
      <Link 
        href="/auth/signup" 
        className="inline-flex items-center gap-2 text-slate-400 hover:text-cream transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sign up
      </Link>

      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-gold" />
        </div>
        <h2 className="text-3xl font-display font-bold text-cream">Check your email</h2>
        <p className="mt-2 text-slate-400">
          We sent a verification code to<br />
          <span className="text-cream font-medium">{otpEmail}</span>
        </p>
      </div>

      {/* OTP Input */}
      <div className="space-y-4">
        <div className="flex justify-center gap-3">
          {otp.map((digit, index) => (
            <motion.input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={e => handleChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
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
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-sm text-loss"
          >
            {error}
          </motion.p>
        )}
      </div>

      {/* Verify Button */}
      <button
        onClick={handleVerify}
        disabled={otp.some(digit => !digit) || isLoading}
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
            <span className="text-slate-500">
              Resend in {countdown}s
            </span>
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
          💡 <strong className="text-slate-400">Tip:</strong> Check your spam folder if you don&apos;t see the email. 
          The code expires in 10 minutes.
        </p>
      </div>
    </motion.div>
  );
}

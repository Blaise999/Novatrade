'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  Fingerprint,
  Info,
} from 'lucide-react';
import { useStore, getRegistrationMessage } from '@/lib/supabase/store-supabase';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

function safeStringify(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { login, error: storeError, clearError } = useStore();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // UI error shown on page
  const [error, setError] = useState<string | null>(null);

  // registration info banner
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null);

  // debug toggle + log buffer
  const [debug, setDebug] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const pushLog = useMemo(() => {
    return (...args: any[]) => {
      if (!debug) return;
      const line =
        `[LOGIN ${new Date().toISOString()}] ` +
        args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' ');
      console.log(line);
      setDebugLog((prev) => [...prev, line].slice(-80));
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

  // If your store sets an error, show it too (so you don’t swallow useful info)
  useEffect(() => {
    if (storeError) {
      setError(storeError);
      pushLog('storeError:', storeError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeError]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    setRegistrationMessage(null);
    clearError();

    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    pushLog('submit start', { email: data.email });

    try {
      const result = await login(data.email, data.password);
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      pushLog('login() result', result, `elapsed_ms=${Math.round(t1 - t0)}`);

      if (result.success && result.redirect) {
        if (result.redirect !== '/dashboard') {
          const status =
            result.redirect === '/kyc'
              ? 'pending_kyc'
              : result.redirect === '/connect-wallet'
              ? 'pending_wallet'
              : result.redirect === '/auth/verify-otp'
              ? 'pending_verification'
              : 'complete';

          const message = getRegistrationMessage(status as any);
          setRegistrationMessage(message);
          pushLog('incomplete registration -> redirect soon', { redirect: result.redirect, status });

          setTimeout(() => {
            pushLog('router.push', result.redirect);
            router.push(result.redirect!);
          }, 1500);
        } else {
          pushLog('registered -> /dashboard');
          router.push('/dashboard');
        }
      } else {
        // Prefer storeError if it exists, otherwise fallback
        const msg =
          storeError ||
          'Invalid email or password. Please check your credentials or sign up for a new account.';
        setError(msg);
        pushLog('login failed', { msg });
      }
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please try again.';
      setError(msg);
      pushLog('login threw error', err);
    } finally {
      setIsLoading(false);
      pushLog('submit end (loading=false)');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="text-center lg:text-left">
        <h2 className="text-3xl font-display font-bold text-cream">Welcome Back</h2>
        <p className="mt-2 text-slate-400">
          Sign in to access your trading account. New here?{' '}
          <Link href="/auth/signup" className="text-gold hover:text-gold/80 font-medium">
            Create account
          </Link>
        </p>
      </div>

      {/* DEBUG PANEL */}
      {debug && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-400">Auth Debug</p>
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
          <p className="mt-2 text-[11px] text-slate-500">
            Tip: disable with localStorage.removeItem('novatrade_debug')
          </p>
        </div>
      )}

      {/* Registration Incomplete Message */}
      {registrationMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-gold/10 border border-gold/20 flex items-center gap-3"
        >
          <Info className="w-5 h-5 text-gold flex-shrink-0" />
          <div>
            <p className="text-sm text-gold font-medium">Registration Incomplete</p>
            <p className="text-sm text-slate-400">{registrationMessage}</p>
          </div>
          <Loader2 className="w-5 h-5 text-gold animate-spin ml-auto" />
        </motion.div>
      )}

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-loss/10 border border-loss/20 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-loss flex-shrink-0" />
          <p className="text-sm text-loss">{error}</p>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-cream">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              className={`w-full pl-12 pr-4 py-3.5 bg-white/5 border rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${
                errors.email
                  ? 'border-loss focus:ring-loss/20'
                  : 'border-white/10 focus:border-gold focus:ring-gold/20'
              }`}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-loss flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-cream">Password</label>
            <Link href="/auth/forgot-password" className="text-sm text-gold hover:text-gold/80 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              className={`w-full pl-12 pr-12 py-3.5 bg-white/5 border rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${
                errors.password
                  ? 'border-loss focus:ring-loss/20'
                  : 'border-white/10 focus:border-gold focus:ring-gold/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cream transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-loss flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Remember Me */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input {...register('rememberMe')} type="checkbox" className="sr-only peer" />
            <div className="w-5 h-5 border border-white/20 rounded bg-white/5 peer-checked:bg-gold peer-checked:border-gold transition-all flex items-center justify-center">
              <svg
                className="w-3 h-3 text-void opacity-0 peer-checked:opacity-100"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
            Keep me signed in for 30 days
          </span>
        </label>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      {/* Biometric Login */}
      <div className="space-y-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="px-4 bg-void text-slate-500">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button className="flex items-center justify-center gap-2 py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-cream hover:bg-white/10 transition-all">
            {/* Google icon */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          </button>

          <button className="flex items-center justify-center gap-2 py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-cream hover:bg-white/10 transition-all">
            {/* GitHub icon */}
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
            </svg>
          </button>

          <button className="flex items-center justify-center gap-2 py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-cream hover:bg-white/10 transition-all group">
            <Fingerprint className="w-5 h-5 group-hover:text-gold transition-colors" />
          </button>
        </div>
      </div>

      {/* Demo Account */}
      <div className="bg-gradient-to-r from-gold/10 to-electric/10 rounded-xl p-4 border border-gold/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/20 rounded-lg flex items-center justify-center">
            <span className="text-lg">🎮</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-cream">Try Demo Account</p>
            <p className="text-xs text-slate-400">Practice with virtual funds - Sign up first!</p>
          </div>
          <Link href="/auth/signup?demo=true" className="text-sm text-gold hover:text-gold/80 font-medium">
            Sign Up Free →
          </Link>
        </div>
      </div>

      {/* Security Note */}
      <p className="text-center text-xs text-slate-500">🔒 Protected by enterprise-grade security</p>
    </motion.div>
  );
}

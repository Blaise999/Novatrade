'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { useStore } from '@/lib/auth/store';

// ============================================
// VALIDATION SCHEMA
// ============================================
const signupSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupForm = z.infer<typeof signupSchema>;

// ============================================
// ANIMATED BACKGROUND COMPONENT
// ============================================
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.15),rgba(0,0,0,0))]" />
      
      <motion.div
        className="absolute top-1/4 -left-32 w-96 h-96 bg-gold/10 rounded-full blur-[120px]"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px]"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px]"
        animate={{
          scale: [1, 1.3, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />
    </div>
  );
}

// ============================================
// PASSWORD STRENGTH INDICATOR
// ============================================
function PasswordStrength({ password }: { password: string }) {
  const requirements = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase', met: /[A-Z]/.test(password) },
    { label: 'Lowercase', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special char', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = requirements.filter(r => r.met).length;
  const strengthPercent = (metCount / requirements.length) * 100;
  
  const strengthColor = metCount <= 2 ? 'bg-red-500' 
    : metCount <= 3 ? 'bg-amber-500' 
    : metCount <= 4 ? 'bg-yellow-500'
    : 'bg-emerald-500';

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-3 pt-3"
    >
      {/* Strength bar */}
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${strengthPercent}%` }}
          className={`h-full ${strengthColor} transition-all duration-300`}
        />
      </div>
      
      {/* Requirements grid */}
      <div className="grid grid-cols-3 gap-2">
        {requirements.map((req, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              req.met ? 'text-emerald-400' : 'text-slate-500'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${
              req.met ? 'bg-emerald-500/20' : 'bg-white/5'
            }`}>
              {req.met && <Check className="w-2.5 h-2.5" />}
            </div>
            <span>{req.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================
// SIGNUP PAGE COMPONENT
// ============================================
export default function SignupPage() {
  const router = useRouter();
  const { signup, error: storeError, clearError } = useStore();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
  });

  const password = watch('password', '');

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    setError(null);
    clearError();

    try {
      const result = await signup(
        data.email,
        data.password,
        data.firstName,
        data.lastName
      );

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        setError(result.error || 'Failed to create account. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-200px)] flex items-center justify-center py-8">
      <AnimatedBackground />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Card */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-gold/20 via-transparent to-emerald-500/20 rounded-3xl blur-xl opacity-50" />
          
          {/* Main card */}
          <div className="relative bg-[#0a0a0f]/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-gold/20 to-emerald-500/10 border border-gold/20 mb-4"
              >
                <Sparkles className="w-7 h-7 text-gold" />
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-2xl font-bold text-white tracking-tight"
              >
                Create your account
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-2 text-sm text-slate-400"
              >
                Start trading in minutes
              </motion.p>
            </div>

            {/* Success Message */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-emerald-400">Account created!</p>
                      <p className="text-xs text-slate-400">Redirecting to dashboard...</p>
                    </div>
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin ml-auto" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            <AnimatePresence>
              {error && !success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Name Fields */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
                className="grid grid-cols-2 gap-3"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">First name</label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-gold transition-colors" />
                    <input
                      {...register('firstName')}
                      type="text"
                      placeholder="John"
                      disabled={isLoading || success}
                      className={`w-full pl-10 pr-3 py-3 bg-white/[0.03] border rounded-xl text-white placeholder:text-slate-600 focus:outline-none transition-all text-sm disabled:opacity-50 ${
                        errors.firstName
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-white/[0.08] focus:border-gold/50 focus:bg-white/[0.05]'
                      }`}
                    />
                  </div>
                  {errors.firstName && (
                    <p className="text-xs text-red-400">{errors.firstName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Last name</label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-gold transition-colors" />
                    <input
                      {...register('lastName')}
                      type="text"
                      placeholder="Doe"
                      disabled={isLoading || success}
                      className={`w-full pl-10 pr-3 py-3 bg-white/[0.03] border rounded-xl text-white placeholder:text-slate-600 focus:outline-none transition-all text-sm disabled:opacity-50 ${
                        errors.lastName
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-white/[0.08] focus:border-gold/50 focus:bg-white/[0.05]'
                      }`}
                    />
                  </div>
                  {errors.lastName && (
                    <p className="text-xs text-red-400">{errors.lastName.message}</p>
                  )}
                </div>
              </motion.div>

              {/* Email Field */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                <label className="text-sm font-medium text-slate-300">Email</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-gold transition-colors" />
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={isLoading || success}
                    className={`w-full pl-12 pr-4 py-3 bg-white/[0.03] border rounded-xl text-white placeholder:text-slate-600 focus:outline-none transition-all disabled:opacity-50 ${
                      errors.email
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-white/[0.08] focus:border-gold/50 focus:bg-white/[0.05]'
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email.message}
                  </p>
                )}
              </motion.div>

              {/* Password Field */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                className="space-y-2"
              >
                <label className="text-sm font-medium text-slate-300">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-gold transition-colors" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    disabled={isLoading || success}
                    className={`w-full pl-12 pr-12 py-3 bg-white/[0.03] border rounded-xl text-white placeholder:text-slate-600 focus:outline-none transition-all disabled:opacity-50 ${
                      errors.password
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-white/[0.08] focus:border-gold/50 focus:bg-white/[0.05]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading || success}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <AnimatePresence>
                  <PasswordStrength password={password} />
                </AnimatePresence>
              </motion.div>

              {/* Confirm Password Field */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <label className="text-sm font-medium text-slate-300">Confirm password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-gold transition-colors" />
                  <input
                    {...register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    disabled={isLoading || success}
                    className={`w-full pl-12 pr-12 py-3 bg-white/[0.03] border rounded-xl text-white placeholder:text-slate-600 focus:outline-none transition-all disabled:opacity-50 ${
                      errors.confirmPassword
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-white/[0.08] focus:border-gold/50 focus:bg-white/[0.05]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading || success}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.confirmPassword.message}
                  </p>
                )}
              </motion.div>

              {/* Terms */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      {...register('acceptTerms')}
                      type="checkbox"
                      disabled={isLoading || success}
                      className="sr-only peer"
                    />
                    <div className="w-5 h-5 border border-white/20 rounded-md bg-white/[0.03] peer-checked:bg-gold peer-checked:border-gold transition-all flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-black opacity-0 peer-checked:opacity-100"
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
                    I agree to the{' '}
                    <Link href="/legal/terms" className="text-gold hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/legal/privacy" className="text-gold hover:underline">Privacy Policy</Link>
                  </span>
                </label>
                {errors.acceptTerms && (
                  <p className="text-xs text-red-400 mt-1">{errors.acceptTerms.message}</p>
                )}
              </motion.div>

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="pt-2"
              >
                <button
                  type="submit"
                  disabled={isLoading || success || !isValid}
                  className="relative w-full py-4 rounded-xl font-semibold text-black overflow-hidden group disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-gold via-amber-400 to-gold bg-[length:200%_100%] group-hover:animate-shimmer transition-all group-disabled:opacity-50" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute inset-0 bg-gold/20 blur-xl" />
                  </div>
                  <span className="relative flex items-center justify-center gap-2">
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Creating account...</span>
                      </>
                    ) : success ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Success!</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                </button>
              </motion.div>
            </form>

            {/* Sign In Link */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="mt-6 text-center text-sm text-slate-400"
            >
              Already have an account?{' '}
              <Link
                href="/auth/login"
                className="text-gold hover:text-gold/80 font-medium transition-colors"
              >
                Sign in
              </Link>
            </motion.p>
          </div>
        </div>

        {/* Security Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Your data is protected with bank-grade encryption</span>
        </motion.div>
      </motion.div>

      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .group-hover\\:animate-shimmer:hover {
          animation: shimmer 3s linear infinite;
        }
      `}</style>
    </div>
  );
}

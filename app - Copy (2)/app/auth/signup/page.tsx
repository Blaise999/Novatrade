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
import { useAuthStore } from '@/lib/store';
import { useEmail } from '@/hooks/useEmail';

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
    { label: 'Special', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const strength = requirements.filter(r => r.met).length;
  const strengthPercent = (strength / requirements.length) * 100;
  
  const strengthColor = 
    strength <= 2 ? 'bg-red-500' :
    strength <= 3 ? 'bg-yellow-500' :
    strength <= 4 ? 'bg-emerald-400' : 'bg-emerald-500';

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 space-y-2"
    >
      {/* Progress bar */}
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${strengthColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${strengthPercent}%` }}
          transition={{ duration: 0.3 }}
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
  const { setOtpEmail, setOtpName, setOtpPassword, setRedirectUrl } = useAuthStore();
  const { sendOTP } = useEmail();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    try {
      // Store signup data in auth store for verify-otp page
      // NOTE: Use the dedicated OTP fields — NOT setUser (which sets
      // isAuthenticated:true prematurely and leaks password into user state)
      setOtpEmail(data.email.toLowerCase());
      setOtpName(`${data.firstName} ${data.lastName}`);
      setOtpPassword(data.password);
      setRedirectUrl('/dashboard');

      // Send OTP email
      const otpResult = await sendOTP(data.email.toLowerCase(), `${data.firstName} ${data.lastName}`);
      
      if (!otpResult.success) {
        setError(otpResult.error || 'Failed to send verification code. Please try again.');
        setIsLoading(false);
        return;
      }

      // Redirect to OTP verification page
      router.push('/auth/verify-otp');
    } catch (err: any) {
      console.error('Signup error:', err);
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

            {/* Error Message */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      {...register('firstName')}
                      type="text"
                      placeholder="John"
                      className={`w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border ${
                        errors.firstName ? 'border-red-500/50' : 'border-white/[0.08]'
                      } rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all`}
                    />
                  </div>
                  {errors.firstName && (
                    <p className="mt-1.5 text-xs text-red-400">{errors.firstName.message}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      {...register('lastName')}
                      type="text"
                      placeholder="Doe"
                      className={`w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border ${
                        errors.lastName ? 'border-red-500/50' : 'border-white/[0.08]'
                      } rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all`}
                    />
                  </div>
                  {errors.lastName && (
                    <p className="mt-1.5 text-xs text-red-400">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="you@example.com"
                    className={`w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border ${
                      errors.email ? 'border-red-500/50' : 'border-white/[0.08]'
                    } rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all`}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    className={`w-full pl-12 pr-12 py-3.5 bg-white/[0.03] border ${
                      errors.password ? 'border-red-500/50' : 'border-white/[0.08]'
                    } rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <AnimatePresence>
                  <PasswordStrength password={password} />
                </AnimatePresence>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    {...register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    className={`w-full pl-12 pr-12 py-3.5 bg-white/[0.03] border ${
                      errors.confirmPassword ? 'border-red-500/50' : 'border-white/[0.08]'
                    } rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-xs text-red-400">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3">
                <input
                  {...register('acceptTerms')}
                  type="checkbox"
                  id="terms"
                  className="mt-1 w-4 h-4 bg-white/5 border-white/20 rounded focus:ring-gold text-gold"
                />
                <label htmlFor="terms" className="text-sm text-slate-400">
                  I agree to the{' '}
                  <Link href="/legal/terms" className="text-gold hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/legal/privacy" className="text-gold hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              {errors.acceptTerms && (
                <p className="text-xs text-red-400">{errors.acceptTerms.message}</p>
              )}

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={isLoading || !isValid}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
                  isLoading || !isValid
                    ? 'bg-gold/50 text-void/70 cursor-not-allowed'
                    : 'bg-gradient-to-r from-gold to-amber-500 text-void hover:shadow-lg hover:shadow-gold/25'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending verification code...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Sign in link */}
            <p className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{' '}
              <Link
                href="/auth/login"
                className="text-gold font-medium hover:underline"
              >
                Sign in
              </Link>
            </p>

            {/* Security badge */}
            <div className="mt-6 pt-6 border-t border-white/[0.06] flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4" />
              <span>256-bit SSL encryption</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

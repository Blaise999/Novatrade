'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  Phone,
  User, 
  ArrowRight,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useStore } from '@/lib/supabase/store-supabase';
import { useEmail } from '@/hooks/useEmail';

const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Please enter a valid phone number').optional().or(z.literal('')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms'),
  acceptMarketing: z.boolean().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/dashboard/wallet';
  const { setOtpEmail, setOtpName, setOtpPassword, setRedirectUrl } = useAuthStore();
  const { sendOTP, loading: emailLoading, error: emailError } = useEmail();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store redirect URL for after verification
  useEffect(() => {
    if (redirectUrl) {
      setRedirectUrl(redirectUrl);
    }
  }, [redirectUrl, setRedirectUrl]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange',
  });

  const password = watch('password', '');
  
  const passwordRequirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const onSubmit = async (data: SignUpFormData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Send OTP email via Resend
      const result = await sendOTP(data.email, data.name, 'email_verification');
      
      if (result.success) {
        // Store email, name, and password for OTP verification
        setOtpEmail(data.email);
        setOtpName(data.name);
        setOtpPassword(data.password); // Store password for registration after OTP verification
        
        // Redirect to OTP verification
        router.push('/auth/verify-otp');
      } else {
        setError(result.error || 'Failed to send verification code. Please try again.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
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
        <h2 className="text-3xl font-display font-bold text-cream">Create Account</h2>
        <p className="mt-2 text-slate-400">
          Start trading in minutes. Already have an account?{' '}
          <Link href="/auth/login" className="text-gold hover:text-gold/80 font-medium">
            Sign in
          </Link>
        </p>
      </div>

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
        {/* Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-cream">Full Name</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              {...register('name')}
              type="text"
              placeholder="John Doe"
              className={`w-full pl-12 pr-4 py-3.5 bg-white/5 border rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${
                errors.name 
                  ? 'border-loss focus:ring-loss/20' 
                  : 'border-white/10 focus:border-gold focus:ring-gold/20'
              }`}
            />
          </div>
          {errors.name && (
            <p className="text-sm text-loss flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.name.message}
            </p>
          )}
        </div>

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

        {/* Phone (Optional) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-cream">
            Phone Number <span className="text-slate-500">(Optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              {...register('phone')}
              type="tel"
              placeholder="+1 (555) 000-0000"
              className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-cream">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
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
          
          {/* Password Requirements */}
          {password && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-2 gap-2 pt-2"
            >
              {passwordRequirements.map((req, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    req.met ? 'bg-profit' : 'bg-white/10'
                  }`}>
                    {req.met && <Check className="w-3 h-3 text-void" />}
                  </div>
                  <span className={`text-xs ${req.met ? 'text-profit' : 'text-slate-500'}`}>
                    {req.label}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-cream">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              {...register('confirmPassword')}
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              className={`w-full pl-12 pr-12 py-3.5 bg-white/5 border rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${
                errors.confirmPassword 
                  ? 'border-loss focus:ring-loss/20' 
                  : 'border-white/10 focus:border-gold focus:ring-gold/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cream transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-loss flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Terms & Conditions */}
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                {...register('acceptTerms')}
                type="checkbox"
                className="sr-only peer"
              />
              <div className="w-5 h-5 border border-white/20 rounded bg-white/5 peer-checked:bg-gold peer-checked:border-gold transition-all flex items-center justify-center">
                <Check className="w-3 h-3 text-void opacity-0 peer-checked:opacity-100" />
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
            <p className="text-sm text-loss flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.acceptTerms.message}
            </p>
          )}
          
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                {...register('acceptMarketing')}
                type="checkbox"
                className="sr-only peer"
              />
              <div className="w-5 h-5 border border-white/20 rounded bg-white/5 peer-checked:bg-gold peer-checked:border-gold transition-all flex items-center justify-center">
                <Check className="w-3 h-3 text-void opacity-0 peer-checked:opacity-100" />
              </div>
            </div>
            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              Send me trading tips, market updates, and promotional offers
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="w-full py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              Create Account
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      {/* Social Sign Up */}
      <div className="space-y-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="px-4 bg-void text-slate-500">Or continue with</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-cream hover:bg-white/10 transition-all">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
          <button className="flex items-center justify-center gap-2 py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-cream hover:bg-white/10 transition-all">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
            </svg>
            GitHub
          </button>
        </div>
      </div>

      {/* Security Note */}
      <p className="text-center text-xs text-slate-500">
        🔒 Your data is protected with bank-grade encryption
      </p>
    </motion.div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Mail, 
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle
} from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSubmittedEmail(data.email);
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8 text-center"
      >
        <div className="w-20 h-20 bg-profit/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-profit" />
        </div>
        
        <div>
          <h2 className="text-3xl font-display font-bold text-cream">Check Your Email</h2>
          <p className="mt-4 text-slate-400">
            We&apos;ve sent password reset instructions to<br />
            <span className="text-cream font-medium">{submittedEmail}</span>
          </p>
        </div>
        
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <p className="text-sm text-slate-400">
            Didn&apos;t receive the email? Check your spam folder or{' '}
            <button 
              onClick={() => setIsSubmitted(false)}
              className="text-gold hover:text-gold/80 font-medium"
            >
              try another email
            </button>
          </p>
        </div>
        
        <Link 
          href="/auth/login"
          className="inline-flex items-center gap-2 text-gold hover:text-gold/80 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>
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
        href="/auth/login" 
        className="inline-flex items-center gap-2 text-slate-400 hover:text-cream transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sign in
      </Link>

      {/* Header */}
      <div className="text-center lg:text-left">
        <h2 className="text-3xl font-display font-bold text-cream">Forgot Password?</h2>
        <p className="mt-2 text-slate-400">
          No worries! Enter your email and we&apos;ll send you reset instructions.
        </p>
      </div>

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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              Send Reset Link
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      {/* Help */}
      <div className="text-center">
        <p className="text-sm text-slate-500">
          Remember your password?{' '}
          <Link href="/auth/login" className="text-gold hover:text-gold/80 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}

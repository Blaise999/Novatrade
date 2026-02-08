'use client';

import { useRouter } from 'next/navigation';
import { Shield, Clock, XCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';

interface KYCGateProps {
  children: React.ReactNode;
  /** What action is being gated (shown in the message) */
  action?: string;
}

/**
 * KYC Gate Component
 *
 * Wraps any page/section that requires KYC verification.
 * If KYC is not 'verified', shows appropriate blocker:
 *  - 'none' / 'not_started' → prompt to start KYC
 *  - 'pending' → show waiting for admin approval
 *  - 'rejected' → show resubmit prompt
 */
export default function KYCGate({ children, action = 'access this feature' }: KYCGateProps) {
  const router = useRouter();
  const { user } = useStore();

  const kycStatus = user?.kycStatus ?? 'none';

  // ✅ Verified — render children normally
  if (kycStatus === 'verified' || kycStatus === 'approved') {
    return <>{children}</>;
  }

  // Admin users bypass KYC
  if (user?.role === 'admin') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Pending Review */}
        {kycStatus === 'pending' && (
          <div className="bg-white/5 rounded-2xl border border-yellow-500/20 p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-cream mb-2">KYC Under Review</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your identity verification documents are being reviewed by our team. 
                This usually takes 1-24 hours. You&apos;ll be able to {action} once approved.
              </p>
            </div>
            <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
                <Clock className="w-4 h-4" />
                Pending Admin Approval
              </div>
              <p className="text-xs text-slate-500 mt-1">
                You&apos;ll receive a notification once your verification is complete.
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 bg-white/5 text-cream font-medium rounded-xl hover:bg-white/10 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Rejected */}
        {kycStatus === 'rejected' && (
          <div className="bg-white/5 rounded-2xl border border-red-500/20 p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-cream mb-2">Verification Rejected</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your identity verification was not approved. Please resubmit your documents 
                with clear, valid information to {action}.
              </p>
            </div>
            <button
              onClick={() => router.push('/kyc')}
              className="w-full py-3 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              Resubmit KYC
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Not Started */}
        {(kycStatus === 'none' || kycStatus === 'not_started' || !kycStatus) && (
          <div className="bg-white/5 rounded-2xl border border-gold/20 p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-gold" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-cream mb-2">Identity Verification Required</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                To {action}, you need to complete identity verification (KYC). 
                This helps us keep the platform secure and compliant.
              </p>
            </div>
            <div className="bg-gold/5 border border-gold/10 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">What you&apos;ll need:</p>
              <ul className="text-sm text-slate-300 space-y-1.5">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                  Government-issued ID (passport, license, or national ID)
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                  Selfie photo for identity confirmation
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                  Proof of address (utility bill or bank statement)
                </li>
              </ul>
            </div>
            <button
              onClick={() => router.push('/kyc')}
              className="w-full py-3 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              Start Verification
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-slate-500">
              Verification is typically completed within 1-24 hours
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

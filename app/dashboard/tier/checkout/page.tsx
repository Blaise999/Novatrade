'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Shield,
  Gift,
  Copy,
  CheckCircle,
  Loader2,
  AlertCircle,
  Wallet,
  CreditCard,
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';
import { useDepositSettingsStore } from '@/lib/deposit-settings';

interface TierInfo {
  level: number;
  code: string;
  name: string;
  price: number;
  bonus: number;
  features: string[];
}

const TIER_MAP: Record<string, TierInfo> = {
  starter: {
    level: 1,
    code: 'starter',
    name: 'Starter',
    price: 500,
    bonus: 200,
    features: ['Live trading', 'Shield protection', '1:50 leverage'],
  },
  trader: {
    level: 2,
    code: 'trader',
    name: 'Trader',
    price: 1000,
    bonus: 400,
    features: ['DCA Bots', 'All Starter features', '1:100 leverage'],
  },
  professional: {
    level: 3,
    code: 'professional',
    name: 'Professional',
    price: 3000,
    bonus: 1200,
    features: ['GridWarrior Bots', 'AI Assistant', 'All Trader features'],
  },
  elite: {
    level: 4,
    code: 'elite',
    name: 'Elite',
    price: 5000,
    bonus: 2000,
    features: ['Unlimited leverage', 'Dedicated manager', 'All features'],
  },
};

type CheckoutStep = 'review' | 'payment' | 'confirm' | 'submitted';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useStore();
  const { cryptoWallets, getEnabledCryptoWallets } = useDepositSettingsStore();

  const tierCode = searchParams.get('tier') || '';
  const tier = TIER_MAP[tierCode.toLowerCase()];

  const [step, setStep] = useState<CheckoutStep>('review');
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [txHash, setTxHash] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const enabledWallets = getEnabledCryptoWallets?.() || cryptoWallets?.filter((w: any) => w.enabled) || [];

  if (!tier) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertCircle className="w-12 h-12 text-loss mx-auto mb-4" />
        <h2 className="text-xl font-bold text-cream mb-2">Invalid Tier</h2>
        <p className="text-slate-400 mb-6">The tier &quot;{tierCode}&quot; was not found.</p>
        <button
          onClick={() => router.push('/dashboard/tier')}
          className="px-6 py-2 bg-gold text-void rounded-xl font-semibold"
        >
          Back to Tiers
        </button>
      </div>
    );
  }

  async function handleCopyAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }

  async function handleSubmit() {
    if (!user?.id) return;

    setIsSubmitting(true);
    setError('');

    try {
      const walletObj = enabledWallets.find((w: any) => w.id === selectedWallet || w.symbol === selectedWallet);

      const res = await fetch('/api/tier-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          tierCode: tier.code,
          txHash: txHash || undefined,
          amountPaid: tier.price,
          currency: 'USD',
          paymentAsset: walletObj?.symbol || walletObj?.name || 'crypto',
          paymentNetwork: walletObj?.network || undefined,
          addressShown: walletObj?.address || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to submit purchase');
        return;
      }

      setStep('submitted');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.push('/dashboard/tier')}
        className="flex items-center gap-2 text-slate-400 hover:text-cream mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tiers
      </button>

      <h1 className="text-2xl font-display font-bold text-cream mb-6">
        Purchase {tier.name} Tier
      </h1>

      {/* Submitted State */}
      {step === 'submitted' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-obsidian rounded-2xl border border-profit/30 p-8 text-center"
        >
          <CheckCircle className="w-16 h-16 text-profit mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-cream mb-2">Purchase Submitted!</h2>
          <p className="text-slate-400 mb-4">
            Your {tier.name} tier purchase is pending review. Once approved, you&apos;ll receive:
          </p>
          <div className="bg-gold/10 border border-gold/20 rounded-xl p-4 mb-6">
            <p className="text-gold font-bold text-lg">+${tier.bonus.toLocaleString()} Trading Credit</p>
            <p className="text-sm text-slate-400">40% bonus on ${tier.price.toLocaleString()} tier price</p>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            You&apos;ll be notified when your purchase is approved. This usually takes a few hours.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-8 py-3 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl"
          >
            Return to Dashboard
          </button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-obsidian rounded-2xl border border-white/10 p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Order Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-300">{tier.name} Tier</span>
                <span className="text-cream font-semibold">${tier.price.toLocaleString()}</span>
              </div>
              <div className="border-t border-white/5 pt-3 flex justify-between">
                <span className="text-gold flex items-center gap-1">
                  <Gift className="w-4 h-4" />
                  Trading Credit Bonus (40%)
                </span>
                <span className="text-gold font-bold">+${tier.bonus.toLocaleString()}</span>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-slate-400">Features unlocked:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tier.features.map((f, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-white/5 rounded-lg text-xs text-cream"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          {step === 'review' && (
            <div className="bg-obsidian rounded-2xl border border-white/10 p-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Select Payment Method
              </h3>
              {enabledWallets.length > 0 ? (
                <div className="space-y-2">
                  {enabledWallets.map((w: any) => (
                    <button
                      key={w.id || w.symbol}
                      onClick={() => {
                        setSelectedWallet(w.id || w.symbol);
                        setStep('payment');
                      }}
                      className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
                        selectedWallet === (w.id || w.symbol)
                          ? 'border-gold/40 bg-gold/5'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <Wallet className="w-5 h-5 text-gold" />
                      <div className="text-left flex-1">
                        <p className="text-cream font-medium">{w.name || w.symbol}</p>
                        <p className="text-xs text-slate-500">{w.network || 'Crypto'}</p>
                      </div>
                      <CreditCard className="w-4 h-4 text-slate-500" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-400 mb-2">Payment methods loading...</p>
                  <p className="text-xs text-slate-500">Contact support if you need assistance.</p>
                  <button
                    onClick={() => setStep('payment')}
                    className="mt-4 px-6 py-2 bg-white/10 text-cream rounded-xl"
                  >
                    Continue Anyway
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Payment Details */}
          {step === 'payment' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-obsidian rounded-2xl border border-white/10 p-6"
            >
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Payment Instructions
              </h3>

              {(() => {
                const wallet = enabledWallets.find(
                  (w: any) => (w.id || w.symbol) === selectedWallet
                );
                if (wallet?.address) {
                  return (
                    <div className="space-y-4">
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-xs text-slate-500 mb-1">Send exactly</p>
                        <p className="text-xl font-bold text-cream">
                          ${tier.price.toLocaleString()} USD
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          in {wallet.name || wallet.symbol} ({wallet.network || 'default network'})
                        </p>
                      </div>

                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-xs text-slate-500 mb-2">To this address:</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm text-gold break-all font-mono bg-void/50 p-2 rounded-lg">
                            {wallet.address}
                          </code>
                          <button
                            onClick={() => handleCopyAddress(wallet.address)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            {copied ? (
                              <CheckCircle className="w-4 h-4 text-profit" />
                            ) : (
                              <Copy className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                        <p className="text-xs text-amber-400">
                          ⚠️ Send only {wallet.symbol || wallet.name} on {wallet.network || 'the correct network'}. Sending wrong tokens may result in loss.
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <p className="text-slate-400">
                      Send <strong className="text-cream">${tier.price.toLocaleString()}</strong> to complete payment.
                    </p>
                    <p className="text-xs text-slate-500 mt-2">Contact support for payment details.</p>
                  </div>
                );
              })()}

              {/* TX Hash input */}
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Transaction Hash (optional but recommended)
                  </label>
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:border-gold/40 focus:outline-none font-mono text-sm"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-loss/10 border border-loss/20 rounded-xl">
                    <p className="text-sm text-loss flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('review')}
                    className="px-6 py-3 bg-white/5 text-slate-300 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        I&apos;ve Paid — Submit for Review
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TierCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

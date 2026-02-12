'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Gift,
  Copy,
  CheckCircle,
  Loader2,
  AlertCircle,
  Wallet,
  CreditCard,
  Crown,
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';
import { useDepositSettingsStore } from '@/lib/deposit-settings';

type DepositStep = 'amount' | 'payment' | 'confirm' | 'submitted';

function DepositContent() {
  const router = useRouter();
  const { user } = useStore();
  const { cryptoWallets, getEnabledCryptoWallets } = useDepositSettingsStore();

  const [step, setStep] = useState<DepositStep>('amount');
  const [amount, setAmount] = useState('');
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [txHash, setTxHash] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [tierLevel, setTierLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const enabledWallets = getEnabledCryptoWallets?.() || cryptoWallets?.filter((w: any) => w.enabled) || [];

  // Check tier
  useEffect(() => {
    if (!user?.id) return;
    const checkTier = async () => {
      try {
        const { supabase, isSupabaseConfigured } = await import('@/lib/supabase/client');
        if (!isSupabaseConfigured()) { setTierLevel(1); setLoading(false); return; }
        const { data } = await supabase
          .from('users')
          .select('tier_level, tier_active')
          .eq('id', user.id)
          .maybeSingle();
        const tl = Number(data?.tier_level ?? 0);
        setTierLevel(tl);
        if (tl === 0) router.replace('/dashboard/tier');
      } catch {
        setTierLevel(0);
      }
      setLoading(false);
    };
    checkTier();
  }, [user?.id, router]);

  async function handleCopyAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function handleSubmit() {
    if (!user?.id) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const walletObj = enabledWallets.find((w: any) => w.id === selectedWallet || w.symbol === selectedWallet);

      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: amt,
          currency: 'USD',
          method: 'crypto',
          methodName: walletObj
            ? `${walletObj.name || walletObj.symbol} (${walletObj.network || 'crypto'})`
            : 'Crypto Deposit',
          network: walletObj?.network || undefined,
          txHash: txHash || undefined,
          paymentAsset: walletObj?.symbol || 'crypto',
          addressShown: walletObj?.address || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setStep('submitted');
    } catch {
      setError('Connection error. Please check your internet and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading || tierLevel === null || tierLevel === 0) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push('/dashboard/wallet')}
        className="flex items-center gap-2 text-slate-400 hover:text-cream mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Wallet
      </button>

      <h1 className="text-2xl font-display font-bold text-cream mb-6">Deposit Funds</h1>

      {/* SUBMITTED */}
      {step === 'submitted' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-obsidian rounded-2xl border border-profit/30 p-8 text-center"
        >
          <CheckCircle className="w-16 h-16 text-profit mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-cream mb-2">Deposit Submitted!</h2>
          <p className="text-slate-400 mb-4">
            Your deposit is pending review. Once approved, the funds will be credited to your account.
          </p>
          <div className="bg-electric/10 border border-electric/20 rounded-xl p-4 mb-6">
            <p className="text-electric font-bold text-lg">${parseFloat(amount).toLocaleString()}</p>
            <p className="text-sm text-slate-400">will be added to your balance upon approval</p>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            You&apos;ll be notified when your deposit is confirmed. This usually takes 1-24 hours.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setStep('amount'); setAmount(''); setTxHash(''); setSelectedWallet(''); }}
              className="px-6 py-3 bg-white/10 text-cream rounded-xl hover:bg-white/15 transition-colors"
            >
              Make Another Deposit
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl"
            >
              Return to Dashboard
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Step 1: Amount */}
          {step === 'amount' && (
            <div className="bg-obsidian rounded-2xl border border-white/10 p-6 space-y-5">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                How much do you want to deposit?
              </h3>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cream/40 text-xl font-bold">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-cream text-2xl font-bold placeholder:text-slate-600 focus:border-gold/40 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[50, 100, 250, 500, 1000, 2500].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      amount === String(v)
                        ? 'bg-gold/20 text-gold border border-gold/30'
                        : 'bg-white/5 text-cream/50 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    ${v.toLocaleString()}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  if (!amount || parseFloat(amount) <= 0) {
                    setError('Please enter an amount.');
                    return;
                  }
                  setError('');
                  setStep('payment');
                }}
                disabled={!amount || parseFloat(amount) <= 0}
                className="w-full py-3 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue to Payment
              </button>

              {error && (
                <p className="text-sm text-loss flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </p>
              )}
            </div>
          )}

          {/* Step 2: Select payment method */}
          {step === 'payment' && (
            <div className="space-y-6">
              {/* Amount summary */}
              <div className="bg-obsidian rounded-2xl border border-white/10 p-6">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Deposit Amount</span>
                  <span className="text-2xl font-bold text-cream">${parseFloat(amount).toLocaleString()}</span>
                </div>
              </div>

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
                          setStep('confirm');
                        }}
                        className="w-full p-4 rounded-xl border border-white/10 hover:border-white/20 transition-all flex items-center gap-3"
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
                    <button
                      onClick={() => setStep('confirm')}
                      className="mt-4 px-6 py-2 bg-white/10 text-cream rounded-xl"
                    >
                      Continue Anyway
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setStep('amount')}
                  className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ← Change amount
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment details + submit */}
          {step === 'confirm' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Amount summary */}
              <div className="bg-obsidian rounded-2xl border border-white/10 p-6">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Deposit Amount</span>
                  <span className="text-2xl font-bold text-cream">${parseFloat(amount).toLocaleString()}</span>
                </div>
              </div>

              {/* Payment instructions */}
              <div className="bg-obsidian rounded-2xl border border-white/10 p-6">
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
                            ${parseFloat(amount).toLocaleString()} USD
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
                        Send <strong className="text-cream">${parseFloat(amount).toLocaleString()}</strong> to complete payment.
                      </p>
                      <p className="text-xs text-slate-500 mt-2">Contact support for payment details.</p>
                    </div>
                  );
                })()}

                {/* TX Hash */}
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
                      onClick={() => setStep('payment')}
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
                          <CheckCircle className="w-4 h-4" />
                          I&apos;ve Paid — Submit for Review
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DepositPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
        </div>
      }
    >
      <DepositContent />
    </Suspense>
  );
}

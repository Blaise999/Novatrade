'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useStore } from '@/lib/supabase/store-supabase';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Copy, CheckCircle, Crown, ArrowUpRight, Wallet } from 'lucide-react';

const DEPOSIT_WALLETS = [
  { network: 'Ethereum (ERC-20)', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38', token: 'USDT / USDC / ETH' },
  { network: 'BNB Smart Chain (BEP-20)', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38', token: 'USDT / USDC / BNB' },
  { network: 'Tron (TRC-20)', address: 'TJYs48yKP6FqJhqPJgrFMNfRYiPdnQUh9J', token: 'USDT' },
  { network: 'Bitcoin', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', token: 'BTC' },
];

function DepositContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useStore();
  const [tierLevel, setTierLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [txHash, setTxHash] = useState('');
  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState(DEPOSIT_WALLETS[0].network);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const checkTier = async () => {
      if (!isSupabaseConfigured()) {
        const tl = (user as any)?.tierLevel ?? (user as any)?.tier_level ?? 0;
        setTierLevel(tl);
        if (tl === 0) {
          const params = searchParams.toString();
          router.replace(`/dashboard/tier${params ? `?${params}` : ''}`);
        }
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('users')
          .select('tier_level, tier_active')
          .eq('id', user.id)
          .maybeSingle();

        const tl = Number(data?.tier_level ?? 0);
        setTierLevel(tl);

        // First time user with no tier -> redirect to tier selection
        if (tl === 0) {
          const params = searchParams.toString();
          router.replace(`/dashboard/tier${params ? `?${params}` : ''}`);
          return;
        }
      } catch {
        setTierLevel(0);
      }
      setLoading(false);
    };

    checkTier();
  }, [user?.id, router, searchParams]);

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmitDeposit = async () => {
    if (!txHash.trim() || !amount.trim() || !user?.id) return;
    setSubmitting(true);

    try {
      if (isSupabaseConfigured()) {
        await supabase.from('deposits').insert({
          user_id: user.id,
          amount: parseFloat(amount),
          currency: 'USDT',
          network,
          tx_hash: txHash.trim(),
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      }
      setSuccess(true);
      setTxHash('');
      setAmount('');
    } catch {}
    setSubmitting(false);
  };

  if (loading || tierLevel === null || tierLevel === 0) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const selectedWallet = DEPOSIT_WALLETS.find(w => w.network === network) || DEPOSIT_WALLETS[0];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cream">Deposit Funds</h1>
          <p className="text-sm text-cream/50">Add funds to your trading account</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/tier')}
          className="flex items-center gap-2 px-4 py-2 bg-gold/10 border border-gold/30 text-gold rounded-xl text-sm hover:bg-gold/20 transition-all"
        >
          <Crown className="w-4 h-4" />
          Change Tier
        </button>
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-emerald-300 font-semibold text-sm">Deposit submitted!</p>
            <p className="text-emerald-300/60 text-xs">Your deposit will be reviewed and credited within 1-24 hours.</p>
          </div>
        </div>
      )}

      {/* Network Selection */}
      <div className="bg-slate-900/60 border border-cream/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-5 h-5 text-electric" />
          <h2 className="text-lg font-semibold text-cream">Select Network</h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {DEPOSIT_WALLETS.map((w) => (
            <button
              key={w.network}
              onClick={() => setNetwork(w.network)}
              className={`p-3 rounded-xl border text-left transition-all text-sm ${
                network === w.network
                  ? 'bg-electric/10 border-electric/50 text-electric'
                  : 'bg-slate-800/50 border-cream/10 text-cream/60 hover:border-cream/30'
              }`}
            >
              <div className="font-medium text-xs">{w.network}</div>
              <div className="text-[10px] mt-0.5 opacity-60">{w.token}</div>
            </button>
          ))}
        </div>

        {/* Wallet Address */}
        <div className="space-y-2">
          <label className="text-sm text-cream/60">Send funds to this address:</label>
          <div className="flex items-center gap-2 bg-slate-800/70 border border-cream/10 rounded-xl px-4 py-3">
            <code className="text-electric text-xs flex-1 break-all font-mono">{selectedWallet.address}</code>
            <button
              onClick={() => copyAddress(selectedWallet.address)}
              className="text-cream/40 hover:text-gold transition-colors shrink-0"
            >
              {copied === selectedWallet.address ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Submit Deposit */}
      <div className="bg-slate-900/60 border border-cream/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <ArrowUpRight className="w-5 h-5 text-gold" />
          <h2 className="text-lg font-semibold text-cream">Confirm Deposit</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-cream/60 mb-1 block">Amount (USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full bg-slate-800/70 border border-cream/10 rounded-xl px-4 py-3 text-cream placeholder:text-cream/30 focus:outline-none focus:border-electric/50"
            />
          </div>

          <div>
            <label className="text-sm text-cream/60 mb-1 block">Transaction Hash</label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x..."
              className="w-full bg-slate-800/70 border border-cream/10 rounded-xl px-4 py-3 text-cream placeholder:text-cream/30 font-mono text-sm focus:outline-none focus:border-electric/50"
            />
          </div>
        </div>

        <button
          onClick={handleSubmitDeposit}
          disabled={submitting || !txHash.trim() || !amount.trim()}
          className="w-full py-3 bg-electric text-void font-bold rounded-xl hover:bg-electric/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Submit Deposit'}
        </button>

        <p className="text-xs text-cream/30 text-center">
          Deposits are manually reviewed and typically credited within 1-24 hours.
        </p>
      </div>
    </div>
  );
}

export default function DepositPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-void flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
        </div>
      }
    >
      <DepositContent />
    </Suspense>
  );
}

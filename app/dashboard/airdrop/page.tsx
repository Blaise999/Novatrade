'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Gift,
  Wallet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Shield,
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface AirdropClaim {
  id: string;
  season: string;
  airdrop_key: string;
  wallet_address: string | null;
  claim_status: string;
  amount: number;
  tx_hash: string | null;
  claimed_at: string;
}

interface AirdropSeason {
  key: string;
  name: string;
  description: string;
  totalTokens: string;
  status: 'active' | 'upcoming' | 'ended';
  endDate?: string;
}

const AIRDROP_SEASONS: AirdropSeason[] = [
  {
    key: 'nova-s1',
    name: 'Season 1 — Genesis Drop',
    description:
      'Reward for early adopters and active traders. Claim your NOVA tokens based on trading volume and tier level.',
    totalTokens: '10,000,000 NOVA',
    status: 'active',
    endDate: '2025-06-30',
  },
  {
    key: 'nova-s2',
    name: 'Season 2 — Growth Phase',
    description: 'Coming soon. Rewards for referrals and community contributions.',
    totalTokens: '20,000,000 NOVA',
    status: 'upcoming',
  },
];

export default function AirdropPage() {
  const { user } = useStore();
  const [claims, setClaims] = useState<AirdropClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimLoading, setClaimLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ✅ new: eligibility notice shown when user clicks "Claim Airdrop"
  const [notice, setNotice] = useState('');

  useEffect(() => {
    async function load() {
      if (!user?.id || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('airdrop_claims')
        .select('*')
        .eq('user_id', user.id)
        .order('claimed_at', { ascending: false });

      if (data) {
        setClaims(data as AirdropClaim[]);
      }

      // Pre-fill wallet
      if ((user as any).walletAddress) {
        setWalletAddress((user as any).walletAddress);
      }

      setLoading(false);
    }

    load();
  }, [user?.id, (user as any)?.walletAddress]);

  async function handleClaim(seasonKey: string) {
    // ✅ Always show "Not eligible..." on click (UI only)
    setError('');
    setSuccess('');
    setNotice('Not eligible. Refer 20 users to earn $100 NOVA airdrop.');
    return;

    // --- (old claim logic stays below, unreachable until you remove the return) ---
    // if (!user?.id) return;
    // if (!walletAddress) {
    //   setError('Please enter your wallet address');
    //   return;
    // }
    //
    // setClaimLoading(true);
    // setError('');
    // setSuccess('');
    //
    // try {
    //   const existing = claims.find((c) => c.airdrop_key === seasonKey);
    //   if (existing) {
    //     setError('You have already claimed this airdrop.');
    //     return;
    //   }
    //
    //   const { error: insertErr } = await supabase.from('airdrop_claims').insert({
    //     user_id: user.id,
    //     season: seasonKey,
    //     airdrop_key: seasonKey,
    //     wallet_address: walletAddress,
    //     claim_status: 'claimed',
    //   });
    //
    //   if (insertErr) {
    //     setError(insertErr.message || 'Claim failed');
    //     return;
    //   }
    //
    //   setSuccess('Airdrop claimed successfully! Tokens will be distributed soon.');
    //
    //   const { data: updated } = await supabase
    //     .from('airdrop_claims')
    //     .select('*')
    //     .eq('user_id', user.id)
    //     .order('claimed_at', { ascending: false });
    //
    //   if (updated) setClaims(updated as AirdropClaim[]);
    // } catch (err: unknown) {
    //   setError(err instanceof Error ? err.message : 'Network error');
    // } finally {
    //   setClaimLoading(false);
    // }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-cream flex items-center gap-2">
          <Gift className="w-6 h-6 text-gold" />
          NOVA Airdrops
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Claim your NOVA token airdrops. Rewards are based on your trading activity and tier level.
        </p>
      </div>

      {/* Wallet Input */}
      <div className="bg-obsidian rounded-2xl border border-white/10 p-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Claim Wallet Address
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x... or connect wallet above"
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:border-gold/40 focus:outline-none font-mono text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          EVM-compatible address (Ethereum, BSC, Polygon, etc.)
        </p>
      </div>

      {/* Messages */}
      {notice && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-200">{notice}</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-loss/10 border border-loss/20 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-loss flex-shrink-0" />
          <p className="text-sm text-loss">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-profit/10 border border-profit/20 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-profit flex-shrink-0" />
          <p className="text-sm text-profit">{success}</p>
        </div>
      )}

      {/* Airdrop Seasons */}
      <div className="space-y-4">
        {AIRDROP_SEASONS.map((season) => {
          const claimed = claims.find((c) => c.airdrop_key === season.key);
          const isActive = season.status === 'active';

          return (
            <motion.div
              key={season.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-obsidian rounded-2xl border p-6 ${
                isActive ? 'border-gold/20' : 'border-white/10'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isActive ? 'bg-gold/20' : 'bg-white/5'
                    }`}
                  >
                    <Sparkles className={`w-5 h-5 ${isActive ? 'text-gold' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-cream">{season.name}</h3>
                    <p className="text-xs text-slate-500">{season.totalTokens}</p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    season.status === 'active'
                      ? 'bg-profit/20 text-profit'
                      : season.status === 'upcoming'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-slate-500/20 text-slate-400'
                  }`}
                >
                  {season.status === 'active'
                    ? '● Live'
                    : season.status === 'upcoming'
                    ? 'Upcoming'
                    : 'Ended'}
                </span>
              </div>

              <p className="text-sm text-slate-400 mb-4">{season.description}</p>

              {season.endDate && (
                <p className="text-xs text-slate-500 mb-4">
                  Claim window ends: {new Date(season.endDate).toLocaleDateString()}
                </p>
              )}

              {claimed ? (
                <div className="flex items-center gap-2 p-3 bg-profit/10 border border-profit/20 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-profit" />
                  <div>
                    <p className="text-sm text-profit font-medium">Claimed</p>
                    <p className="text-xs text-slate-400">
                      {new Date(claimed.claimed_at).toLocaleDateString()}
                      {claimed.tx_hash && (
                        <span className="ml-2 font-mono">TX: {claimed.tx_hash.slice(0, 10)}...</span>
                      )}
                    </p>
                  </div>
                </div>
              ) : isActive ? (
                <button
                  onClick={() => handleClaim(season.key)}
                  disabled={claimLoading}
                  className="w-full py-3 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {claimLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                  Claim Airdrop
                </button>
              ) : (
                <div className="p-3 bg-white/5 rounded-xl text-center">
                  <p className="text-sm text-slate-500">
                    {season.status === 'upcoming' ? 'Coming soon' : 'Claim window closed'}
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Smart Contract Info */}
      <div className="bg-obsidian rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-profit" />
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Contract Security
          </h3>
        </div>
        <p className="text-sm text-slate-400">
        
        </p>
      </div>
    </div>
  );
}

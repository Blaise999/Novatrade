'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Gift,
  Copy,
  CheckCircle,
  Share2,
  Link2,
  DollarSign,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface Referral {
  id: string;
  referred_user_id: string;
  reward_paid: boolean;
  reward_amount: number;
  reward_trigger: string | null;
  created_at: string;
  users?: { email: string; first_name: string };
}

export default function ReferralsPage() {
  const { user } = useStore();
  const [referralCode, setReferralCode] = useState('');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user?.id || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      // Get or create referral code
      const { data: codeData } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', user.id)
        .maybeSingle();

      if (codeData?.code) {
        setReferralCode(codeData.code);
      } else {
        // Try to get from users table
        const { data: userData } = await supabase
          .from('users')
          .select('referral_code')
          .eq('id', user.id)
          .maybeSingle();

        if (userData?.referral_code) {
          setReferralCode(userData.referral_code);
        }
      }

      // Load referral list
      const { data: refs } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      if (refs) {
        setReferrals(refs as Referral[]);
      }

      setLoading(false);
    }

    load();
  }, [user?.id]);

  // ✅ HYDRATION FIX: compute referralLink in effect to avoid server/client mismatch
  const [referralLink, setReferralLink] = useState('');
  useEffect(() => {
    if (referralCode) {
      setReferralLink(`${window.location.origin}/auth/signup?ref=${referralCode}`);
    }
  }, [referralCode]);

  const totalEarnings = referrals
    .filter((r) => r.reward_paid)
    .reduce((sum, r) => sum + Number(r.reward_amount || 0), 0);

  async function handleCopy(text: string, type: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {
      /* noop */
    }
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
          <Users className="w-6 h-6 text-gold" />
          Referral Program
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Invite friends and earn <span className="text-gold font-semibold">5% commission</span> when they purchase their first tier.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-obsidian rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-500">Total Referrals</span>
          </div>
          <p className="text-2xl font-bold text-cream">{referrals.length}</p>
        </div>
        <div className="bg-obsidian rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-profit" />
            <span className="text-xs text-slate-500">Total Earnings</span>
          </div>
          <p className="text-2xl font-bold text-profit">
            ${totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-obsidian rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4 text-gold" />
            <span className="text-xs text-slate-500">Pending Rewards</span>
          </div>
          <p className="text-2xl font-bold text-gold">
            {referrals.filter((r) => !r.reward_paid).length}
          </p>
        </div>
      </div>

      {/* Referral Code Section */}
      <div className="bg-obsidian rounded-2xl border border-gold/20 p-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Your Referral Code
        </h3>

        {referralCode ? (
          <div className="space-y-4">
            {/* Code display */}
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 bg-gold/10 border border-gold/20 rounded-xl">
                <span className="text-2xl font-mono font-bold text-gold tracking-widest">
                  {referralCode}
                </span>
              </div>
              <button
                onClick={() => handleCopy(referralCode, 'code')}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                {copied ? (
                  <CheckCircle className="w-5 h-5 text-profit" />
                ) : (
                  <Copy className="w-5 h-5 text-slate-400" />
                )}
              </button>
            </div>

            {/* Link display */}
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <span className="text-sm text-slate-400 font-mono truncate block">
                  {referralLink}
                </span>
              </div>
              <button
                onClick={() => handleCopy(referralLink, 'link')}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                {copiedLink ? (
                  <CheckCircle className="w-5 h-5 text-profit" />
                ) : (
                  <Link2 className="w-5 h-5 text-slate-400" />
                )}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">
            No referral code yet. Complete your profile to get one.
          </p>
        )}
      </div>

      {/* How it works */}
      <div className="bg-obsidian rounded-2xl border border-white/10 p-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          How It Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              step: '1',
              title: 'Share your code',
              desc: 'Send your referral link to friends',
              icon: Share2,
            },
            {
              step: '2',
              title: 'They sign up & buy a tier',
              desc: 'Your friend registers and purchases any tier',
              icon: TrendingUp,
            },
            {
              step: '3',
              title: 'You earn 5%',
              desc: '5% of their tier price is credited to your balance',
              icon: Gift,
            },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-gold">{item.step}</span>
              </div>
              <div>
                <p className="text-cream font-medium text-sm">{item.title}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral History */}
      <div className="bg-obsidian rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Referral History
          </h3>
        </div>
        {referrals.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No referrals yet. Share your code to get started!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Referred User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Reward</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((ref) => (
                  <tr key={ref.id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(ref.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-cream">
                      {ref.referred_user_id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-sm text-gold">
                      {ref.reward_paid
                        ? `+$${Number(ref.reward_amount).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-lg ${
                          ref.reward_paid
                            ? 'bg-profit/20 text-profit'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {ref.reward_paid ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

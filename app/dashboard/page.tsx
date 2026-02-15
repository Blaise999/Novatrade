'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Wallet,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Bot,
  Shield,
  CheckCircle,
  ChevronRight,
  BarChart3,
  History,
  Settings,
  CreditCard,
  Send,
} from 'lucide-react';

import { useStore } from '@/lib/supabase/store-supabase';
import { useBotEngine } from '@/lib/services/bot-trading-engine';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAccount } from 'wagmi';

// ----- helpers
const n = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export default function DashboardOverview() {
  const { user, refreshUser } = useStore();
  const { bots, fetchBots } = useBotEngine();
  const [hideBalance, setHideBalance] = useState(false);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const { address: liveAddress, isConnected: liveConnected } = useAccount();

  useEffect(() => {
    if (!user?.id) return;
    fetchBots(user.id);
    refreshUser();
    loadRecentActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadRecentActivity = async () => {
    if (!user?.id || !isSupabaseConfigured()) return;
    try {
      const { data: trades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: deposits } = await supabase
        .from('deposits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      const { data: tierPurchases } = await supabase
        .from('tier_purchases')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      const { data: bonuses } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .in('type', ['tier_bonus', 'bonus', 'deposit'])
        .order('created_at', { ascending: false })
        .limit(3);

      const { data: withdrawals } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      const { data: referrals } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      const items: any[] = [];

      (trades || []).forEach((t: any) => {
        items.push({
          id: `trade-${t.id}`,
          kind: 'trade',
          label: t.symbol || t.pair || 'Trade',
          sublabel: `${t.direction || t.type || 'Trade'} • ${t.market_type || t.asset_type || ''}`,
          amount: Number(t.amount ?? 0),
          pnl: Number(t.profit_loss ?? t.pnl ?? 0),
          status: t.status,
          created_at: t.created_at || t.opened_at,
        });
      });

      (deposits || []).forEach((d: any) => {
        items.push({
          id: `dep-${d.id}`,
          kind: 'deposit',
          label: 'Deposit',
          sublabel: `${d.network || d.currency || 'Funds'} • ${d.status}`,
          amount: Number(d.amount ?? 0),
          pnl: Number(d.amount ?? 0),
          status: d.status,
          created_at: d.created_at,
        });
      });

      (tierPurchases || []).forEach((tp: any) => {
        const tierNames: Record<number, string> = {
          1: 'Starter',
          2: 'Trader',
          3: 'Professional',
          4: 'Elite',
        };
        items.push({
          id: `tier-${tp.id}`,
          kind: 'tier',
          label: `${tierNames[tp.tier_level] || 'Tier'} Purchase`,
          sublabel: `Tier ${tp.tier_level} • ${tp.status}`,
          amount: Number(tp.price_amount ?? 0),
          pnl: tp.status === 'approved' ? Number(tp.bonus_amount ?? 0) : 0,
          status: tp.status,
          created_at: tp.created_at,
        });
      });

      (bonuses || []).forEach((b: any) => {
        items.push({
          id: `tx-${b.id}`,
          kind: 'bonus',
          label:
            b.type === 'tier_bonus'
              ? 'Tier Bonus'
              : b.type === 'deposit'
              ? 'Deposit Credit'
              : 'Bonus',
          sublabel: b.description || b.reference_type || 'Credit',
          amount: Math.abs(Number(b.amount ?? 0)),
          pnl: Number(b.amount ?? 0),
          status: 'completed',
          created_at: b.created_at,
        });
      });

      (withdrawals || []).forEach((w: any) => {
        items.push({
          id: `wd-${w.id}`,
          kind: 'withdrawal',
          label: 'Withdrawal',
          sublabel: `${w.method || w.network || 'Funds'} • ${w.status}`,
          amount: Number(w.amount ?? 0),
          pnl: -Number(w.amount ?? 0),
          status: w.status,
          created_at: w.created_at,
        });
      });

      (referrals || []).forEach((r: any) => {
        items.push({
          id: `ref-${r.id}`,
          kind: 'referral',
          label: 'Referral',
          sublabel: r.reward_paid
            ? `Earned $${Number(r.reward_amount || 0).toFixed(2)}`
            : 'New signup',
          amount: Number(r.reward_amount ?? 0),
          pnl: r.reward_paid ? Number(r.reward_amount ?? 0) : 0,
          status: r.reward_paid ? 'completed' : 'pending',
          created_at: r.created_at,
        });
      });

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentActivity(items.slice(0, 8));
    } catch {}
  };

  // ✅ SINGLE SOURCE OF TRUTH FOR DISPLAY:
  // MUST match layout header: users.balance_available
  const cashBalance =
    n((user as any)?.balance_available) ||
    n((user as any)?.balanceAvailable) ||
    n((user as any)?.balance) ||
    0;

  const activeBots = bots.filter((b) => b.status === 'running').length;
  const totalBotPnl = bots.reduce((s, b) => s + (b.total_pnl ?? 0), 0);

  const kycRaw = String((user as any)?.kycStatus ?? (user as any)?.kyc_status ?? 'none').toLowerCase();
  const kycStatus = kycRaw === 'approved' ? 'verified' : kycRaw;

  const walletConnected = liveConnected || !!user?.walletAddress;
  const walletAddress = liveAddress || user?.walletAddress;

  const formatBal = (val: number) =>
    hideBalance
      ? '••••••'
      : `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-cream">
          Welcome back, {user?.firstName || 'Trader'} 👋
        </h1>
        <p className="text-sm text-cream/50 mt-1">Here's your account overview</p>
      </div>

      {/* Main Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden p-6 bg-gradient-to-br from-electric/10 via-gold/5 to-transparent rounded-2xl border border-white/10"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-electric/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-cream/60">Balance</span>
            <button
              onClick={() => setHideBalance(!hideBalance)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              {hideBalance ? (
                <EyeOff className="w-4 h-4 text-cream/40" />
              ) : (
                <Eye className="w-4 h-4 text-cream/40" />
              )}
            </button>
          </div>

          {/* ✅ EXACT SAME BALANCE AS LAYOUT HEADER */}
          <p className="text-4xl font-bold text-cream mb-1">{formatBal(cashBalance)}</p>

          {/* ✅ Bonus line removed */}

          <div className="flex flex-wrap gap-3 mt-5">
            <Link
              href="/dashboard/deposit"
              className="flex items-center gap-2 px-4 py-2.5 bg-gold text-void font-semibold text-sm rounded-xl hover:bg-gold/90 transition-all"
            >
              <CreditCard className="w-4 h-4" /> Deposit
            </Link>
            <Link
              href="/dashboard/wallet?tab=withdraw"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-cream font-semibold text-sm rounded-xl hover:bg-white/15 transition-all"
            >
              <Send className="w-4 h-4" /> Withdraw
            </Link>
            <Link
              href="/dashboard/trade/crypto"
              className="flex items-center gap-2 px-4 py-2.5 bg-electric/20 text-electric font-semibold text-sm rounded-xl hover:bg-electric/30 transition-all"
            >
              <TrendingUp className="w-4 h-4" /> Trade
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/dashboard/bots"
          className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-electric/30 transition-all group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-purple-400" />
            </div>
            <ChevronRight className="w-4 h-4 text-cream/20 ml-auto group-hover:text-electric/60 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-cream">{activeBots}</p>
          <p className="text-xs text-cream/40">Active Bots</p>
        </Link>

        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${totalBotPnl >= 0 ? 'bg-profit/20' : 'bg-loss/20'}`}>
              {totalBotPnl >= 0 ? (
                <TrendingUp className="w-4 h-4 text-profit" />
              ) : (
                <TrendingDown className="w-4 h-4 text-loss" />
              )}
            </div>
          </div>
          <p className={`text-2xl font-bold ${totalBotPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {totalBotPnl >= 0 ? '+' : ''}
            {formatBal(totalBotPnl)}
          </p>
          <p className="text-xs text-cream/40">Bot P&L</p>
        </div>

        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${walletConnected ? 'bg-profit/20' : 'bg-white/10'}`}>
              <Wallet className={`w-4 h-4 ${walletConnected ? 'text-profit' : 'text-cream/40'}`} />
            </div>
          </div>

          {walletConnected ? (
            <>
              <p className="text-sm font-bold text-profit flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Connected
              </p>
              <p className="text-xs text-cream/40 font-mono truncate mt-0.5">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '—'}
              </p>
              <p className="text-[10px] text-cream/30 mt-1">
                {liveConnected ? 'Live wallet' : user?.walletAddress ? 'Saved wallet' : ''}
              </p>
            </>
          ) : (
            <>
              <Link href="/dashboard/connect-wallet" className="text-sm font-bold text-cream/60 hover:text-electric transition-colors">
                Not Connected
              </Link>
              <p className="text-xs text-cream/40">Tap to connect</p>
            </>
          )}
        </div>

        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                kycStatus === 'verified' ? 'bg-profit/20' : kycStatus === 'pending' ? 'bg-gold/20' : 'bg-white/10'
              }`}
            >
              <Shield
                className={`w-4 h-4 ${
                  kycStatus === 'verified' ? 'text-profit' : kycStatus === 'pending' ? 'text-gold' : 'text-cream/40'
                }`}
              />
            </div>
          </div>

          <p
            className={`text-sm font-bold ${
              kycStatus === 'verified' ? 'text-profit' : kycStatus === 'pending' ? 'text-gold' : 'text-cream/60'
            }`}
          >
            {kycStatus === 'verified'
              ? 'Verified ✓'
              : kycStatus === 'pending'
              ? 'In Review'
              : kycStatus === 'rejected'
              ? 'Rejected'
              : 'Not Verified'}
          </p>

          <p className="text-xs text-cream/40">
            {kycStatus === 'verified' ? (
              'Full access enabled'
            ) : kycStatus === 'pending' ? (
              'Under review'
            ) : (
              <Link href="/kyc" className="text-electric hover:underline">
                Complete KYC →
              </Link>
            )}
          </p>
        </div>
      </div>

      {/* Recent Activity + Quick Links unchanged (your existing code can stay) */}
      {/* ... keep the rest exactly as you already have it ... */}

      <div className="bg-white/5 rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-cream flex items-center gap-2">
            <History className="w-5 h-5 text-gold" /> Recent Activity
          </h2>
          <Link href="/dashboard/history" className="text-xs text-electric hover:underline">
            View All →
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <p className="text-center py-6 text-cream/30 text-sm">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((item: any) => {
              const isPositive = item.kind === 'deposit' || item.kind === 'bonus' || item.kind === 'tier' || item.pnl >= 0;
              const iconColor =
                item.kind === 'deposit'
                  ? 'bg-electric/20'
                  : item.kind === 'tier'
                  ? 'bg-gold/20'
                  : item.kind === 'bonus'
                  ? 'bg-purple-500/20'
                  : isPositive
                  ? 'bg-profit/20'
                  : 'bg-loss/20';

              const textColor =
                item.kind === 'deposit'
                  ? 'text-electric'
                  : item.kind === 'tier'
                  ? 'text-gold'
                  : item.kind === 'bonus'
                  ? 'text-purple-400'
                  : isPositive
                  ? 'text-profit'
                  : 'text-loss';

              return (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
                      {item.kind === 'deposit' || item.kind === 'tier' || item.kind === 'bonus' ? (
                        <ArrowUpRight className={`w-4 h-4 ${textColor}`} />
                      ) : item.pnl >= 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-profit" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-loss" />
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-cream">{item.label}</p>
                      <p className="text-xs text-cream/40">
                        {item.sublabel} • {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-sm font-bold ${textColor}`}>
                      {item.kind === 'trade' ? (
                        <>{item.pnl >= 0 ? '+' : ''}${Number(item.pnl).toFixed(2)}</>
                      ) : (
                        <>+${Number(item.amount).toFixed(2)}</>
                      )}
                    </p>

                    {item.kind === 'trade' && <p className="text-xs text-cream/40">${Number(item.amount).toFixed(2)}</p>}
                    {item.kind !== 'trade' && item.status && (
                      <p
                        className={`text-xs ${
                          item.status === 'approved' || item.status === 'completed'
                            ? 'text-emerald-400/60'
                            : item.status === 'pending'
                            ? 'text-yellow-400/60'
                            : 'text-cream/40'
                        }`}
                      >
                        {item.status}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Trading Bots', href: '/dashboard/bots', icon: Bot, color: 'text-purple-400' },
          { label: 'Portfolio', href: '/dashboard/portfolio', icon: BarChart3, color: 'text-electric' },
          { label: 'Trade History', href: '/dashboard/history', icon: History, color: 'text-gold' },
          { label: 'Settings', href: '/dashboard/settings', icon: Settings, color: 'text-cream/60' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all group"
          >
            <link.icon className={`w-5 h-5 ${link.color}`} />
            <span className="text-sm text-cream/70 group-hover:text-cream transition-colors">{link.label}</span>
            <ChevronRight className="w-4 h-4 text-cream/20 ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
}

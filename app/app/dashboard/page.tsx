'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Wallet, Eye, EyeOff, TrendingUp, TrendingDown, ArrowUpRight,
  ArrowDownRight, Bot, Clock, Grid3X3, Shield, CheckCircle,
  AlertCircle, ChevronRight, DollarSign, BarChart3, History,
  Settings, Plus, Zap, Lock, Unlock, CreditCard, Send,
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';
import { useBotEngine } from '@/lib/services/bot-trading-engine';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export default function DashboardOverview() {
  const { user, refreshUser } = useStore();
  const { bots, fetchBots } = useBotEngine();
  const [hideBalance, setHideBalance] = useState(false);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchBots(user.id);
      refreshUser();
      loadRecentTrades();
    }
  }, [user?.id]);

  const loadRecentTrades = async () => {
    if (!user?.id || !isSupabaseConfigured()) return;
    try {
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (data) setRecentTrades(data);
    } catch {}
  };

  const balance = user?.balance ?? 0;
  const bonus = user?.bonusBalance ?? 0;
  const totalBalance = balance + bonus;
  const activeBots = bots.filter(b => b.status === 'running').length;
  const totalBotPnl = bots.reduce((s, b) => s + (b.total_pnl ?? 0), 0);
  const kycStatus = user?.kycStatus ?? 'none';
  const walletConnected = !!user?.walletAddress;

  const formatBal = (n: number) => hideBalance ? '••••••' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
            <span className="text-sm text-cream/60">Total Balance</span>
            <button onClick={() => setHideBalance(!hideBalance)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              {hideBalance ? <EyeOff className="w-4 h-4 text-cream/40" /> : <Eye className="w-4 h-4 text-cream/40" />}
            </button>
          </div>
          <p className="text-4xl font-bold text-cream mb-1">{formatBal(totalBalance)}</p>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-cream/50">Available: <span className="text-cream font-medium">{formatBal(balance)}</span></span>
            {bonus > 0 && <span className="text-cream/50">Bonus: <span className="text-gold font-medium">{formatBal(bonus)}</span></span>}
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <Link href="/dashboard/wallet" className="flex items-center gap-2 px-4 py-2.5 bg-gold text-void font-semibold text-sm rounded-xl hover:bg-gold/90 transition-all">
              <CreditCard className="w-4 h-4" /> Deposit
            </Link>
            <Link href="/dashboard/wallet?tab=withdraw" className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-cream font-semibold text-sm rounded-xl hover:bg-white/15 transition-all">
              <Send className="w-4 h-4" /> Withdraw
            </Link>
            <Link href="/dashboard/trade/crypto" className="flex items-center gap-2 px-4 py-2.5 bg-electric/20 text-electric font-semibold text-sm rounded-xl hover:bg-electric/30 transition-all">
              <TrendingUp className="w-4 h-4" /> Trade
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Bots */}
        <Link href="/dashboard/bots" className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-electric/30 transition-all group">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-purple-400" />
            </div>
            <ChevronRight className="w-4 h-4 text-cream/20 ml-auto group-hover:text-electric/60 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-cream">{activeBots}</p>
          <p className="text-xs text-cream/40">Active Bots</p>
        </Link>

        {/* Bot P&L */}
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${totalBotPnl >= 0 ? 'bg-profit/20' : 'bg-loss/20'}`}>
              {totalBotPnl >= 0 ? <TrendingUp className="w-4 h-4 text-profit" /> : <TrendingDown className="w-4 h-4 text-loss" />}
            </div>
          </div>
          <p className={`text-2xl font-bold ${totalBotPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {totalBotPnl >= 0 ? '+' : ''}{formatBal(totalBotPnl)}
          </p>
          <p className="text-xs text-cream/40">Bot P&L</p>
        </div>

        {/* Wallet */}
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
                {user?.walletAddress?.slice(0, 6)}...{user?.walletAddress?.slice(-4)}
              </p>
            </>
          ) : (
            <>
              <Link href="/connect-wallet" className="text-sm font-bold text-cream/60 hover:text-electric transition-colors">
                Not Connected
              </Link>
              <p className="text-xs text-cream/40">Tap to connect</p>
            </>
          )}
        </div>

        {/* KYC */}
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              kycStatus === 'verified' ? 'bg-profit/20' : kycStatus === 'pending' ? 'bg-gold/20' : 'bg-white/10'
            }`}>
              <Shield className={`w-4 h-4 ${
                kycStatus === 'verified' ? 'text-profit' : kycStatus === 'pending' ? 'text-gold' : 'text-cream/40'
              }`} />
            </div>
          </div>
          <p className={`text-sm font-bold ${
            kycStatus === 'verified' ? 'text-profit' : kycStatus === 'pending' ? 'text-gold' : 'text-cream/60'
          }`}>
            {kycStatus === 'verified' ? 'Verified ✓' : kycStatus === 'pending' ? 'In Review' : kycStatus === 'rejected' ? 'Rejected' : 'Not Verified'}
          </p>
          <p className="text-xs text-cream/40">
            {kycStatus === 'verified' ? 'Full access enabled' : kycStatus === 'pending' ? 'Under review' : (
              <Link href="/kyc" className="text-electric hover:underline">Complete KYC →</Link>
            )}
          </p>
        </div>
      </div>

      {/* Running Bots Summary */}
      {bots.filter(b => b.status === 'running').length > 0 && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-cream flex items-center gap-2">
              <Bot className="w-5 h-5 text-electric" /> Active Bots
            </h2>
            <Link href="/dashboard/bots" className="text-xs text-electric hover:underline">View All →</Link>
          </div>
          <div className="space-y-2">
            {bots.filter(b => b.status === 'running').slice(0, 3).map(bot => (
              <div key={bot.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bot.bot_type === 'dca' ? 'bg-purple-500/20' : 'bg-orange-500/20'}`}>
                    {bot.bot_type === 'dca' ? <Clock className="w-4 h-4 text-purple-400" /> : <Grid3X3 className="w-4 h-4 text-orange-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-cream">{bot.name}</p>
                    <p className="text-xs text-cream/40">{bot.pair} • {bot.total_trades} trades</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${(bot.total_pnl ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {(bot.total_pnl ?? 0) >= 0 ? '+' : ''}${(bot.total_pnl ?? 0).toFixed(2)}
                  </p>
                  <span className="flex items-center gap-1 text-[10px] text-profit">
                    <span className="w-1.5 h-1.5 bg-profit rounded-full animate-pulse" /> Running
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Trades */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-cream flex items-center gap-2">
            <History className="w-5 h-5 text-gold" /> Recent Activity
          </h2>
          <Link href="/dashboard/history" className="text-xs text-electric hover:underline">View All →</Link>
        </div>
        {recentTrades.length === 0 ? (
          <p className="text-center py-6 text-cream/30 text-sm">No recent trades</p>
        ) : (
          <div className="space-y-2">
            {recentTrades.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.pnl >= 0 ? 'bg-profit/20' : 'bg-loss/20'}`}>
                    {t.pnl >= 0 ? <ArrowUpRight className="w-4 h-4 text-profit" /> : <ArrowDownRight className="w-4 h-4 text-loss" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-cream">{t.pair || 'Trade'}</p>
                    <p className="text-xs text-cream/40">{t.close_reason || t.type || 'Trade'} • {new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${(t.pnl ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {(t.pnl ?? 0) >= 0 ? '+' : ''}${Number(t.pnl ?? 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-cream/40">${Number(t.amount ?? 0).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Trading Bots', href: '/dashboard/bots', icon: Bot, color: 'text-purple-400' },
          { label: 'Portfolio', href: '/dashboard/portfolio', icon: BarChart3, color: 'text-electric' },
          { label: 'Trade History', href: '/dashboard/history', icon: History, color: 'text-gold' },
          { label: 'Settings', href: '/dashboard/settings', icon: Settings, color: 'text-cream/60' },
        ].map(link => (
          <Link key={link.href} href={link.href}
            className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all group">
            <link.icon className={`w-5 h-5 ${link.color}`} />
            <span className="text-sm text-cream/70 group-hover:text-cream transition-colors">{link.label}</span>
            <ChevronRight className="w-4 h-4 text-cream/20 ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
}

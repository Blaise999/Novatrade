'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  DollarSign,
  Bitcoin,
  Globe,
  Gift,
  PiggyBank,
  Copy,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Eye,
  EyeOff,
  Zap,
  Shield,
  Activity,
  Target,
  Users,
  LineChart,
  Sparkles,
  Trophy,
  CreditCard
} from 'lucide-react';
import { useAuthStore, useTradingStore } from '@/lib/store';
import { useTradingAccountStore, useInvestmentsStore, useAirdropsStore } from '@/lib/trading-store';
import { marketAssets } from '@/lib/data';

// Mini TradingView Chart Component (placeholder for embedding)
const MiniChart = ({ symbol, change }: { symbol: string; change: number }) => {
  const isPositive = change >= 0;
  const points = Array.from({ length: 20 }, (_, i) => {
    const base = 50;
    const trend = isPositive ? i * 2 : -i * 2;
    const noise = Math.random() * 20 - 10;
    return Math.max(5, Math.min(95, base + trend + noise));
  });
  
  return (
    <svg viewBox="0 0 100 50" className="w-full h-12">
      <defs>
        <linearGradient id={`gradient-${symbol}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M 0,${100 - points[0]} ${points.map((p, i) => `L ${(i / 19) * 100},${100 - p}`).join(' ')} L 100,100 L 0,100 Z`}
        fill={`url(#gradient-${symbol})`}
      />
      <path
        d={`M 0,${100 - points[0]} ${points.map((p, i) => `L ${(i / 19) * 100},${100 - p}`).join(' ')}`}
        fill="none"
        stroke={isPositive ? '#10B981' : '#EF4444'}
        strokeWidth="2"
      />
    </svg>
  );
};

// Quick Stats Card Component
const StatCard = ({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color,
  href 
}: { 
  title: string; 
  value: string; 
  change?: number; 
  icon: any;
  color: string;
  href?: string;
}) => {
  const content = (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-400">{title}</p>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-cream">{value}</p>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${change >= 0 ? 'text-profit' : 'text-loss'}`}>
          {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </div>
      )}
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
};

// Market Asset Row Component
const AssetRow = ({ asset, onClick }: { asset: any; onClick?: () => void }) => (
  <motion.div
    whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
    onClick={onClick}
    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer"
  >
    <div className={`w-10 h-10 rounded-lg ${
      asset.type === 'crypto' ? 'bg-orange-500/20' :
      asset.type === 'forex' ? 'bg-blue-500/20' :
      'bg-green-500/20'
    } flex items-center justify-center`}>
      {asset.type === 'crypto' && <Bitcoin className="w-5 h-5 text-orange-500" />}
      {asset.type === 'forex' && <Globe className="w-5 h-5 text-blue-500" />}
      {asset.type === 'stock' && <BarChart3 className="w-5 h-5 text-green-500" />}
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-cream">{asset.symbol}</p>
      <p className="text-xs text-slate-500">{asset.name}</p>
    </div>
    <div className="text-right">
      <p className="text-sm font-mono text-cream">
        ${asset.price < 1 ? asset.price.toFixed(4) : asset.price.toLocaleString()}
      </p>
      <p className={`text-xs ${asset.changePercent24h >= 0 ? 'text-profit' : 'text-loss'}`}>
        {asset.changePercent24h >= 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
      </p>
    </div>
    <MiniChart symbol={asset.symbol} change={asset.changePercent24h} />
  </motion.div>
);

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { activeTrades, tradeHistory } = useTradingStore();
  const { 
    spotAccount, 
    marginAccount, 
    stockPositions, 
    marginPositions,
    calculateSpotEquity,
    calculateMarginEquity,
    calculateTotalUnrealizedPnL,
    initializeAccounts
  } = useTradingAccountStore();
  const { investments, totalInvested, totalEarned } = useInvestmentsStore();
  const { participations, totalPointsEarned } = useAirdropsStore();
  
  const [showBalance, setShowBalance] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<'all' | 'crypto' | 'forex' | 'stock'>('all');
  
  // Initialize trading accounts if not exists
  useEffect(() => {
    if (user && !spotAccount) {
      initializeAccounts(user.id);
    }
  }, [user, spotAccount, initializeAccounts]);
  
  // Calculate totals
  const totalBalance = user?.balance?.available || 0;
  const spotEquity = calculateSpotEquity();
  const marginEquity = calculateMarginEquity();
  const totalEquity = spotEquity + marginEquity;
  const totalUnrealizedPnL = calculateTotalUnrealizedPnL();
  const totalRealizedPnL = (spotAccount?.realizedPnL || 0) + (marginAccount?.realizedPnL || 0);
  
  // Filter assets
  const filteredAssets = marketAssets.filter(asset => 
    selectedMarket === 'all' || asset.type === selectedMarket
  ).slice(0, 8);
  
  // Active investments count
  const activeInvestments = investments.filter(i => i.status === 'active').length;
  
  // Active airdrops count
  const activeAirdrops = participations.filter(p => p.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-cream">
            Welcome back, {user?.firstName || user?.email?.split('@')[0] || 'Trader'}! 👋
          </h1>
          <p className="text-slate-400 mt-1">
            Here's your trading overview for today
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/wallet"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold to-gold/80 text-void text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all"
          >
            <CreditCard className="w-4 h-4" />
            Deposit
          </Link>
          <Link
            href="/dashboard/trade/crypto"
            className="flex items-center gap-2 px-4 py-2 bg-profit text-void text-sm font-semibold rounded-xl hover:bg-profit/90 transition-all"
          >
            <TrendingUp className="w-4 h-4" />
            Trade Now
          </Link>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-2 p-5 bg-gradient-to-br from-gold/20 to-gold/5 rounded-2xl border border-gold/20"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-400">Total Portfolio Value</p>
            <button onClick={() => setShowBalance(!showBalance)} className="text-slate-400 hover:text-cream">
              {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-4xl font-bold text-cream">
            {showBalance ? `$${totalBalance.toLocaleString()}` : '••••••'}
          </p>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1 text-sm">
              <span className="text-slate-400">Unrealized:</span>
              <span className={totalUnrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}>
                {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-slate-400">Realized:</span>
              <span className={totalRealizedPnL >= 0 ? 'text-profit' : 'text-loss'}>
                {totalRealizedPnL >= 0 ? '+' : ''}${totalRealizedPnL.toFixed(2)}
              </span>
            </div>
          </div>
        </motion.div>
        
        <StatCard
          title="Spot Account"
          value={showBalance ? `$${spotEquity.toLocaleString()}` : '••••'}
          change={spotAccount?.unrealizedPnL ? (spotAccount.unrealizedPnL / spotEquity) * 100 : 0}
          icon={BarChart3}
          color="text-profit"
          href="/dashboard/trade/stocks"
        />
        
        <StatCard
          title="Margin Account"
          value={showBalance ? `$${marginEquity.toLocaleString()}` : '••••'}
          change={marginAccount?.unrealizedPnL ? (marginAccount.unrealizedPnL / marginEquity) * 100 : 0}
          icon={Activity}
          color="text-electric"
          href="/dashboard/trade/fx"
        />
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { 
            title: 'Crypto Trading', 
            desc: 'Binary Options', 
            icon: Bitcoin, 
            href: '/dashboard/trade/crypto',
            color: 'from-orange-500/20 to-orange-600/10',
            iconColor: 'text-orange-500',
            stats: `${activeTrades.length} active`
          },
          { 
            title: 'Forex Trading', 
            desc: 'CFD/Margin', 
            icon: Globe, 
            href: '/dashboard/trade/fx',
            color: 'from-blue-500/20 to-blue-600/10',
            iconColor: 'text-blue-500',
            stats: `${marginPositions.length} positions`
          },
          { 
            title: 'Stock Trading', 
            desc: 'Spot Market', 
            icon: BarChart3, 
            href: '/dashboard/trade/stocks',
            color: 'from-green-500/20 to-green-600/10',
            iconColor: 'text-green-500',
            stats: `${stockPositions.length} holdings`
          },
          { 
            title: 'Copy Trading', 
            desc: 'Follow Experts', 
            icon: Copy, 
            href: '/dashboard/copy-trading',
            color: 'from-purple-500/20 to-purple-600/10',
            iconColor: 'text-purple-500',
            stats: '12 traders'
          },
        ].map((item, index) => (
          <Link key={item.title} href={item.href}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              className={`p-4 bg-gradient-to-br ${item.color} rounded-xl border border-white/5 hover:border-white/10 transition-all`}
            >
              <item.icon className={`w-8 h-8 ${item.iconColor} mb-3`} />
              <h3 className="font-semibold text-cream">{item.title}</h3>
              <p className="text-xs text-slate-400">{item.desc}</p>
              <p className="text-xs text-gold mt-2">{item.stats}</p>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Market Overview */}
        <div className="lg:col-span-2 bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <h2 className="text-lg font-semibold text-cream">Market Overview</h2>
            <div className="flex items-center gap-2">
              {['all', 'crypto', 'forex', 'stock'].map(market => (
                <button
                  key={market}
                  onClick={() => setSelectedMarket(market as any)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all capitalize ${
                    selectedMarket === market
                      ? 'bg-gold text-void'
                      : 'bg-white/5 text-slate-400 hover:text-cream'
                  }`}
                >
                  {market}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {filteredAssets.map(asset => (
              <AssetRow key={asset.id} asset={asset} />
            ))}
          </div>
          <Link
            href="/markets"
            className="flex items-center justify-center gap-2 p-3 text-sm text-gold hover:bg-white/5 transition-all"
          >
            View All Markets
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Investments Summary */}
          <div className="bg-white/5 rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-cream flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-gold" />
                Investments
              </h3>
              <Link href="/invest/plans" className="text-xs text-gold hover:text-gold/80">
                View Plans
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Total Invested</span>
                <span className="text-sm font-semibold text-cream">
                  ${totalInvested.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Total Earned</span>
                <span className="text-sm font-semibold text-profit">
                  +${totalEarned.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Active Plans</span>
                <span className="text-sm font-semibold text-cream">{activeInvestments}</span>
              </div>
            </div>
            {activeInvestments === 0 && (
              <Link
                href="/invest/plans"
                className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-gold/10 text-gold text-sm font-medium rounded-lg hover:bg-gold/20 transition-all"
              >
                Start Investing
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {/* Airdrops Summary */}
          <div className="bg-white/5 rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-cream flex items-center gap-2">
                <Gift className="w-5 h-5 text-electric" />
                Airdrops
              </h3>
              <Link href="/earn/airdrops" className="text-xs text-gold hover:text-gold/80">
                Explore
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Points Earned</span>
                <span className="text-sm font-semibold text-cream">
                  {totalPointsEarned.toLocaleString()} pts
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Active Campaigns</span>
                <span className="text-sm font-semibold text-cream">{activeAirdrops}</span>
              </div>
            </div>
            <Link
              href="/earn/airdrops"
              className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-electric/10 text-electric text-sm font-medium rounded-lg hover:bg-electric/20 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Claim Rewards
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="bg-white/5 rounded-2xl border border-white/5 p-4">
            <h3 className="font-semibold text-cream mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/dashboard/wallet"
                className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
              >
                <ArrowDownLeft className="w-5 h-5 text-profit" />
                <span className="text-xs text-slate-400">Deposit</span>
              </Link>
              <Link
                href="/dashboard/wallet"
                className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
              >
                <ArrowUpRight className="w-5 h-5 text-loss" />
                <span className="text-xs text-slate-400">Withdraw</span>
              </Link>
              <Link
                href="/earn/referral"
                className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
              >
                <Users className="w-5 h-5 text-electric" />
                <span className="text-xs text-slate-400">Refer</span>
              </Link>
              <Link
                href="/dashboard/settings"
                className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
              >
                <Shield className="w-5 h-5 text-gold" />
                <span className="text-xs text-slate-400">Security</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Open Positions Summary */}
      {(stockPositions.length > 0 || marginPositions.length > 0) && (
        <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <h2 className="text-lg font-semibold text-cream">Open Positions</h2>
            <Link href="/dashboard/portfolio" className="text-sm text-gold hover:text-gold/80">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-white/5">
                  <th className="text-left p-4">Asset</th>
                  <th className="text-left p-4">Type</th>
                  <th className="text-right p-4">Size</th>
                  <th className="text-right p-4">Entry</th>
                  <th className="text-right p-4">Current</th>
                  <th className="text-right p-4">P&L</th>
                </tr>
              </thead>
              <tbody>
                {stockPositions.slice(0, 3).map(position => (
                  <tr key={position.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-cream">{position.symbol}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-400">Stock</td>
                    <td className="p-4 text-sm text-cream text-right">{position.qty}</td>
                    <td className="p-4 text-sm text-cream text-right font-mono">${position.avgEntry.toFixed(2)}</td>
                    <td className="p-4 text-sm text-cream text-right font-mono">${position.currentPrice.toFixed(2)}</td>
                    <td className={`p-4 text-sm font-semibold text-right ${position.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {marginPositions.slice(0, 3).map(position => (
                  <tr key={position.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-cream">{position.symbol}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-400 capitalize">
                      {position.type} ({position.side})
                    </td>
                    <td className="p-4 text-sm text-cream text-right">{position.qty} @ {position.leverage}x</td>
                    <td className="p-4 text-sm text-cream text-right font-mono">${position.avgEntry.toFixed(4)}</td>
                    <td className="p-4 text-sm text-cream text-right font-mono">${position.currentPrice.toFixed(4)}</td>
                    <td className={`p-4 text-sm font-semibold text-right ${position.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white/5 rounded-2xl border border-white/5 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-cream">Recent Activity</h3>
          <Link href="/dashboard/history" className="text-sm text-gold hover:text-gold/80">
            View History
          </Link>
        </div>
        {tradeHistory.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No recent activity</p>
            <p className="text-xs text-slate-500 mt-1">Your trades will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tradeHistory.slice(0, 5).map(trade => (
              <div
                key={trade.id}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-xl"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  trade.status === 'won' ? 'bg-profit/10' : 'bg-loss/10'
                }`}>
                  {trade.status === 'won' ? (
                    <CheckCircle className="w-5 h-5 text-profit" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-loss" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-cream">
                    {trade.direction === 'up' ? 'CALL' : 'PUT'} {trade.asset?.symbol}
                  </p>
                  <p className="text-xs text-slate-500">
                    ${trade.amount} • {new Date(trade.closedAt || trade.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${
                    trade.status === 'won' ? 'text-profit' : 'text-loss'
                  }`}>
                    {trade.profit && trade.profit >= 0 ? '+' : ''}${(trade.profit || 0).toFixed(2)}
                  </p>
                  <p className={`text-xs ${
                    trade.status === 'won' ? 'text-profit' : 'text-loss'
                  }`}>
                    {trade.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

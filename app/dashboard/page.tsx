'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  BarChart3,
  Users,
  Clock,
  ChevronRight,
  Plus,
  Bitcoin,
  DollarSign,
  Activity,
  Target,
  Zap
} from 'lucide-react';
import { useAuthStore, useTradingStore } from '@/lib/store';
import { marketAssets } from '@/lib/data';

// Quick stats data
const quickStats = [
  { label: 'Total Balance', value: '$10,100.00', change: '+12.5%', isPositive: true, icon: Wallet },
  { label: 'Today\'s P&L', value: '+$245.80', change: '+2.4%', isPositive: true, icon: TrendingUp },
  { label: 'Open Positions', value: '5', change: '3 profit', isPositive: true, icon: Activity },
  { label: 'Win Rate', value: '68%', change: '+5%', isPositive: true, icon: Target },
];

// Recent trades mock data
const recentTrades = [
  { id: 1, asset: 'BTC/USD', type: 'crypto', direction: 'up', amount: 500, profit: 85, status: 'won', time: '2 min ago' },
  { id: 2, asset: 'EUR/USD', type: 'forex', direction: 'down', amount: 200, profit: -200, status: 'lost', time: '15 min ago' },
  { id: 3, asset: 'AAPL', type: 'stock', direction: 'up', amount: 300, profit: 51, status: 'won', time: '32 min ago' },
  { id: 4, asset: 'ETH/USD', type: 'crypto', direction: 'up', amount: 400, profit: 68, status: 'won', time: '1 hr ago' },
  { id: 5, asset: 'GBP/USD', type: 'forex', direction: 'down', amount: 150, profit: 25.5, status: 'won', time: '2 hrs ago' },
];

// Top movers
const topMovers = marketAssets.slice(0, 6).map(asset => ({
  ...asset,
  changePercent24h: (Math.random() - 0.3) * 20 // Random change for demo
}));

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [selectedPeriod, setSelectedPeriod] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1W');

  // Simulated portfolio data points
  const portfolioData = [
    { date: 'Mon', value: 9500 },
    { date: 'Tue', value: 9800 },
    { date: 'Wed', value: 9600 },
    { date: 'Thu', value: 10200 },
    { date: 'Fri', value: 9900 },
    { date: 'Sat', value: 10100 },
    { date: 'Sun', value: 10100 },
  ];

  const maxValue = Math.max(...portfolioData.map(d => d.value));
  const minValue = Math.min(...portfolioData.map(d => d.value));

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-cream">
            Welcome back, {user?.firstName || 'Trader'}! 👋
          </h1>
          <p className="text-slate-400 mt-1">
            Here&apos;s what&apos;s happening with your portfolio today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/trade/crypto"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold to-gold/80 text-void text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Trade
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-gold" />
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                stat.isPositive ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
              }`}>
                {stat.change}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
            <p className="text-xl font-bold text-cream">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Portfolio Chart */}
        <div className="lg:col-span-2 bg-white/5 rounded-2xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-cream">Portfolio Performance</h2>
              <p className="text-sm text-slate-400">Your balance over time</p>
            </div>
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
              {(['1D', '1W', '1M', '3M', '1Y'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    selectedPeriod === period
                      ? 'bg-gold text-void'
                      : 'text-slate-400 hover:text-cream'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {/* Simple Chart Visualization */}
          <div className="relative h-48">
            <svg className="w-full h-full" viewBox="0 0 700 200" preserveAspectRatio="none">
              {/* Grid Lines */}
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={i}
                  x1="0"
                  y1={i * 50}
                  x2="700"
                  y2={i * 50}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
              ))}
              
              {/* Area Fill */}
              <defs>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`M 0 ${200 - ((portfolioData[0].value - minValue) / (maxValue - minValue)) * 180} 
                    ${portfolioData.map((d, i) => 
                      `L ${(i / (portfolioData.length - 1)) * 700} ${200 - ((d.value - minValue) / (maxValue - minValue)) * 180}`
                    ).join(' ')} 
                    L 700 200 L 0 200 Z`}
                fill="url(#areaGradient)"
              />
              
              {/* Line */}
              <path
                d={`M ${portfolioData.map((d, i) => 
                  `${(i / (portfolioData.length - 1)) * 700} ${200 - ((d.value - minValue) / (maxValue - minValue)) * 180}`
                ).join(' L ')}`}
                fill="none"
                stroke="#D4AF37"
                strokeWidth="2"
              />
              
              {/* Data Points */}
              {portfolioData.map((d, i) => (
                <circle
                  key={i}
                  cx={(i / (portfolioData.length - 1)) * 700}
                  cy={200 - ((d.value - minValue) / (maxValue - minValue)) * 180}
                  r="4"
                  fill="#D4AF37"
                />
              ))}
            </svg>

            {/* X-axis Labels */}
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              {portfolioData.map((d) => (
                <span key={d.date}>{d.date}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
          <h2 className="text-lg font-semibold text-cream mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {[
              { label: 'Trade Crypto', icon: Bitcoin, href: '/dashboard/trade/crypto', color: 'from-orange-500/20 to-yellow-500/20' },
              { label: 'Trade Forex', icon: DollarSign, href: '/dashboard/trade/fx', color: 'from-green-500/20 to-emerald-500/20' },
              { label: 'Trade Stocks', icon: BarChart3, href: '/dashboard/trade/stocks', color: 'from-blue-500/20 to-indigo-500/20' },
              { label: 'Copy Traders', icon: Users, href: '/dashboard/copy-trading', color: 'from-purple-500/20 to-pink-500/20' },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all group"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center`}>
                  <action.icon className="w-5 h-5 text-cream" />
                </div>
                <span className="flex-1 text-sm font-medium text-cream">{action.label}</span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-gold group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>

          {/* Promo Banner */}
          <div className="mt-4 p-4 bg-gradient-to-r from-gold/10 to-electric/10 rounded-xl border border-gold/20">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-gold" />
              <span className="text-xs font-semibold text-gold">BOOST YOUR TRADES</span>
            </div>
            <p className="text-sm text-cream mb-2">Get 50% bonus on your next deposit!</p>
            <Link href="/dashboard/wallet" className="text-xs text-gold hover:underline">
              Deposit now →
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Trades */}
        <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-cream">Recent Trades</h2>
            <Link href="/dashboard/history" className="text-sm text-gold hover:text-gold/80 transition-colors">
              View all
            </Link>
          </div>
          
          <div className="space-y-3">
            {recentTrades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  trade.direction === 'up' ? 'bg-profit/10' : 'bg-loss/10'
                }`}>
                  {trade.direction === 'up' ? (
                    <ArrowUpRight className={`w-5 h-5 ${trade.status === 'won' ? 'text-profit' : 'text-loss'}`} />
                  ) : (
                    <ArrowDownRight className={`w-5 h-5 ${trade.status === 'won' ? 'text-profit' : 'text-loss'}`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-cream">{trade.asset}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      trade.type === 'crypto' ? 'bg-orange-500/10 text-orange-400' :
                      trade.type === 'forex' ? 'bg-green-500/10 text-green-400' :
                      'bg-blue-500/10 text-blue-400'
                    }`}>
                      {trade.type}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{trade.time}</span>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${trade.profit >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {trade.profit >= 0 ? '+' : ''}${Math.abs(trade.profit).toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">${trade.amount}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Movers */}
        <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-cream">Top Movers</h2>
            <Link href="/dashboard/trade/crypto" className="text-sm text-gold hover:text-gold/80 transition-colors">
              Trade now
            </Link>
          </div>
          
          <div className="space-y-3">
            {topMovers.map((asset) => (
              <Link
                key={asset.id}
                href={`/dashboard/trade/${asset.type === 'crypto' ? 'crypto' : asset.type === 'forex' ? 'fx' : 'stocks'}?asset=${asset.symbol}`}
                className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg">
                  {asset.type === 'crypto' ? '₿' : asset.type === 'forex' ? '$' : '📈'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-cream">{asset.symbol}</p>
                  <p className="text-xs text-slate-500">{asset.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-cream">
                    ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className={`text-xs font-medium ${asset.changePercent24h >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {asset.changePercent24h >= 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-gold group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* KYC Reminder (if not complete) */}
      {user?.kycStatus !== 'approved' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-gradient-to-r from-gold/10 to-transparent rounded-2xl border border-gold/20 flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-gold/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-gold" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-cream">Complete Your Verification</h3>
            <p className="text-xs text-slate-400 mt-1">
              Unlock higher withdrawal limits and access all features by completing KYC verification.
            </p>
          </div>
          <Link
            href="/kyc"
            className="px-4 py-2 bg-gold text-void text-sm font-semibold rounded-xl hover:bg-gold/90 transition-all flex-shrink-0"
          >
            Verify Now
          </Link>
        </motion.div>
      )}
    </div>
  );
}

// Import Shield icon that was missing
import { Shield } from 'lucide-react';

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Clock,
  Target,
  Wallet,
  Activity,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useStore } from '@/lib/store-supabase';
import { useTradingStore } from '@/lib/store';

// Mock portfolio data
const portfolioAllocation = [
  { asset: 'Crypto', value: 45, color: '#F59E0B' },
  { asset: 'Forex', value: 30, color: '#10B981' },
  { asset: 'Stocks', value: 20, color: '#6366F1' },
  { asset: 'Cash', value: 5, color: '#64748B' },
];

const performanceData = [
  { month: 'Jan', profit: 520, loss: -180 },
  { month: 'Feb', profit: 780, loss: -320 },
  { month: 'Mar', profit: 450, loss: -150 },
  { month: 'Apr', profit: 920, loss: -280 },
  { month: 'May', profit: 650, loss: -200 },
  { month: 'Jun', profit: 1100, loss: -350 },
];

const recentPositions = [
  { id: 1, asset: 'BTC/USD', type: 'crypto', direction: 'up', amount: 500, entryPrice: 97500, currentPrice: 98200, pnl: 3.58, status: 'won', time: '5m ago' },
  { id: 2, asset: 'EUR/USD', type: 'forex', direction: 'down', amount: 200, entryPrice: 1.0850, currentPrice: 1.0835, pnl: 1.38, status: 'won', time: '15m ago' },
  { id: 3, asset: 'NVDA', type: 'stock', direction: 'up', amount: 300, entryPrice: 142.50, currentPrice: 141.80, pnl: -0.49, status: 'lost', time: '32m ago' },
  { id: 4, asset: 'SOL/USD', type: 'crypto', direction: 'up', amount: 400, entryPrice: 244.00, currentPrice: 248.50, pnl: 1.84, status: 'won', time: '1h ago' },
  { id: 5, asset: 'GBP/USD', type: 'forex', direction: 'down', amount: 150, entryPrice: 1.2660, currentPrice: 1.2645, pnl: 1.19, status: 'won', time: '2h ago' },
];

export default function PortfolioPage() {
  const { user } = useStore();
  const { tradeHistory, activeTrades } = useTradingStore();
  const [selectedPeriod, setSelectedPeriod] = useState<'1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'>('1M');

  // Calculate stats
  const totalWins = recentPositions.filter(p => p.status === 'won').length;
  const totalTrades = recentPositions.length;
  const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
  const totalPnL = recentPositions.reduce((acc, p) => acc + (p.amount * p.pnl / 100), 0);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-cream">Portfolio</h1>
          <p className="text-slate-400 mt-1">Track your performance and positions</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-slate-400 hover:text-cream transition-all">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-slate-400 hover:text-cream transition-all">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-gradient-to-br from-gold/10 to-gold/5 rounded-2xl border border-gold/20"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Portfolio Value</p>
            <Wallet className="w-5 h-5 text-gold" />
          </div>
          <p className="text-3xl font-bold text-cream">
            ${((user?.balance || 0) + (user?.bonusBalance || 0)).toLocaleString()}
          </p>
          <p className="text-sm text-profit mt-2">+12.5% this month</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 bg-white/5 rounded-2xl border border-white/5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Total P&L</p>
            <TrendingUp className="w-5 h-5 text-profit" />
          </div>
          <p className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </p>
          <p className="text-sm text-slate-500 mt-2">Realized P&L</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 bg-white/5 rounded-2xl border border-white/5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Win Rate</p>
            <Target className="w-5 h-5 text-electric" />
          </div>
          <p className="text-3xl font-bold text-cream">{winRate.toFixed(1)}%</p>
          <p className="text-sm text-slate-500 mt-2">{totalWins}/{totalTrades} trades won</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-5 bg-white/5 rounded-2xl border border-white/5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Active Trades</p>
            <Activity className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-cream">{activeTrades.length}</p>
          <p className="text-sm text-slate-500 mt-2">Open positions</p>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <div className="lg:col-span-2 bg-white/5 rounded-2xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-cream">Performance</h2>
              <p className="text-sm text-slate-400">Profit & Loss over time</p>
            </div>
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
              {(['1W', '1M', '3M', '6M', '1Y', 'ALL'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all ${
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

          {/* Chart */}
          <div className="h-64 relative">
            <svg className="w-full h-full" viewBox="0 0 600 250" preserveAspectRatio="none">
              {/* Grid lines */}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <line
                  key={i}
                  x1="0"
                  y1={i * 50}
                  x2="600"
                  y2={i * 50}
                  stroke="rgba(255,255,255,0.05)"
                />
              ))}

              {/* Bars */}
              {performanceData.map((data, i) => {
                const x = i * 100 + 20;
                const maxVal = Math.max(...performanceData.map(d => Math.max(d.profit, Math.abs(d.loss))));
                const profitHeight = (data.profit / maxVal) * 100;
                const lossHeight = (Math.abs(data.loss) / maxVal) * 100;
                
                return (
                  <g key={i}>
                    {/* Profit bar */}
                    <rect
                      x={x}
                      y={125 - profitHeight}
                      width={30}
                      height={profitHeight}
                      fill="#00D9A5"
                      rx="4"
                    />
                    {/* Loss bar */}
                    <rect
                      x={x + 35}
                      y={125}
                      width={30}
                      height={lossHeight}
                      fill="#FF4757"
                      rx="4"
                    />
                    {/* Month label */}
                    <text
                      x={x + 32}
                      y={240}
                      textAnchor="middle"
                      fill="#64748B"
                      fontSize="12"
                    >
                      {data.month}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-profit rounded" />
              <span className="text-sm text-slate-400">Profit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-loss rounded" />
              <span className="text-sm text-slate-400">Loss</span>
            </div>
          </div>
        </div>

        {/* Allocation */}
        <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
          <h2 className="text-lg font-semibold text-cream mb-4">Asset Allocation</h2>
          
          {/* Simple pie chart representation */}
          <div className="relative w-40 h-40 mx-auto mb-6">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {portfolioAllocation.reduce((acc, item, i) => {
                const startOffset = acc.offset;
                const dashArray = item.value;
                acc.elements.push(
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth="20"
                    strokeDasharray={`${dashArray} ${100 - dashArray}`}
                    strokeDashoffset={-startOffset}
                  />
                );
                acc.offset += item.value;
                return acc;
              }, { elements: [] as JSX.Element[], offset: 0 }).elements}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-cream">100%</p>
                <p className="text-xs text-slate-500">Allocated</p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-3">
            {portfolioAllocation.map((item) => (
              <div key={item.asset} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-slate-400">{item.asset}</span>
                </div>
                <span className="text-sm font-medium text-cream">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      <div className="mt-6 bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-cream">Recent Trades</h2>
            <Link
              href="/dashboard/history"
              className="flex items-center gap-1 text-sm text-gold hover:text-gold/80 transition-colors"
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Direction
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Entry
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Exit
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  P&L
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentPositions.map((position) => (
                <tr key={position.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        position.type === 'crypto' ? 'bg-orange-500/10' :
                        position.type === 'forex' ? 'bg-green-500/10' : 'bg-blue-500/10'
                      }`}>
                        {position.type === 'crypto' ? '₿' :
                         position.type === 'forex' ? '$' : '📈'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-cream">{position.asset}</p>
                        <p className="text-xs text-slate-500 capitalize">{position.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`flex items-center gap-1 text-sm ${
                      position.direction === 'up' ? 'text-profit' : 'text-loss'
                    }`}>
                      {position.direction === 'up' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      {position.direction.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-cream">
                    ${position.amount}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-400 font-mono">
                    {position.type === 'forex' ? position.entryPrice.toFixed(4) : position.entryPrice.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-400 font-mono">
                    {position.type === 'forex' ? position.currentPrice.toFixed(4) : position.currentPrice.toLocaleString()}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-sm font-semibold ${
                      position.pnl >= 0 ? 'text-profit' : 'text-loss'
                    }`}>
                      {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-slate-500">{position.time}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  TrendingUp,
  Trophy,
  Shield,
  Star,
  CheckCircle,
  Copy,
  ChevronRight,
  Search,
  Filter,
  X,
  AlertTriangle,
  Wallet,
  Target,
  Clock,
  BarChart3,
  Zap
} from 'lucide-react';
import { topTraders } from '@/lib/data';
import { useStore } from '@/lib/store-supabase';
import { Trader } from '@/lib/types';

// Risk level colors
const riskColors: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-profit/10', text: 'text-profit', label: 'Low' },
  2: { bg: 'bg-green-500/10', text: 'text-green-400', label: 'Low-Med' },
  3: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Medium' },
  4: { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Med-High' },
  5: { bg: 'bg-loss/10', text: 'text-loss', label: 'High' },
};

export default function CopyTradingPage() {
  const { user } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'crypto' | 'forex' | 'stocks'>('all');
  const [sortBy, setSortBy] = useState<'return' | 'winRate' | 'followers'>('return');
  const [selectedTrader, setSelectedTrader] = useState<Trader | null>(null);
  const [copyAmount, setCopyAmount] = useState('100');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copiedTraders, setCopiedTraders] = useState<string[]>([]);

  const filteredTraders = topTraders
    .filter(trader => {
      const matchesSearch = trader.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trader.assets.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (selectedFilter === 'all') return matchesSearch;
      
      const assetTypeMap: Record<string, string[]> = {
        crypto: ['BTC', 'ETH', 'SOL', 'XRP'],
        forex: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
        stocks: ['AAPL', 'NVDA', 'TSLA']
      };
      
      return matchesSearch && trader.assets.some(a => assetTypeMap[selectedFilter]?.includes(a));
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'return': return b.totalReturn - a.totalReturn;
        case 'winRate': return b.winRate - a.winRate;
        case 'followers': return b.followers - a.followers;
        default: return 0;
      }
    });

  const handleCopyTrader = () => {
    if (!selectedTrader || !user) return;
    
    const amount = parseFloat(copyAmount);
    const userBalance = user.balance || 0;
    if (amount > userBalance) return;
    
    // Note: Balance deduction should be handled by backend API
    // This is just UI state for now
    setCopiedTraders([...copiedTraders, selectedTrader.id]);
    setShowCopyModal(false);
    setSelectedTrader(null);
  };

  const openCopyModal = (trader: Trader) => {
    setSelectedTrader(trader);
    setShowCopyModal(true);
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-cream">Copy Trading</h1>
        <p className="text-slate-400 mt-1">
          Automatically copy trades from top-performing traders
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-white/5 rounded-xl border border-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Active Traders</p>
              <p className="text-xl font-bold text-cream">2,847</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 bg-white/5 rounded-xl border border-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-profit/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-profit" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Avg. Return</p>
              <p className="text-xl font-bold text-profit">+127%</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 bg-white/5 rounded-xl border border-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-electric/10 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-electric" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Top Win Rate</p>
              <p className="text-xl font-bold text-cream">85.7%</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 bg-white/5 rounded-xl border border-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Copy className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">You&apos;re Copying</p>
              <p className="text-xl font-bold text-cream">{copiedTraders.length}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search traders or assets..."
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold"
          />
        </div>

        <div className="flex gap-2">
          {(['all', 'crypto', 'forex', 'stocks'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                selectedFilter === filter
                  ? 'bg-gold text-void'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-cream focus:outline-none focus:border-gold"
        >
          <option value="return">Highest Return</option>
          <option value="winRate">Best Win Rate</option>
          <option value="followers">Most Popular</option>
        </select>
      </div>

      {/* Traders Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTraders.map((trader, index) => {
          const risk = riskColors[trader.riskScore] || riskColors[3];
          const isCopying = copiedTraders.includes(trader.id);
          
          return (
            <motion.div
              key={trader.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-all"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/5">
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Image
                      src={trader.avatar}
                      alt={trader.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                    {trader.verified && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-electric rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-void" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-cream">{trader.name}</h3>
                      {trader.verified && (
                        <span className="text-xs px-2 py-0.5 bg-electric/10 text-electric rounded-full">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{trader.bio}</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="p-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Total Return</p>
                  <p className="text-lg font-bold text-profit">
                    +{trader.totalReturn.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Win Rate</p>
                  <p className="text-lg font-bold text-cream">{trader.winRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Followers</p>
                  <p className="text-lg font-bold text-cream">
                    {(trader.followers / 1000).toFixed(1)}K
                  </p>
                </div>
              </div>

              {/* Assets & Risk */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex flex-wrap gap-1">
                    {trader.assets.slice(0, 3).map((asset) => (
                      <span
                        key={asset}
                        className="text-xs px-2 py-1 bg-white/5 text-slate-400 rounded"
                      >
                        {asset}
                      </span>
                    ))}
                    {trader.assets.length > 3 && (
                      <span className="text-xs px-2 py-1 bg-white/5 text-slate-500 rounded">
                        +{trader.assets.length - 3}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${risk.bg} ${risk.text}`}>
                    {risk.label} Risk
                  </span>
                </div>

                {/* Actions */}
                {isCopying ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 py-2.5 bg-profit/10 text-profit text-sm font-medium rounded-lg text-center">
                      ✓ Copying
                    </div>
                    <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                      <BarChart3 className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openCopyModal(trader)}
                    className="w-full py-2.5 bg-gradient-to-r from-gold to-gold/80 text-void text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-gold/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Trader
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Copy Modal */}
      <AnimatePresence>
        {showCopyModal && selectedTrader && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowCopyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-charcoal rounded-2xl border border-white/10 w-full max-w-md overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Image
                      src={selectedTrader.avatar}
                      alt={selectedTrader.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                    <div>
                      <h3 className="text-lg font-semibold text-cream">{selectedTrader.name}</h3>
                      <p className="text-sm text-profit">+{selectedTrader.totalReturn}% return</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCopyModal(false)}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-5 space-y-4">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-white/5 rounded-xl text-center">
                    <Target className="w-5 h-5 text-gold mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Win Rate</p>
                    <p className="text-sm font-bold text-cream">{selectedTrader.winRate}%</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl text-center">
                    <BarChart3 className="w-5 h-5 text-electric mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Trades</p>
                    <p className="text-sm font-bold text-cream">{selectedTrader.trades.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl text-center">
                    <Users className="w-5 h-5 text-profit mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Copiers</p>
                    <p className="text-sm font-bold text-cream">{(selectedTrader.followers / 1000).toFixed(1)}K</p>
                  </div>
                </div>

                {/* Copy Amount */}
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                    Copy Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={copyAmount}
                      onChange={(e) => setCopyAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-lg font-semibold text-cream focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[50, 100, 250, 500].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setCopyAmount(amt.toString())}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          copyAmount === amt.toString()
                            ? 'bg-gold text-void'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Risk Warning */}
                <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-yellow-200">
                      <p className="font-medium">Risk Disclosure</p>
                      <p className="text-yellow-200/80 mt-1">
                        Past performance doesn&apos;t guarantee future results. Only copy with funds you can afford to lose.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Balance Check */}
                {user && parseFloat(copyAmount) > (user.balance || 0) && (
                  <div className="p-3 bg-loss/10 rounded-xl border border-loss/20 text-center">
                    <p className="text-sm text-loss mb-2">
                      Insufficient balance. Available: ${(user.balance || 0).toLocaleString()}
                    </p>
                    <Link
                      href="/dashboard/wallet"
                      className="inline-flex items-center gap-2 text-sm text-gold hover:text-gold/80 font-medium"
                    >
                      <Wallet className="w-4 h-4" />
                      Deposit Funds
                    </Link>
                  </div>
                )}

                {/* Copy Button */}
                <button
                  onClick={handleCopyTrader}
                  disabled={!copyAmount || parseFloat(copyAmount) <= 0 || !!(user && parseFloat(copyAmount) > (user.balance || 0))}

                  className="w-full py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Copy className="w-5 h-5" />
                  Start Copying with ${copyAmount}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How It Works */}
      <div className="mt-8 p-6 bg-gradient-to-r from-gold/5 to-electric/5 rounded-2xl border border-gold/10">
        <h2 className="text-lg font-semibold text-cream mb-4">How Copy Trading Works</h2>
        <div className="grid sm:grid-cols-4 gap-6">
          {[
            { icon: Search, title: 'Find Traders', desc: 'Browse top performers by return, win rate, or strategy' },
            { icon: Copy, title: 'Start Copying', desc: 'Set your investment amount and start automatically copying' },
            { icon: Zap, title: 'Auto Execute', desc: 'Their trades are replicated in your account in real-time' },
            { icon: TrendingUp, title: 'Earn Together', desc: 'When they profit, you profit proportionally' },
          ].map((step, i) => (
            <div key={i} className="text-center">
              <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <step.icon className="w-6 h-6 text-gold" />
              </div>
              <h3 className="text-sm font-medium text-cream mb-1">{step.title}</h3>
              <p className="text-xs text-slate-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

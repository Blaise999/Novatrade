'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  History,
  TrendingUp,
  TrendingDown,
  Filter,
  ChevronDown,
  Download,
  Calendar,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  BarChart3,
  Target
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';

type FilterType = 'all' | 'won' | 'lost' | 'pending';
type AssetFilter = 'all' | 'crypto' | 'forex' | 'stocks';

// Mock trade history data
const tradeHistory = [
  { id: 1, asset: 'BTC/USD', type: 'crypto', direction: 'up', amount: 500, profit: 425, payout: 85, status: 'won', entryPrice: 97842.50, exitPrice: 98156.30, duration: '5m', date: '2024-01-22 14:32:15' },
  { id: 2, asset: 'EUR/USD', type: 'forex', direction: 'down', amount: 200, profit: -200, payout: 88, status: 'lost', entryPrice: 1.0842, exitPrice: 1.0856, duration: '1m', date: '2024-01-22 14:15:42' },
  { id: 3, asset: 'AAPL', type: 'stock', direction: 'up', amount: 300, profit: 240, payout: 80, status: 'won', entryPrice: 228.45, exitPrice: 229.12, duration: '15m', date: '2024-01-22 13:45:00' },
  { id: 4, asset: 'ETH/USD', type: 'crypto', direction: 'up', amount: 400, profit: 340, payout: 85, status: 'won', entryPrice: 3456.78, exitPrice: 3478.90, duration: '5m', date: '2024-01-22 12:30:20' },
  { id: 5, asset: 'GBP/USD', type: 'forex', direction: 'down', amount: 150, profit: 132, payout: 88, status: 'won', entryPrice: 1.2654, exitPrice: 1.2638, duration: '2m', date: '2024-01-22 11:20:00' },
  { id: 6, asset: 'NVDA', type: 'stock', direction: 'up', amount: 250, profit: -250, payout: 80, status: 'lost', entryPrice: 142.87, exitPrice: 142.45, duration: '30m', date: '2024-01-22 10:00:00' },
  { id: 7, asset: 'SOL/USD', type: 'crypto', direction: 'down', amount: 350, profit: 280, payout: 80, status: 'won', entryPrice: 245.67, exitPrice: 243.20, duration: '5m', date: '2024-01-21 22:45:30' },
  { id: 8, asset: 'USD/JPY', type: 'forex', direction: 'up', amount: 180, profit: 158.4, payout: 88, status: 'won', entryPrice: 156.78, exitPrice: 156.95, duration: '5m', date: '2024-01-21 20:15:00' },
  { id: 9, asset: 'TSLA', type: 'stock', direction: 'down', amount: 400, profit: -400, payout: 78, status: 'lost', entryPrice: 412.56, exitPrice: 415.23, duration: '1h', date: '2024-01-21 16:30:00' },
  { id: 10, asset: 'XRP/USD', type: 'crypto', direction: 'up', amount: 200, profit: 160, payout: 80, status: 'won', entryPrice: 2.87, exitPrice: 2.92, duration: '5m', date: '2024-01-21 14:00:00' },
  { id: 11, asset: 'AUD/USD', type: 'forex', direction: 'up', amount: 120, profit: 103.2, payout: 86, status: 'won', entryPrice: 0.6234, exitPrice: 0.6248, duration: '15m', date: '2024-01-21 10:30:00' },
  { id: 12, asset: 'GOOGL', type: 'stock', direction: 'up', amount: 350, profit: 287, payout: 82, status: 'won', entryPrice: 198.45, exitPrice: 199.67, duration: '30m', date: '2024-01-20 15:45:00' },
];

export default function HistoryPage() {
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Calculate stats
  const stats = {
    totalTrades: tradeHistory.length,
    wonTrades: tradeHistory.filter(t => t.status === 'won').length,
    lostTrades: tradeHistory.filter(t => t.status === 'lost').length,
    totalProfit: tradeHistory.reduce((acc, t) => acc + t.profit, 0),
    totalInvested: tradeHistory.reduce((acc, t) => acc + t.amount, 0),
    winRate: (tradeHistory.filter(t => t.status === 'won').length / tradeHistory.length * 100).toFixed(1),
  };

  // Filter trades
  const filteredTrades = tradeHistory.filter(trade => {
    const matchesStatus = statusFilter === 'all' || trade.status === statusFilter;
    const matchesAsset = assetFilter === 'all' || trade.type === assetFilter;
    const matchesSearch = trade.asset.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesAsset && matchesSearch;
  });

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'crypto': return '₿';
      case 'forex': return '$';
      case 'stock': return '📈';
      default: return '•';
    }
  };

  const getAssetColor = (type: string) => {
    switch (type) {
      case 'crypto': return 'bg-orange-500/10 text-orange-400';
      case 'forex': return 'bg-green-500/10 text-green-400';
      case 'stock': return 'bg-blue-500/10 text-blue-400';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-cream">Trade History</h1>
          <p className="text-slate-400 mt-1">View all your past trades and performance</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-slate-400 hover:text-cream transition-colors">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-white/5 rounded-2xl border border-white/5"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-gold" />
            </div>
          </div>
          <p className="text-xs text-slate-500">Total Trades</p>
          <p className="text-2xl font-bold text-cream">{stats.totalTrades}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 bg-white/5 rounded-2xl border border-white/5"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-profit/10 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-profit" />
            </div>
          </div>
          <p className="text-xs text-slate-500">Win Rate</p>
          <p className="text-2xl font-bold text-profit">{stats.winRate}%</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 bg-white/5 rounded-2xl border border-white/5"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-electric/10 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-electric" />
            </div>
          </div>
          <p className="text-xs text-slate-500">Total Invested</p>
          <p className="text-2xl font-bold text-cream">${stats.totalInvested.toLocaleString()}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 bg-white/5 rounded-2xl border border-white/5"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              stats.totalProfit >= 0 ? 'bg-profit/10' : 'bg-loss/10'
            }`}>
              {stats.totalProfit >= 0 ? (
                <TrendingUp className="w-5 h-5 text-profit" />
              ) : (
                <TrendingDown className="w-5 h-5 text-loss" />
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500">Total P&L</p>
          <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
            {stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toLocaleString()}
          </p>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by asset..."
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'won', label: 'Won' },
            { id: 'lost', label: 'Lost' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id as FilterType)}
              className={`px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                statusFilter === filter.id
                  ? 'bg-gold text-void'
                  : 'bg-white/5 text-slate-400 hover:text-cream'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Asset Filter */}
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All Assets' },
            { id: 'crypto', label: 'Crypto' },
            { id: 'forex', label: 'Forex' },
            { id: 'stocks', label: 'Stocks' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setAssetFilter(filter.id as AssetFilter)}
              className={`px-4 py-3 text-sm font-medium rounded-xl transition-all hidden sm:block ${
                assetFilter === filter.id
                  ? 'bg-gold text-void'
                  : 'bg-white/5 text-slate-400 hover:text-cream'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trade List */}
      <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
        {/* Table Header */}
        <div className="hidden lg:grid grid-cols-8 gap-4 p-4 border-b border-white/5 text-xs text-slate-500 uppercase">
          <div>Asset</div>
          <div>Direction</div>
          <div>Amount</div>
          <div>Entry Price</div>
          <div>Exit Price</div>
          <div>Duration</div>
          <div>P&L</div>
          <div>Date</div>
        </div>

        {/* Trade Rows */}
        <div className="divide-y divide-white/5">
          {filteredTrades.map((trade, index) => (
            <motion.div
              key={trade.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.02 }}
              className="p-4 hover:bg-white/5 transition-all"
            >
              {/* Mobile View */}
              <div className="lg:hidden space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      trade.direction === 'up' ? 'bg-profit/10' : 'bg-loss/10'
                    }`}>
                      {trade.direction === 'up' ? (
                        <TrendingUp className={`w-5 h-5 ${trade.status === 'won' ? 'text-profit' : 'text-loss'}`} />
                      ) : (
                        <TrendingDown className={`w-5 h-5 ${trade.status === 'won' ? 'text-profit' : 'text-loss'}`} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-cream">{trade.asset}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getAssetColor(trade.type)}`}>
                          {trade.type}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">{trade.date}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${trade.profit >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">${trade.amount}</p>
                  </div>
                </div>
              </div>

              {/* Desktop View */}
              <div className="hidden lg:grid grid-cols-8 gap-4 items-center">
                {/* Asset */}
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${getAssetColor(trade.type)}`}>
                    {getAssetIcon(trade.type)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-cream">{trade.asset}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getAssetColor(trade.type)}`}>
                      {trade.type}
                    </span>
                  </div>
                </div>

                {/* Direction */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded flex items-center justify-center ${
                    trade.direction === 'up' ? 'bg-profit/10' : 'bg-loss/10'
                  }`}>
                    {trade.direction === 'up' ? (
                      <TrendingUp className="w-4 h-4 text-profit" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-loss" />
                    )}
                  </div>
                  <span className="text-sm text-cream capitalize">{trade.direction}</span>
                </div>

                {/* Amount */}
                <div className="text-sm text-cream">${trade.amount}</div>

                {/* Entry Price */}
                <div className="text-sm font-mono text-cream">{trade.entryPrice}</div>

                {/* Exit Price */}
                <div className="text-sm font-mono text-cream">{trade.exitPrice}</div>

                {/* Duration */}
                <div className="flex items-center gap-1 text-sm text-slate-400">
                  <Clock className="w-3 h-3" />
                  {trade.duration}
                </div>

                {/* P&L */}
                <div className="flex items-center gap-2">
                  {trade.status === 'won' ? (
                    <CheckCircle className="w-4 h-4 text-profit" />
                  ) : (
                    <XCircle className="w-4 h-4 text-loss" />
                  )}
                  <span className={`font-semibold ${trade.profit >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                  </span>
                </div>

                {/* Date */}
                <div className="text-xs text-slate-500">{trade.date}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredTrades.length === 0 && (
          <div className="p-12 text-center">
            <History className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-cream font-medium">No trades found</p>
            <p className="text-sm text-slate-500 mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredTrades.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {filteredTrades.length} of {tradeHistory.length} trades
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white/5 rounded-lg text-slate-400 hover:text-cream transition-colors">
              Previous
            </button>
            <button className="px-4 py-2 bg-gold text-void rounded-lg font-medium">
              1
            </button>
            <button className="px-4 py-2 bg-white/5 rounded-lg text-slate-400 hover:text-cream transition-colors">
              2
            </button>
            <button className="px-4 py-2 bg-white/5 rounded-lg text-slate-400 hover:text-cream transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

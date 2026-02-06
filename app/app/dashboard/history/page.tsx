'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Target,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

type FilterType = 'all' | 'won' | 'lost' | 'pending';
type AssetFilter = 'all' | 'crypto' | 'forex' | 'stocks';

interface Trade {
  id: string;
  asset: string;
  type: 'crypto' | 'forex' | 'stock';
  direction: 'up' | 'down';
  amount: number;
  profit: number;
  payout: number;
  status: 'won' | 'lost' | 'pending' | 'cancelled';
  entryPrice: number;
  exitPrice: number | null;
  duration: string;
  date: string;
  created_at: string;
}

export default function HistoryPage() {
  const { user } = useStore();
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalTrades, setTotalTrades] = useState(0);
  const pageSize = 20;

  // Fetch real trade history from database
  const fetchTradeHistory = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query with filters
      let query = supabase
        .from('trades')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply search filter
      if (searchQuery) {
        query = query.ilike('symbol', `%${searchQuery}%`);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      // Transform database records to Trade interface
      const trades: Trade[] = (data || []).map(trade => {
        // Determine asset type from symbol
        const symbol = trade.symbol || '';
        let type: 'crypto' | 'forex' | 'stock' = 'crypto';
        if (symbol.includes('/USD') && !symbol.includes('BTC') && !symbol.includes('ETH')) {
          type = 'forex';
        } else if (['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'META', 'NFLX'].some(s => symbol.includes(s))) {
          type = 'stock';
        }

        // Calculate profit
        const profit = trade.status === 'won' 
          ? (trade.amount * (trade.payout_percent || 85) / 100)
          : trade.status === 'lost' 
            ? -trade.amount 
            : 0;

        // Format duration
        const durationSeconds = trade.duration_seconds || 300;
        let duration = '5m';
        if (durationSeconds < 60) duration = `${durationSeconds}s`;
        else if (durationSeconds < 3600) duration = `${Math.floor(durationSeconds / 60)}m`;
        else duration = `${Math.floor(durationSeconds / 3600)}h`;

        return {
          id: trade.id,
          asset: trade.symbol || 'Unknown',
          type,
          direction: trade.direction || 'up',
          amount: trade.amount || 0,
          profit,
          payout: trade.payout_percent || 85,
          status: trade.status || 'pending',
          entryPrice: trade.entry_price || 0,
          exitPrice: trade.exit_price,
          duration,
          date: new Date(trade.created_at).toLocaleString(),
          created_at: trade.created_at,
        };
      });

      setTradeHistory(trades);
      setTotalTrades(count || 0);
    } catch (err: any) {
      console.error('Error fetching trade history:', err);
      setError(err.message || 'Failed to load trade history');
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter, assetFilter, searchQuery, page]);

  useEffect(() => {
    fetchTradeHistory();
  }, [fetchTradeHistory]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel('trade-history-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refresh when any trade changes
          fetchTradeHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchTradeHistory]);

  // Calculate stats from real data
  const completedTrades = tradeHistory.filter(t => t.status !== 'pending');
  const stats = {
    totalTrades: totalTrades,
    wonTrades: tradeHistory.filter(t => t.status === 'won').length,
    lostTrades: tradeHistory.filter(t => t.status === 'lost').length,
    totalProfit: tradeHistory.reduce((acc, t) => acc + t.profit, 0),
    totalInvested: tradeHistory.reduce((acc, t) => acc + t.amount, 0),
    winRate: completedTrades.length > 0 
      ? (completedTrades.filter(t => t.status === 'won').length / completedTrades.length * 100).toFixed(1)
      : '0.0',
  };

  // Filter trades (client-side for search)
  const filteredTrades = tradeHistory.filter(trade => {
    const matchesSearch = trade.asset.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAsset = assetFilter === 'all' || trade.type === assetFilter.replace('stocks', 'stock');
    return matchesSearch && matchesAsset;
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

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Asset', 'Type', 'Direction', 'Amount', 'Entry Price', 'Exit Price', 'Duration', 'Status', 'P&L'];
    const rows = tradeHistory.map(t => [
      t.date,
      t.asset,
      t.type,
      t.direction,
      t.amount,
      t.entryPrice,
      t.exitPrice || '',
      t.duration,
      t.status,
      t.profit,
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalTrades / pageSize);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-cream">Trade History</h1>
          <p className="text-slate-400 mt-1">View all your past trades and performance</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchTradeHistory}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-slate-400 hover:text-cream transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={exportToCSV}
            disabled={tradeHistory.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-slate-400 hover:text-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-loss/10 border border-loss/20 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-loss flex-shrink-0" />
          <div>
            <p className="text-loss font-medium">Failed to load trade history</p>
            <p className="text-sm text-loss/70">{error}</p>
          </div>
          <button 
            onClick={fetchTradeHistory}
            className="ml-auto px-3 py-1 bg-loss/20 text-loss rounded-lg text-sm hover:bg-loss/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

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
          <p className="text-2xl font-bold text-cream">{loading ? '-' : stats.totalTrades}</p>
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
          <p className="text-2xl font-bold text-profit">{loading ? '-' : `${stats.winRate}%`}</p>
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
          <p className="text-2xl font-bold text-cream">{loading ? '-' : `$${stats.totalInvested.toLocaleString()}`}</p>
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
            {loading ? '-' : `${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toLocaleString()}`}
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
            placeholder="Search assets..."
            className="w-full pl-12 pr-4 py-3 bg-white/5 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'won', label: 'Won' },
            { id: 'lost', label: 'Lost' },
            { id: 'pending', label: 'Pending' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => { setStatusFilter(filter.id as FilterType); setPage(1); }}
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
              onClick={() => { setAssetFilter(filter.id as AssetFilter); setPage(1); }}
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

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-gold mx-auto mb-4 animate-spin" />
            <p className="text-slate-400">Loading trade history...</p>
          </div>
        )}

        {/* Trade Rows */}
        {!loading && (
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
                  <div className="text-sm font-mono text-cream">{trade.entryPrice.toFixed(trade.entryPrice < 10 ? 4 : 2)}</div>

                  {/* Exit Price */}
                  <div className="text-sm font-mono text-cream">
                    {trade.exitPrice ? trade.exitPrice.toFixed(trade.exitPrice < 10 ? 4 : 2) : '-'}
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-1 text-sm text-slate-400">
                    <Clock className="w-3 h-3" />
                    {trade.duration}
                  </div>

                  {/* P&L */}
                  <div className="flex items-center gap-2">
                    {trade.status === 'won' ? (
                      <CheckCircle className="w-4 h-4 text-profit" />
                    ) : trade.status === 'lost' ? (
                      <XCircle className="w-4 h-4 text-loss" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-500" />
                    )}
                    <span className={`font-semibold ${
                      trade.status === 'pending' ? 'text-yellow-500' :
                      trade.profit >= 0 ? 'text-profit' : 'text-loss'
                    }`}>
                      {trade.status === 'pending' ? 'Pending' : `${trade.profit >= 0 ? '+' : ''}$${trade.profit.toFixed(2)}`}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="text-xs text-slate-500">{trade.date}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredTrades.length === 0 && (
          <div className="p-12 text-center">
            <History className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-cream font-medium">No trades found</p>
            <p className="text-sm text-slate-500 mt-1">
              {tradeHistory.length === 0 
                ? "Start trading to see your history here"
                : "Try adjusting your filters"
              }
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {filteredTrades.length} of {totalTrades} trades
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-white/5 rounded-lg text-slate-400 hover:text-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    page === pageNum
                      ? 'bg-gold text-void'
                      : 'bg-white/5 text-slate-400 hover:text-cream'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-white/5 rounded-lg text-slate-400 hover:text-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

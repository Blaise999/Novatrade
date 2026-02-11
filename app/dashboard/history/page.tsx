'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  History,
  TrendingUp,
  TrendingDown,
  Download,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  BarChart3,
  Target,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

import { useStore } from '@/lib/supabase/store-supabase';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

type FilterType = 'all' | 'won' | 'lost' | 'open' | 'cancelled';
type AssetFilter = 'all' | 'crypto' | 'forex' | 'stocks' | 'commodity' | 'index';

type TradeType = 'crypto' | 'forex' | 'stock' | 'commodity' | 'index' | 'other';
type TradeStatus = 'won' | 'lost' | 'pending' | 'cancelled';

interface Trade {
  id: string;
  asset: string;
  type: TradeType;
  direction: 'up' | 'down';
  amount: number;
  profit: number;
  payout: number;
  status: TradeStatus;
  entryPrice: number;
  exitPrice: number | null;
  duration: string;
  date: string;
  created_at: string;
}

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function csvEscape(value: any) {
  const s = String(value ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function marketLabel(t: TradeType) {
  switch (t) {
    case 'crypto':
      return 'Crypto';
    case 'forex':
      return 'FX';
    case 'stock':
      return 'Stocks';
    case 'commodity':
      return 'Commod.';
    case 'index':
      return 'Index';
    default:
      return 'Other';
  }
}

function marketPillClass(t: TradeType) {
  switch (t) {
    case 'crypto':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'forex':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'stock':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'commodity':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'index':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}

function statusPillClass(s: TradeStatus) {
  switch (s) {
    case 'won':
      return 'bg-profit/10 text-profit border-profit/20';
    case 'lost':
      return 'bg-loss/10 text-loss border-loss/20';
    case 'cancelled':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    default:
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  }
}

function formatPrice(v: number) {
  if (!Number.isFinite(v)) return '-';
  return v.toFixed(v < 10 ? 4 : 2);
}

export default function HistoryPage() {
  const { user } = useStore();

  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [page, setPage] = useState(1);
  const [totalTrades, setTotalTrades] = useState(0);

  const pageSize = 20;

  // debounce search to avoid refetching every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchTradeHistory = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('trades')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Status filter (schema: pending/active/won/lost/closed/cancelled/expired)
      if (statusFilter !== 'all') {
        if (statusFilter === 'open') {
          query = query.in('status', ['pending', 'active']);
        } else if (statusFilter === 'cancelled') {
          query = query.in('status', ['cancelled', 'expired']);
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      // Asset filter (schema: crypto/forex/stock/commodity/index)
      if (assetFilter !== 'all') {
        const dbAssetType = assetFilter === 'stocks' ? 'stock' : assetFilter;
        query = query.eq('asset_type', dbAssetType);
      }

      // Search (schema: symbol)
      if (debouncedQuery) {
        query = query.ilike('symbol', `%${debouncedQuery}%`);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;

      const trades: Trade[] = (data || []).map((t: any) => {
        // ----- type -----
        let type: TradeType = 'other';
        const at = String(t.asset_type ?? '').toLowerCase();
        if (['crypto', 'forex', 'stock', 'commodity', 'index'].includes(at)) type = at as TradeType;

        // fallback for older rows / mixed usage
        const mt = String(t.market_type ?? '').toLowerCase(); // crypto | fx | stocks
        if (type === 'other') {
          if (mt === 'crypto') type = 'crypto';
          else if (mt === 'fx') type = 'forex';
          else if (mt === 'stocks') type = 'stock';
        }

        // ----- direction normalize (schema allows up/down/buy/sell/long/short) -----
        const dirRaw = String(t.direction ?? '').toLowerCase();
        const direction: 'up' | 'down' = ['down', 'sell', 'short'].includes(dirRaw) ? 'down' : 'up';

        // ----- profit -----
        let profit = toNum(t.profit_loss, 0);

        // fallback for binary options if profit_loss wasn't written
        const tradeType = String(t.trade_type ?? '').toLowerCase(); // binary/spot/margin/cfd
        const statusRaw = String(t.status ?? '').toLowerCase();
        const amount = toNum(t.amount, 0);
        const payoutPct = toNum(t.payout_percent, 85);

        if ((profit === 0 || !Number.isFinite(profit)) && tradeType === 'binary') {
          if (statusRaw === 'won') profit = amount * (payoutPct / 100);
          else if (statusRaw === 'lost') profit = -amount;
        }

        // fallback for spot/margin/cfd if closed + we have prices
        const entry = toNum(t.entry_price, 0);
        const exit = t.exit_price == null ? null : toNum(t.exit_price, 0);
        const qty = t.quantity == null ? null : toNum(t.quantity, 0);
        const lev = Math.max(1, toNum(t.leverage, 1));

        if ((profit === 0 || !Number.isFinite(profit)) && statusRaw === 'closed' && exit != null && entry > 0) {
          const effectiveQty = qty ?? (entry > 0 ? amount / entry : 0);
          const diff = exit - entry;
          const signed = direction === 'down' ? -diff : diff;
          profit = signed * effectiveQty * lev;
        }

        // ----- status normalize for UI -----
        let displayStatus: TradeStatus = 'pending';
        if (statusRaw === 'won') displayStatus = 'won';
        else if (statusRaw === 'lost') displayStatus = 'lost';
        else if (statusRaw === 'closed') displayStatus = profit >= 0 ? 'won' : 'lost';
        else if (statusRaw === 'cancelled' || statusRaw === 'expired') displayStatus = 'cancelled';
        else displayStatus = 'pending'; // pending/active

        // ----- duration -----
        const durationSeconds = toNum(t.duration_seconds, 0);
        let duration = '-';

        if (statusRaw === 'active') duration = 'Open';
        else if (durationSeconds > 0) {
          if (durationSeconds < 60) duration = `${durationSeconds}s`;
          else if (durationSeconds < 3600) duration = `${Math.floor(durationSeconds / 60)}m`;
          else duration = `${Math.floor(durationSeconds / 3600)}h`;
        } else if (t.opened_at && t.closed_at) {
          const diffMs = new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime();
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 60) duration = `${diffMins}m`;
          else if (diffMins < 1440) duration = `${Math.floor(diffMins / 60)}h`;
          else duration = `${Math.floor(diffMins / 1440)}d`;
        }

        const createdIso = t.created_at || t.opened_at || null;

        return {
          id: String(t.id),
          asset: String(t.symbol ?? 'Unknown'),
          type,
          direction,
          amount,
          profit,
          payout: payoutPct,
          status: displayStatus,
          entryPrice: entry,
          exitPrice: exit,
          duration,
          date: createdIso ? new Date(createdIso).toLocaleString() : '-',
          created_at: createdIso ?? '',
        };
      });

      setTradeHistory(trades);
      setTotalTrades(count || 0);
    } catch (err: any) {
      console.error('Error fetching trade history:', err);
      setError(err?.message || 'Failed to load trade history');
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter, assetFilter, debouncedQuery, page]);

  useEffect(() => {
    fetchTradeHistory();
  }, [fetchTradeHistory]);

  // Realtime updates
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
          fetchTradeHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchTradeHistory]);

  const stats = useMemo(() => {
    const completed = tradeHistory.filter((t) => t.status === 'won' || t.status === 'lost');
    const won = completed.filter((t) => t.status === 'won').length;
    const lost = completed.filter((t) => t.status === 'lost').length;

    const totalProfit = tradeHistory.reduce((acc, t) => acc + toNum(t.profit, 0), 0);
    const totalInvested = tradeHistory.reduce((acc, t) => acc + toNum(t.amount, 0), 0);

    const winRate = completed.length > 0 ? ((won / completed.length) * 100).toFixed(1) : '0.0';

    return {
      totalTrades,
      wonTrades: won,
      lostTrades: lost,
      totalProfit,
      totalInvested,
      winRate,
    };
  }, [tradeHistory, totalTrades]);

  const exportToCSV = () => {
    const headers = ['Date', 'Symbol', 'Market', 'Side', 'Amount', 'Entry', 'Exit', 'Duration', 'Status', 'P&L'];

    const rows = tradeHistory.map((t) => [
      t.date,
      t.asset,
      marketLabel(t.type),
      t.direction === 'up' ? 'Buy/Long' : 'Sell/Short',
      t.amount,
      t.entryPrice,
      t.exitPrice ?? '',
      t.duration,
      t.status,
      t.profit,
    ]);

    const csvContent =
      [headers, ...rows]
        .map((row) => row.map(csvEscape).join(','))
        .join('\n') + '\n';

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalTrades / pageSize);

  const statusTabs: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'won', label: 'Won' },
    { id: 'lost', label: 'Lost' },
    { id: 'open', label: 'Open' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  const marketTabs: { id: AssetFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'forex', label: 'FX' },
    { id: 'stocks', label: 'Stocks' },
    { id: 'commodity', label: 'Commodity' },
    { id: 'index', label: 'Index' },
  ];

  if (!isSupabaseConfigured()) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
          <p className="text-cream font-medium">Supabase not configured</p>
          <p className="text-sm text-slate-400 mt-1">Add your Supabase env keys to load trade history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-cream">Trade History</h1>
          <p className="text-slate-400 mt-1">All markets — Crypto, FX, Stocks, Commodities & Indices</p>
          <p className="text-xs text-slate-500 mt-2">
            Stats shown for the current page (use Export for full history).
          </p>
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
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-gold" />
            </div>
          </div>
          <p className="text-xs text-slate-500">Trades (filtered)</p>
          <p className="text-2xl font-bold text-cream">{loading ? '-' : stats.totalTrades}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-profit/10 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-profit" />
            </div>
          </div>
          <p className="text-xs text-slate-500">Win Rate (page)</p>
          <p className="text-2xl font-bold text-profit">{loading ? '-' : `${stats.winRate}%`}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-electric/10 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-electric" />
            </div>
          </div>
          <p className="text-xs text-slate-500">Invested (page)</p>
          <p className="text-2xl font-bold text-cream">{loading ? '-' : `$${stats.totalInvested.toLocaleString()}`}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.totalProfit >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
              {stats.totalProfit >= 0 ? <TrendingUp className="w-5 h-5 text-profit" /> : <TrendingDown className="w-5 h-5 text-loss" />}
            </div>
          </div>
          <p className="text-xs text-slate-500">P&L (page)</p>
          <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
            {loading ? '-' : `${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toLocaleString()}`}
          </p>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search symbols across all markets…"
            className="w-full pl-12 pr-4 py-3 bg-white/5 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
        </div>

        {/* Tabs row */}
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Status tabs */}
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setStatusFilter(t.id);
                  setPage(1);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  statusFilter === t.id ? 'bg-gold text-void' : 'bg-white/5 text-slate-400 hover:text-cream'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Market tabs (works on mobile too) */}
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            {marketTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setAssetFilter(t.id);
                  setPage(1);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  assetFilter === t.id ? 'bg-gold text-void' : 'bg-white/5 text-slate-400 hover:text-cream'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trade List */}
      <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
        {/* Table Header */}
        <div className="hidden lg:grid grid-cols-9 gap-4 p-4 border-b border-white/5 text-xs text-slate-500 uppercase">
          <div>Symbol</div>
          <div>Market</div>
          <div>Side</div>
          <div>Amount</div>
          <div>Entry</div>
          <div>Exit</div>
          <div>Duration</div>
          <div>Result</div>
          <div>Time</div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-gold mx-auto mb-4 animate-spin" />
            <p className="text-slate-400">Loading trade history...</p>
          </div>
        )}

        {/* Rows */}
        {!loading && (
          <div className="divide-y divide-white/5">
            {tradeHistory.map((trade, index) => {
              const sideLabel = trade.direction === 'up' ? 'Buy/Long' : 'Sell/Short';
              const pnlLabel =
                trade.status === 'pending'
                  ? 'Open'
                  : trade.status === 'cancelled'
                  ? 'Cancelled'
                  : `${trade.profit >= 0 ? '+' : ''}$${trade.profit.toFixed(2)}`;

              return (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(0.2, index * 0.015) }}
                  className="p-4 hover:bg-white/5 transition-all"
                >
                  {/* Mobile */}
                  <div className="lg:hidden space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${trade.direction === 'up' ? 'bg-profit/10' : 'bg-loss/10'}`}>
                          {trade.direction === 'up' ? (
                            <TrendingUp className="w-5 h-5 text-profit" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-loss" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-cream truncate">{trade.asset}</span>

                            <span className={`text-xs px-2 py-0.5 rounded-lg border ${marketPillClass(trade.type)}`}>
                              {marketLabel(trade.type)}
                            </span>

                            <span className={`text-xs px-2 py-0.5 rounded-lg border ${statusPillClass(trade.status)}`}>
                              {trade.status === 'pending' ? 'Open' : trade.status}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                            <span>{sideLabel}</span>
                            <span className="text-slate-600">•</span>
                            <span>${trade.amount.toLocaleString()}</span>
                            <span className="text-slate-600">•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {trade.duration}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={`font-semibold ${trade.status === 'pending' ? 'text-yellow-400' : trade.profit >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {pnlLabel}
                        </p>
                        <p className="text-xs text-slate-500">{trade.date}</p>
                      </div>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div className="hidden lg:grid grid-cols-9 gap-4 items-center">
                    {/* Symbol */}
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${trade.direction === 'up' ? 'bg-profit/10' : 'bg-loss/10'}`}>
                        {trade.direction === 'up' ? (
                          <TrendingUp className="w-4 h-4 text-profit" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-loss" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-cream">{trade.asset}</p>
                        <p className="text-xs text-slate-500">{trade.entryPrice ? `Entry: ${formatPrice(trade.entryPrice)}` : ''}</p>
                      </div>
                    </div>

                    {/* Market */}
                    <div>
                      <span className={`inline-flex items-center text-xs px-2 py-1 rounded-lg border ${marketPillClass(trade.type)}`}>
                        {marketLabel(trade.type)}
                      </span>
                    </div>

                    {/* Side */}
                    <div className="text-sm text-cream">{sideLabel}</div>

                    {/* Amount */}
                    <div className="text-sm text-cream">${trade.amount.toLocaleString()}</div>

                    {/* Entry */}
                    <div className="text-sm font-mono text-cream">{formatPrice(trade.entryPrice)}</div>

                    {/* Exit */}
                    <div className="text-sm font-mono text-cream">{trade.exitPrice != null ? formatPrice(trade.exitPrice) : '-'}</div>

                    {/* Duration */}
                    <div className="flex items-center gap-1 text-sm text-slate-400">
                      <Clock className="w-3 h-3" />
                      {trade.duration}
                    </div>

                    {/* Result */}
                    <div className="flex items-center gap-2">
                      {trade.status === 'won' ? (
                        <CheckCircle className="w-4 h-4 text-profit" />
                      ) : trade.status === 'lost' ? (
                        <XCircle className="w-4 h-4 text-loss" />
                      ) : trade.status === 'cancelled' ? (
                        <XCircle className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-500" />
                      )}

                      <span className={`text-sm font-semibold ${
                        trade.status === 'pending'
                          ? 'text-yellow-500'
                          : trade.status === 'cancelled'
                          ? 'text-slate-500'
                          : trade.profit >= 0
                          ? 'text-profit'
                          : 'text-loss'
                      }`}>
                        {pnlLabel}
                      </span>

                      <span className={`ml-2 inline-flex items-center text-xs px-2 py-1 rounded-lg border ${statusPillClass(trade.status)}`}>
                        {trade.status === 'pending' ? 'Open' : trade.status}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="text-xs text-slate-500">{trade.date}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Empty */}
        {!loading && tradeHistory.length === 0 && (
          <div className="p-12 text-center">
            <History className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-cream font-medium">No trades found</p>
            <p className="text-sm text-slate-500 mt-1">Try changing filters or search a different symbol.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} • Showing {tradeHistory.length} of {totalTrades} trades
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-white/5 rounded-lg text-slate-400 hover:text-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (page <= 3) pageNum = i + 1;
              else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = page - 2 + i;

              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    page === pageNum ? 'bg-gold text-void' : 'bg-white/5 text-slate-400 hover:text-cream'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

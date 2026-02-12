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

type FilterType = 'all' | 'won' | 'lost' | 'open' | 'cancelled';
type MarketFilter = 'all' | 'crypto' | 'fx' | 'stocks';
type TradeType = 'crypto' | 'forex' | 'stock' | 'other';
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

/* -------- utils -------- */

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
    case 'crypto': return 'Crypto';
    case 'forex': return 'FX';
    case 'stock': return 'Stocks';
    default: return 'Other';
  }
}

function marketPillClass(t: TradeType) {
  switch (t) {
    case 'crypto': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'forex': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'stock': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}

function statusPillClass(s: TradeStatus) {
  switch (s) {
    case 'won': return 'bg-profit/10 text-profit border-profit/20';
    case 'lost': return 'bg-loss/10 text-loss border-loss/20';
    case 'cancelled': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    default: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  }
}

function formatPrice(v: number) {
  if (!Number.isFinite(v)) return '-';
  return v.toFixed(v < 10 ? 4 : 2);
}

function normalizeDirection(raw: any): 'up' | 'down' {
  const v = String(raw ?? '').toLowerCase().trim();
  if (['down', 'sell', 'short'].includes(v)) return 'down';
  return 'up';
}

function normalizeMarketType(t: any): TradeType {
  const mt = String(t.market_type ?? '').toLowerCase();
  if (mt === 'crypto') return 'crypto';
  if (mt === 'fx') return 'forex';
  if (mt === 'stocks') return 'stock';
  const at = String(t.asset_type ?? '').toLowerCase();
  if (at === 'crypto') return 'crypto';
  if (at === 'forex' || at === 'fx') return 'forex';
  if (at === 'stock' || at === 'stocks') return 'stock';
  return 'other';
}

function computeStatus(raw: string, profit: number): TradeStatus {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'won') return 'won';
  if (s === 'lost') return 'lost';
  if (s === 'cancelled' || s === 'expired') return 'cancelled';
  if (['open', 'pending', 'active'].includes(s)) return 'pending';
  if (s === 'closed') return profit >= 0 ? 'won' : 'lost';
  return 'pending';
}

function mapRawTrade(t: any): Trade {
  const type = normalizeMarketType(t);
  const direction = normalizeDirection(t.direction ?? t.type);
  const amount = toNum(t.amount, 0);
  const entry = toNum(t.entry_price, 0);
  const exit = t.exit_price == null ? null : toNum(t.exit_price, 0);
  let profit = toNum(t.profit_loss ?? t.pnl, 0);

  const tradeTypeRaw = String(t.trade_type ?? '').toLowerCase();
  const statusRaw = String(t.status ?? '').toLowerCase();
  const payoutPct = toNum(t.payout_percent, 85);

  if ((profit === 0 || !Number.isFinite(profit)) && tradeTypeRaw === 'binary') {
    if (statusRaw === 'won') profit = amount * (payoutPct / 100);
    else if (statusRaw === 'lost') profit = -amount;
  }

  if ((profit === 0 || !Number.isFinite(profit)) && statusRaw === 'closed' && exit != null && entry > 0) {
    const lev = Math.max(1, toNum(t.leverage, 1));
    const effectiveQty = t.quantity != null ? toNum(t.quantity, 0) : (entry > 0 ? amount / entry : 0);
    const diff = exit - entry;
    const signed = direction === 'down' ? -diff : diff;
    profit = signed * effectiveQty * lev;
  }

  const displayStatus = computeStatus(statusRaw, profit);

  const durationSeconds = toNum(t.duration_seconds, 0);
  let duration = '-';
  if (['open', 'pending', 'active'].includes(statusRaw)) duration = 'Open';
  else if (durationSeconds > 0) {
    if (durationSeconds < 60) duration = `${durationSeconds}s`;
    else if (durationSeconds < 3600) duration = `${Math.floor(durationSeconds / 60)}m`;
    else duration = `${Math.floor(durationSeconds / 3600)}h`;
  } else if (t.opened_at && t.closed_at) {
    const diffMins = Math.max(0, Math.floor((new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime()) / 60000));
    if (diffMins < 60) duration = `${diffMins}m`;
    else if (diffMins < 1440) duration = `${Math.floor(diffMins / 60)}h`;
    else duration = `${Math.floor(diffMins / 1440)}d`;
  }

  const createdIso = t.opened_at || t.created_at || null;

  return {
    id: String(t.id),
    asset: String(t.symbol ?? t.pair ?? 'Unknown'),
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
}

/* ============================== COMPONENT ============================== */

export default function TradeHistoryPage() {
  const { user } = useStore();

  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [totalTrades, setTotalTrades] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchTradeHistory = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setError('Please sign in to view your trades.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        userId: user.id,
        page: String(page),
        pageSize: String(pageSize),
      });

      if (marketFilter !== 'all') params.set('market', marketFilter);
      if (debouncedQuery) params.set('search', debouncedQuery);

      // Map status filter for API
      if (statusFilter === 'open') params.set('status', 'open');
      else if (statusFilter === 'won') params.set('status', 'won');
      else if (statusFilter === 'lost') params.set('status', 'lost');
      else if (statusFilter === 'cancelled') params.set('status', 'cancelled');

      const res = await fetch(`/api/user/trades?${params.toString()}`, {
        headers: { 'x-user-id': user.id },
        cache: 'no-store',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed`);
      }

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load trades');
      }

      const mapped: Trade[] = (data.trades || []).map(mapRawTrade);

      // Client-side won/lost filter for "closed" trades that map to won/lost
      let filtered = mapped;
      if (statusFilter === 'won') filtered = mapped.filter(t => t.status === 'won');
      else if (statusFilter === 'lost') filtered = mapped.filter(t => t.status === 'lost');

      setTradeHistory(filtered);
      setTotalTrades(data.total || 0);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
        setError('Connection error. Please check your internet and try again.');
      } else if (msg.includes('sign in') || msg.includes('auth') || msg.includes('401')) {
        setError('Please sign in to view your trades.');
      } else {
        setError('Something went wrong loading your trades. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter, marketFilter, debouncedQuery, page, pageSize]);

  useEffect(() => {
    fetchTradeHistory();
  }, [fetchTradeHistory]);

  /* -------- stats -------- */
  const stats = useMemo(() => {
    const completed = tradeHistory.filter(t => t.status === 'won' || t.status === 'lost');
    const won = completed.filter(t => t.status === 'won').length;
    const totalProfit = tradeHistory.reduce((acc, t) => acc + toNum(t.profit, 0), 0);
    const totalInvested = tradeHistory.reduce((acc, t) => acc + toNum(t.amount, 0), 0);
    const winRate = completed.length > 0 ? ((won / completed.length) * 100).toFixed(1) : '0.0';
    return { pageTrades: tradeHistory.length, totalTradesDb: totalTrades, wonTrades: won, lostTrades: completed.length - won, totalProfit, totalInvested, winRate };
  }, [tradeHistory, totalTrades]);

  const exportToCSV = () => {
    const headers = ['Date', 'Symbol', 'Market', 'Side', 'Amount', 'Entry', 'Exit', 'Duration', 'Status', 'P&L'];
    const rows = tradeHistory.map(t => [t.date, t.asset, marketLabel(t.type), t.direction === 'up' ? 'Buy/Long' : 'Sell/Short', t.amount, t.entryPrice, t.exitPrice ?? '', t.duration, t.status, t.profit]);
    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
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
  const marketTabs: { id: MarketFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'fx', label: 'FX' },
    { id: 'stocks', label: 'Stocks' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-cream">Trade History</h1>
          <p className="text-slate-400 mt-1">All markets — Crypto, FX, Stocks</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTradeHistory} className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-slate-400 hover:text-cream transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={exportToCSV} disabled={tradeHistory.length === 0} className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-slate-400 hover:text-cream transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-loss/10 border border-loss/20 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-loss flex-shrink-0" />
          <div className="flex-1">
            <p className="text-loss font-medium text-sm">{error}</p>
          </div>
          <button onClick={fetchTradeHistory} className="px-4 py-2 bg-loss/20 text-loss rounded-lg text-sm hover:bg-loss/30 transition-colors font-medium">
            Try Again
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center mb-2"><BarChart3 className="w-5 h-5 text-gold" /></div>
          <p className="text-xs text-slate-500">Total Trades</p>
          <p className="text-2xl font-bold text-cream">{loading ? '-' : stats.totalTradesDb}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="w-10 h-10 bg-profit/10 rounded-xl flex items-center justify-center mb-2"><Target className="w-5 h-5 text-profit" /></div>
          <p className="text-xs text-slate-500">Win Rate</p>
          <p className="text-2xl font-bold text-profit">{loading ? '-' : `${stats.winRate}%`}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="w-10 h-10 bg-electric/10 rounded-xl flex items-center justify-center mb-2"><DollarSign className="w-5 h-5 text-electric" /></div>
          <p className="text-xs text-slate-500">Invested</p>
          <p className="text-2xl font-bold text-cream">{loading ? '-' : `$${stats.totalInvested.toLocaleString()}`}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${stats.totalProfit >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
            {stats.totalProfit >= 0 ? <TrendingUp className="w-5 h-5 text-profit" /> : <TrendingDown className="w-5 h-5 text-loss" />}
          </div>
          <p className="text-xs text-slate-500">P&L</p>
          <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-profit' : 'text-loss'}`}>{loading ? '-' : `${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toLocaleString()}`}</p>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} placeholder="Search symbols…" className="w-full pl-12 pr-4 py-3 bg-white/5 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50" />
        </div>
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map(t => (
              <button key={t.id} onClick={() => { setStatusFilter(t.id); setPage(1); }} className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${statusFilter === t.id ? 'bg-gold text-void' : 'bg-white/5 text-slate-400 hover:text-cream'}`}>{t.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            {marketTabs.map(t => (
              <button key={t.id} onClick={() => { setMarketFilter(t.id); setPage(1); }} className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${marketFilter === t.id ? 'bg-gold text-void' : 'bg-white/5 text-slate-400 hover:text-cream'}`}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Trade List */}
      <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
        <div className="hidden lg:grid grid-cols-9 gap-4 p-4 border-b border-white/5 text-xs text-slate-500 uppercase">
          <div>Symbol</div><div>Market</div><div>Side</div><div>Amount</div><div>Entry</div><div>Exit</div><div>Duration</div><div>Result</div><div>Time</div>
        </div>

        {loading && (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-gold mx-auto mb-4 animate-spin" />
            <p className="text-slate-400">Loading trade history...</p>
          </div>
        )}

        {!loading && (
          <div className="divide-y divide-white/5">
            {tradeHistory.map((trade, index) => {
              const sideLabel = trade.direction === 'up' ? 'Buy/Long' : 'Sell/Short';
              const pnlLabel = trade.status === 'pending' ? 'Open' : trade.status === 'cancelled' ? 'Cancelled' : `${trade.profit >= 0 ? '+' : ''}$${trade.profit.toFixed(2)}`;

              return (
                <motion.div key={trade.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(0.2, index * 0.015) }} className="p-4 hover:bg-white/5 transition-all">
                  {/* Mobile */}
                  <div className="lg:hidden space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${trade.direction === 'up' ? 'bg-profit/10' : 'bg-loss/10'}`}>
                          {trade.direction === 'up' ? <TrendingUp className="w-5 h-5 text-profit" /> : <TrendingDown className="w-5 h-5 text-loss" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-cream truncate">{trade.asset}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-lg border ${marketPillClass(trade.type)}`}>{marketLabel(trade.type)}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-lg border ${statusPillClass(trade.status)}`}>{trade.status === 'pending' ? 'Open' : trade.status}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                            <span>{sideLabel}</span><span className="text-slate-600">•</span><span>${trade.amount.toLocaleString()}</span><span className="text-slate-600">•</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{trade.duration}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${trade.status === 'pending' ? 'text-yellow-400' : trade.profit >= 0 ? 'text-profit' : 'text-loss'}`}>{pnlLabel}</p>
                        <p className="text-xs text-slate-500">{trade.date}</p>
                      </div>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div className="hidden lg:grid grid-cols-9 gap-4 items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${trade.direction === 'up' ? 'bg-profit/10' : 'bg-loss/10'}`}>
                        {trade.direction === 'up' ? <TrendingUp className="w-4 h-4 text-profit" /> : <TrendingDown className="w-4 h-4 text-loss" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-cream">{trade.asset}</p>
                        <p className="text-xs text-slate-500">{trade.entryPrice ? `Entry: ${formatPrice(trade.entryPrice)}` : ''}</p>
                      </div>
                    </div>
                    <div><span className={`inline-flex items-center text-xs px-2 py-1 rounded-lg border ${marketPillClass(trade.type)}`}>{marketLabel(trade.type)}</span></div>
                    <div className="text-sm text-cream">{sideLabel}</div>
                    <div className="text-sm text-cream">${trade.amount.toLocaleString()}</div>
                    <div className="text-sm font-mono text-cream">{formatPrice(trade.entryPrice)}</div>
                    <div className="text-sm font-mono text-cream">{trade.exitPrice != null ? formatPrice(trade.exitPrice) : '-'}</div>
                    <div className="flex items-center gap-1 text-sm text-slate-400"><Clock className="w-3 h-3" />{trade.duration}</div>
                    <div className="flex items-center gap-2">
                      {trade.status === 'won' ? <CheckCircle className="w-4 h-4 text-profit" /> : trade.status === 'lost' ? <XCircle className="w-4 h-4 text-loss" /> : trade.status === 'cancelled' ? <XCircle className="w-4 h-4 text-slate-500" /> : <Clock className="w-4 h-4 text-yellow-500" />}
                      <span className={`text-sm font-semibold ${trade.status === 'pending' ? 'text-yellow-500' : trade.status === 'cancelled' ? 'text-slate-500' : trade.profit >= 0 ? 'text-profit' : 'text-loss'}`}>{pnlLabel}</span>
                      <span className={`ml-2 inline-flex items-center text-xs px-2 py-1 rounded-lg border ${statusPillClass(trade.status)}`}>{trade.status === 'pending' ? 'Open' : trade.status}</span>
                    </div>
                    <div className="text-xs text-slate-500">{trade.date}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {!loading && tradeHistory.length === 0 && !error && (
          <div className="p-12 text-center">
            <History className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-cream font-medium">No trades found</p>
            <p className="text-sm text-slate-500 mt-1">Try changing filters or make your first trade.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {page} of {totalPages} • {totalTrades} total trades</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-white/5 rounded-lg text-slate-400 hover:text-cream disabled:opacity-50">Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 bg-white/5 rounded-lg text-slate-400 hover:text-cream disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

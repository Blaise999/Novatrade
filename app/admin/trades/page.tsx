// app/admin/trades/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Download,
  RefreshCw,
  X,
  Eye,
  XCircle,
  AlertTriangle,
  DollarSign,
  Target,
  CheckCircle,
  AlertCircle,
  User,
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';
import { adminService, type Trade, type User as UserType } from '@/lib/services/admin-service';

type AnyTrade = Trade & Record<string, any>;

function getAdminToken(): string | null {
  try {
    const s = sessionStorage.getItem('novatrade_admin_token');
    if (s) return s;
    const l = localStorage.getItem('novatrade_admin_token');
    if (l) return l;
  } catch {}
  return null;
}

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeMarket(v: any): string {
  const s = String(v ?? '').toLowerCase();
  if (s === 'fx' || s === 'forex') return 'forex';
  if (s === 'stock' || s === 'stocks') return 'stocks';
  if (s === 'crypto') return 'crypto';
  if (s === 'commodities' || s === 'commodity') return 'commodities';
  return s || '';
}

function getPair(t: AnyTrade) {
  return String(t.pair ?? t.symbol ?? 'Unknown');
}

function getSide(t: AnyTrade) {
  return String(t.side ?? t.direction ?? t.type ?? '').toLowerCase();
}

function getPnL(t: AnyTrade) {
  return toNum(t.pnl ?? t.profit_loss ?? 0, 0);
}

function getAmount(t: AnyTrade) {
  return toNum(t.amount ?? 0, 0);
}

function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatPrice(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
}

export default function AdminTradesPage() {
  const { admin, isAuthenticated } = useAdminAuthStore();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [closePrice, setClosePrice] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ✅ User drawer (click user -> view trade history)
  const [showUserDrawer, setShowUserDrawer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; email?: string } | null>(null);
  const [userTrades, setUserTrades] = useState<AnyTrade[]>([]);
  const [userTradesLoading, setUserTradesLoading] = useState(false);
  const [userTradesSearch, setUserTradesSearch] = useState('');
  const [userTradesStatus, setUserTradesStatus] = useState('');

  useEffect(() => {
    if (admin?.id) adminService.setAdminId(admin.id);
    loadTrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.id]);

  const loadTrades = async () => {
    setLoading(true);
    try {
      const { data, error } = await adminService.getAllTrades({ limit: 200 });
      if (data) setTrades(data);
      if (error) console.error('Failed to load trades:', error);
    } catch (error) {
      console.error('Failed to load trades:', error);
    }
    setLoading(false);
  };

  const loadUserTrades = useCallback(async (userId: string) => {
    setUserTradesLoading(true);
    try {
      // ✅ Best: server route using service role
      const token = getAdminToken();
      const qs = new URLSearchParams();
      qs.set('user_id', userId);
      qs.set('page', '1');
      qs.set('pageSize', '200');

      const res = await fetch(`/api/admin/trades?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: 'no-store',
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load user trades');

      setUserTrades(Array.isArray(json?.data) ? (json.data as AnyTrade[]) : []);
    } catch (e) {
      // fallback (in case you haven’t added /api/admin/trades yet)
      try {
        const { data } = await adminService.getAllTrades({ user_id: userId, limit: 200 });
        setUserTrades((data as AnyTrade[]) || []);
      } catch (err) {
        console.error(err);
        setUserTrades([]);
      }
    } finally {
      setUserTradesLoading(false);
    }
  }, []);

  const filteredTrades = useMemo(() => {
    return (trades as AnyTrade[]).filter((trade) => {
      const status = String(trade.status ?? '').toLowerCase();
      const marketNorm = normalizeMarket(trade.market_type);
      const source = String(trade.source ?? '').toLowerCase();

      if (statusFilter && status !== statusFilter.toLowerCase()) return false;
      if (marketFilter && marketNorm !== marketFilter.toLowerCase()) return false;
      if (sourceFilter && source !== sourceFilter.toLowerCase()) return false;

      if (searchQuery) {
        const user = trade.user as unknown as UserType;
        const q = searchQuery.toLowerCase();

        const pair = getPair(trade).toLowerCase();
        const id = String(trade.id ?? '').toLowerCase();
        const email = String(user?.email ?? '').toLowerCase();

        return pair.includes(q) || email.includes(q) || id.includes(q);
      }
      return true;
    });
  }, [trades, statusFilter, marketFilter, sourceFilter, searchQuery]);

  const openTrades = useMemo(() => {
    return filteredTrades.filter((t) => {
      const s = String((t as AnyTrade).status ?? '').toLowerCase();
      return s === 'open' || s === 'active';
    });
  }, [filteredTrades]);

  const closedTrades = useMemo(() => {
    return filteredTrades.filter((t) => {
      const s = String((t as AnyTrade).status ?? '').toLowerCase();
      return s === 'closed' || s === 'won' || s === 'lost' || s === 'cancelled' || s === 'liquidated';
    });
  }, [filteredTrades]);

  const totalPnL = useMemo(() => {
    return filteredTrades.reduce((sum, t) => sum + getPnL(t as AnyTrade), 0);
  }, [filteredTrades]);

  const totalVolume = useMemo(() => {
    return filteredTrades.reduce((sum, t) => sum + getAmount(t as AnyTrade), 0);
  }, [filteredTrades]);

  const openDetailModal = (trade: Trade) => {
    setSelectedTrade(trade);
    setShowDetailModal(true);
  };

  const openCloseModal = (trade: Trade) => {
    const any = trade as AnyTrade;
    setSelectedTrade(trade);
    setClosePrice(String(any.current_price ?? any.entry_price ?? ''));
    setShowCloseModal(true);
  };

  const handleForceClose = async () => {
    if (!selectedTrade || !closePrice || !closeReason) return;

    setProcessing(true);
    try {
      await adminService.forceCloseTrade(selectedTrade.id, parseFloat(closePrice), closeReason);
      setNotification({ type: 'success', message: 'Trade closed successfully' });
      setShowCloseModal(false);
      setSelectedTrade(null);
      setClosePrice('');
      setCloseReason('');
      loadTrades();
      if (selectedUser?.id) loadUserTrades(selectedUser.id);
    } catch (error) {
      setNotification({ type: 'error', message: (error as Error).message || 'Failed to close trade' });
    }
    setProcessing(false);
  };

  const handleCancelTrade = async (trade: Trade) => {
    if (!confirm('Are you sure you want to cancel this pending order?')) return;

    try {
      await adminService.cancelTrade(trade.id, 'Cancelled by admin');
      setNotification({ type: 'success', message: 'Order cancelled successfully' });
      loadTrades();
      if (selectedUser?.id) loadUserTrades(selectedUser.id);
    } catch (error) {
      setNotification({ type: 'error', message: (error as Error).message || 'Failed to cancel order' });
    }
  };

  const openUserDrawer = async (trade: AnyTrade) => {
    const user = trade.user as unknown as UserType | undefined;
    const userId = String(trade.user_id || user?.id || '');
    if (!userId) return;

    setSelectedUser({ id: userId, email: user?.email });
    setUserTradesSearch('');
    setUserTradesStatus('');
    setShowUserDrawer(true);
    await loadUserTrades(userId);
  };

  const filteredUserTrades = useMemo(() => {
    const q = userTradesSearch.trim().toLowerCase();
    const sFilter = userTradesStatus.trim().toLowerCase();

    return userTrades.filter((t) => {
      const status = String(t.status ?? '').toLowerCase();
      if (sFilter && status !== sFilter) return false;

      if (!q) return true;
      const pair = getPair(t).toLowerCase();
      const id = String(t.id ?? '').toLowerCase();
      return pair.includes(q) || id.includes(q);
    });
  }, [userTrades, userTradesSearch, userTradesStatus]);

  const userStats = useMemo(() => {
    const pnl = filteredUserTrades.reduce((sum, t) => sum + getPnL(t), 0);
    const vol = filteredUserTrades.reduce((sum, t) => sum + getAmount(t), 0);
    const openCount = filteredUserTrades.filter((t) => {
      const s = String(t.status ?? '').toLowerCase();
      return s === 'open' || s === 'active';
    }).length;
    return { pnl, vol, openCount, total: filteredUserTrades.length };
  }, [filteredUserTrades]);

  const exportUserCSV = () => {
    const rows = filteredUserTrades.map((t) => {
      const createdAt = t.created_at ? new Date(t.created_at).toISOString() : '';
      return [
        createdAt,
        getPair(t),
        String(t.market_type ?? ''),
        String(t.status ?? ''),
        String(t.side ?? t.direction ?? ''),
        String(t.entry_price ?? ''),
        String(t.exit_price ?? t.current_price ?? ''),
        String(t.amount ?? ''),
        String(getPnL(t)),
      ].join(',');
    });

    const header = 'created_at,pair,market_type,status,side,entry,exit_or_current,amount,pnl\n';
    const blob = new Blob([header + rows.join('\n') + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-trades-${selectedUser?.id || 'user'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated || !admin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Please log in to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-xl flex items-center gap-3 ${
              notification.type === 'success' ? 'bg-profit/20 border border-profit/30' : 'bg-loss/20 border border-loss/30'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-profit" />
            ) : (
              <AlertCircle className="w-5 h-5 text-loss" />
            )}
            <span className={notification.type === 'success' ? 'text-profit' : 'text-loss'}>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cream">Trade Management</h1>
          <p className="text-slate-400 mt-1">View and manage all trades and orders</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadTrades}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-all">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-electric/20 to-electric/5 rounded-xl border border-electric/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-electric/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-electric" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Open Trades</p>
              <p className="text-xl font-bold text-cream">{openTrades.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-slate-500/20 to-slate-500/5 rounded-xl border border-slate-500/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Closed Trades</p>
              <p className="text-xl font-bold text-cream">{closedTrades.length}</p>
            </div>
          </div>
        </div>
        <div
          className={`bg-gradient-to-br ${
            totalPnL >= 0 ? 'from-profit/20 to-profit/5 border-profit/20' : 'from-loss/20 to-loss/5 border-loss/20'
          } rounded-xl border p-4`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${totalPnL >= 0 ? 'bg-profit/20' : 'bg-loss/20'}`}>
              <DollarSign className={`w-5 h-5 ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total P&L</p>
              <p className={`text-xl font-bold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                {totalPnL >= 0 ? '+' : ''}
                {formatMoney(Math.abs(totalPnL))}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-gold/20 to-gold/5 rounded-xl border border-gold/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/20 rounded-lg">
              <Target className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Volume</p>
              <p className="text-xl font-bold text-cream">
                {`$${totalVolume.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by pair/symbol, user, or trade ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
          <option value="liquidated">Liquidated</option>
        </select>

        <select
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
        >
          <option value="">All Markets</option>
          <option value="crypto">Crypto</option>
          <option value="forex">Forex</option>
          <option value="stocks">Stocks</option>
          <option value="commodities">Commodities</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
        >
          <option value="">All Sources</option>
          <option value="live">Live Trading</option>
          <option value="edu">Educational</option>
        </select>
      </div>

      {/* Trades Table */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-white/5">
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">User</th>
                <th className="text-left p-4">Pair</th>
                <th className="text-center p-4">Side</th>
                <th className="text-right p-4">Amount</th>
                <th className="text-right p-4">Entry</th>
                <th className="text-right p-4">Current/Exit</th>
                <th className="text-right p-4">P&L</th>
                <th className="text-center p-4">Status</th>
                <th className="text-center p-4">Source</th>
                <th className="text-center p-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading trades...
                  </td>
                </tr>
              ) : filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    No trades found
                  </td>
                </tr>
              ) : (
                filteredTrades.map((tradeRaw) => {
                  const trade = tradeRaw as AnyTrade;
                  const user = trade.user as unknown as UserType;

                  const pair = getPair(trade);
                  const side = getSide(trade);
                  const amount = getAmount(trade);
                  const pnl = getPnL(trade);

                  const entry = toNum(trade.entry_price, 0);
                  const currentOrExit = toNum(trade.exit_price ?? trade.current_price ?? trade.entry_price, 0);

                  const isLong = ['long', 'buy', 'up'].includes(side);
                  const isProfitable = pnl > 0;

                  return (
                    <tr key={trade.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <div className="text-sm">
                          <p className="text-cream">{new Date(trade.created_at).toLocaleDateString()}</p>
                          <p className="text-slate-500">{new Date(trade.created_at).toLocaleTimeString()}</p>
                        </div>
                      </td>

                      {/* ✅ Click email -> open drawer */}
                      <td className="p-4">
                        <button
                          onClick={() => openUserDrawer(trade)}
                          className="text-cream text-sm hover:text-electric inline-flex items-center gap-2"
                          title="View this user's trade history"
                        >
                          <User className="w-4 h-4 text-slate-500" />
                          <span className="underline-offset-4 hover:underline">
                            {user?.email || 'Unknown'}
                          </span>
                        </button>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-cream font-medium">{pair}</span>
                          {trade.leverage != null && (
                            <span className="text-xs text-slate-500 px-1.5 py-0.5 bg-white/5 rounded">
                              {toNum(trade.leverage, 1)}x
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            isLong ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                          }`}
                        >
                          {(trade.side ?? trade.direction ?? trade.type ?? '').toString().toUpperCase() || '—'}
                        </span>
                      </td>

                      <td className="p-4 text-right font-mono text-cream">{formatMoney(amount)}</td>

                      <td className="p-4 text-right font-mono text-slate-400">{formatPrice(entry)}</td>

                      <td className="p-4 text-right font-mono text-cream">{formatPrice(currentOrExit)}</td>

                      <td className="p-4 text-right">
                        <span className={`font-mono ${isProfitable ? 'text-profit' : pnl < 0 ? 'text-loss' : 'text-slate-400'}`}>
                          {pnl > 0 ? '+' : ''}
                          {pnl.toFixed(2)}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            trade.status === 'open' || trade.status === 'active'
                              ? 'bg-electric/20 text-electric'
                              : trade.status === 'closed' || trade.status === 'won' || trade.status === 'lost'
                              ? 'bg-slate-500/20 text-slate-400'
                              : trade.status === 'pending'
                              ? 'bg-gold/20 text-gold'
                              : trade.status === 'cancelled'
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-loss/20 text-loss'
                          }`}
                        >
                          {String(trade.status ?? '').toUpperCase()}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            String(trade.source ?? '').toLowerCase() === 'edu'
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-profit/20 text-profit'
                          }`}
                        >
                          {String(trade.source ?? '').toLowerCase() === 'edu' ? 'EDU' : 'LIVE'}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openDetailModal(trade)}
                            className="p-1.5 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-all"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {(trade.status === 'open' || trade.status === 'active') && (
                            <button
                              onClick={() => openCloseModal(trade)}
                              className="p-1.5 bg-loss/10 text-loss rounded-lg hover:bg-loss/20 transition-all"
                              title="Force Close"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          {trade.status === 'pending' && (
                            <button
                              onClick={() => handleCancelTrade(trade)}
                              className="p-1.5 bg-orange-500/10 text-orange-400 rounded-lg hover:bg-orange-500/20 transition-all"
                              title="Cancel Order"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ USER TRADE HISTORY DRAWER */}
      <AnimatePresence>
        {showUserDrawer && selectedUser?.id && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-void/70 backdrop-blur-sm"
            onClick={() => setShowUserDrawer(false)}
          >
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="absolute right-0 top-0 h-full w-full max-w-4xl bg-charcoal border-l border-white/10 p-5 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-cream font-semibold text-lg">User Trade History</h3>
                  <p className="text-slate-400 text-sm">{selectedUser.email || selectedUser.id}</p>
                </div>
                <button
                  onClick={() => setShowUserDrawer(false)}
                  className="p-2 bg-white/5 rounded-lg text-slate-300 hover:bg-white/10"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-white/5 rounded-xl border border-white/10 p-3">
                  <p className="text-xs text-slate-400">Trades</p>
                  <p className="text-xl font-bold text-cream">{userTradesLoading ? '—' : userStats.total}</p>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-3">
                  <p className="text-xs text-slate-400">Open</p>
                  <p className="text-xl font-bold text-cream">{userTradesLoading ? '—' : userStats.openCount}</p>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-3">
                  <p className="text-xs text-slate-400">Volume</p>
                  <p className="text-xl font-bold text-cream">{userTradesLoading ? '—' : formatMoney(userStats.vol)}</p>
                </div>
                <div
                  className={`bg-white/5 rounded-xl border border-white/10 p-3 ${
                    userStats.pnl >= 0 ? 'text-profit' : 'text-loss'
                  }`}
                >
                  <p className="text-xs text-slate-400">P&L</p>
                  <p className="text-xl font-bold">
                    {userTradesLoading ? '—' : `${userStats.pnl >= 0 ? '+' : ''}${userStats.pnl.toFixed(2)}`}
                  </p>
                </div>
              </div>

              {/* Drawer controls */}
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={userTradesSearch}
                    onChange={(e) => setUserTradesSearch(e.target.value)}
                    placeholder="Search by pair/symbol or trade ID..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
                  />
                </div>

                <select
                  value={userTradesStatus}
                  onChange={(e) => setUserTradesStatus(e.target.value)}
                  className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
                >
                  <option value="">All Status</option>
                  <option value="open">Open</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="liquidated">Liquidated</option>
                </select>

                <button
                  onClick={() => selectedUser?.id && loadUserTrades(selectedUser.id)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10"
                >
                  <RefreshCw className={`w-4 h-4 ${userTradesLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>

                <button
                  onClick={exportUserCSV}
                  disabled={filteredUserTrades.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
              </div>

              {/* Drawer table */}
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-white/5">
                        <th className="text-left p-4">Date</th>
                        <th className="text-left p-4">Pair</th>
                        <th className="text-center p-4">Side</th>
                        <th className="text-right p-4">Amount</th>
                        <th className="text-right p-4">Entry</th>
                        <th className="text-right p-4">Exit/Current</th>
                        <th className="text-right p-4">P&L</th>
                        <th className="text-center p-4">Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {userTradesLoading ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Loading user trades...
                          </td>
                        </tr>
                      ) : filteredUserTrades.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            No trades for this user
                          </td>
                        </tr>
                      ) : (
                        filteredUserTrades.map((t) => {
                          const pair = getPair(t);
                          const side = getSide(t);
                          const amount = getAmount(t);
                          const pnl = getPnL(t);
                          const entry = toNum(t.entry_price, 0);
                          const exitOrCur = toNum(t.exit_price ?? t.current_price ?? t.entry_price, 0);
                          const isLong = ['long', 'buy', 'up'].includes(side);

                          return (
                            <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="p-4 text-sm text-cream">
                                {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                              </td>
                              <td className="p-4 text-sm text-cream">{pair}</td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${isLong ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'}`}>
                                  {(t.side ?? t.direction ?? t.type ?? '').toString().toUpperCase() || '—'}
                                </span>
                              </td>
                              <td className="p-4 text-right font-mono text-cream">{formatMoney(amount)}</td>
                              <td className="p-4 text-right font-mono text-slate-300">{formatPrice(entry)}</td>
                              <td className="p-4 text-right font-mono text-cream">{formatPrice(exitOrCur)}</td>
                              <td className="p-4 text-right">
                                <span className={`font-mono ${pnl > 0 ? 'text-profit' : pnl < 0 ? 'text-loss' : 'text-slate-400'}`}>
                                  {pnl > 0 ? '+' : ''}
                                  {pnl.toFixed(2)}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <span className="px-2 py-1 rounded-lg text-xs font-medium bg-white/5 text-slate-300">
                                  {String(t.status ?? '').toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trade Detail Modal (unchanged except uses selectedTrade) */}
      <AnimatePresence>
        {showDetailModal && selectedTrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-charcoal rounded-2xl border border-white/10 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-cream">Trade Details</h3>
                <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {(() => {
                const t = selectedTrade as AnyTrade;
                const pnl = getPnL(t);
                const pair = getPair(t);
                const side = String(t.side ?? t.direction ?? '').toUpperCase() || '—';

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">Trade ID</p>
                        <p className="text-cream font-mono text-sm truncate">{t.id}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">Status</p>
                        <p className="text-cream capitalize">{String(t.status ?? '')}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">Pair</p>
                        <p className="text-cream">{pair}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">Side</p>
                        <p className={getSide(t) === 'long' ? 'text-profit' : 'text-loss'}>{side}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">Amount</p>
                        <p className="text-cream">{formatMoney(getAmount(t))}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">Leverage</p>
                        <p className="text-cream">{toNum(t.leverage, 1)}x</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">Entry Price</p>
                        <p className="text-cream">{formatPrice(toNum(t.entry_price, 0))}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">
                          {String(t.status ?? '').toLowerCase() === 'closed' ? 'Exit Price' : 'Current/Exit'}
                        </p>
                        <p className="text-cream">{formatPrice(toNum(t.exit_price ?? t.current_price ?? t.entry_price, 0))}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">P&L</p>
                        <p className={pnl >= 0 ? 'text-profit' : 'text-loss'}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">Source</p>
                        <p className={String(t.source ?? '').toLowerCase() === 'edu' ? 'text-purple-400' : 'text-profit'}>
                          {String(t.source ?? '').toLowerCase() === 'edu' ? 'Educational' : 'Live Trading'}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-xs text-slate-400">Opened At</p>
                      <p className="text-cream">{new Date(t.opened_at || t.created_at).toLocaleString()}</p>
                    </div>

                    {t.closed_at && (
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">Closed At</p>
                        <p className="text-cream">{new Date(t.closed_at).toLocaleString()}</p>
                      </div>
                    )}

                    {t.close_reason && (
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">Close Reason</p>
                        <p className="text-cream capitalize">{String(t.close_reason)}</p>
                      </div>
                    )}

                    <div className="mt-6">
                      <button
                        onClick={() => setShowDetailModal(false)}
                        className="w-full py-3 bg-white/5 text-slate-400 font-semibold rounded-xl hover:bg-white/10 transition-all"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Force Close Modal (unchanged logic) */}
      <AnimatePresence>
        {showCloseModal && selectedTrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-charcoal rounded-2xl border border-white/10 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-cream flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-loss" />
                  Force Close Trade
                </h3>
                <button onClick={() => setShowCloseModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-white/5 rounded-xl">
                  {(() => {
                    const t = selectedTrade as AnyTrade;
                    return (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-slate-400">Pair</p>
                          <p className="text-cream">{getPair(t)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Side</p>
                          <p className={getSide(t) === 'long' ? 'text-profit' : 'text-loss'}>
                            {(t.side ?? t.direction ?? '').toString().toUpperCase() || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Entry Price</p>
                          <p className="text-cream">{formatPrice(toNum(t.entry_price, 0))}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Amount</p>
                          <p className="text-cream">{formatMoney(getAmount(t))}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Exit Price *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="number"
                      value={closePrice}
                      onChange={(e) => setClosePrice(e.target.value)}
                      placeholder="0.00"
                      step="any"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Reason (Required for Audit) *</label>
                  <textarea
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    placeholder="Enter the reason for force closing..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold resize-none"
                  />
                </div>

                {closePrice && (
                  <div className="p-3 bg-loss/10 border border-loss/20 rounded-xl">
                    <p className="text-xs text-slate-400 mb-1">Estimated P&L</p>
                    <p className="text-sm text-cream">
                      {(() => {
                        const t = selectedTrade as AnyTrade;
                        const exitP = parseFloat(closePrice);
                        const entryP = toNum(t.entry_price, 0);
                        const isLong = getSide(t) === 'long';
                        const quantity = toNum(t.quantity ?? (getAmount(t) / Math.max(entryP, 1e-9)), 0);
                        const lev = Math.max(1, toNum(t.leverage, 1));
                        const pnl = isLong ? (exitP - entryP) * quantity * lev : (entryP - exitP) * quantity * lev;
                        return <span className={pnl >= 0 ? 'text-profit' : 'text-loss'}>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</span>;
                      })()}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCloseModal(false)}
                    className="flex-1 py-3 bg-white/5 text-slate-400 font-semibold rounded-xl hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleForceClose}
                    disabled={!closePrice || !closeReason || processing}
                    className="flex-1 py-3 bg-loss text-white font-semibold rounded-xl hover:bg-loss/90 transition-all disabled:opacity-50"
                  >
                    {processing ? 'Processing...' : 'Force Close'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

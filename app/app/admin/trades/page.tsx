'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Download,
  RefreshCw,
  X,
  Eye,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  DollarSign,
  Target,
  Shield,
  CheckCircle,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';
import { adminService, type Trade, type User as UserType } from '@/lib/services/admin-service';

export default function AdminTradesPage() {
  const { admin, isAuthenticated } = useAdminAuthStore();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  
  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [closePrice, setClosePrice] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (admin?.id) {
      adminService.setAdminId(admin.id);
    }
    loadTrades();
  }, [admin]);

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

  const filteredTrades = trades.filter(trade => {
    if (statusFilter && trade.status !== statusFilter) return false;
    if (marketFilter && trade.market_type !== marketFilter) return false;
    if (sourceFilter && trade.source !== sourceFilter) return false;
    if (searchQuery) {
      const user = trade.user as unknown as UserType;
      const searchLower = searchQuery.toLowerCase();
      return (
        trade.pair.toLowerCase().includes(searchLower) ||
        user?.email?.toLowerCase().includes(searchLower) ||
        trade.id.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const openTrades = filteredTrades.filter(t => t.status === 'open');
  const closedTrades = filteredTrades.filter(t => t.status === 'closed');
  const totalPnL = filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalVolume = filteredTrades.reduce((sum, t) => sum + (t.amount || 0), 0);

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
    } catch (error) {
      setNotification({ type: 'error', message: (error as Error).message || 'Failed to cancel order' });
    }
  };

  const openDetailModal = (trade: Trade) => {
    setSelectedTrade(trade);
    setShowDetailModal(true);
  };

  const openCloseModal = (trade: Trade) => {
    setSelectedTrade(trade);
    setClosePrice(trade.current_price?.toString() || trade.entry_price.toString());
    setShowCloseModal(true);
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
            <span className={notification.type === 'success' ? 'text-profit' : 'text-loss'}>
              {notification.message}
            </span>
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
        <div className={`bg-gradient-to-br ${totalPnL >= 0 ? 'from-profit/20 to-profit/5 border-profit/20' : 'from-loss/20 to-loss/5 border-loss/20'} rounded-xl border p-4`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${totalPnL >= 0 ? 'bg-profit/20' : 'bg-loss/20'}`}>
              <DollarSign className={`w-5 h-5 ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total P&L</p>
              <p className={`text-xl font-bold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
              <p className="text-xl font-bold text-cream">${totalVolume.toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
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
            placeholder="Search by pair, user, or trade ID..."
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
          <option value="closed">Closed</option>
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
                filteredTrades.map((trade) => {
                  const user = trade.user as unknown as UserType;
                  const isLong = trade.side === 'long';
                  const isProfitable = trade.pnl > 0;
                  return (
                    <tr key={trade.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <div className="text-sm">
                          <p className="text-cream">{new Date(trade.created_at).toLocaleDateString()}</p>
                          <p className="text-slate-500">{new Date(trade.created_at).toLocaleTimeString()}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-cream text-sm">{user?.email || 'Unknown'}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-cream font-medium">{trade.pair}</span>
                          <span className="text-xs text-slate-500 px-1.5 py-0.5 bg-white/5 rounded">
                            {trade.leverage}x
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          isLong ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                        }`}>
                          {trade.side?.toUpperCase() || trade.type?.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-cream">
                        ${trade.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-mono text-slate-400">
                        ${trade.entry_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                      </td>
                      <td className="p-4 text-right font-mono text-cream">
                        ${(trade.exit_price || trade.current_price || trade.entry_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                      </td>
                      <td className="p-4 text-right">
                        <span className={`font-mono ${isProfitable ? 'text-profit' : trade.pnl < 0 ? 'text-loss' : 'text-slate-400'}`}>
                          {trade.pnl > 0 ? '+' : ''}{trade.pnl?.toFixed(2) || '0.00'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          trade.status === 'open' ? 'bg-electric/20 text-electric' :
                          trade.status === 'closed' ? 'bg-slate-500/20 text-slate-400' :
                          trade.status === 'pending' ? 'bg-gold/20 text-gold' :
                          trade.status === 'cancelled' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-loss/20 text-loss'
                        }`}>
                          {trade.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          trade.source === 'edu' ? 'bg-purple-500/20 text-purple-400' : 'bg-profit/20 text-profit'
                        }`}>
                          {trade.source === 'edu' ? 'EDU' : 'LIVE'}
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
                          {trade.status === 'open' && (
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

      {/* Trade Detail Modal */}
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
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Trade ID</p>
                    <p className="text-cream font-mono text-sm truncate">{selectedTrade.id}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Status</p>
                    <p className="text-cream capitalize">{selectedTrade.status}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Pair</p>
                    <p className="text-cream">{selectedTrade.pair}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Side</p>
                    <p className={selectedTrade.side === 'long' ? 'text-profit' : 'text-loss'}>
                      {selectedTrade.side?.toUpperCase()}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Amount</p>
                    <p className="text-cream">${selectedTrade.amount.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Leverage</p>
                    <p className="text-cream">{selectedTrade.leverage}x</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Entry Price</p>
                    <p className="text-cream">${selectedTrade.entry_price}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">{selectedTrade.status === 'closed' ? 'Exit Price' : 'Current Price'}</p>
                    <p className="text-cream">${selectedTrade.exit_price || selectedTrade.current_price || selectedTrade.entry_price}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">P&L</p>
                    <p className={selectedTrade.pnl >= 0 ? 'text-profit' : 'text-loss'}>
                      {selectedTrade.pnl >= 0 ? '+' : ''}${selectedTrade.pnl?.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Source</p>
                    <p className={selectedTrade.source === 'edu' ? 'text-purple-400' : 'text-profit'}>
                      {selectedTrade.source === 'edu' ? 'Educational' : 'Live Trading'}
                    </p>
                  </div>
                </div>

                {selectedTrade.stop_loss && (
                  <div className="p-3 bg-loss/10 border border-loss/20 rounded-xl">
                    <p className="text-xs text-slate-400">Stop Loss</p>
                    <p className="text-loss">${selectedTrade.stop_loss}</p>
                  </div>
                )}
                {selectedTrade.take_profit && (
                  <div className="p-3 bg-profit/10 border border-profit/20 rounded-xl">
                    <p className="text-xs text-slate-400">Take Profit</p>
                    <p className="text-profit">${selectedTrade.take_profit}</p>
                  </div>
                )}

                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-xs text-slate-400">Opened At</p>
                  <p className="text-cream">{new Date(selectedTrade.opened_at || selectedTrade.created_at).toLocaleString()}</p>
                </div>
                {selectedTrade.closed_at && (
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Closed At</p>
                    <p className="text-cream">{new Date(selectedTrade.closed_at).toLocaleString()}</p>
                  </div>
                )}
                {selectedTrade.close_reason && (
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Close Reason</p>
                    <p className="text-cream capitalize">{selectedTrade.close_reason}</p>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="w-full py-3 bg-white/5 text-slate-400 font-semibold rounded-xl hover:bg-white/10 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Force Close Modal */}
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
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Trade Info */}
                <div className="p-3 bg-white/5 rounded-xl">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-slate-400">Pair</p>
                      <p className="text-cream">{selectedTrade.pair}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Side</p>
                      <p className={selectedTrade.side === 'long' ? 'text-profit' : 'text-loss'}>
                        {selectedTrade.side?.toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Entry Price</p>
                      <p className="text-cream">${selectedTrade.entry_price}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Amount</p>
                      <p className="text-cream">${selectedTrade.amount}</p>
                    </div>
                  </div>
                </div>

                {/* Exit Price */}
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

                {/* Reason */}
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

                {/* P&L Preview */}
                {closePrice && (
                  <div className="p-3 bg-loss/10 border border-loss/20 rounded-xl">
                    <p className="text-xs text-slate-400 mb-1">Estimated P&L</p>
                    <p className="text-sm text-cream">
                      {(() => {
                        const exitP = parseFloat(closePrice);
                        const entryP = selectedTrade.entry_price;
                        const isLong = selectedTrade.side === 'long';
                        const quantity = selectedTrade.quantity || selectedTrade.amount / entryP;
                        const pnl = isLong
                          ? (exitP - entryP) * quantity * selectedTrade.leverage
                          : (entryP - exitP) * quantity * selectedTrade.leverage;
                        return (
                          <span className={pnl >= 0 ? 'text-profit' : 'text-loss'}>
                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                          </span>
                        );
                      })()}
                    </p>
                  </div>
                )}

                {/* Actions */}
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

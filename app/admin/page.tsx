'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight,
  Search,
  Filter,
  Download,
  RefreshCw,
  X,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  User,
  DollarSign,
  Wallet,
  AlertCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';
import { adminService, type User as UserType } from '@/lib/services/admin-service';

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  method: string;
  wallet_address?: string;
  wallet_network?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';
  tx_hash?: string;
  processed_by?: string;
  processed_at?: string;
  admin_note?: string;
  rejection_reason?: string;
  created_at: string;
  user?: UserType;
}

// Mock withdrawals for demo
const MOCK_WITHDRAWALS: Withdrawal[] = [
  {
    id: 'wd-1',
    user_id: 'user-1',
    amount: 500,
    fee: 5,
    net_amount: 495,
    method: 'crypto',
    wallet_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    wallet_network: 'ERC-20',
    status: 'pending',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    user: { id: 'user-1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' } as UserType,
  },
  {
    id: 'wd-2',
    user_id: 'user-2',
    amount: 1000,
    fee: 10,
    net_amount: 990,
    method: 'crypto',
    wallet_address: 'TKsLPHbmE7CJPFJhMuJW9HxGfmZWHd2Uxj',
    wallet_network: 'TRC-20',
    status: 'pending',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    user: { id: 'user-2', email: 'jane@example.com', first_name: 'Jane', last_name: 'Smith' } as UserType,
  },
  {
    id: 'wd-3',
    user_id: 'user-3',
    amount: 2500,
    fee: 25,
    net_amount: 2475,
    method: 'bank',
    bank_name: 'Chase Bank',
    account_name: 'Alice Brown',
    account_number: '****4567',
    status: 'completed',
    tx_hash: '0x123abc...',
    processed_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    user: { id: 'user-3', email: 'alice@example.com', first_name: 'Alice', last_name: 'Brown' } as UserType,
  },
  {
    id: 'wd-4',
    user_id: 'user-4',
    amount: 300,
    fee: 3,
    net_amount: 297,
    method: 'crypto',
    wallet_address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    wallet_network: 'Bitcoin',
    status: 'rejected',
    rejection_reason: 'Insufficient verification',
    processed_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    user: { id: 'user-4', email: 'bob@example.com', first_name: 'Bob', last_name: 'Wilson' } as UserType,
  },
];

export default function AdminWithdrawalsPage() {
  const { admin, isAuthenticated } = useAdminAuthStore();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(MOCK_WITHDRAWALS);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  
  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [txHash, setTxHash] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (admin?.id) {
      adminService.setAdminId(admin.id);
    }
    loadWithdrawals();
  }, [admin]);

  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      const { data, error } = await adminService.getAllWithdrawals({ limit: 100 });
      if (data && data.length > 0) {
        setWithdrawals(data as Withdrawal[]);
      } else {
        setWithdrawals(MOCK_WITHDRAWALS);
      }
    } catch (error) {
      setWithdrawals(MOCK_WITHDRAWALS);
    }
    setLoading(false);
  };

  const filteredWithdrawals = withdrawals.filter(wd => {
    if (statusFilter && wd.status !== statusFilter) return false;
    if (methodFilter && wd.method !== methodFilter) return false;
    if (searchQuery) {
      const user = wd.user;
      const searchLower = searchQuery.toLowerCase();
      return (
        user?.email?.toLowerCase().includes(searchLower) ||
        wd.wallet_address?.toLowerCase().includes(searchLower) ||
        wd.id.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const pendingWithdrawals = filteredWithdrawals.filter(w => w.status === 'pending');
  const totalPendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const totalCompletedAmount = filteredWithdrawals
    .filter(w => w.status === 'completed')
    .reduce((sum, w) => sum + w.amount, 0);

  const handleApprove = async () => {
    if (!selectedWithdrawal) return;
    
    setProcessing(true);
    try {
      await adminService.approveWithdrawal(selectedWithdrawal.id, txHash || undefined, approveNote || undefined);
      setNotification({ type: 'success', message: 'Withdrawal approved successfully' });
      setShowApproveModal(false);
      setSelectedWithdrawal(null);
      setTxHash('');
      setApproveNote('');
      
      // Update locally for demo
      setWithdrawals(prev => prev.map(w => 
        w.id === selectedWithdrawal.id 
          ? { ...w, status: 'completed' as const, tx_hash: txHash, processed_at: new Date().toISOString() }
          : w
      ));
    } catch (error) {
      // Update locally anyway for demo
      setWithdrawals(prev => prev.map(w => 
        w.id === selectedWithdrawal.id 
          ? { ...w, status: 'completed' as const, tx_hash: txHash, processed_at: new Date().toISOString() }
          : w
      ));
      setNotification({ type: 'success', message: 'Withdrawal approved locally' });
      setShowApproveModal(false);
      setSelectedWithdrawal(null);
      setTxHash('');
      setApproveNote('');
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedWithdrawal || !rejectReason) return;
    
    setProcessing(true);
    try {
      await adminService.rejectWithdrawal(selectedWithdrawal.id, rejectReason);
      setNotification({ type: 'success', message: 'Withdrawal rejected' });
      setShowRejectModal(false);
      setSelectedWithdrawal(null);
      setRejectReason('');
      
      // Update locally for demo
      setWithdrawals(prev => prev.map(w => 
        w.id === selectedWithdrawal.id 
          ? { ...w, status: 'rejected' as const, rejection_reason: rejectReason, processed_at: new Date().toISOString() }
          : w
      ));
    } catch (error) {
      // Update locally anyway for demo
      setWithdrawals(prev => prev.map(w => 
        w.id === selectedWithdrawal.id 
          ? { ...w, status: 'rejected' as const, rejection_reason: rejectReason, processed_at: new Date().toISOString() }
          : w
      ));
      setNotification({ type: 'success', message: 'Withdrawal rejected locally' });
      setShowRejectModal(false);
      setSelectedWithdrawal(null);
      setRejectReason('');
    }
    setProcessing(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setNotification({ type: 'success', message: 'Copied to clipboard' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gold/20 text-gold';
      case 'processing': return 'bg-electric/20 text-electric';
      case 'completed': return 'bg-profit/20 text-profit';
      case 'rejected': return 'bg-loss/20 text-loss';
      case 'cancelled': return 'bg-slate-500/20 text-slate-400';
      default: return 'bg-white/10 text-slate-400';
    }
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
          <h1 className="text-2xl font-bold text-cream">Withdrawal Management</h1>
          <p className="text-slate-400 mt-1">Review and process withdrawal requests</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadWithdrawals}
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
        <div className="bg-gradient-to-br from-gold/20 to-gold/5 rounded-xl border border-gold/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/20 rounded-lg">
              <Clock className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Pending</p>
              <p className="text-xl font-bold text-cream">{pendingWithdrawals.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-loss/20 to-loss/5 rounded-xl border border-loss/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-loss/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-loss" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Pending Amount</p>
              <p className="text-xl font-bold text-cream">${totalPendingAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-profit/20 to-profit/5 rounded-xl border border-profit/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-profit/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-profit" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Completed</p>
              <p className="text-xl font-bold text-cream">
                {filteredWithdrawals.filter(w => w.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-electric/20 to-electric/5 rounded-xl border border-electric/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-electric/20 rounded-lg">
              <ArrowUpRight className="w-5 h-5 text-electric" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Processed</p>
              <p className="text-xl font-bold text-cream">${totalCompletedAmount.toLocaleString()}</p>
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
            placeholder="Search by email or wallet address..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
        >
          <option value="">All Methods</option>
          <option value="crypto">Crypto</option>
          <option value="bank">Bank Transfer</option>
        </select>
      </div>

      {/* Withdrawals Table */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-white/5">
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">User</th>
                <th className="text-left p-4">Method</th>
                <th className="text-left p-4">Destination</th>
                <th className="text-right p-4">Amount</th>
                <th className="text-right p-4">Fee</th>
                <th className="text-right p-4">Net</th>
                <th className="text-center p-4">Status</th>
                <th className="text-center p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading withdrawals...
                  </td>
                </tr>
              ) : filteredWithdrawals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No withdrawals found
                  </td>
                </tr>
              ) : (
                filteredWithdrawals.map((wd) => {
                  const user = wd.user;
                  return (
                    <tr key={wd.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <div className="text-sm">
                          <p className="text-cream">{new Date(wd.created_at).toLocaleDateString()}</p>
                          <p className="text-slate-500">{new Date(wd.created_at).toLocaleTimeString()}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-cream text-sm">{user?.email || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">{user?.first_name} {user?.last_name}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          wd.method === 'crypto' ? 'bg-orange-500/20 text-orange-400' : 'bg-electric/20 text-electric'
                        }`}>
                          {wd.method === 'crypto' ? 'Crypto' : 'Bank'}
                        </span>
                      </td>
                      <td className="p-4">
                        {wd.method === 'crypto' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-cream text-sm font-mono truncate max-w-[150px]">
                              {wd.wallet_address}
                            </span>
                            <button
                              onClick={() => copyToClipboard(wd.wallet_address || '')}
                              className="p-1 hover:bg-white/10 rounded"
                            >
                              <Copy className="w-3 h-3 text-slate-400" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-sm">
                            <p className="text-cream">{wd.bank_name}</p>
                            <p className="text-slate-500">{wd.account_number}</p>
                          </div>
                        )}
                        {wd.wallet_network && (
                          <p className="text-xs text-slate-500">{wd.wallet_network}</p>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono text-cream">
                        ${wd.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-mono text-slate-400">
                        ${wd.fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-mono text-cream">
                        ${wd.net_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(wd.status)}`}>
                          {wd.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedWithdrawal(wd);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-all"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {wd.status === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedWithdrawal(wd);
                                  setShowApproveModal(true);
                                }}
                                className="p-1.5 bg-profit/10 text-profit rounded-lg hover:bg-profit/20 transition-all"
                                title="Approve"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedWithdrawal(wd);
                                  setShowRejectModal(true);
                                }}
                                className="p-1.5 bg-loss/10 text-loss rounded-lg hover:bg-loss/20 transition-all"
                                title="Reject"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
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

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedWithdrawal && (
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
                <h3 className="text-xl font-semibold text-cream">Withdrawal Details</h3>
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
                    <p className="text-xs text-slate-400">ID</p>
                    <p className="text-cream font-mono text-sm truncate">{selectedWithdrawal.id}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Status</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(selectedWithdrawal.status)}`}>
                      {selectedWithdrawal.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Amount</p>
                    <p className="text-cream">${selectedWithdrawal.amount.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Net Amount</p>
                    <p className="text-cream">${selectedWithdrawal.net_amount.toLocaleString()}</p>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-xs text-slate-400">User</p>
                  <p className="text-cream">{selectedWithdrawal.user?.email}</p>
                </div>

                {selectedWithdrawal.method === 'crypto' ? (
                  <>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-xs text-slate-400">Wallet Address</p>
                      <div className="flex items-center gap-2">
                        <p className="text-cream font-mono text-sm break-all">{selectedWithdrawal.wallet_address}</p>
                        <button
                          onClick={() => copyToClipboard(selectedWithdrawal.wallet_address || '')}
                          className="p-1 hover:bg-white/10 rounded flex-shrink-0"
                        >
                          <Copy className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-xs text-slate-400">Network</p>
                      <p className="text-cream">{selectedWithdrawal.wallet_network}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-xs text-slate-400">Bank Name</p>
                      <p className="text-cream">{selectedWithdrawal.bank_name}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-xs text-slate-400">Account</p>
                      <p className="text-cream">{selectedWithdrawal.account_name} - {selectedWithdrawal.account_number}</p>
                    </div>
                  </>
                )}

                {selectedWithdrawal.tx_hash && (
                  <div className="p-3 bg-profit/10 border border-profit/20 rounded-xl">
                    <p className="text-xs text-profit">Transaction Hash</p>
                    <p className="text-cream font-mono text-sm break-all">{selectedWithdrawal.tx_hash}</p>
                  </div>
                )}

                {selectedWithdrawal.rejection_reason && (
                  <div className="p-3 bg-loss/10 border border-loss/20 rounded-xl">
                    <p className="text-xs text-loss">Rejection Reason</p>
                    <p className="text-cream">{selectedWithdrawal.rejection_reason}</p>
                  </div>
                )}

                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-xs text-slate-400">Requested At</p>
                  <p className="text-cream">{new Date(selectedWithdrawal.created_at).toLocaleString()}</p>
                </div>
                
                {selectedWithdrawal.processed_at && (
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Processed At</p>
                    <p className="text-cream">{new Date(selectedWithdrawal.processed_at).toLocaleString()}</p>
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

      {/* Approve Modal */}
      <AnimatePresence>
        {showApproveModal && selectedWithdrawal && (
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
                  <CheckCircle className="w-5 h-5 text-profit" />
                  Approve Withdrawal
                </h3>
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-sm text-slate-400">Amount: <span className="text-cream">${selectedWithdrawal.net_amount}</span></p>
                  <p className="text-sm text-slate-400 mt-1">To: <span className="text-cream font-mono text-xs">{selectedWithdrawal.wallet_address || selectedWithdrawal.account_number}</span></p>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Transaction Hash (optional)</label>
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Note (optional)</label>
                  <textarea
                    value={approveNote}
                    onChange={(e) => setApproveNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowApproveModal(false)}
                    className="flex-1 py-3 bg-white/5 text-slate-400 font-semibold rounded-xl hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex-1 py-3 bg-profit text-void font-semibold rounded-xl hover:bg-profit/90 transition-all disabled:opacity-50"
                  >
                    {processing ? 'Processing...' : 'Approve'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && selectedWithdrawal && (
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
                  <XCircle className="w-5 h-5 text-loss" />
                  Reject Withdrawal
                </h3>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-sm text-slate-400">Amount: <span className="text-cream">${selectedWithdrawal.amount}</span></p>
                  <p className="text-sm text-slate-400 mt-1">User: <span className="text-cream">{selectedWithdrawal.user?.email}</span></p>
                </div>

                <div className="p-3 bg-loss/10 border border-loss/20 rounded-xl">
                  <p className="text-xs text-loss">User's balance will be refunded</p>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Rejection Reason *</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter the reason for rejection..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowRejectModal(false)}
                    className="flex-1 py-3 bg-white/5 text-slate-400 font-semibold rounded-xl hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!rejectReason || processing}
                    className="flex-1 py-3 bg-loss text-white font-semibold rounded-xl hover:bg-loss/90 transition-all disabled:opacity-50"
                  >
                    {processing ? 'Processing...' : 'Reject'}
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

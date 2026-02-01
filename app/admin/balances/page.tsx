'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  Search,
  Plus,
  Minus,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Filter,
  Download,
  RefreshCw,
  User,
  Clock,
  FileText,
  ChevronDown,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';
import { adminService, type User as UserType, type Transaction } from '@/lib/services/admin-service';

export default function AdminBalancesPage() {
  const { admin, isAuthenticated } = useAdminAuthStore();
  const [users, setUsers] = useState<UserType[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'ledger'>('users');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [transactionType, setTransactionType] = useState('');
  
  // Modal states
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [adjustAction, setAdjustAction] = useState<'credit' | 'debit'>('credit');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (admin?.id) {
      adminService.setAdminId(admin.id);
    }
    loadData();
  }, [admin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, txRes] = await Promise.all([
        adminService.getAllUsers({ limit: 100 }),
        adminService.getAllTransactions({ limit: 100 }),
      ]);
      if (usersRes.data) setUsers(usersRes.data);
      if (txRes.data) setTransactions(txRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.first_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredTransactions = transactions.filter(tx => {
    if (transactionType && tx.type !== transactionType) return false;
    if (searchQuery) {
      const userEmail = (tx.user as unknown as UserType)?.email || '';
      return userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const handleAdjustBalance = async () => {
    if (!selectedUser || !adjustAmount || !adjustReason) return;
    
    setAdjusting(true);
    try {
      const amount = parseFloat(adjustAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
      }

      if (adjustAction === 'credit') {
        await adminService.creditBalance(selectedUser.id, amount, adjustReason);
      } else {
        await adminService.debitBalance(selectedUser.id, amount, adjustReason);
      }

      setNotification({ type: 'success', message: `Successfully ${adjustAction}ed $${amount.toFixed(2)} ${adjustAction === 'credit' ? 'to' : 'from'} user` });
      setShowAdjustModal(false);
      setSelectedUser(null);
      setAdjustAmount('');
      setAdjustReason('');
      loadData();
    } catch (error) {
      setNotification({ type: 'error', message: (error as Error).message || 'Failed to adjust balance' });
    }
    setAdjusting(false);
  };

  const openAdjustModal = (user: UserType, action: 'credit' | 'debit') => {
    setSelectedUser(user);
    setAdjustAction(action);
    setShowAdjustModal(true);
  };

  const totalBalance = users.reduce((sum, u) => sum + (u.balance_available || 0), 0);
  const totalBonusBalance = users.reduce((sum, u) => sum + (u.balance_bonus || 0), 0);

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
          <h1 className="text-2xl font-bold text-cream">Balance Management</h1>
          <p className="text-slate-400 mt-1">View and manage user balances and ledger</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
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
        <div className="bg-gradient-to-br from-profit/20 to-profit/5 rounded-xl border border-profit/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-profit/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-profit" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total User Balances</p>
              <p className="text-xl font-bold text-cream">${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-gold/20 to-gold/5 rounded-xl border border-gold/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/20 rounded-lg">
              <Wallet className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Bonus Balances</p>
              <p className="text-xl font-bold text-cream">${totalBonusBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-electric/20 to-electric/5 rounded-xl border border-electric/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-electric/20 rounded-lg">
              <User className="w-5 h-5 text-electric" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Users with Balance</p>
              <p className="text-xl font-bold text-cream">{users.filter(u => u.balance_available > 0).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-loss/20 to-loss/5 rounded-xl border border-loss/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-loss/20 rounded-lg">
              <FileText className="w-5 h-5 text-loss" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Transactions</p>
              <p className="text-xl font-bold text-cream">{transactions.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'users'
              ? 'border-gold text-gold'
              : 'border-transparent text-slate-400 hover:text-cream'
          }`}
        >
          User Balances
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'ledger'
              ? 'border-gold text-gold'
              : 'border-transparent text-slate-400 hover:text-cream'
          }`}
        >
          Transaction Ledger
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'users' ? 'Search users...' : 'Search by email...'}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
          />
        </div>
        {activeTab === 'ledger' && (
          <select
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
          >
            <option value="">All Types</option>
            <option value="deposit">Deposits</option>
            <option value="withdrawal">Withdrawals</option>
            <option value="trade_open">Trade Open</option>
            <option value="trade_close">Trade Close</option>
            <option value="admin_credit">Admin Credit</option>
            <option value="admin_debit">Admin Debit</option>
            <option value="bonus">Bonus</option>
            <option value="fee">Fee</option>
          </select>
        )}
      </div>

      {/* Content */}
      {activeTab === 'users' ? (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-white/5">
                  <th className="text-left p-4">User</th>
                  <th className="text-right p-4">Available Balance</th>
                  <th className="text-right p-4">Bonus Balance</th>
                  <th className="text-right p-4">Total Deposited</th>
                  <th className="text-right p-4">Total Withdrawn</th>
                  <th className="text-center p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <div>
                          <p className="text-cream font-medium">{user.first_name} {user.last_name}</p>
                          <p className="text-sm text-slate-400">{user.email}</p>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-cream font-mono">
                          ${(user.balance_available || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-gold font-mono">
                          ${(user.balance_bonus || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-profit font-mono">
                          ${(user.total_deposited || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-loss font-mono">
                          ${(user.total_withdrawn || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openAdjustModal(user, 'credit')}
                            className="p-2 bg-profit/10 text-profit rounded-lg hover:bg-profit/20 transition-all"
                            title="Credit Balance"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openAdjustModal(user, 'debit')}
                            className="p-2 bg-loss/10 text-loss rounded-lg hover:bg-loss/20 transition-all"
                            title="Debit Balance"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-white/5">
                  <th className="text-left p-4">Date</th>
                  <th className="text-left p-4">User</th>
                  <th className="text-left p-4">Type</th>
                  <th className="text-right p-4">Amount</th>
                  <th className="text-right p-4">Balance Before</th>
                  <th className="text-right p-4">Balance After</th>
                  <th className="text-left p-4">Description</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const user = tx.user as unknown as UserType;
                    const isCredit = tx.amount > 0;
                    return (
                      <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Clock className="w-4 h-4" />
                            {new Date(tx.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-cream">{user?.email || 'Unknown'}</p>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            tx.type === 'deposit' ? 'bg-profit/20 text-profit' :
                            tx.type === 'withdrawal' ? 'bg-loss/20 text-loss' :
                            tx.type === 'admin_credit' ? 'bg-electric/20 text-electric' :
                            tx.type === 'admin_debit' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-white/10 text-slate-400'
                          }`}>
                            {tx.type.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className={`flex items-center justify-end gap-1 font-mono ${isCredit ? 'text-profit' : 'text-loss'}`}>
                            {isCredit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            ${Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono text-slate-400">
                          ${tx.balance_before.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-mono text-cream">
                          ${tx.balance_after.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-sm text-slate-400 max-w-xs truncate">
                          {tx.description || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      <AnimatePresence>
        {showAdjustModal && selectedUser && (
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
                <h3 className="text-xl font-semibold text-cream">
                  {adjustAction === 'credit' ? 'Credit' : 'Debit'} Balance
                </h3>
                <button
                  onClick={() => setShowAdjustModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* User Info */}
                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-sm text-slate-400">User</p>
                  <p className="text-cream font-medium">{selectedUser.email}</p>
                  <p className="text-sm text-gold mt-1">
                    Current Balance: ${selectedUser.balance_available.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Amount *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="number"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>

                {/* Reason (Required) */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Reason (Required for Audit) *</label>
                  <textarea
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Enter the reason for this adjustment..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold resize-none"
                  />
                </div>

                {/* Preview */}
                {adjustAmount && (
                  <div className={`p-3 rounded-xl ${adjustAction === 'credit' ? 'bg-profit/10 border border-profit/20' : 'bg-loss/10 border border-loss/20'}`}>
                    <p className="text-xs text-slate-400 mb-1">Preview</p>
                    <p className="text-sm text-cream">
                      ${selectedUser.balance_available.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span className="mx-2">→</span>
                      <span className={adjustAction === 'credit' ? 'text-profit' : 'text-loss'}>
                        ${(adjustAction === 'credit'
                          ? selectedUser.balance_available + parseFloat(adjustAmount || '0')
                          : Math.max(0, selectedUser.balance_available - parseFloat(adjustAmount || '0'))
                        ).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAdjustModal(false)}
                    className="flex-1 py-3 bg-white/5 text-slate-400 font-semibold rounded-xl hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdjustBalance}
                    disabled={!adjustAmount || !adjustReason || adjusting}
                    className={`flex-1 py-3 font-semibold rounded-xl transition-all disabled:opacity-50 ${
                      adjustAction === 'credit'
                        ? 'bg-profit text-void hover:bg-profit/90'
                        : 'bg-loss text-white hover:bg-loss/90'
                    }`}
                  >
                    {adjusting ? 'Processing...' : adjustAction === 'credit' ? 'Credit Balance' : 'Debit Balance'}
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

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  Edit,
  Trash2,
  Plus,
  Minus,
  DollarSign,
  Wallet,
  Bitcoin,
  Shield,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  Copy,
  ExternalLink,
  Settings,
  ChevronDown,
  Eye,
  EyeOff,
  Save,
  Globe
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';
import { useDepositAddressesStore } from '@/lib/trading-store';

// Mock users data (in production, this would come from a database)
interface MockUser {
  id: string;
  email: string;
  name: string;
  balance: number;
  marginBalance: number;
  status: 'active' | 'suspended' | 'pending';
  kycLevel: number;
  createdAt: string;
  lastLogin: string;
}

const mockUsers: MockUser[] = [
  { id: '1', email: 'john@example.com', name: 'John Doe', balance: 5000, marginBalance: 10000, status: 'active', kycLevel: 2, createdAt: '2024-01-15', lastLogin: '2024-01-20' },
  { id: '2', email: 'jane@example.com', name: 'Jane Smith', balance: 15000, marginBalance: 25000, status: 'active', kycLevel: 3, createdAt: '2024-01-10', lastLogin: '2024-01-20' },
  { id: '3', email: 'bob@example.com', name: 'Bob Wilson', balance: 2500, marginBalance: 5000, status: 'pending', kycLevel: 1, createdAt: '2024-01-18', lastLogin: '2024-01-19' },
  { id: '4', email: 'alice@example.com', name: 'Alice Brown', balance: 50000, marginBalance: 100000, status: 'active', kycLevel: 3, createdAt: '2023-12-01', lastLogin: '2024-01-20' },
  { id: '5', email: 'charlie@example.com', name: 'Charlie Davis', balance: 1000, marginBalance: 2000, status: 'suspended', kycLevel: 1, createdAt: '2024-01-05', lastLogin: '2024-01-10' },
];

export default function AdminUsersPage() {
  const { admin, isAuthenticated } = useAdminAuthStore();
  const { addresses, updateAddress, addAddress, toggleActive } = useDepositAddressesStore();
  
  const [users, setUsers] = useState<MockUser[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<MockUser | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<'spot' | 'margin'>('spot');
  const [editAction, setEditAction] = useState<'add' | 'subtract' | 'set'>('add');
  const [editNote, setEditNote] = useState('');
  
  // New address form
  const [newAddress, setNewAddress] = useState({
    currency: '',
    network: '',
    address: '',
    memo: ''
  });
  
  // Edit address state
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editingAddressValue, setEditingAddressValue] = useState('');

  if (!isAuthenticated || !admin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Please log in to access this page.</p>
      </div>
    );
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditBalance = () => {
    if (!selectedUser || !editAmount) return;
    
    const amount = parseFloat(editAmount);
    if (isNaN(amount)) return;
    
    setUsers(prev => prev.map(user => {
      if (user.id !== selectedUser.id) return user;
      
      const balanceKey = editType === 'spot' ? 'balance' : 'marginBalance';
      let newBalance: number;
      
      switch (editAction) {
        case 'add':
          newBalance = user[balanceKey] + amount;
          break;
        case 'subtract':
          newBalance = Math.max(0, user[balanceKey] - amount);
          break;
        case 'set':
          newBalance = amount;
          break;
        default:
          newBalance = user[balanceKey];
      }
      
      return { ...user, [balanceKey]: newBalance };
    }));
    
    setShowEditModal(false);
    setSelectedUser(null);
    setEditAmount('');
    setEditNote('');
  };

  const handleSaveAddress = (id: string) => {
    if (admin) {
      updateAddress(id, editingAddressValue, admin.id);
    }
    setEditingAddressId(null);
    setEditingAddressValue('');
  };

  const handleAddNewAddress = () => {
    if (!newAddress.currency || !newAddress.network || !newAddress.address) return;
    
    addAddress({
      currency: newAddress.currency.toUpperCase(),
      network: newAddress.network,
      address: newAddress.address,
      memo: newAddress.memo || undefined,
      isActive: true,
    });
    
    setNewAddress({ currency: '', network: '', address: '', memo: '' });
    setShowAddressModal(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cream">User Management</h1>
          <p className="text-slate-400 mt-1">Manage user accounts and deposit addresses</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddressModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gold text-void font-semibold rounded-lg hover:bg-gold/90 transition-all"
          >
            <Wallet className="w-4 h-4" />
            Manage Addresses
          </button>
        </div>
      </div>

      {/* Deposit Addresses Section */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-cream flex items-center gap-2">
            <Bitcoin className="w-5 h-5 text-orange-500" />
            Deposit Addresses
          </h2>
          <button
            onClick={() => setShowAddressModal(true)}
            className="text-sm text-gold hover:text-gold/80"
          >
            + Add New
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-white/5">
                <th className="text-left p-4">Currency</th>
                <th className="text-left p-4">Network</th>
                <th className="text-left p-4">Address</th>
                <th className="text-center p-4">Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {addresses.map(addr => (
                <tr key={addr.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <span className="text-sm font-medium text-cream">{addr.currency}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-slate-400">{addr.network}</span>
                  </td>
                  <td className="p-4">
                    {editingAddressId === addr.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingAddressValue}
                          onChange={(e) => setEditingAddressValue(e.target.value)}
                          className="flex-1 px-3 py-1 bg-white/5 border border-gold rounded text-cream text-sm font-mono focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveAddress(addr.id)}
                          className="p-1 bg-profit rounded hover:bg-profit/80"
                        >
                          <Save className="w-4 h-4 text-void" />
                        </button>
                        <button
                          onClick={() => setEditingAddressId(null)}
                          className="p-1 bg-loss/20 rounded hover:bg-loss/30"
                        >
                          <X className="w-4 h-4 text-loss" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-cream">
                          {addr.address.slice(0, 10)}...{addr.address.slice(-8)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(addr.address)}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          <Copy className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      addr.isActive
                        ? 'bg-profit/10 text-profit'
                        : 'bg-loss/10 text-loss'
                    }`}>
                      {addr.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingAddressId(addr.id);
                          setEditingAddressValue(addr.address);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit Address"
                      >
                        <Edit className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => toggleActive(addr.id)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title={addr.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {addr.isActive ? (
                          <EyeOff className="w-4 h-4 text-slate-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users Section */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-cream flex items-center gap-2">
            <Users className="w-5 h-5 text-electric" />
            User Accounts
          </h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
              />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-white/5">
                <th className="text-left p-4">User</th>
                <th className="text-right p-4">Spot Balance</th>
                <th className="text-right p-4">Margin Balance</th>
                <th className="text-center p-4">KYC</th>
                <th className="text-center p-4">Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div>
                      <p className="text-sm font-medium text-cream">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-sm font-mono text-cream">
                      ${user.balance.toLocaleString()}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-sm font-mono text-cream">
                      ${user.marginBalance.toLocaleString()}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.kycLevel >= 2
                        ? 'bg-profit/10 text-profit'
                        : user.kycLevel === 1
                        ? 'bg-yellow-500/10 text-yellow-500'
                        : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      Level {user.kycLevel}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                      user.status === 'active'
                        ? 'bg-profit/10 text-profit'
                        : user.status === 'pending'
                        ? 'bg-yellow-500/10 text-yellow-500'
                        : 'bg-loss/10 text-loss'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowEditModal(true);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit Balance"
                      >
                        <Edit className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Balance Modal */}
      <AnimatePresence>
        {showEditModal && selectedUser && (
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
                <h3 className="text-xl font-semibold text-cream">Edit User Balance</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* User Info */}
                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-sm text-cream font-medium">{selectedUser.name}</p>
                  <p className="text-xs text-slate-400">{selectedUser.email}</p>
                  <div className="flex gap-4 mt-2">
                    <span className="text-xs text-slate-400">
                      Spot: ${selectedUser.balance.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400">
                      Margin: ${selectedUser.marginBalance.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Account Type */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Account Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setEditType('spot')}
                      className={`p-3 rounded-xl border transition-all ${
                        editType === 'spot'
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      Spot Account
                    </button>
                    <button
                      onClick={() => setEditType('margin')}
                      className={`p-3 rounded-xl border transition-all ${
                        editType === 'margin'
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      Margin Account
                    </button>
                  </div>
                </div>

                {/* Action Type */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Action</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setEditAction('add')}
                      className={`p-2 rounded-lg border transition-all flex items-center justify-center gap-1 ${
                        editAction === 'add'
                          ? 'border-profit bg-profit/10 text-profit'
                          : 'border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                    <button
                      onClick={() => setEditAction('subtract')}
                      className={`p-2 rounded-lg border transition-all flex items-center justify-center gap-1 ${
                        editAction === 'subtract'
                          ? 'border-loss bg-loss/10 text-loss'
                          : 'border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <Minus className="w-4 h-4" />
                      Subtract
                    </button>
                    <button
                      onClick={() => setEditAction('set')}
                      className={`p-2 rounded-lg border transition-all flex items-center justify-center gap-1 ${
                        editAction === 'set'
                          ? 'border-electric bg-electric/10 text-electric'
                          : 'border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Set
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Amount</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Note (for audit)</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Reason for adjustment..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
                  />
                </div>

                {/* Preview */}
                <div className="p-3 bg-gold/5 border border-gold/20 rounded-xl">
                  <p className="text-xs text-gold mb-1">Preview</p>
                  <p className="text-sm text-cream">
                    {editType === 'spot' ? 'Spot' : 'Margin'} Balance:{' '}
                    <span className="font-mono">
                      ${(editType === 'spot' ? selectedUser.balance : selectedUser.marginBalance).toLocaleString()}
                    </span>
                    {' → '}
                    <span className="font-mono text-gold">
                      ${(() => {
                        const current = editType === 'spot' ? selectedUser.balance : selectedUser.marginBalance;
                        const amount = parseFloat(editAmount) || 0;
                        switch (editAction) {
                          case 'add': return (current + amount).toLocaleString();
                          case 'subtract': return Math.max(0, current - amount).toLocaleString();
                          case 'set': return amount.toLocaleString();
                          default: return current.toLocaleString();
                        }
                      })()}
                    </span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-3 bg-white/5 text-slate-400 font-semibold rounded-xl hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditBalance}
                    disabled={!editAmount}
                    className="flex-1 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-all disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Address Modal */}
      <AnimatePresence>
        {showAddressModal && (
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
                <h3 className="text-xl font-semibold text-cream">Add Deposit Address</h3>
                <button
                  onClick={() => setShowAddressModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Currency</label>
                  <input
                    type="text"
                    value={newAddress.currency}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, currency: e.target.value }))}
                    placeholder="BTC, ETH, USDT..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Network</label>
                  <input
                    type="text"
                    value={newAddress.network}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, network: e.target.value }))}
                    placeholder="ERC-20, TRC-20, Bitcoin..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Wallet Address</label>
                  <input
                    type="text"
                    value={newAddress.address}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="0x..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Memo (optional)</label>
                  <input
                    type="text"
                    value={newAddress.memo}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, memo: e.target.value }))}
                    placeholder="Tag or memo if required..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAddressModal(false)}
                    className="flex-1 py-3 bg-white/5 text-slate-400 font-semibold rounded-xl hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddNewAddress}
                    disabled={!newAddress.currency || !newAddress.network || !newAddress.address}
                    className="flex-1 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-all disabled:opacity-50"
                  >
                    Add Address
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

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
  Globe,
  UserX,
  UserCheck,
  Lock,
  Unlock
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';
import { useDepositAddressesStore } from '@/lib/trading-store';
import { adminService, type User as AdminUser } from '@/lib/services/admin-service';

// User type from admin service
interface UserData {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  balance_available: number;
  balance_bonus: number;
  total_deposited: number;
  total_withdrawn: number;
  role: string;
  tier: string;
  is_active: boolean;
  kyc_status: string;
  created_at: string;
  last_login_at?: string;
}

// Mock users for fallback
const mockUsers: UserData[] = [
  { id: '1', email: 'john@example.com', first_name: 'John', last_name: 'Doe', balance_available: 5000, balance_bonus: 100, total_deposited: 6000, total_withdrawn: 1000, role: 'user', tier: 'basic', is_active: true, kyc_status: 'verified', created_at: '2024-01-15', last_login_at: '2024-01-20' },
  { id: '2', email: 'jane@example.com', first_name: 'Jane', last_name: 'Smith', balance_available: 15000, balance_bonus: 500, total_deposited: 20000, total_withdrawn: 5000, role: 'user', tier: 'pro', is_active: true, kyc_status: 'verified', created_at: '2024-01-10', last_login_at: '2024-01-20' },
  { id: '3', email: 'bob@example.com', first_name: 'Bob', last_name: 'Wilson', balance_available: 2500, balance_bonus: 50, total_deposited: 3000, total_withdrawn: 500, role: 'user', tier: 'basic', is_active: true, kyc_status: 'pending', created_at: '2024-01-18', last_login_at: '2024-01-19' },
  { id: '4', email: 'alice@example.com', first_name: 'Alice', last_name: 'Brown', balance_available: 50000, balance_bonus: 2000, total_deposited: 60000, total_withdrawn: 10000, role: 'user', tier: 'elite', is_active: true, kyc_status: 'verified', created_at: '2023-12-01', last_login_at: '2024-01-20' },
  { id: '5', email: 'charlie@example.com', first_name: 'Charlie', last_name: 'Davis', balance_available: 1000, balance_bonus: 0, total_deposited: 2000, total_withdrawn: 1000, role: 'user', tier: 'basic', is_active: false, kyc_status: 'rejected', created_at: '2024-01-05', last_login_at: '2024-01-10' },
];

export default function AdminUsersPage() {
  const { admin, isAuthenticated } = useAdminAuthStore();
  const { addresses, updateAddress, addAddress, toggleActive } = useDepositAddressesStore();
  
  const [users, setUsers] = useState<UserData[]>(mockUsers);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<'spot' | 'bonus'>('spot');
  const [editAction, setEditAction] = useState<'add' | 'subtract' | 'set'>('add');
  const [editNote, setEditNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
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

  useEffect(() => {
    if (admin?.id) {
      adminService.setAdminId(admin.id);
    }
    loadUsers();
  }, [admin]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await adminService.getAllUsers({ limit: 100 });
      if (data && data.length > 0) {
        setUsers(data as UserData[]);
      } else {
        // Use mock data for demo
        setUsers(mockUsers);
      }
    } catch (error) {
      setUsers(mockUsers);
    }
    setLoading(false);
  };

  if (!isAuthenticated || !admin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Please log in to access this page.</p>
      </div>
    );
  }

  const filteredUsers = users.filter(user => {
    if (statusFilter === 'active' && !user.is_active) return false;
    if (statusFilter === 'inactive' && user.is_active) return false;
    if (roleFilter && user.role !== roleFilter) return false;
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      return (
        user.email.toLowerCase().includes(searchLower) ||
        (user.first_name?.toLowerCase().includes(searchLower)) ||
        (user.last_name?.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  const handleEditBalance = async () => {
    if (!selectedUser || !editAmount || !editNote) {
      setNotification({ type: 'error', message: 'Please fill all fields including reason' });
      return;
    }
    
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      setNotification({ type: 'error', message: 'Invalid amount' });
      return;
    }

    setProcessing(true);
    try {
      if (editAction === 'add') {
        await adminService.creditBalance(selectedUser.id, amount, editNote);
      } else if (editAction === 'subtract') {
        await adminService.debitBalance(selectedUser.id, amount, editNote);
      } else {
        // Set - credit the difference
        const diff = amount - selectedUser.balance_available;
        if (diff > 0) {
          await adminService.creditBalance(selectedUser.id, diff, editNote);
        } else if (diff < 0) {
          await adminService.debitBalance(selectedUser.id, Math.abs(diff), editNote);
        }
      }
      
      setNotification({ type: 'success', message: 'Balance updated successfully' });
      loadUsers();
    } catch (error) {
      // Update locally for demo
      setUsers(prev => prev.map(user => {
        if (user.id !== selectedUser.id) return user;
        let newBalance: number;
        switch (editAction) {
          case 'add':
            newBalance = user.balance_available + amount;
            break;
          case 'subtract':
            newBalance = Math.max(0, user.balance_available - amount);
            break;
          case 'set':
            newBalance = amount;
            break;
          default:
            newBalance = user.balance_available;
        }
        return { ...user, balance_available: newBalance };
      }));
      setNotification({ type: 'success', message: 'Balance updated locally' });
    }
    
    setProcessing(false);
    setShowEditModal(false);
    setSelectedUser(null);
    setEditAmount('');
    setEditNote('');
  };

  const handleToggleUserStatus = async (user: UserData) => {
    const action = user.is_active ? 'freeze' : 'unfreeze';
    const reason = `User ${action}d by admin`;
    
    try {
      if (user.is_active) {
        await adminService.freezeUser(user.id, reason);
      } else {
        await adminService.unfreezeUser(user.id, reason);
      }
      setNotification({ type: 'success', message: `User ${action}d successfully` });
      loadUsers();
    } catch (error) {
      // Update locally for demo
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, is_active: !u.is_active } : u
      ));
      setNotification({ type: 'success', message: `User ${action}d locally` });
    }
  };

  const handleChangeRole = async (user: UserData, newRole: string) => {
    try {
      await adminService.setUserRole(user.id, newRole as AdminUser['role'], `Role changed to ${newRole}`);
      setNotification({ type: 'success', message: 'User role updated' });
      loadUsers();
    } catch (error) {
      // Update locally for demo
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, role: newRole } : u
      ));
      setNotification({ type: 'success', message: 'User role updated locally' });
    }
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
    setNotification({ type: 'success', message: 'Copied to clipboard' });
  };

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
          <h1 className="text-2xl font-bold text-cream">User Management</h1>
          <p className="text-slate-400 mt-1">Manage user accounts, balances, and deposit addresses</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadUsers}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddressModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gold text-void font-semibold rounded-lg hover:bg-gold/90 transition-all"
          >
            <Wallet className="w-4 h-4" />
            Manage Addresses
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-electric/20 to-electric/5 rounded-xl border border-electric/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-electric/20 rounded-lg">
              <Users className="w-5 h-5 text-electric" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Users</p>
              <p className="text-xl font-bold text-cream">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-profit/20 to-profit/5 rounded-xl border border-profit/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-profit/20 rounded-lg">
              <UserCheck className="w-5 h-5 text-profit" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Active</p>
              <p className="text-xl font-bold text-cream">{users.filter(u => u.is_active).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-loss/20 to-loss/5 rounded-xl border border-loss/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-loss/20 rounded-lg">
              <UserX className="w-5 h-5 text-loss" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Frozen</p>
              <p className="text-xl font-bold text-cream">{users.filter(u => !u.is_active).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-gold/20 to-gold/5 rounded-xl border border-gold/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/20 rounded-lg">
              <Shield className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-sm text-slate-400">KYC Verified</p>
              <p className="text-xl font-bold text-cream">{users.filter(u => u.kyc_status === 'verified').length}</p>
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
            placeholder="Search by email or name..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Frozen</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
        >
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="support">Support</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-white/5">
                <th className="text-left p-4">User</th>
                <th className="text-right p-4">Balance</th>
                <th className="text-right p-4">Deposited</th>
                <th className="text-center p-4">Role</th>
                <th className="text-center p-4">KYC</th>
                <th className="text-center p-4">Status</th>
                <th className="text-center p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
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
                      {user.balance_bonus > 0 && (
                        <p className="text-xs text-gold">+${user.balance_bonus} bonus</p>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-profit font-mono">
                        ${(user.total_deposited || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <select
                        value={user.role}
                        onChange={(e) => handleChangeRole(user, e.target.value)}
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-cream focus:outline-none"
                      >
                        <option value="user">User</option>
                        <option value="support">Support</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        user.kyc_status === 'verified' ? 'bg-profit/20 text-profit' :
                        user.kyc_status === 'pending' ? 'bg-gold/20 text-gold' :
                        user.kyc_status === 'rejected' ? 'bg-loss/20 text-loss' :
                        'bg-white/10 text-slate-400'
                      }`}>
                        {user.kyc_status?.toUpperCase() || 'NONE'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        user.is_active ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                      }`}>
                        {user.is_active ? 'ACTIVE' : 'FROZEN'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserDetailModal(true);
                          }}
                          className="p-1.5 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-all"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowEditModal(true);
                          }}
                          className="p-1.5 bg-gold/10 text-gold rounded-lg hover:bg-gold/20 transition-all"
                          title="Edit Balance"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(user)}
                          className={`p-1.5 rounded-lg transition-all ${
                            user.is_active 
                              ? 'bg-loss/10 text-loss hover:bg-loss/20' 
                              : 'bg-profit/10 text-profit hover:bg-profit/20'
                          }`}
                          title={user.is_active ? 'Freeze User' : 'Unfreeze User'}
                        >
                          {user.is_active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
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

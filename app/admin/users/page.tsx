'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  Edit,
  Plus,
  Minus,
  DollarSign,
  Wallet,
  Shield,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Save,
  UserX,
  UserCheck,
  Lock,
  Unlock,
  XCircle,
} from 'lucide-react';

import { useAdminAuthStore } from '@/lib/admin-store';
import { useDepositAddressesStore } from '@/lib/trading-store';
import { adminService, type User as AdminUser } from '@/lib/services/admin-service';

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

const mockUsers: UserData[] = [
  {
    id: '1',
    email: 'john@example.com',
    first_name: 'John',
    last_name: 'Doe',
    balance_available: 5000,
    balance_bonus: 100,
    total_deposited: 6000,
    total_withdrawn: 1000,
    role: 'user',
    tier: 'basic',
    is_active: true,
    kyc_status: 'pending',
    created_at: '2024-01-15',
    last_login_at: '2024-01-20',
  },
];

function getStorageToken(): string | null {
  if (typeof window === 'undefined') return null;

  // ✅ prefer sessionStorage (new behavior)
  const ss =
    window.sessionStorage.getItem('novatrade_admin_token') ||
    window.sessionStorage.getItem('admin_token');

  if (ss) return ss;

  // fallback: old localStorage keys
  const ls =
    window.localStorage.getItem('novatrade_admin_token') ||
    window.localStorage.getItem('admin_token');

  // ✅ migrate localStorage -> sessionStorage so refreshes stop breaking
  if (ls) {
    try {
      window.sessionStorage.setItem('novatrade_admin_token', ls);
    } catch {}
    return ls;
  }

  return null;
}

function getAdminToken(admin: any, sessionToken?: string | null): string | null {
  // ✅ best case: store exposes sessionToken directly
  if (sessionToken) return sessionToken;

  // fallback: token inside admin object variants
  const fromAdmin =
    admin?.sessionToken ||
    admin?.session_token ||
    admin?.token ||
    admin?.access_token ||
    admin?.accessToken ||
    null;

  if (fromAdmin) return fromAdmin;

  // fallback: browser storage
  return getStorageToken();
}

export default function AdminUsersPage() {
  // some codebases type the store narrowly; we read it safely
  const store: any = useAdminAuthStore();
  const { admin, isAuthenticated } = store;
  const sessionToken: string | null = store?.sessionToken ?? store?.token ?? null;

  const token = useMemo(() => getAdminToken(admin, sessionToken), [admin, sessionToken]);

  const { addresses, updateAddress, addAddress, toggleActive } = useDepositAddressesStore();

  const [users, setUsers] = useState<UserData[]>(mockUsers);
  const [loading, setLoading] = useState(true);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);

  const [editType, setEditType] = useState<'spot' | 'bonus'>('spot');
  const [editAction, setEditAction] = useState<'add' | 'subtract' | 'set'>('add');
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState({
    currency: '',
    network: '',
    address: '',
    memo: '',
  });

  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editingAddressValue, setEditingAddressValue] = useState('');

  // ✅ keep token in sessionStorage so navigation/refresh doesn't drop it
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!token) return;
    try {
      window.sessionStorage.setItem('novatrade_admin_token', token);
    } catch {}
  }, [token]);

  useEffect(() => {
    if (admin?.id) adminService.setAdminId(admin.id);
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.id]);

  const apiFetch = async (path: string, init?: RequestInit) => {
    if (!token) throw new Error('Missing admin token. Please log in again.');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(init?.headers as any),
    };

    // add JSON content-type if we send a body and none provided
    if (init?.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(path, {
      ...init,
      headers,
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
    return json;
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      // ✅ First choice: your server admin route (prevents anon-token [] issue)
      try {
        const json = await apiFetch('/api/admin/users');
        if (Array.isArray(json?.users)) {
          setUsers(json.users as UserData[]);
          return;
        }
      } catch (routeErr) {
        // ignore and fallback to adminService
        console.warn('[AdminUsers] /api/admin/users failed, falling back:', routeErr);
      }

      // ✅ Second choice: adminService (if it's wired properly)
      const { data } = await adminService.getAllUsers({ limit: 200 });
      if (Array.isArray(data)) {
        setUsers(data as UserData[]);
      } else {
        setUsers([]); // don't force mockUsers if backend is empty
      }
    } catch (e: any) {
      console.error('[AdminUsers] loadUsers error:', e);
      setUsers(mockUsers);
      setNotification({ type: 'error', message: e?.message || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || !admin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Please log in to access this page.</p>
      </div>
    );
  }

  const filteredUsers = users.filter((user) => {
    if (statusFilter === 'active' && !user.is_active) return false;
    if (statusFilter === 'inactive' && user.is_active) return false;
    if (roleFilter && user.role !== roleFilter) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        user.email.toLowerCase().includes(q) ||
        (user.first_name?.toLowerCase().includes(q) ?? false) ||
        (user.last_name?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const openEditModal = (u: UserData) => {
    setSelectedUser(u);
    setEditType('spot');
    setEditAction('add');
    setEditAmount('');
    setEditNote('');
    setShowEditModal(true);
  };

  const openDetailModal = (u: UserData) => {
    setSelectedUser(u);
    setShowUserDetailModal(true);
  };

  const handleEditBalance = async () => {
    if (!selectedUser || !editAmount || !editNote) {
      setNotification({ type: 'error', message: 'Please fill all fields including reason' });
      return;
    }

    const amount = parseFloat(editAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setNotification({ type: 'error', message: 'Invalid amount' });
      return;
    }

    setProcessing(true);

    const current =
      editType === 'spot' ? selectedUser.balance_available : selectedUser.balance_bonus;

    try {
      if (editType === 'spot') {
        if (editAction === 'add') {
          await adminService.creditBalance(selectedUser.id, amount, editNote);
        } else if (editAction === 'subtract') {
          await adminService.debitBalance(selectedUser.id, amount, editNote);
        } else {
          const diff = amount - current;
          if (diff > 0) await adminService.creditBalance(selectedUser.id, diff, editNote);
          if (diff < 0) await adminService.debitBalance(selectedUser.id, Math.abs(diff), editNote);
        }
        setNotification({ type: 'success', message: 'Spot balance updated successfully' });
        await loadUsers();
      } else {
        throw new Error('Bonus adjustment not wired to API yet');
      }
    } catch (e: any) {
      console.warn('[AdminUsers] edit balance fallback:', e);
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== selectedUser.id) return u;

          const field = editType === 'spot' ? 'balance_available' : 'balance_bonus';
          const base = editType === 'spot' ? u.balance_available : u.balance_bonus;

          let next = base;
          if (editAction === 'add') next = base + amount;
          if (editAction === 'subtract') next = Math.max(0, base - amount);
          if (editAction === 'set') next = amount;

          return { ...u, [field]: next } as UserData;
        })
      );

      setNotification({
        type: 'success',
        message:
          editType === 'spot'
            ? 'Spot balance updated locally'
            : 'Bonus balance updated locally (API not wired yet)',
      });
    } finally {
      setProcessing(false);
      setShowEditModal(false);
      setSelectedUser(null);
      setEditAmount('');
      setEditNote('');
    }
  };

  const handleToggleUserStatus = async (user: UserData) => {
    const action = user.is_active ? 'freeze' : 'unfreeze';
    const reason = `User ${action}d by admin`;

    try {
      if (user.is_active) await adminService.freezeUser(user.id, reason);
      else await adminService.unfreezeUser(user.id, reason);

      setNotification({ type: 'success', message: `User ${action}d successfully` });
      await loadUsers();
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u)));
      setNotification({ type: 'success', message: `User ${action}d locally` });
    }
  };

  const handleChangeRole = async (user: UserData, newRole: string) => {
    try {
      await adminService.setUserRole(
        user.id,
        newRole as AdminUser['role'],
        `Role changed to ${newRole}`
      );
      setNotification({ type: 'success', message: 'User role updated' });
      await loadUsers();
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
      setNotification({ type: 'success', message: 'User role updated locally' });
    }
  };

  // ✅ CONNECTED KYC ACTIONS (calls your server routes)
  const handleKycAction = async (userId: string, action: 'approve' | 'reject') => {
    try {
      const target = users.find((u) => u.id === userId);
      const who = target?.email ?? selectedUser?.email ?? 'user';

      if (action === 'approve') {
        const json = await apiFetch(`/api/admin/kyc/${userId}/approve`, { method: 'POST' });

        const next = String(json?.user?.kyc_status ?? 'verified');
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, kyc_status: next } : u)));
        if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, kyc_status: next });

        setNotification({ type: 'success', message: `KYC approved for ${who}` });
      } else {
        const reason = prompt('Reason for rejection (optional):') || '';
        const json = await apiFetch(`/api/admin/kyc/${userId}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });

        const next = String(json?.user?.kyc_status ?? 'rejected');
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, kyc_status: next } : u)));
        if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, kyc_status: next });

        setNotification({ type: 'error', message: `KYC rejected for ${who}` });
      }
    } catch (e: any) {
      console.error('[AdminUsers] KYC action error:', e);
      setNotification({ type: 'error', message: e?.message || 'KYC action failed' });
    }
  };

  const handleSaveAddress = (id: string) => {
    if (admin) updateAddress(id, editingAddressValue, admin.id);
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
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setNotification({ type: 'success', message: 'Copied to clipboard' });
  };

  const displayName = (u: UserData) =>
    `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email;

  const kycLabel = (s: string) => {
    const v = String(s || '').toLowerCase();
    // DB might store 'approved' while UI wants 'verified'
    if (v === 'approved') return 'verified';
    return v || 'none';
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
              notification.type === 'success'
                ? 'bg-profit/20 border border-profit/30'
                : 'bg-loss/20 border border-loss/30'
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
              <p className="text-xl font-bold text-cream">{users.filter((u) => u.is_active).length}</p>
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
              <p className="text-xl font-bold text-cream">{users.filter((u) => !u.is_active).length}</p>
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
              <p className="text-xl font-bold text-cream">
                {users.filter((u) => kycLabel(u.kyc_status) === 'verified').length}
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
                <th className="text-right p-4">Spot</th>
                <th className="text-right p-4">Bonus</th>
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
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const kyc = kycLabel(user.kyc_status);

                  return (
                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <div>
                          <p className="text-cream font-medium">{displayName(user)}</p>
                          <p className="text-sm text-slate-400">{user.email}</p>
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <span className="text-cream font-mono">
                          ${(user.balance_available ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <span className="text-gold font-mono">
                          ${(user.balance_bonus ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <span className="text-profit font-mono">
                          ${(user.total_deposited ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            kyc === 'verified'
                              ? 'bg-profit/20 text-profit'
                              : kyc === 'pending'
                              ? 'bg-gold/20 text-gold'
                              : kyc === 'rejected'
                              ? 'bg-loss/20 text-loss'
                              : 'bg-white/10 text-slate-400'
                          }`}
                        >
                          {kyc.toUpperCase()}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            user.is_active ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                          }`}
                        >
                          {user.is_active ? 'ACTIVE' : 'FROZEN'}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openDetailModal(user)}
                            className="p-1.5 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-all"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => openEditModal(user)}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal */}
      <AnimatePresence>
        {showUserDetailModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-charcoal rounded-2xl border border-white/10 p-6 max-w-lg w-full"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-semibold text-cream">User Details</h3>
                <button onClick={() => setShowUserDetailModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-cream font-medium">{displayName(selectedUser)}</p>
                  <p className="text-sm text-slate-400">{selectedUser.email}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Spot</p>
                    <p className="text-cream font-mono">${(selectedUser.balance_available ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Bonus</p>
                    <p className="text-gold font-mono">${(selectedUser.balance_bonus ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Deposited</p>
                    <p className="text-profit font-mono">${(selectedUser.total_deposited ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Withdrawn</p>
                    <p className="text-loss font-mono">${(selectedUser.total_withdrawn ?? 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl text-sm text-slate-300 space-y-1">
                  <p><span className="text-slate-400">Role:</span> {selectedUser.role}</p>
                  <p><span className="text-slate-400">Tier:</span> {selectedUser.tier}</p>
                  <p>
                    <span className="text-slate-400">KYC:</span>{' '}
                    <span
                      className={
                        kycLabel(selectedUser.kyc_status) === 'verified'
                          ? 'text-profit font-medium'
                          : kycLabel(selectedUser.kyc_status) === 'pending'
                          ? 'text-yellow-400 font-medium'
                          : kycLabel(selectedUser.kyc_status) === 'rejected'
                          ? 'text-loss font-medium'
                          : ''
                      }
                    >
                      {kycLabel(selectedUser.kyc_status).toUpperCase()}
                    </span>
                  </p>
                  <p><span className="text-slate-400">Status:</span> {selectedUser.is_active ? 'active' : 'frozen'}</p>
                  <p><span className="text-slate-400">Created:</span> {selectedUser.created_at}</p>
                  <p><span className="text-slate-400">Last login:</span> {selectedUser.last_login_at ?? '—'}</p>
                </div>

                {/* ✅ KYC Review Actions */}
                {(kycLabel(selectedUser.kyc_status) === 'pending' ||
                  kycLabel(selectedUser.kyc_status) === 'rejected' ||
                  kycLabel(selectedUser.kyc_status) === 'none') && (
                  <div className="p-3 bg-yellow-500/5 rounded-xl border border-yellow-500/10">
                    <p className="text-xs text-yellow-400 font-medium mb-3">
                      {kycLabel(selectedUser.kyc_status) === 'pending' ? '⏳ KYC Pending Review' : '🔑 KYC Actions'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleKycAction(selectedUser.id, 'approve')}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-profit/20 text-profit text-sm font-semibold rounded-lg hover:bg-profit/30 transition-all border border-profit/20"
                      >
                        <CheckCircle className="w-4 h-4" /> Approve KYC
                      </button>

                      {kycLabel(selectedUser.kyc_status) !== 'rejected' && (
                        <button
                          onClick={() => handleKycAction(selectedUser.id, 'reject')}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-loss/20 text-loss text-sm font-semibold rounded-lg hover:bg-loss/30 transition-all border border-loss/20"
                        >
                          <XCircle className="w-4 h-4" /> Reject KYC
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {kycLabel(selectedUser.kyc_status) === 'verified' && (
                  <div className="p-3 bg-profit/5 rounded-xl border border-profit/10 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-profit" />
                    <span className="text-sm text-profit font-medium">KYC Verified ✓</span>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-charcoal rounded-2xl border border-white/10 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-cream">Edit Balance</h3>
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-sm text-cream font-medium">{displayName(selectedUser)}</p>
                  <p className="text-xs text-slate-400">{selectedUser.email}</p>
                  <div className="flex gap-4 mt-2">
                    <span className="text-xs text-slate-400">Spot: ${selectedUser.balance_available.toLocaleString()}</span>
                    <span className="text-xs text-slate-400">Bonus: ${selectedUser.balance_bonus.toLocaleString()}</span>
                  </div>
                </div>

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
                      Spot
                    </button>
                    <button
                      onClick={() => setEditType('bonus')}
                      className={`p-3 rounded-xl border transition-all ${
                        editType === 'bonus'
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      Bonus
                    </button>
                  </div>
                  {editType === 'bonus' && (
                    <p className="mt-2 text-xs text-slate-500">
                      Bonus edits are currently local fallback unless you wire bonus endpoints.
                    </p>
                  )}
                </div>

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

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-3 bg-white/5 text-slate-400 font-semibold rounded-xl hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditBalance}
                    disabled={!editAmount || !editNote || processing}
                    className="flex-1 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-all disabled:opacity-50"
                  >
                    {processing ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manage Addresses Modal (unchanged) */}
      <AnimatePresence>
        {showAddressModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-charcoal rounded-2xl border border-white/10 p-6 max-w-3xl w-full"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-semibold text-cream">Manage Deposit Addresses</h3>
                <button onClick={() => setShowAddressModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
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
                      {addresses.map((addr: any) => (
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
                                  className="flex-1 px-3 py-2 bg-white/5 border border-gold rounded text-cream text-sm font-mono focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveAddress(addr.id)}
                                  className="p-2 bg-profit rounded hover:bg-profit/80"
                                  title="Save"
                                >
                                  <Save className="w-4 h-4 text-void" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingAddressId(null);
                                    setEditingAddressValue('');
                                  }}
                                  className="p-2 bg-loss/20 rounded hover:bg-loss/30"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4 text-loss" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono text-cream">
                                  {String(addr.address).slice(0, 10)}...{String(addr.address).slice(-8)}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(addr.address)}
                                  className="p-1 hover:bg-white/10 rounded"
                                  title="Copy"
                                >
                                  <Copy className="w-3 h-3 text-slate-400" />
                                </button>
                              </div>
                            )}
                            {addr.memo ? <p className="text-xs text-slate-500 mt-1">Memo: {addr.memo}</p> : null}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-1 text-xs rounded-full ${addr.isActive ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>
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
                                {addr.isActive ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {addresses.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400">
                            No deposit addresses yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold uppercase"
                  placeholder="Currency (BTC)"
                  value={newAddress.currency}
                  onChange={(e) => setNewAddress((p) => ({ ...p, currency: e.target.value }))}
                />
                <input
                  className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
                  placeholder="Network (TRC20)"
                  value={newAddress.network}
                  onChange={(e) => setNewAddress((p) => ({ ...p, network: e.target.value }))}
                />
                <input
                  className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold font-mono md:col-span-2"
                  placeholder="Wallet address"
                  value={newAddress.address}
                  onChange={(e) => setNewAddress((p) => ({ ...p, address: e.target.value }))}
                />
                <input
                  className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold md:col-span-3"
                  placeholder="Memo (optional)"
                  value={newAddress.memo}
                  onChange={(e) => setNewAddress((p) => ({ ...p, memo: e.target.value }))}
                />
                <button
                  onClick={handleAddNewAddress}
                  disabled={!newAddress.currency || !newAddress.network || !newAddress.address}
                  className="px-4 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-all disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

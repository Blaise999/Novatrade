'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  User,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

import { useAdminAuthStore } from '@/lib/admin-store';

interface KYCUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  kyc_status: string;
  created_at: string;
  kyc_submitted_at?: string;
  kyc_data?: {
    date_of_birth?: string;
    nationality?: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    id_type?: string;
    id_number?: string;
    id_front_doc?: string;
    id_back_doc?: string;
    selfie_doc?: string;
    proof_of_address_doc?: string;
  };
  kyc_docs?: {
    id_front?: string | null;
    id_back?: string | null;
    selfie?: string | null;
    proof?: string | null;
  };
}

type Filter = 'all' | 'pending' | 'verified' | 'rejected' | 'none';

function getAdminToken(admin: any, sessionToken?: string | null): string | null {
  if (!admin && !sessionToken) return null;

  return (
    sessionToken ||
    admin?.token ||
    admin?.access_token ||
    admin?.accessToken ||
    admin?.session_token ||
    admin?.sessionToken ||
    (typeof window !== 'undefined' ? window.localStorage.getItem('admin_token') : null) ||
    null
  );
}

export default function AdminKYCPage() {
  const { admin, isAuthenticated, logout } = useAdminAuthStore();

  // ✅ use same token logic as your Admin Users page
  const token = useMemo(() => getAdminToken(admin, (admin as any)?.sessionToken ?? null), [admin]);

  const [allUsers, setAllUsers] = useState<KYCUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [selectedUser, setSelectedUser] = useState<KYCUser | null>(null);

  // ✅ token-based guard (NOT sessionToken-based)
  const tokenOk = Boolean(isAuthenticated && admin && token);

  useEffect(() => {
    if (!tokenOk) return;
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenOk]);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(t);
  }, [notification]);

  const apiFetch = async (path: string, init?: RequestInit) => {
    if (!token) throw new Error('Missing admin token. Please log in again.');

    const res = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`, // ✅ EXACTLY like your Users page
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = json?.error || `Request failed (${res.status})`;
      if (res.status === 401 || res.status === 403) {
        await logout(); // auto logout on invalid token
      }
      throw new Error(msg);
    }

    return json;
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('status', 'all');

      const json = await apiFetch(`/api/admin/kyc?${q.toString()}`);
      const kycs = Array.isArray(json?.kycs) ? (json.kycs as KYCUser[]) : [];
      setAllUsers(kycs);
    } catch (e: any) {
      console.error('[AdminKYC] loadUsers error:', e);
      setAllUsers([]);
      setNotification({
        type: 'error',
        message: e?.message || 'Failed to load KYCs',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateKYC = async (userId: string, status: 'verified' | 'rejected') => {
    setProcessing(userId);
    try {
      if (status === 'verified') {
        await apiFetch(`/api/admin/kyc/${userId}/approve`, { method: 'POST' });
      } else {
        await apiFetch(`/api/admin/kyc/${userId}/reject`, { method: 'POST' });
      }

      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, kyc_status: status } : u))
      );

      const email = allUsers.find((u) => u.id === userId)?.email || 'user';
      setNotification({
        type: status === 'verified' ? 'success' : 'error',
        message: `KYC ${status === 'verified' ? 'approved' : 'rejected'} for ${email}`,
      });

      if (selectedUser?.id === userId) {
        setSelectedUser((p) => (p ? { ...p, kyc_status: status } : p));
      }
    } catch (e: any) {
      console.error('[AdminKYC] updateKYC error:', e);
      setNotification({
        type: 'error',
        message: e?.message || 'Failed to update KYC',
      });
    } finally {
      setProcessing(null);
    }
  };

  const counts = useMemo(() => {
    const norm = (s?: string) => (s || 'none').toLowerCase();

    return {
      all: allUsers.length,
      pending: allUsers.filter((u) => norm(u.kyc_status) === 'pending').length,
      verified: allUsers.filter((u) =>
        ['verified', 'approved'].includes(norm(u.kyc_status))
      ).length,
      rejected: allUsers.filter((u) => norm(u.kyc_status) === 'rejected').length,
      none: allUsers.filter((u) => {
        const s = norm(u.kyc_status);
        return !u.kyc_status || s === 'none' || s === 'not_started';
      }).length,
    };
  }, [allUsers]);

  const statusConfig: Record<
    string,
    { color: string; bg: string; Icon: any; label: string }
  > = {
    pending: {
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      Icon: Clock,
      label: 'Pending Review',
    },
    verified: {
      color: 'text-profit',
      bg: 'bg-profit/10',
      Icon: CheckCircle,
      label: 'Verified',
    },
    approved: {
      color: 'text-profit',
      bg: 'bg-profit/10',
      Icon: CheckCircle,
      label: 'Verified',
    },
    rejected: {
      color: 'text-loss',
      bg: 'bg-loss/10',
      Icon: XCircle,
      label: 'Rejected',
    },
    none: {
      color: 'text-slate-400',
      bg: 'bg-white/5',
      Icon: AlertCircle,
      label: 'Not Submitted',
    },
    not_started: {
      color: 'text-slate-400',
      bg: 'bg-white/5',
      Icon: AlertCircle,
      label: 'Not Submitted',
    },
  };

  const filtered = useMemo(() => {
    const norm = (s?: string) => (s || 'none').toLowerCase();

    return allUsers.filter((u) => {
      const s = norm(u.kyc_status);

      if (filter !== 'all') {
        if (filter === 'pending' && s !== 'pending') return false;
        if (filter === 'rejected' && s !== 'rejected') return false;
        if (filter === 'verified' && !['verified', 'approved'].includes(s)) return false;
        if (filter === 'none' && !(s === 'none' || s === 'not_started' || !u.kyc_status))
          return false;
      }

      if (search) {
        const q = search.toLowerCase();
        return (
          u.email.toLowerCase().includes(q) ||
          `${u.first_name} ${u.last_name}`.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [allUsers, filter, search]);

  if (!tokenOk) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Please log in to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-xl border ${
              notification.type === 'success'
                ? 'bg-profit/10 border-profit/20 text-profit'
                : 'bg-loss/10 border-loss/20 text-loss'
            }`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cream">KYC Verification</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review and manage user identity verification
          </p>
        </div>
        <button
          onClick={loadUsers}
          className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
        >
          <RefreshCw
            className={`w-5 h-5 text-cream/60 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {(['all', 'pending', 'verified', 'rejected', 'none'] as Filter[]).map(
          (key) => {
            const sc =
              key === 'all'
                ? {
                    color: 'text-cream',
                    bg: 'bg-white/5',
                    Icon: User,
                    label: 'All Users',
                  }
                : statusConfig[key];

            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`p-4 rounded-xl border transition-all text-left ${
                  filter === key
                    ? 'border-gold/50 bg-gold/5'
                    : 'border-white/5 bg-white/5 hover:border-white/10'
                }`}
              >
                <p className="text-2xl font-bold text-cream">{counts[key]}</p>
                <p className={`text-xs ${sc.color}`}>{sc.label}</p>
              </button>
            );
          }
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold"
        />
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-3" />
            <p className="text-cream/50">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-cream/20 mx-auto mb-3" />
            <p className="text-cream/50">No users match the current filter</p>
          </div>
        ) : (
          filtered.map((u) => {
            const s = (u.kyc_status || 'none').toLowerCase();
            const sc = statusConfig[s] || statusConfig.none;

            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/5 rounded-xl border border-white/5 p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-electric/20 to-gold/20 rounded-xl flex items-center justify-center text-cream font-bold text-sm">
                      {(u.first_name?.[0] || u.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-cream">
                        {u.first_name} {u.last_name}
                      </p>
                      <p className="text-xs text-cream/40">{u.email}</p>
                      <p className="text-[10px] text-cream/30 mt-0.5">
                        Joined {new Date(u.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${sc.bg} ${sc.color}`}
                    >
                      <sc.Icon className="w-3.5 h-3.5" /> {sc.label}
                    </span>

                    {(s === 'pending' ||
                      s === 'none' ||
                      s === 'rejected' ||
                      s === 'not_started') && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateKYC(u.id, 'verified')}
                          disabled={processing === u.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-profit/20 text-profit text-xs font-semibold rounded-lg hover:bg-profit/30 transition-all border border-profit/20 disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>

                        {s !== 'rejected' && (
                          <button
                            onClick={() => updateKYC(u.id, 'rejected')}
                            disabled={processing === u.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-loss/20 text-loss text-xs font-semibold rounded-lg hover:bg-loss/30 transition-all border border-loss/20 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        )}
                      </div>
                    )}

                    {(u.kyc_data || u.kyc_docs) && (
                      <button
                        onClick={() =>
                          setSelectedUser(selectedUser?.id === u.id ? null : u)
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-cream/60 text-xs font-medium rounded-lg hover:bg-white/10 transition-all border border-white/5"
                      >
                        <User className="w-3.5 h-3.5" />{' '}
                        {selectedUser?.id === u.id ? 'Hide' : 'View'} Details
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {selectedUser?.id === u.id && (u.kyc_data || u.kyc_docs) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-white/5"
                    >
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                          Documents
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {u.kyc_docs?.id_front && (
                            <a
                              href={u.kyc_docs.id_front}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-electric/10 text-electric text-xs rounded-md"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> ID Front
                            </a>
                          )}

                          {u.kyc_docs?.id_back && (
                            <a
                              href={u.kyc_docs.id_back}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-electric/10 text-electric text-xs rounded-md"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> ID Back
                            </a>
                          )}

                          {u.kyc_docs?.selfie && (
                            <a
                              href={u.kyc_docs.selfie}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-electric/10 text-electric text-xs rounded-md"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Selfie
                            </a>
                          )}

                          {u.kyc_docs?.proof && (
                            <a
                              href={u.kyc_docs.proof}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-electric/10 text-electric text-xs rounded-md"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Proof of
                              Address
                            </a>
                          )}

                          {!u.kyc_docs?.id_front && !u.kyc_docs?.selfie && (
                            <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 text-xs rounded-md">
                              ⚠ No signed document links returned
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

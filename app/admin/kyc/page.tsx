'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, CheckCircle, XCircle, Clock, Search, User,
  RefreshCw, AlertCircle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface KYCUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  kyc_status: string;
  created_at: string;
  kyc_data?: {
    date_of_birth?: string;
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
  kyc_submitted_at?: string;
}

type Filter = 'all' | 'pending' | 'verified' | 'rejected' | 'none';

export default function AdminKYCPage() {
  const [users, setUsers] = useState<KYCUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<KYCUser | null>(null);

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  const loadUsers = async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      setUsers([
        { id: '1', email: 'john@test.com', first_name: 'John', last_name: 'Doe', kyc_status: 'pending', created_at: new Date().toISOString() },
        { id: '2', email: 'jane@test.com', first_name: 'Jane', last_name: 'Smith', kyc_status: 'verified', created_at: new Date().toISOString() },
      ]);
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, kyc_status, created_at, kyc_data, kyc_submitted_at')
        .order('created_at', { ascending: false });
      if (data) setUsers(data);
    } catch {}
    setLoading(false);
  };

  const updateKYC = async (userId: string, status: 'verified' | 'rejected') => {
    setProcessing(userId);
    try {
      if (isSupabaseConfigured()) {
        await supabase.from('users').update({ kyc_status: status }).eq('id', userId);
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, kyc_status: status } : u));
      const email = users.find(u => u.id === userId)?.email;
      setNotification({
        type: status === 'verified' ? 'success' : 'error',
        message: `KYC ${status === 'verified' ? 'approved' : 'rejected'} for ${email}`,
      });
    } catch {}
    setProcessing(null);
  };

  const filtered = users.filter(u => {
    const s = u.kyc_status || 'none';
    if (filter !== 'all' && s !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.email.toLowerCase().includes(q) || `${u.first_name} ${u.last_name}`.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: users.length,
    pending: users.filter(u => u.kyc_status === 'pending').length,
    verified: users.filter(u => u.kyc_status === 'verified').length,
    rejected: users.filter(u => u.kyc_status === 'rejected').length,
    none: users.filter(u => !u.kyc_status || u.kyc_status === 'none').length,
  };

  const statusConfig: Record<string, { color: string; bg: string; Icon: any; label: string }> = {
    pending: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', Icon: Clock, label: 'Pending Review' },
    verified: { color: 'text-profit', bg: 'bg-profit/10', Icon: CheckCircle, label: 'Verified' },
    rejected: { color: 'text-loss', bg: 'bg-loss/10', Icon: XCircle, label: 'Rejected' },
    none: { color: 'text-slate-400', bg: 'bg-white/5', Icon: AlertCircle, label: 'Not Submitted' },
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-xl border ${notification.type === 'success' ? 'bg-profit/10 border-profit/20 text-profit' : 'bg-loss/10 border-loss/20 text-loss'}`}>
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cream">KYC Verification</h1>
          <p className="text-sm text-slate-400 mt-1">Review and manage user identity verification</p>
        </div>
        <button onClick={loadUsers} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
          <RefreshCw className={`w-5 h-5 text-cream/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {(['all', 'pending', 'verified', 'rejected', 'none'] as Filter[]).map(key => {
          const sc = key === 'all'
            ? { color: 'text-cream', bg: 'bg-white/5', Icon: User, label: 'All Users' }
            : statusConfig[key];
          return (
            <button key={key} onClick={() => setFilter(key)}
              className={`p-4 rounded-xl border transition-all text-left ${
                filter === key ? 'border-gold/50 bg-gold/5' : 'border-white/5 bg-white/5 hover:border-white/10'
              }`}>
              <p className="text-2xl font-bold text-cream">{counts[key]}</p>
              <p className={`text-xs ${sc.color}`}>{sc.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold" />
      </div>

      {/* User List */}
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
          filtered.map(u => {
            const s = u.kyc_status || 'none';
            const sc = statusConfig[s] || statusConfig.none;
            return (
              <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white/5 rounded-xl border border-white/5 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-electric/20 to-gold/20 rounded-xl flex items-center justify-center text-cream font-bold text-sm">
                      {(u.first_name?.[0] || u.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-cream">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-cream/40">{u.email}</p>
                      <p className="text-[10px] text-cream/30 mt-0.5">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${sc.bg} ${sc.color}`}>
                      <sc.Icon className="w-3.5 h-3.5" /> {sc.label}
                    </span>

                    {(s === 'pending' || s === 'none' || s === 'rejected') && (
                      <div className="flex gap-2">
                        <button onClick={() => updateKYC(u.id, 'verified')} disabled={processing === u.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-profit/20 text-profit text-xs font-semibold rounded-lg hover:bg-profit/30 transition-all border border-profit/20 disabled:opacity-50">
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        {s !== 'rejected' && (
                          <button onClick={() => updateKYC(u.id, 'rejected')} disabled={processing === u.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-loss/20 text-loss text-xs font-semibold rounded-lg hover:bg-loss/30 transition-all border border-loss/20 disabled:opacity-50">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        )}
                      </div>
                    )}

                    {s === 'verified' && (
                      <span className="text-xs text-profit/60 font-medium">Approved</span>
                    )}

                    {/* View Details button */}
                    {u.kyc_data && (
                      <button onClick={() => setSelectedUser(selectedUser?.id === u.id ? null : u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-cream/60 text-xs font-medium rounded-lg hover:bg-white/10 transition-all border border-white/5">
                        <User className="w-3.5 h-3.5" /> {selectedUser?.id === u.id ? 'Hide' : 'View'} Details
                      </button>
                    )}
                  </div>
                </div>

                {/* KYC Detail Panel */}
                <AnimatePresence>
                  {selectedUser?.id === u.id && u.kyc_data && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-white/5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {u.kyc_data.date_of_birth && (
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Date of Birth</p>
                            <p className="text-sm text-cream mt-0.5">{u.kyc_data.date_of_birth}</p>
                          </div>
                        )}
                        {u.kyc_data.country && (
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Country</p>
                            <p className="text-sm text-cream mt-0.5">{u.kyc_data.country}</p>
                          </div>
                        )}
                        {u.kyc_data.address && (
                          <div className="bg-white/5 rounded-lg p-3 sm:col-span-2">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Address</p>
                            <p className="text-sm text-cream mt-0.5">
                              {u.kyc_data.address}, {u.kyc_data.city}, {u.kyc_data.state} {u.kyc_data.postal_code}
                            </p>
                          </div>
                        )}
                        {u.kyc_data.id_type && (
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">ID Type</p>
                            <p className="text-sm text-cream mt-0.5 capitalize">{u.kyc_data.id_type.replace('_', ' ')}</p>
                          </div>
                        )}
                        {u.kyc_data.id_number && (
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">ID Number</p>
                            <p className="text-sm text-cream mt-0.5 font-mono">{u.kyc_data.id_number}</p>
                          </div>
                        )}
                        {u.kyc_submitted_at && (
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Submitted</p>
                            <p className="text-sm text-cream mt-0.5">{new Date(u.kyc_submitted_at).toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                      {/* Document indicators */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {u.kyc_data.id_front_doc && (
                          <span className="px-2 py-1 bg-electric/10 text-electric text-xs rounded-md">✓ ID Front</span>
                        )}
                        {u.kyc_data.id_back_doc && (
                          <span className="px-2 py-1 bg-electric/10 text-electric text-xs rounded-md">✓ ID Back</span>
                        )}
                        {u.kyc_data.selfie_doc && (
                          <span className="px-2 py-1 bg-electric/10 text-electric text-xs rounded-md">✓ Selfie</span>
                        )}
                        {u.kyc_data.proof_of_address_doc && (
                          <span className="px-2 py-1 bg-electric/10 text-electric text-xs rounded-md">✓ Proof of Address</span>
                        )}
                        {!u.kyc_data.id_front_doc && !u.kyc_data.selfie_doc && (
                          <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 text-xs rounded-md">⚠ No documents uploaded</span>
                        )}
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

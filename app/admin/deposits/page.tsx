'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Search,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';

interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  method: string | null;
  method_name: string | null;
  network: string | null;
  transaction_ref: string | null;
  tx_hash: string | null;
  proof_url: string | null;
  status: string;
  admin_note: string | null;
  rejection_reason: string | null;
  note: string | null;
  processed_at: string | null;
  created_at: string;
  users?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    tier_level: number;
    balance_available: number;
  };
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  processing: 'bg-blue-500/20 text-blue-400',
  confirmed: 'bg-profit/20 text-profit',
  approved: 'bg-profit/20 text-profit',
  rejected: 'bg-loss/20 text-loss',
  expired: 'bg-slate-500/20 text-slate-400',
};

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'rejected';

export default function AdminDepositsPage() {
  const { getAuthHeader } = useAdminAuthStore();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showDetailModal, setShowDetailModal] = useState<Deposit | null>(null);

  const loadDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        filter === 'all'
          ? '/api/admin/deposits'
          : `/api/admin/deposits?status=${filter}`;

      const res = await fetch(url, { headers: getAuthHeader() });
      const data = await res.json();

      if (data.success) {
        setDeposits(data.deposits || []);
      }
    } catch (err) {
      console.error('Failed to load deposits:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, getAuthHeader]);

  useEffect(() => {
    loadDeposits();
  }, [loadDeposits]);

  async function handleApprove(depositId: string) {
    setActionLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/deposits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ depositId, action: 'approve' }),
      });
      const data = await res.json();
      setMessage(data.message || (data.success ? 'Approved!' : data.error));
      if (data.success) await loadDeposits();
    } catch {
      setMessage('Failed to approve');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(depositId: string) {
    setActionLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/deposits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          depositId,
          action: 'reject',
          rejectedReason: rejectReason || 'Rejected by admin',
        }),
      });
      const data = await res.json();
      setMessage(data.message || (data.success ? 'Rejected' : data.error));
      if (data.success) {
        setShowRejectModal(null);
        setRejectReason('');
        await loadDeposits();
      }
    } catch {
      setMessage('Failed to reject');
    } finally {
      setActionLoading(false);
    }
  }

const pendingCount = deposits.filter((d) => d.status === 'pending').length;

const confirmedCount = deposits.filter((d) =>
  ['confirmed', 'approved', 'completed'].includes(d.status)
).length;

const totalConfirmed = deposits
  .filter((d) => ['confirmed', 'approved', 'completed'].includes(d.status))
  .reduce((sum, d) => sum + Number(d.amount), 0);


  const filtered = deposits.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const email = (d.users?.email || '').toLowerCase();
    const name = `${d.users?.first_name || ''} ${d.users?.last_name || ''}`.toLowerCase();
    const ref = (d.transaction_ref || d.tx_hash || '').toLowerCase();
    return email.includes(q) || name.includes(q) || ref.includes(q) || d.id.includes(q);
  });

  function getUserDisplay(d: Deposit) {
    const u = d.users;
    if (!u) return { name: 'Unknown', email: d.user_id?.slice(0, 8) || '' };
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'User';
    return { name, email: u.email };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cream flex items-center gap-2">
            <Wallet className="w-6 h-6 text-gold" />
            Deposit Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review and process user deposit requests. Approved deposits credit user balances.
          </p>
        </div>
        <button
          onClick={loadDeposits}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-obsidian rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-cream">{pendingCount}</p>
              <p className="text-sm text-amber-400">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-obsidian rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-profit" />
            <div>
              <p className="text-2xl font-bold text-cream">{confirmedCount}</p>
              <p className="text-sm text-profit">Confirmed</p>
            </div>
          </div>
        </div>
        <div className="bg-obsidian rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-gold" />
            <div>
              <p className="text-2xl font-bold text-cream">${totalConfirmed.toLocaleString()}</p>
              <p className="text-sm text-cream/60">Total Deposited</p>
            </div>
          </div>
        </div>
        <div className="bg-obsidian rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Wallet className="w-8 h-8 text-electric" />
            <div>
              <p className="text-2xl font-bold text-cream">{deposits.length}</p>
              <p className="text-sm text-cream/60">Total Requests</p>
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="p-3 bg-gold/10 border border-gold/20 rounded-xl text-sm text-cream flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-cream/40 hover:text-cream">✕</button>
        </div>
      )}

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {(['pending', 'all', 'confirmed', 'rejected'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-gold/20 text-gold'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500/30 text-amber-400 rounded-full text-xs">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, tx..."
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-obsidian rounded-2xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 text-slate-500 animate-spin mx-auto mb-2" />
            <p className="text-slate-500">Loading deposits...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500">No deposits found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Method</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">TX Ref</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const u = getUserDisplay(d);
                  const txRef = d.transaction_ref || d.tx_hash || '';
                  return (
                    <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="text-sm text-cream">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-cream font-semibold">
                        ${Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-xs text-slate-500 ml-1">{d.currency || 'USD'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-cream">{d.method_name || d.method || 'Crypto'}</p>
                        {d.network && <p className="text-xs text-slate-500">{d.network}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {txRef ? (
                          <span className="text-xs font-mono text-slate-400" title={txRef}>
                            {txRef.slice(0, 14)}{txRef.length > 14 ? '…' : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STATUS_STYLES[d.status] || 'bg-white/10 text-slate-400'}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(d.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-[10px]">{new Date(d.created_at).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        {d.status === 'pending' || d.status === 'processing' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(d.id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-profit/20 text-profit text-xs rounded-lg hover:bg-profit/30 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setShowRejectModal(d.id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-loss/20 text-loss text-xs rounded-lg hover:bg-loss/30 transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => setShowDetailModal(d)}
                              className="px-2 py-1.5 bg-white/5 text-slate-400 text-xs rounded-lg hover:bg-white/10"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 items-center">
                            {d.status === 'rejected' && (d.rejection_reason || d.note) && (
                              <span className="text-xs text-slate-500 max-w-[120px] truncate" title={d.rejection_reason || d.note || ''}>
                                {(d.rejection_reason || d.note || '').slice(0, 30)}
                              </span>
                            )}
                            <button
                              onClick={() => setShowDetailModal(d)}
                              className="px-2 py-1.5 bg-white/5 text-slate-400 text-xs rounded-lg hover:bg-white/10"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="bg-charcoal border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-lg font-bold text-cream mb-4">Reject Deposit</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (optional)..."
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:border-loss/40 focus:outline-none text-sm"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowRejectModal(null)}
                  className="flex-1 py-2 bg-white/5 text-slate-300 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(showRejectModal)}
                  disabled={actionLoading}
                  className="flex-1 py-2 bg-loss/20 text-loss font-semibold rounded-xl disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowDetailModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="bg-charcoal border border-white/10 rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            >
              <h3 className="text-lg font-bold text-cream mb-4">Deposit Details</h3>
              <div className="space-y-3 text-sm">
                <Row label="User" value={`${getUserDisplay(showDetailModal).name} (${getUserDisplay(showDetailModal).email})`} />
                <Row label="Amount" value={`$${Number(showDetailModal.amount).toLocaleString()} ${showDetailModal.currency || 'USD'}`} bold />
                <Row label="Method" value={showDetailModal.method_name || showDetailModal.method || 'Crypto'} />
                {showDetailModal.network && <Row label="Network" value={showDetailModal.network} />}
                {(showDetailModal.transaction_ref || showDetailModal.tx_hash) && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400 shrink-0">TX Ref</span>
                    <span className="text-cream font-mono text-xs break-all text-right">
                      {showDetailModal.transaction_ref || showDetailModal.tx_hash}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[showDetailModal.status] || ''}`}>
                    {showDetailModal.status}
                  </span>
                </div>
                <Row label="Submitted" value={new Date(showDetailModal.created_at).toLocaleString()} />
                {showDetailModal.processed_at && (
                  <Row label="Processed" value={new Date(showDetailModal.processed_at).toLocaleString()} />
                )}
                {showDetailModal.proof_url && (
                  <div>
                    <span className="text-slate-400 block mb-2">Payment Proof</span>
                    <img src={showDetailModal.proof_url} alt="Proof" className="max-w-full rounded-xl border border-white/10" />
                  </div>
                )}
                {(showDetailModal.rejection_reason || showDetailModal.note) && (
                  <Row label="Reason" value={showDetailModal.rejection_reason || showDetailModal.note || ''} loss />
                )}
                {showDetailModal.admin_note && (
                  <Row label="Admin Note" value={showDetailModal.admin_note} />
                )}
                {showDetailModal.users?.balance_available != null && (
                  <Row label="User Balance" value={`$${Number(showDetailModal.users.balance_available).toLocaleString()}`} />
                )}
              </div>

              {/* Actions if still pending */}
              {(showDetailModal.status === 'pending' || showDetailModal.status === 'processing') && (
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => { handleApprove(showDetailModal.id); setShowDetailModal(null); }}
                    disabled={actionLoading}
                    className="flex-1 py-2 bg-profit/20 text-profit font-semibold rounded-xl hover:bg-profit/30 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => { setShowRejectModal(showDetailModal.id); setShowDetailModal(null); }}
                    className="flex-1 py-2 bg-loss/20 text-loss font-semibold rounded-xl hover:bg-loss/30"
                  >
                    Reject
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowDetailModal(null)}
                className="w-full mt-3 py-2 bg-white/5 text-slate-300 rounded-xl hover:bg-white/10 transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value, bold, loss }: { label: string; value: string; bold?: boolean; loss?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={`${loss ? 'text-loss' : 'text-cream'} ${bold ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}

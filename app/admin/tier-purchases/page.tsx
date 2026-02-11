'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  DollarSign,
  Gift,
  Search,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Eye,
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';

interface TierPurchase {
  id: string;
  user_id: string;
  tier_level: number;
  tier_code: string;
  price_amount: number;
  bonus_amount: number;
  currency: string;
  payment_asset: string | null;
  payment_network: string | null;
  tx_hash: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  users?: {
    email: string;
    first_name: string;
    last_name: string;
    tier_level: number;
    tier_active: boolean;
  };
}

const TIER_NAMES: Record<string, string> = {
  starter: 'Starter',
  trader: 'Trader',
  professional: 'Professional',
  elite: 'Elite',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-profit/20 text-profit',
  rejected: 'bg-loss/20 text-loss',
};

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminTierPurchasesPage() {
  const { getAuthHeader } = useAdminAuthStore();
  const [purchases, setPurchases] = useState<TierPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        filter === 'all'
          ? '/api/admin/tier-purchases'
          : `/api/admin/tier-purchases?status=${filter}`;

      const res = await fetch(url, { headers: getAuthHeader() });
      const data = await res.json();

      if (data.success) {
        setPurchases(data.purchases || []);
      }
    } catch (err) {
      console.error('Failed to load tier purchases:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, getAuthHeader]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  async function handleApprove(purchaseId: string) {
    setActionLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/tier-purchases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ purchaseId, action: 'approve' }),
      });

      const data = await res.json();
      setMessage(data.message || (data.success ? 'Approved!' : data.error));
      if (data.success) {
        await loadPurchases();
      }
    } catch {
      setMessage('Failed to approve');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(purchaseId: string) {
    setActionLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/tier-purchases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          purchaseId,
          action: 'reject',
          rejectedReason: rejectReason || 'Rejected by admin',
        }),
      });

      const data = await res.json();
      setMessage(data.message || (data.success ? 'Rejected' : data.error));
      if (data.success) {
        setShowRejectModal(null);
        setRejectReason('');
        await loadPurchases();
      }
    } catch {
      setMessage('Failed to reject');
    } finally {
      setActionLoading(false);
    }
  }

  const pendingCount = purchases.filter((p) => p.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cream flex items-center gap-2">
            <Shield className="w-6 h-6 text-gold" />
            Tier Purchases
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Approve or reject tier purchase requests. Approved purchases grant tier access + 40% bonus credit.
          </p>
        </div>
        <button
          onClick={loadPurchases}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-obsidian rounded-xl border border-white/10 p-4">
          <p className="text-xs text-slate-500">Pending</p>
          <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
        </div>
        <div className="bg-obsidian rounded-xl border border-white/10 p-4">
          <p className="text-xs text-slate-500">Approved</p>
          <p className="text-2xl font-bold text-profit">
            {purchases.filter((p) => p.status === 'approved').length}
          </p>
        </div>
        <div className="bg-obsidian rounded-xl border border-white/10 p-4">
          <p className="text-xs text-slate-500">Total Revenue</p>
          <p className="text-2xl font-bold text-cream">
            ${purchases
              .filter((p) => p.status === 'approved')
              .reduce((sum, p) => sum + Number(p.price_amount), 0)
              .toLocaleString()}
          </p>
        </div>
        <div className="bg-obsidian rounded-xl border border-white/10 p-4">
          <p className="text-xs text-slate-500">Total Bonuses</p>
          <p className="text-2xl font-bold text-gold">
            ${purchases
              .filter((p) => p.status === 'approved')
              .reduce((sum, p) => sum + Number(p.bonus_amount), 0)
              .toLocaleString()}
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="p-3 bg-gold/10 border border-gold/20 rounded-xl text-sm text-cream">
          {message}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['pending', 'all', 'approved', 'rejected'] as FilterStatus[]).map((f) => (
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

      {/* Table */}
      <div className="bg-obsidian rounded-2xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 text-slate-500 animate-spin mx-auto mb-2" />
            <p className="text-slate-500">Loading...</p>
          </div>
        ) : purchases.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500">No tier purchases found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    User
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Tier
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Amount
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Bonus
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    TX Hash
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="text-sm text-cream">
                        {p.users?.first_name || ''} {p.users?.last_name || ''}
                      </p>
                      <p className="text-xs text-slate-500">{p.users?.email || p.user_id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-cream">
                        {TIER_NAMES[p.tier_code] || p.tier_code}
                      </span>
                      <span className="text-xs text-slate-500 ml-1">(L{p.tier_level})</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-cream font-medium">
                      ${Number(p.price_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gold">
                      +${Number(p.bonus_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {p.tx_hash ? (
                        <span className="text-xs font-mono text-slate-400">
                          {p.tx_hash.slice(0, 10)}...
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          STATUS_STYLES[p.status] || ''
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {p.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(p.id)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-profit/20 text-profit text-xs rounded-lg hover:bg-profit/30 transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setShowRejectModal(p.id)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-loss/20 text-loss text-xs rounded-lg hover:bg-loss/30 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : p.status === 'rejected' && p.rejected_reason ? (
                        <span className="text-xs text-slate-500" title={p.rejected_reason}>
                          {p.rejected_reason.slice(0, 30)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
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
              onClick={(e) => e.stopPropagation()}
              className="bg-charcoal border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-lg font-bold text-cream mb-4">Reject Tier Purchase</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:border-loss/40 focus:outline-none text-sm"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowRejectModal(null)}
                  className="flex-1 py-2 bg-white/5 text-slate-300 rounded-xl"
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
    </div>
  );
}

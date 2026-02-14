'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Calendar,
  Download,
  Gift,
  CreditCard,
  Users,
  Wallet,
  History,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useStore } from '@/lib/supabase/store-supabase';

type ActivityKind = 'trade' | 'deposit' | 'withdrawal' | 'tier' | 'bonus' | 'referral' | 'all';

type ActivityItem = {
  id: string;
  kind: 'trade' | 'deposit' | 'withdrawal' | 'tier' | 'bonus' | 'referral';
  label: string;
  sublabel: string;
  amount: number;
  pnl: number;
  status: string;
  created_at: string;
  // Trade-specific fields
  direction?: string;
  entry_price?: number;
  exit_price?: number;
  multiplier?: number;
  market_type?: string;
};

function fmt(n: number, dp = 2) {
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(dp);
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FullActivityHistoryPage() {
  const { user } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKind, setFilterKind] = useState<ActivityKind>('all');
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const firstLoadRef = useRef(false);

  const canUseSupabase =
    (typeof isSupabaseConfigured === 'function' ? isSupabaseConfigured() : !!isSupabaseConfigured) && !!supabase;

  const fetchAllActivity = useCallback(async () => {
    if (!user?.id || !canUseSupabase) {
      setError('Please sign in to view your activity history.');
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const items: ActivityItem[] = [];

      // Calculate date filter
      let dateFilter: Date | null = null;
      if (dateRange === '7d') {
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '30d') {
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '90d') {
        dateFilter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      }

      // Fetch trades
      let tradesQuery = supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (dateFilter) {
        tradesQuery = tradesQuery.gte('created_at', dateFilter.toISOString());
      }

      const { data: trades } = await tradesQuery;

      (trades || []).forEach((t: any) => {
        const pnl = Number(t.profit_loss ?? t.pnl ?? t.floating_pnl ?? 0);
        const direction = t.direction || t.type || 'Trade';
        const marketType = t.market_type || t.asset_type || '';

        items.push({
          id: `trade-${t.id}`,
          kind: 'trade',
          label: t.symbol || t.pair || t.asset || 'Trade',
          sublabel: `${direction.toUpperCase()} • ${marketType.toUpperCase() || 'SPOT'} • x${t.multiplier || t.leverage || 1}`,
          amount: Number(t.amount ?? t.investment ?? 0),
          pnl,
          status: t.status || 'closed',
          created_at: t.created_at || t.opened_at,
          direction: direction,
          entry_price: Number(t.entry_price || 0),
          exit_price: Number(t.exit_price || 0),
          multiplier: Number(t.multiplier || t.leverage || 1),
          market_type: marketType,
        });
      });

      // Fetch deposits
      let depositsQuery = supabase
        .from('deposits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (dateFilter) {
        depositsQuery = depositsQuery.gte('created_at', dateFilter.toISOString());
      }

      const { data: deposits } = await depositsQuery;

      (deposits || []).forEach((d: any) => {
        items.push({
          id: `dep-${d.id}`,
          kind: 'deposit',
          label: 'Deposit',
          sublabel: `${d.network || d.currency || d.method || 'Funds'} • ${d.status}`,
          amount: Number(d.amount ?? 0),
          pnl: Number(d.amount ?? 0),
          status: d.status,
          created_at: d.created_at,
        });
      });

      // Fetch withdrawals
      let withdrawalsQuery = supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (dateFilter) {
        withdrawalsQuery = withdrawalsQuery.gte('created_at', dateFilter.toISOString());
      }

      const { data: withdrawals } = await withdrawalsQuery;

      (withdrawals || []).forEach((w: any) => {
        items.push({
          id: `wd-${w.id}`,
          kind: 'withdrawal',
          label: 'Withdrawal',
          sublabel: `${w.method || w.network || 'Funds'} • ${w.status}`,
          amount: Number(w.amount ?? 0),
          pnl: -Number(w.amount ?? 0),
          status: w.status,
          created_at: w.created_at,
        });
      });

      // Fetch tier purchases
      let tierQuery = supabase
        .from('tier_purchases')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (dateFilter) {
        tierQuery = tierQuery.gte('created_at', dateFilter.toISOString());
      }

      const { data: tierPurchases } = await tierQuery;

      const tierNames: Record<number, string> = {
        1: 'Starter',
        2: 'Trader',
        3: 'Professional',
        4: 'Elite',
      };

      (tierPurchases || []).forEach((tp: any) => {
        items.push({
          id: `tier-${tp.id}`,
          kind: 'tier',
          label: `${tierNames[tp.tier_level] || 'Tier'} Purchase`,
          sublabel: `Tier ${tp.tier_level} • Bonus: $${Number(tp.bonus_amount ?? 0).toFixed(2)}`,
          amount: Number(tp.price_amount ?? 0),
          pnl: tp.status === 'approved' ? Number(tp.bonus_amount ?? 0) : 0,
          status: tp.status,
          created_at: tp.created_at,
        });
      });

      // Fetch bonus transactions
      let bonusQuery = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .in('type', ['tier_bonus', 'bonus', 'deposit', 'referral_bonus'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (dateFilter) {
        bonusQuery = bonusQuery.gte('created_at', dateFilter.toISOString());
      }

      const { data: bonuses } = await bonusQuery;

      (bonuses || []).forEach((b: any) => {
        const typeLabel =
          b.type === 'tier_bonus'
            ? 'Tier Bonus'
            : b.type === 'referral_bonus'
              ? 'Referral Bonus'
              : b.type === 'deposit'
                ? 'Deposit Credit'
                : 'Bonus';

        items.push({
          id: `tx-${b.id}`,
          kind: 'bonus',
          label: typeLabel,
          sublabel: b.description || b.reference_type || 'Credit',
          amount: Math.abs(Number(b.amount ?? 0)),
          pnl: Number(b.amount ?? 0),
          status: 'completed',
          created_at: b.created_at,
        });
      });

      // Fetch referrals
      let referralsQuery = supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (dateFilter) {
        referralsQuery = referralsQuery.gte('created_at', dateFilter.toISOString());
      }

      const { data: referrals } = await referralsQuery;

      (referrals || []).forEach((r: any) => {
        items.push({
          id: `ref-${r.id}`,
          kind: 'referral',
          label: 'Referral',
          sublabel: r.reward_paid
            ? `Earned $${Number(r.reward_amount || 0).toFixed(2)}`
            : 'Pending tier purchase',
          amount: Number(r.reward_amount ?? 0),
          pnl: r.reward_paid ? Number(r.reward_amount ?? 0) : 0,
          status: r.reward_paid ? 'completed' : 'pending',
          created_at: r.created_at,
        });
      });

      // Sort by date descending
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setActivities(items);
    } catch (e: any) {
      setError(e?.message || 'Failed to load activity history');
    } finally {
      setLoading(false);
    }
  }, [user?.id, canUseSupabase, dateRange]);

  useEffect(() => {
    if (firstLoadRef.current) return;
    firstLoadRef.current = true;
    fetchAllActivity();
  }, [fetchAllActivity]);

  useEffect(() => {
    if (firstLoadRef.current) {
      fetchAllActivity();
    }
  }, [dateRange, fetchAllActivity]);

  // Filtered activities
  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return activities.filter((item) => {
      // Kind filter
      if (filterKind !== 'all' && item.kind !== filterKind) return false;

      // Search filter
      if (query) {
        const matchLabel = item.label.toLowerCase().includes(query);
        const matchSublabel = item.sublabel.toLowerCase().includes(query);
        if (!matchLabel && !matchSublabel) return false;
      }

      return true;
    });
  }, [activities, filterKind, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterKind, dateRange]);

  // Stats
  const stats = useMemo(() => {
    const trades = activities.filter((a) => a.kind === 'trade');
    const deposits = activities.filter((a) => a.kind === 'deposit');
    const withdrawals = activities.filter((a) => a.kind === 'withdrawal');

    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalDeposited = deposits
      .filter((d) => d.status === 'approved' || d.status === 'completed')
      .reduce((sum, d) => sum + d.amount, 0);
    const totalWithdrawn = withdrawals
      .filter((w) => w.status === 'approved' || w.status === 'completed')
      .reduce((sum, w) => sum + w.amount, 0);

    const winTrades = trades.filter((t) => t.pnl > 0).length;
    const lossTrades = trades.filter((t) => t.pnl < 0).length;

    return {
      totalTrades: trades.length,
      totalPnl,
      totalDeposited,
      totalWithdrawn,
      winRate: trades.length > 0 ? ((winTrades / trades.length) * 100).toFixed(1) : '0',
      winTrades,
      lossTrades,
    };
  }, [activities]);

  const getKindIcon = (kind: ActivityItem['kind']) => {
    switch (kind) {
      case 'trade':
        return TrendingUp;
      case 'deposit':
        return ArrowUpRight;
      case 'withdrawal':
        return ArrowDownRight;
      case 'tier':
        return CreditCard;
      case 'bonus':
        return Gift;
      case 'referral':
        return Users;
      default:
        return History;
    }
  };

  const getKindColor = (kind: ActivityItem['kind'], pnl: number) => {
    switch (kind) {
      case 'deposit':
        return { bg: 'bg-electric/20', text: 'text-electric' };
      case 'withdrawal':
        return { bg: 'bg-orange-500/20', text: 'text-orange-400' };
      case 'tier':
        return { bg: 'bg-gold/20', text: 'text-gold' };
      case 'bonus':
        return { bg: 'bg-purple-500/20', text: 'text-purple-400' };
      case 'referral':
        return { bg: 'bg-cyan-500/20', text: 'text-cyan-400' };
      case 'trade':
      default:
        return pnl >= 0
          ? { bg: 'bg-profit/20', text: 'text-profit' }
          : { bg: 'bg-loss/20', text: 'text-loss' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'completed':
      case 'won':
      case 'closed':
        return 'text-emerald-400';
      case 'pending':
      case 'active':
      case 'open':
        return 'text-yellow-400';
      case 'rejected':
      case 'lost':
      case 'liquidated':
        return 'text-rose-400';
      default:
        return 'text-white/50';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-gold" />
            Activity History
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Complete history of all your trades, deposits, withdrawals, and more
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchAllActivity()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 disabled:opacity-50 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <p className="text-xs text-white/50 mb-1">Total Trades</p>
          <p className="text-xl font-bold text-white">{stats.totalTrades}</p>
          <p className="text-xs text-white/40 mt-1">
            Win Rate: <span className="text-profit">{stats.winRate}%</span>
          </p>
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <p className="text-xs text-white/50 mb-1">Total P/L</p>
          <p className={`text-xl font-bold ${stats.totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {stats.totalPnl >= 0 ? '+' : ''}${fmt(stats.totalPnl)}
          </p>
          <p className="text-xs text-white/40 mt-1">
            W: {stats.winTrades} / L: {stats.lossTrades}
          </p>
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <p className="text-xs text-white/50 mb-1">Total Deposited</p>
          <p className="text-xl font-bold text-electric">${fmt(stats.totalDeposited)}</p>
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <p className="text-xs text-white/50 mb-1">Total Withdrawn</p>
          <p className="text-xl font-bold text-orange-400">${fmt(stats.totalWithdrawn)}</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activity..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 outline-none text-sm text-white placeholder:text-white/40 focus:border-white/20"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Type Filter */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
            {(['all', 'trade', 'deposit', 'withdrawal', 'tier', 'bonus', 'referral'] as ActivityKind[]).map(
              (kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setFilterKind(kind)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    filterKind === kind
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {kind === 'all' ? 'All' : kind.charAt(0).toUpperCase() + kind.slice(1)}
                </button>
              )
            )}
          </div>

          {/* Date Range */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
            {(['all', '7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  dateRange === range
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {range === 'all' ? 'All Time' : range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="px-4 py-12 text-center text-white/60">Loading activity...</div>
        ) : pageItems.length === 0 ? (
          <div className="px-4 py-12 text-center text-white/60">
            {searchQuery || filterKind !== 'all'
              ? 'No matching activity found.'
              : 'No activity yet.'}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {pageItems.map((item) => {
              const Icon = getKindIcon(item.kind);
              const colors = getKindColor(item.kind, item.pnl);
              const isPositive =
                item.kind === 'deposit' ||
                item.kind === 'bonus' ||
                item.kind === 'tier' ||
                (item.kind === 'referral' && item.pnl > 0) ||
                item.pnl >= 0;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.bg}`}
                    >
                      <Icon className={`w-5 h-5 ${colors.text}`} />
                    </div>

                    {/* Info */}
                    <div>
                      <p className="font-medium text-white">{item.label}</p>
                      <p className="text-xs text-white/50">{item.sublabel}</p>
                      <p className="text-xs text-white/30 mt-0.5">{formatDate(item.created_at)}</p>
                    </div>
                  </div>

                  {/* Amount & Status */}
                  <div className="text-right">
                    <p className={`font-semibold ${colors.text}`}>
                      {item.kind === 'trade' ? (
                        <>
                          {item.pnl >= 0 ? '+' : ''}${fmt(item.pnl)}
                        </>
                      ) : item.kind === 'withdrawal' ? (
                        <>-${fmt(item.amount)}</>
                      ) : (
                        <>+${fmt(item.amount)}</>
                      )}
                    </p>

                    {item.kind === 'trade' && (
                      <p className="text-xs text-white/40">${fmt(item.amount)} invested</p>
                    )}

                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-[10px] font-medium ${getStatusColor(
                        item.status
                      )} bg-white/5`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length > pageSize && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-white/5 text-xs text-white/60">
            <div>
              Page {page} / {totalPages} • {filtered.length} total
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {!canUseSupabase && (
        <div className="text-xs text-yellow-200/80">
          Supabase client not configured — cannot fetch activity history.
        </div>
      )}
    </div>
  );
}

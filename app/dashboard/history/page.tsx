'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

type FxStatus = 'active' | 'closed' | 'liquidated' | 'stopped_out' | 'take_profit';
type StatusFilter = 'all' | 'open' | 'closed' | 'liquidated' | 'stopped' | 'tp';

type TradeRow = {
  id: string;
  asset?: string;
  pair?: string;
  symbol?: string;

  asset_type?: string;
  market_type?: string;

  direction?: string;
  type?: string;
  direction_int?: number;

  investment?: number;
  amount?: number;

  multiplier?: number;
  leverage?: number;

  entry_price?: number;
  current_price?: number;
  exit_price?: number;

  stop_loss?: number | null;
  take_profit?: number | null;

  floating_pnl?: number;
  pnl?: number;
  profit_loss?: number;

  status?: string;
  opened_at?: string;
  closed_at?: string | null;
  updated_at?: string;
  close_reason?: string | null;
};

type FxUiTrade = {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  investment: number;
  multiplier: number;

  entry: number;
  current: number;
  exit?: number;

  pnl: number;
  roi: number;

  status: FxStatus;
  openedAt?: string;
  closedAt?: string;
  reason?: string;
};

function clampNum(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toDirInt(row: TradeRow): 1 | -1 {
  const di = clampNum(row.direction_int, 0);
  if (di === 1 || di === -1) return di as 1 | -1;
  const s = String(row.direction ?? row.type ?? '').toLowerCase();
  return s === 'buy' || s === 'long' || s === 'up' ? 1 : -1;
}

function toSide(di: 1 | -1): 'buy' | 'sell' {
  return di === 1 ? 'buy' : 'sell';
}

function normFxStatus(s: unknown): FxStatus {
  const v = String(s ?? '').toLowerCase();
  if (v === 'open' || v === 'active' || v === 'pending') return 'active';
  if (v === 'closed') return 'closed';
  if (v === 'liquidated') return 'liquidated';
  if (v === 'stopped_out' || v === 'stop_loss') return 'stopped_out';
  if (v === 'take_profit') return 'take_profit';
  return 'closed';
}

function isFxRow(r: TradeRow) {
  const mt = String(r.market_type ?? '').toLowerCase();
  const at = String(r.asset_type ?? '').toLowerCase();
  return mt === 'fx' || at === 'forex' || at === 'fx';
}

function fmt(n: number, dp = 2) {
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(dp);
}

function fmtPx(n: number) {
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(n < 10 ? 5 : 2);
}

function mapFx(row: TradeRow): FxUiTrade {
  const pair = String(row.asset ?? row.pair ?? row.symbol ?? '').trim() || '—';
  const di = toDirInt(row);
  const side = toSide(di);

  const investment = clampNum(row.investment ?? row.amount, 0);
  const multiplier = clampNum(row.multiplier ?? row.leverage, 1);

  const entry = clampNum(row.entry_price, 0);
  const current = clampNum(row.current_price ?? row.entry_price, entry);
  const exit = row.exit_price != null ? clampNum(row.exit_price, 0) : undefined;

  // prefer DB pnl fields
  const pnlDb =
    row.profit_loss != null
      ? clampNum(row.profit_loss, 0)
      : row.pnl != null
        ? clampNum(row.pnl, 0)
        : row.floating_pnl != null
          ? clampNum(row.floating_pnl, 0)
          : 0;

  const pnl =
    pnlDb !== 0
      ? pnlDb
      : entry > 0
        ? di * investment * multiplier * ((current - entry) / entry)
        : 0;

  const roi = investment > 0 ? (pnl / investment) * 100 : 0;

  return {
    id: row.id,
    pair,
    side,
    investment,
    multiplier,
    entry,
    current,
    exit,
    pnl,
    roi,
    status: normFxStatus(row.status),
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? undefined,
    reason: row.close_reason ?? undefined,
  };
}

export default function FxHistorySimplePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<FxUiTrade[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const firstLoadRef = useRef(false);

  const canUseSupabase =
    (typeof isSupabaseConfigured === 'function' ? isSupabaseConfigured() : !!isSupabaseConfigured) && !!supabase;

  const getToken = async () => {
    if (!canUseSupabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session?.access_token ?? null;
  };

  const fetchFxHistory = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in to view your FX trades.');

      const res = await fetch('/api/trades?limit=500', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || `Failed (${res.status})`);

      const raw: TradeRow[] = Array.isArray(json.trades) ? json.trades : [];
      const fx = raw.filter(isFxRow).map(mapFx);

      // newest first
      fx.sort((a, b) => {
        const at = Date.parse(a.openedAt || a.closedAt || '') || 0;
        const bt = Date.parse(b.openedAt || b.closedAt || '') || 0;
        return bt - at;
      });

      setRows(fx);
    } catch (e: any) {
      setError(e?.message || 'Failed to load FX history');
    } finally {
      setLoading(false);
    }
  }, [canUseSupabase]);

  useEffect(() => {
    if (firstLoadRef.current) return;
    firstLoadRef.current = true;
    fetchFxHistory();
  }, [fetchFxHistory]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((t) => {
      const matchQ = !query || t.pair.toLowerCase().includes(query);

      const matchF =
        filter === 'all'
          ? true
          : filter === 'open'
            ? t.status === 'active'
            : filter === 'closed'
              ? t.status === 'closed'
              : filter === 'liquidated'
                ? t.status === 'liquidated'
                : filter === 'stopped'
                  ? t.status === 'stopped_out'
                  : t.status === 'take_profit';

      return matchQ && matchF;
    });
  }, [rows, q, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [q, filter]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status === 'active').length;
    const closed = rows.filter((r) => r.status !== 'active').length;
    const pnl = rows.reduce((acc, r) => acc + clampNum(r.pnl, 0), 0);
    return { total: rows.length, open, closed, pnl };
  }, [rows]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-white">FX History</div>
          <div className="text-xs text-white/60">
            Total: {loading ? '—' : stats.total} • Open: {loading ? '—' : stats.open} • Closed: {loading ? '—' : stats.closed}
          </div>
        </div>

        <button
          type="button"
          onClick={fetchFxHistory}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pair…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 outline-none text-sm text-white placeholder:text-white/40"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'open', 'closed', 'liquidated', 'stopped', 'tp'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl border text-sm transition ${
                filter === f ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
              }`}
            >
              {f === 'tp' ? 'TP' : f === 'stopped' ? 'SL' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-white/60">
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3">Pair</th>
                <th className="text-left px-4 py-3">Side</th>
                <th className="text-right px-4 py-3">Invest</th>
                <th className="text-right px-4 py-3">x</th>
                <th className="text-right px-4 py-3">Entry</th>
                <th className="text-right px-4 py-3">Exit</th>
                <th className="text-right px-4 py-3">P/L</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-white/60" colSpan={8}>
                    Loading…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-white/60" colSpan={8}>
                    No FX trades found.
                  </td>
                </tr>
              ) : (
                pageItems.map((t) => {
                  const pos = t.pnl >= 0;
                  const pnlCls = pos ? 'text-emerald-200' : 'text-rose-200';
                  const sideIcon = t.side === 'buy' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
                  const sideCls =
                    t.side === 'buy'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-100'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-100';

                  return (
                    <tr key={t.id} className="border-b border-white/10">
                      <td className="px-4 py-3 font-medium text-white">{t.pair}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${sideCls}`}>
                          {sideIcon}
                          {t.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-white">${fmt(t.investment, 2)}</td>
                      <td className="px-4 py-3 text-right text-white">x{fmt(t.multiplier, 0)}</td>
                      <td className="px-4 py-3 text-right text-white font-mono">{t.entry ? fmtPx(t.entry) : '-'}</td>
                      <td className="px-4 py-3 text-right text-white font-mono">
                        {t.exit != null ? fmtPx(t.exit) : t.status === 'active' ? fmtPx(t.current) : '-'}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${pnlCls}`}>
                        {t.pnl >= 0 ? '+' : ''}${fmt(t.pnl, 2)}
                        <div className="text-[11px] font-normal text-white/50">
                          {t.roi >= 0 ? '+' : ''}
                          {fmt(t.roi, 2)}%
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/80">
                        {t.status === 'active' ? 'Open' : t.status}
                        {t.reason ? <span className="text-white/40"> • {t.reason}</span> : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > pageSize ? (
          <div className="px-4 py-3 flex items-center justify-between text-xs text-white/60">
            <div>
              Page {page} / {totalPages} • {filtered.length} result(s)
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!canUseSupabase ? (
        <div className="text-xs text-yellow-200/80">
          Supabase client not configured — cannot fetch session token to call /api/trades.
        </div>
      ) : null}
    </div>
  );
}

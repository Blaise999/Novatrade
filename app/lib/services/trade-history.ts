// lib/services/trade-history.ts
// ✅ Matches your existing `public.trades` table schema (symbol-based)
// ✅ Backwards compatible: accepts `pair`, `active` status alias, and close by sessionId
// ✅ Abortable queries + sessionStorage Supabase client

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const TRADE_HISTORY_TABLE = "trades" as const;

export type TradeStatus =
  | "open"
  | "closed"
  | "liquidated"
  | "cancelled"
  | "pending"
  // ✅ alias some older callers may still use
  | "active";

export type TradeDirection = "buy" | "sell";

// Keep broad + include aliases so TS won’t fight you; we normalize on write.
export type TradeMarketType =
  | "fx"
  | "crypto"
  | "stocks"
  | "indices"
  | "commodities"
  | "options"
  | "futures"
  | "forex" // alias -> fx
  | "stock" // alias -> stocks
  | "equity" // alias -> stocks
  | "other";

export type TradeRow = {
  id: string;
  user_id: string;

  asset_id: string | null;

  symbol: string;
  asset_type: string | null;
  trade_type: string | null;

  direction: string;

  amount: number | null;
  quantity: number | null;
  leverage: number | null;

  entry_price: number | null;
  exit_price: number | null;

  stop_loss: number | null;
  take_profit: number | null;

  payout_percent: number | null;
  duration_seconds: number | null;

  expires_at: string | null;

  status: string;

  profit_loss: number | null;
  payout_amount: number | null;

  fee: number | null;
  commission: number | null;
  swap: number | null;

  session_id: string | null;
  signal_id: string | null;

  is_copy_trade: boolean | null;

  idempotency_key: string | null;

  opened_at: string | null;
  closed_at: string | null;

  created_at: string;

  market_type: string | null;
  current_price: number | null;

  session_key: string | null;
};

export type CreateTradeHistoryInput = {
  id?: string;

  userId: string;

  assetId?: string | null;

  // ✅ prefer symbol, but allow pair (older code)
  symbol?: string;
  pair?: string;

  assetType?: string | null;
  tradeType?: string | null;

  direction: TradeDirection;

  amount?: number | null;
  quantity?: number | null;
  leverage?: number | null;

  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;

  payoutPercent?: number | null;
  durationSeconds?: number | null;
  expiresAt?: string | null;

  marketType?: TradeMarketType | null;

  currentPrice?: number | null;

  isCopyTrade?: boolean | null;
  idempotencyKey?: string | null;

  // ✅ your table has these, and your FX page is passing fee
  fee?: number | null;
  commission?: number | null;
  swap?: number | null;

  // ✅ allow callers to pass status, but we normalize it
  status?: TradeStatus | null;

  sessionId?: string | null;
  signalId?: string | null;
  sessionKey?: string | null;

  openedAt?: string | null;
};

export type CloseTradeHistoryInput = {
  // ✅ allow either identifier
  tradeId?: string;
  sessionId?: string;

  userId: string;

  exitPrice?: number | null;
  closedAt?: string | null;

  profitLoss?: number | null;
  // ✅ alias many callers use
  pnl?: number | null;

  payoutAmount?: number | null;

  status?: Exclude<TradeStatus, "open" | "active"> | "closed" | "liquidated" | "cancelled";

  // ✅ kept ONLY so existing callers that pass `symbol` won't fail TS.
  // We do NOT use it to identify the trade.
  symbol?: string;
};

export type FetchTradeHistoryParams = {
  userId: string;

  status?: TradeStatus | "all";
  marketType?: TradeMarketType | "all";
  symbolQuery?: string;

  page?: number;
  pageSize?: number;

  orderBy?: "created_at" | "opened_at" | "closed_at";
  order?: "asc" | "desc";
};

export type FetchTradeHistoryResult = {
  items: TradeRow[];
  count: number;
};

type Opts = { signal?: AbortSignal };

// -----------------------------
// Supabase client (browser-safe)
// -----------------------------
let _client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const storage =
    typeof window !== "undefined" ? window.sessionStorage : undefined;

  _client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage,
    },
  });

  return _client;
}

function withAbort(query: any, signal?: AbortSignal) {
  if (!signal) return query;
  if (typeof query?.abortSignal === "function") return query.abortSignal(signal);
  return query;
}

function nowIso() {
  return new Date().toISOString();
}

function asNumber(n: unknown, fallback: number | null = null) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function cleanErr(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error");
}

function normalizeMarketType(
  mt: TradeMarketType | string | null | undefined
): string | null {
  if (!mt) return null;
  const v = String(mt).toLowerCase().trim();

  if (v === "forex") return "fx";
  if (v === "stock" || v === "equity") return "stocks";

  if (
    v === "fx" ||
    v === "crypto" ||
    v === "stocks" ||
    v === "indices" ||
    v === "commodities" ||
    v === "options" ||
    v === "futures"
  ) {
    return v;
  }

  return "other";
}

function normalizeStatus(s: TradeStatus | string | null | undefined): string {
  const v = String(s ?? "open").toLowerCase().trim();
  // ✅ caller may send "active" meaning open
  if (v === "active") return "open";
  if (v === "open") return "open";
  if (v === "closed") return "closed";
  if (v === "liquidated") return "liquidated";
  if (v === "cancelled") return "cancelled";
  if (v === "pending") return "pending";
  // default safe
  return "open";
}

function pickSymbol(input: CreateTradeHistoryInput): string {
  const s = (input.symbol ?? input.pair ?? "").trim();
  if (!s) throw new Error("saveTradeToHistory: missing symbol/pair");
  return s;
}

// -----------------------------
// Public API
// -----------------------------

export async function saveTradeToHistory(
  input: CreateTradeHistoryInput,
  opts: Opts = {}
): Promise<TradeRow> {
  const supabase = getSupabaseClient();

  if (!input.userId) throw new Error("saveTradeToHistory: missing userId");

  const symbol = pickSymbol(input);

  const row: Partial<TradeRow> = {
    ...(input.id ? { id: input.id } : {}),
    user_id: input.userId,

    asset_id: input.assetId ?? null,

    symbol,
    asset_type: input.assetType ?? null,
    trade_type: input.tradeType ?? null,

    direction: input.direction,

    amount: asNumber(input.amount),
    quantity: asNumber(input.quantity),
    leverage: asNumber(input.leverage),

    entry_price: asNumber(input.entryPrice),
    stop_loss: asNumber(input.stopLoss),
    take_profit: asNumber(input.takeProfit),

    payout_percent: asNumber(input.payoutPercent),
    duration_seconds:
      typeof input.durationSeconds === "number" ? input.durationSeconds : null,

    expires_at: input.expiresAt ?? null,

    // ✅ accept status from caller but normalize (active -> open)
    status: normalizeStatus(input.status),

    profit_loss: null,
    payout_amount: null,

    // ✅ fee/commission/swap supported
    fee: asNumber(input.fee),
    commission: asNumber(input.commission),
    swap: asNumber(input.swap),

    is_copy_trade: input.isCopyTrade ?? null,

    idempotency_key: input.idempotencyKey ?? null,

    opened_at: input.openedAt ?? nowIso(),

    market_type: normalizeMarketType(input.marketType),
    current_price: asNumber(input.currentPrice),

    session_id: input.sessionId ?? null,
    signal_id: input.signalId ?? null,
    session_key: input.sessionKey ?? null,
  };

  try {
    const base = input.id
      ? supabase.from(TRADE_HISTORY_TABLE).upsert(row, { onConflict: "id" })
      : supabase.from(TRADE_HISTORY_TABLE).insert(row);

    const q = withAbort(base.select("*").single(), opts.signal);

    const { data, error } = await q;
    if (error) throw error;
    if (!data) throw new Error("saveTradeToHistory: no data returned");

    return data as TradeRow;
  } catch (e) {
    throw cleanErr(e);
  }
}

export async function closeTradeInHistory(
  input: CloseTradeHistoryInput,
  opts: Opts = {}
): Promise<TradeRow> {
  const supabase = getSupabaseClient();

  if (!input.userId) throw new Error("closeTradeInHistory: missing userId");
  if (!input.tradeId && !input.sessionId) {
    throw new Error("closeTradeInHistory: missing tradeId or sessionId");
  }

  const profitLoss = asNumber(input.profitLoss ?? input.pnl);

  const patch: Partial<TradeRow> = {
    exit_price: asNumber(input.exitPrice),
    closed_at: input.closedAt ?? nowIso(),
    profit_loss: profitLoss,
    payout_amount: asNumber(input.payoutAmount),
    status: normalizeStatus(input.status ?? "closed"),
  };

  try {
    // ✅ If tradeId is given, update directly.
    if (input.tradeId) {
      const q = withAbort(
        supabase
          .from(TRADE_HISTORY_TABLE)
          .update(patch)
          .eq("id", input.tradeId)
          .eq("user_id", input.userId)
          .select("*")
          .single(),
        opts.signal
      );

      const { data, error } = await q;
      if (error) throw error;
      if (!data) throw new Error("closeTradeInHistory: no data returned");

      return data as TradeRow;
    }

    // ✅ Otherwise resolve the latest trade by session_id, then update by id.
    const sid = String(input.sessionId);

    const findQ = withAbort(
      supabase
        .from(TRADE_HISTORY_TABLE)
        .select("id")
        .eq("user_id", input.userId)
        .eq("session_id", sid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      opts.signal
    );

    const { data: found, error: findErr } = await findQ;
    if (findErr) throw findErr;
    if (!found?.id) throw new Error("closeTradeInHistory: trade not found for sessionId");

    const q2 = withAbort(
      supabase
        .from(TRADE_HISTORY_TABLE)
        .update(patch)
        .eq("id", found.id)
        .eq("user_id", input.userId)
        .select("*")
        .single(),
      opts.signal
    );

    const { data, error } = await q2;
    if (error) throw error;
    if (!data) throw new Error("closeTradeInHistory: no data returned");

    return data as TradeRow;
  } catch (e) {
    throw cleanErr(e);
  }
}

export async function fetchTradeHistory(
  params: FetchTradeHistoryParams,
  opts: Opts = {}
): Promise<FetchTradeHistoryResult> {
  const supabase = getSupabaseClient();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const status = params.status ?? "all";
  const marketType = params.marketType ?? "all";
  const orderBy = params.orderBy ?? "created_at";
  const order = params.order ?? "desc";
  const symbolQuery = (params.symbolQuery ?? "").trim();

  if (!params.userId) throw new Error("fetchTradeHistory: missing userId");

  try {
    let q: any = supabase
      .from(TRADE_HISTORY_TABLE)
      .select("*", { count: "exact" })
      .eq("user_id", params.userId)
      .order(orderBy, { ascending: order === "asc" })
      .range(from, to);

    if (status !== "all") q = q.eq("status", normalizeStatus(status));

    if (marketType !== "all") {
      q = q.eq("market_type", normalizeMarketType(marketType));
    }

    if (symbolQuery) q = q.ilike("symbol", `%${symbolQuery}%`);

    q = withAbort(q, opts.signal);

    const { data, error, count } = await q;
    if (error) throw error;

    return {
      items: (data ?? []) as TradeRow[],
      count: typeof count === "number" ? count : 0,
    };
  } catch (e) {
    throw cleanErr(e);
  }
}

// lib/services/trade-history.ts
// ✅ FULL FIXES: stable types + safe Supabase client + abortable queries + clean fetch/save/close
// If your table name is different, change TRADE_HISTORY_TABLE below.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const TRADE_HISTORY_TABLE = "trade_history" as const;

export type TradeStatus = "open" | "closed" | "liquidated" | "cancelled";
export type TradeDirection = "buy" | "sell";

// Keep this broad so you never get TS “fx not assignable” issues from history usage.
export type TradeMarketType =
  | "fx"
  | "crypto"
  | "stocks"
  | "indices"
  | "commodities"
  | "options"
  | "futures"
  | "spot"
  | "margin"
  | "other";

export type TradeHistoryRow = {
  id: string;
  user_id: string;

  // optional fields your table may have
  account_id?: string | null;

  market_type: TradeMarketType;
  asset_type?: string | null; // e.g. "forex", "crypto"
  pair: string; // e.g. "EUR/USD", "BTC/USDT"
  direction: TradeDirection;

  // trade sizing
  quantity?: number | null;
  lot_size?: number | null;
  leverage?: number | null;

  // prices
  entry_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;

  // close data
  exit_price?: number | null;
  pnl?: number | null;
  pnl_percent?: number | null;

  status: TradeStatus;

  opened_at: string; // ISO
  closed_at?: string | null; // ISO

  // metadata
  is_simulated?: boolean | null;
  notes?: string | null;

  created_at: string; // ISO
  updated_at?: string | null; // ISO
};

export type CreateTradeHistoryInput = {
  // If you already generated an id elsewhere, you can pass it; otherwise it will be created by DB default/uuid.
  id?: string;

  userId: string;
  accountId?: string | null;

  marketType: TradeMarketType;
  assetType?: string | null;
  pair: string;
  direction: TradeDirection;

  quantity?: number | null;
  lotSize?: number | null;
  leverage?: number | null;

  entryPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;

  openedAt?: string; // default now
  isSimulated?: boolean | null;
  notes?: string | null;
};

export type CloseTradeHistoryInput = {
  tradeId: string; // history row id
  userId: string;

  exitPrice: number;
  closedAt?: string; // default now

  pnl?: number | null;
  pnlPercent?: number | null;

  status?: Exclude<TradeStatus, "open">; // default "closed"
};

export type FetchTradeHistoryParams = {
  userId: string;

  // filters
  status?: TradeStatus | "all";
  marketType?: TradeMarketType | "all";
  pairQuery?: string; // search in pair

  // pagination
  page?: number; // 1-based
  pageSize?: number; // default 20

  // sorting
  orderBy?: "created_at" | "opened_at" | "closed_at";
  order?: "asc" | "desc";
};

export type FetchTradeHistoryResult = {
  items: TradeHistoryRow[];
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

  // ✅ Uses sessionStorage so it matches your “move persistence from localStorage to sessionStorage” direction.
  // If you still want localStorage, change storage to window.localStorage.
  const storage =
    typeof window !== "undefined" ? window.sessionStorage : undefined;

  _client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage,
    },
    global: {
      // no special fetch here; AbortSignal is attached at query level via .abortSignal
    },
  });

  return _client;
}

// Supabase-js v2 query builders support abortSignal(). We guard it to avoid runtime issues.
function withAbort<T extends any>(query: any, signal?: AbortSignal): any {
  if (!signal) return query;
  if (typeof query?.abortSignal === "function") return query.abortSignal(signal);
  return query;
}

function nowIso() {
  return new Date().toISOString();
}

function asNumber(n: unknown, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function cleanErr(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error");
}

// -----------------------------
// Public API
// -----------------------------

/**
 * ✅ Create/open a trade history row.
 * - Uses INSERT by default.
 * - If you pass id, it uses UPSERT (non-destructive) to “create if missing”.
 */
export async function saveTradeToHistory(
  input: CreateTradeHistoryInput,
  opts: Opts = {}
): Promise<TradeHistoryRow> {
  const supabase = getSupabaseClient();

  if (!input.userId) throw new Error("saveTradeToHistory: missing userId");
  if (!input.pair) throw new Error("saveTradeToHistory: missing pair");

  const row: Partial<TradeHistoryRow> = {
    ...(input.id ? { id: input.id } : {}),
    user_id: input.userId,
    account_id: input.accountId ?? null,

    market_type: input.marketType,
    asset_type: input.assetType ?? null,
    pair: input.pair,
    direction: input.direction,

    quantity: input.quantity ?? null,
    lot_size: input.lotSize ?? null,
    leverage: input.leverage ?? null,

    entry_price: asNumber(input.entryPrice),
    stop_loss: input.stopLoss ?? null,
    take_profit: input.takeProfit ?? null,

    status: "open",
    opened_at: input.openedAt ?? nowIso(),

    is_simulated: input.isSimulated ?? null,
    notes: input.notes ?? null,
  };

  try {
    // ✅ If an id is provided, we use upsert to avoid destructive patterns.
    const base = input.id
      ? supabase.from(TRADE_HISTORY_TABLE).upsert(row, { onConflict: "id" })
      : supabase.from(TRADE_HISTORY_TABLE).insert(row);

    const q = withAbort(
      base.select("*").single(),
      opts.signal
    );

    const { data, error } = await q;

    if (error) throw error;
    if (!data) throw new Error("saveTradeToHistory: no data returned");

    return data as TradeHistoryRow;
  } catch (e) {
    throw cleanErr(e);
  }
}

/**
 * ✅ Close a trade history row.
 * - Updates ONLY close fields (no destructive overwrite).
 * - Verifies user_id match (extra safety).
 */
export async function closeTradeInHistory(
  input: CloseTradeHistoryInput,
  opts: Opts = {}
): Promise<TradeHistoryRow> {
  const supabase = getSupabaseClient();

  if (!input.tradeId) throw new Error("closeTradeInHistory: missing tradeId");
  if (!input.userId) throw new Error("closeTradeInHistory: missing userId");

  const patch: Partial<TradeHistoryRow> = {
    exit_price: asNumber(input.exitPrice),
    closed_at: input.closedAt ?? nowIso(),
    pnl: input.pnl ?? null,
    pnl_percent: input.pnlPercent ?? null,
    status: input.status ?? "closed",
    updated_at: nowIso(),
  };

  try {
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

    return data as TradeHistoryRow;
  } catch (e) {
    throw cleanErr(e);
  }
}

/**
 * ✅ Fetch trade history with filters + pagination.
 * ✅ Abortable (pass signal).
 * ✅ Uses count: "exact" to support pagination UI.
 */
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
  const pairQuery = (params.pairQuery ?? "").trim();

  if (!params.userId) throw new Error("fetchTradeHistory: missing userId");

  try {
    let q: any = supabase
      .from(TRADE_HISTORY_TABLE)
      .select("*", { count: "exact" })
      .eq("user_id", params.userId)
      .order(orderBy, { ascending: order === "asc" })
      .range(from, to);

    if (status !== "all") q = q.eq("status", status);
    if (marketType !== "all") q = q.eq("market_type", marketType);

    // basic search (pair)
    if (pairQuery) {
      // ilike is case-insensitive in Postgres
      q = q.ilike("pair", `%${pairQuery}%`);
    }

    q = withAbort(q, opts.signal);

    const { data, error, count } = await q;

    if (error) throw error;

    return {
      items: (data ?? []) as TradeHistoryRow[],
      count: typeof count === "number" ? count : 0,
    };
  } catch (e) {
    throw cleanErr(e);
  }
}

/**
 * Optional helper if you need “delete my trade history row”.
 * (Only use if your product allows it.)
 */
export async function deleteTradeHistoryRow(
  tradeId: string,
  userId: string,
  opts: Opts = {}
): Promise<void> {
  const supabase = getSupabaseClient();

  if (!tradeId) throw new Error("deleteTradeHistoryRow: missing tradeId");
  if (!userId) throw new Error("deleteTradeHistoryRow: missing userId");

  try {
    const q = withAbort(
      supabase
        .from(TRADE_HISTORY_TABLE)
        .delete()
        .eq("id", tradeId)
        .eq("user_id", userId),
      opts.signal
    );

    const { error } = await q;
    if (error) throw error;
  } catch (e) {
    throw cleanErr(e);
  }
}

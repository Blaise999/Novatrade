// lib/services/trade-history.ts
// ✅ FULL EDIT: tolerant inputs (aliases) + stable pagination + numeric coercion
// Accepts common caller aliases: symbol, amount, type, side, tradeType, sessionId

import "client-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const TRADE_HISTORY_TABLE = "trade_history" as const;

export type TradeStatus = "open" | "closed" | "liquidated" | "cancelled";
export type TradeDirection = "buy" | "sell";

// Keep broad so UI never breaks on new categories.
export type TradeMarketType =
  | "fx"
  | "forex" // alias (will be normalized to "fx")
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

  account_id?: string | null;

  market_type: TradeMarketType;
  asset_type?: string | null;
  pair: string;
  direction: TradeDirection;

  quantity?: number | null;
  lot_size?: number | null;
  leverage?: number | null;

  entry_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;

  exit_price?: number | null;
  pnl?: number | null;
  pnl_percent?: number | null;

  status: TradeStatus;

  opened_at: string; // ISO
  closed_at?: string | null; // ISO

  is_simulated?: boolean | null;
  notes?: string | null;

  created_at: string; // ISO
  updated_at?: string | null; // ISO
};

// ✅ INPUT: supports aliases so your pages can pass amount/type/symbol without TS errors.
export type CreateTradeHistoryInput = {
  id?: string;

  userId: string;
  accountId?: string | null;

  // canonical fields
  marketType: TradeMarketType;
  assetType?: string | null;
  pair?: string; // canonical
  direction?: TradeDirection;

  quantity?: number | null;
  lotSize?: number | null;
  leverage?: number | null;

  entryPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;

  openedAt?: string;
  isSimulated?: boolean | null;
  notes?: string | null;

  // --- aliases coming from pages (tolerated) ---
  symbol?: string; // alias for pair
  amount?: number | null; // alias for quantity
  type?: string | null; // alias for assetType (commonly used in stocks page)
  side?: TradeDirection; // alias for direction
  tradeType?: TradeMarketType; // optional extra category, stored into assetType if assetType missing
};

export type CloseTradeHistoryInput = {
  // canonical
  tradeId?: string;
  userId: string;

  exitPrice: number;
  closedAt?: string;

  pnl?: number | null;
  pnlPercent?: number | null;

  status?: Exclude<TradeStatus, "open">;

  // --- aliases coming from pages (tolerated) ---
  sessionId?: string; // alias for tradeId (some pages call it this)
  symbol?: string; // tolerated but NOT used for lookup (needs an id)
};

export type FetchTradeHistoryParams = {
  userId: string;

  status?: TradeStatus | "all";
  marketType?: TradeMarketType | "all";
  pairQuery?: string;

  page?: number; // 1-based
  pageSize?: number;

  orderBy?: "created_at" | "opened_at" | "closed_at";
  order?: "asc" | "desc";
};

export type FetchTradeHistoryResult = {
  items: TradeHistoryRow[];
  count: number;
};

type Opts = { signal?: AbortSignal };

// -----------------------------
// Supabase client (injectable)
// -----------------------------
let _client: SupabaseClient | null = null;

export function setTradeHistoryClient(client: SupabaseClient) {
  _client = client;
}

function safeStorage(which: "session" | "local"): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const storage = which === "session" ? window.sessionStorage : window.localStorage;
    const k = "__st_test__";
    storage.setItem(k, "1");
    storage.removeItem(k);
    return storage;
  } catch {
    return undefined;
  }
}

function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const storage = safeStorage("session") ?? safeStorage("local");

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

function withAbort(query: any, signal?: AbortSignal): any {
  if (!signal) return query;
  if (typeof query?.abortSignal === "function") return query.abortSignal(signal);
  return query;
}

// -----------------------------
// Helpers
// -----------------------------
function nowIso() {
  return new Date().toISOString();
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toNumber(v: unknown, fallback = 0): number {
  const n = toNumberOrNull(v);
  return n === null ? fallback : n;
}

function cleanErr(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error");
}

const MARKET_SET = new Set<string>([
  "fx",
  "forex",
  "crypto",
  "stocks",
  "indices",
  "commodities",
  "options",
  "futures",
  "spot",
  "margin",
  "other",
]);

function normalizeMarketType(mt: TradeMarketType): TradeMarketType {
  if (mt === "forex") return "fx";
  if (MARKET_SET.has(mt)) return mt;
  return "other";
}

function coerceRow(raw: any): TradeHistoryRow {
  const r = raw ?? {};
  return {
    ...(r as TradeHistoryRow),

    quantity: toNumberOrNull(r.quantity),
    lot_size: toNumberOrNull(r.lot_size),
    leverage: toNumberOrNull(r.leverage),

    entry_price: toNumber(r.entry_price, 0),
    stop_loss: toNumberOrNull(r.stop_loss),
    take_profit: toNumberOrNull(r.take_profit),

    exit_price: toNumberOrNull(r.exit_price),
    pnl: toNumberOrNull(r.pnl),
    pnl_percent: toNumberOrNull(r.pnl_percent),
  };
}

// -----------------------------
// Public API
// -----------------------------
export async function saveTradeToHistory(
  input: CreateTradeHistoryInput,
  opts: Opts = {}
): Promise<TradeHistoryRow> {
  const supabase = getSupabaseClient();

  if (!input.userId) throw new Error("saveTradeToHistory: missing userId");

  const pair = (input.pair ?? input.symbol ?? "").trim();
  if (!pair) throw new Error("saveTradeToHistory: missing pair/symbol");

  const direction = input.direction ?? input.side;
  if (!direction) throw new Error("saveTradeToHistory: missing direction/side");

  const marketType = normalizeMarketType(input.marketType);

  // amount -> quantity fallback
  const quantity = input.quantity ?? input.amount ?? null;

  // type/tradeType -> assetType fallback
  const assetType = input.assetType ?? input.type ?? (input.tradeType ? String(input.tradeType) : null);

  const row: Partial<TradeHistoryRow> = {
    ...(input.id ? { id: input.id } : {}),
    user_id: input.userId,
    account_id: input.accountId ?? null,

    market_type: marketType,
    asset_type: assetType,

    pair,
    direction,

    quantity: quantity ?? null,
    lot_size: input.lotSize ?? null,
    leverage: input.leverage ?? null,

    entry_price: toNumber(input.entryPrice, 0),
    stop_loss: input.stopLoss ?? null,
    take_profit: input.takeProfit ?? null,

    status: "open",
    opened_at: input.openedAt ?? nowIso(),

    is_simulated: input.isSimulated ?? null,
    notes: input.notes ?? null,
    updated_at: nowIso(),
  };

  try {
    const base = input.id
      ? supabase.from(TRADE_HISTORY_TABLE).upsert(row, { onConflict: "id" })
      : supabase.from(TRADE_HISTORY_TABLE).insert(row);

    const q = withAbort(base.select("*").single(), opts.signal);

    const { data, error } = await q;
    if (error) throw error;
    if (!data) throw new Error("saveTradeToHistory: no data returned");

    return coerceRow(data);
  } catch (e) {
    throw cleanErr(e);
  }
}

export async function closeTradeInHistory(
  input: CloseTradeHistoryInput,
  opts: Opts = {}
): Promise<TradeHistoryRow> {
  const supabase = getSupabaseClient();

  const tradeId = (input.tradeId ?? input.sessionId ?? "").trim();
  if (!tradeId) throw new Error("closeTradeInHistory: missing tradeId/sessionId");
  if (!input.userId) throw new Error("closeTradeInHistory: missing userId");

  const patch: Partial<TradeHistoryRow> = {
    exit_price: toNumber(input.exitPrice, 0),
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
        .eq("id", tradeId)
        .eq("user_id", input.userId)
        .select("*")
        .single(),
      opts.signal
    );

    const { data, error } = await q;
    if (error) throw error;
    if (!data) throw new Error("closeTradeInHistory: no data returned");

    return coerceRow(data);
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
  const pairQuery = (params.pairQuery ?? "").trim();

  if (!params.userId) throw new Error("fetchTradeHistory: missing userId");

  try {
    let q: any = supabase
      .from(TRADE_HISTORY_TABLE)
      .select("*", { count: "exact" })
      .eq("user_id", params.userId)
      .order(orderBy, { ascending: order === "asc", nullsFirst: order === "asc" });

    if (orderBy !== "created_at") {
      q = q.order("created_at", { ascending: false });
    }
    q = q.order("id", { ascending: false });

    q = q.range(from, to);

    if (status !== "all") q = q.eq("status", status);
    if (marketType !== "all") q = q.eq("market_type", marketType);

    if (pairQuery) q = q.ilike("pair", `%${pairQuery}%`);

    q = withAbort(q, opts.signal);

    const { data, error, count } = await q;
    if (error) throw error;

    const items = Array.isArray(data) ? data.map(coerceRow) : [];

    return { items, count: typeof count === "number" ? count : 0 };
  } catch (e) {
    throw cleanErr(e);
  }
}

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
      supabase.from(TRADE_HISTORY_TABLE).delete().eq("id", tradeId).eq("user_id", userId),
      opts.signal
    );

    const { error } = await q;
    if (error) throw error;
  } catch (e) {
    throw cleanErr(e);
  }
}

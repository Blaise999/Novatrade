// lib/services/trade-history.ts
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

type MarketTypeInput = "crypto" | "fx" | "stocks" | "forex"; // accept forex input, store as fx
type TradeStatusInput =
  | "open"
  | "pending"
  | "closed"
  | "cancelled"
  | "liquidated"
  | "active"; // accept active input, store as open

const normalizeMarketType = (m: MarketTypeInput): "crypto" | "fx" | "stocks" => {
  const x = String(m ?? "").toLowerCase();
  if (x === "forex") return "fx";
  if (x === "crypto" || x === "fx" || x === "stocks") return x;
  return "crypto";
};

const normalizeStatus = (
  s: TradeStatusInput
): "open" | "pending" | "closed" | "cancelled" | "liquidated" => {
  const x = String(s ?? "").toLowerCase();
  if (x === "active") return "open";
  if (x === "open" || x === "pending" || x === "closed" || x === "cancelled" || x === "liquidated")
    return x;
  return "open";
};

// direction can be buy/sell OR long/short. We store long/short for consistency.
const normalizeDirection = (v?: string) => {
  const x = (v ?? "").toLowerCase().trim();
  if (x === "buy" || x === "long") return "long";
  if (x === "sell" || x === "short") return "short";
  return x || "long";
};

const isUuid = (v?: string | null) => {
  if (!v) return false;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
};

async function resolveAssetId(symbol: string, marketType: "crypto" | "fx" | "stocks") {
  try {
    const { data, error } = await supabase
      .from("assets")
      .select("id")
      .eq("symbol", symbol)
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data?.id ?? null;
  } catch {
    return null;
  }
}

async function getTradeIdByIdempotencyKey(userId: string, idempotencyKey: string) {
  const { data, error } = await supabase
    .from("trades")
    .select("id")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data?.id ? String(data.id) : null;
}

export async function saveTradeToHistory(input: {
  userId: string;
  symbol: string;

  marketType: MarketTypeInput;
  assetType?: string; // optional
  tradeType?: string; // spot/margin/etc
  direction?: string; // buy/sell or long/short
  amount: number;
  quantity: number;
  leverage: number;
  entryPrice: number;
  exitPrice?: number | null;
  stopLoss?: number;
  takeProfit?: number;

  payoutPercent?: number;
  durationSeconds?: number;
  expiresAt?: string | null;

  fee?: number; // use this for FX fees
  fees?: number; // accept old callers
  commission?: number; // use for stocks commission
  swap?: number;

  sessionId?: string; // NOTE: trades.session_id is uuid in your DB
  signalId?: string;
  isCopyTrade?: boolean;
  idempotencyKey?: string;

  status?: TradeStatusInput;

  // old callers (stocks page)
  type?: string; // buy/sell
  side?: string; // long/short
}) {
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase not configured" };

  const market_type = normalizeMarketType(input.marketType);
  const status = normalizeStatus(input.status ?? "open");
  const direction = normalizeDirection(input.direction ?? input.side ?? input.type);

  const asset_id = await resolveAssetId(input.symbol, market_type);

  // ✅ Use text idempotency key for dedupe (safe)
  const idempotency_key =
    (input.idempotencyKey && String(input.idempotencyKey).trim()) ||
    (input.sessionId && String(input.sessionId).trim()) ||
    `${input.userId}:${market_type}:${input.symbol}:${Date.now()}`;

  // ✅ session_id is uuid in DB → ONLY set if valid uuid
  const session_id = isUuid(input.sessionId) ? String(input.sessionId).trim() : null;

  const payload: any = {
    user_id: input.userId,
    asset_id, // may be null if assets not seeded
    symbol: input.symbol,
    asset_type: input.assetType ?? market_type, // ok even if you later standardize
    trade_type: input.tradeType ?? "spot",
    direction,
    amount: input.amount,
    quantity: input.quantity,
    leverage: input.leverage,
    entry_price: input.entryPrice,
    exit_price: input.exitPrice ?? null,
    stop_loss: input.stopLoss ?? null,
    take_profit: input.takeProfit ?? null,
    payout_percent: input.payoutPercent ?? null,
    duration_seconds: input.durationSeconds ?? null,
    expires_at: input.expiresAt ?? null,
    status,
    profit_loss: null,
    payout_amount: null,
    fee: input.fee ?? input.fees ?? null,
    commission: input.commission ?? null,
    swap: input.swap ?? null,
    session_id, // uuid|null
    signal_id: input.signalId ?? null,
    is_copy_trade: input.isCopyTrade ?? false,
    idempotency_key,
    opened_at: new Date().toISOString(),
    market_type,
  };

  // ✅ Non-destructive / idempotent:
  // - onConflict uses idempotency_key
  // - ignoreDuplicates prevents overwriting existing rows
  const { data, error } = await supabase
    .from("trades")
    .upsert(payload, { onConflict: "idempotency_key", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };

  // If ignoreDuplicates hit, PostgREST may return null/empty — fetch id by key
  const tradeId = data?.id ? String(data.id) : await getTradeIdByIdempotencyKey(input.userId, idempotency_key);

  if (!tradeId) return { success: true, tradeId: undefined };
  return { success: true, tradeId };
}

export async function closeTradeInHistory(input: {
  userId: string;
  symbol: string;
  exitPrice: number;
  pnl: number;
  status?: "closed" | "liquidated" | "cancelled";
  tradeId?: string;
  sessionId?: string; // uuid OR non-uuid string
}) {
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase not configured" };

  const finalStatus = input.status ?? "closed";

  // 1) If we know tradeId, close directly
  if (input.tradeId) {
    const { error } = await supabase
      .from("trades")
      .update({
        status: finalStatus,
        exit_price: input.exitPrice,
        profit_loss: input.pnl,
        closed_at: new Date().toISOString(),
      })
      .eq("id", input.tradeId)
      .eq("user_id", input.userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  // 2) If sessionId is a UUID, close by session_id
  if (isUuid(input.sessionId)) {
    const { error } = await supabase
      .from("trades")
      .update({
        status: finalStatus,
        exit_price: input.exitPrice,
        profit_loss: input.pnl,
        closed_at: new Date().toISOString(),
      })
      .eq("session_id", String(input.sessionId).trim())
      .eq("user_id", input.userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  // 3) If sessionId is NOT uuid, treat it as idempotency_key
  if (input.sessionId && String(input.sessionId).trim()) {
    const { error } = await supabase
      .from("trades")
      .update({
        status: finalStatus,
        exit_price: input.exitPrice,
        profit_loss: input.pnl,
        closed_at: new Date().toISOString(),
      })
      .eq("idempotency_key", String(input.sessionId).trim())
      .eq("user_id", input.userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  // 4) fallback: find latest open/pending trade for this symbol, then close it
  const { data: openTrade, error: findErr } = await supabase
    .from("trades")
    .select("id")
    .eq("user_id", input.userId)
    .eq("symbol", input.symbol)
    .in("status", ["open", "pending", "active"])
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) return { success: false, error: findErr.message };
  if (!openTrade?.id) return { success: false, error: "No open trade found to close" };

  const { error: updErr } = await supabase
    .from("trades")
    .update({
      status: finalStatus,
      exit_price: input.exitPrice,
      profit_loss: input.pnl,
      closed_at: new Date().toISOString(),
    })
    .eq("id", openTrade.id)
    .eq("user_id", input.userId);

  if (updErr) return { success: false, error: updErr.message };
  return { success: true };
}

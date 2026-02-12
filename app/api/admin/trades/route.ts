// app/api/admin/trades/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getToken(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();

  // fallback cookie (if you ever set it)
  const c = req.cookies.get("novatrade_admin_token")?.value;
  if (c) return c;

  return null;
}

async function requireAdmin(req: NextRequest) {
  const token = getToken(req);
  if (!token) {
    return { ok: false as const, status: 401, message: "Missing admin token" };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { ok: false as const, status: 401, message: "Invalid admin token" };
  }

  // Check role from your users table
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = String(profile?.role || "").toLowerCase();
  if (!["admin", "super_admin", "support"].includes(role)) {
    return { ok: false as const, status: 403, message: "Not allowed" };
  }

  return { ok: true as const, adminId: data.user.id };
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const url = new URL(req.url);
  const user_id = url.searchParams.get("user_id");
  const q = (url.searchParams.get("q") || "").trim();
  const status = (url.searchParams.get("status") || "").trim(); // won/lost/pending...
  const asset_type = (url.searchParams.get("asset_type") || "").trim(); // crypto/forex/stock...
  const market_type = (url.searchParams.get("market_type") || "").trim(); // crypto/fx/stocks...
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get("pageSize") || 20)));

  try {
    let query = supabaseAdmin
      .from("trades")
      .select(
        `
          id,
          user_id,
          pair,
          symbol,
          asset_type,
          market_type,
          trade_type,
          type,
          direction,
          side,
          amount,
          quantity,
          lot_size,
          leverage,
          entry_price,
          exit_price,
          current_price,
          stop_loss,
          take_profit,
          payout_percent,
          pnl,
          pnl_percentage,
          profit_loss,
          duration_seconds,
          margin_used,
          fees,
          source,
          status,
          opened_at,
          closed_at,
          created_at,
          updated_at,
          user:users(id, email, first_name, last_name)
        `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (user_id) query = query.eq("user_id", user_id);

    /**
     * ✅ IMPORTANT: UI sends status=pending meaning "pending + active/open"
     * If you ONLY do .eq("status","pending") you'll miss active/open trades.
     */
    if (status) {
      const s = status.toLowerCase();

      if (s === "pending") {
        // treat pending as pending + active/open
        query = query.in("status", ["pending", "active", "open"]);
      } else if (s === "won") {
        // includes DB-won + "closed" with profit >= 0 (if you're using profit_loss)
        query = query.or("status.eq.won,and(status.eq.closed,profit_loss.gte.0)");
      } else if (s === "lost") {
        // includes DB-lost + "closed" with profit < 0
        query = query.or("status.eq.lost,and(status.eq.closed,profit_loss.lt.0)");
      } else {
        query = query.eq("status", status);
      }
    }

    if (asset_type) query = query.eq("asset_type", asset_type);
    if (market_type) query = query.eq("market_type", market_type);

    if (q) {
      const safe = q.replace(/,/g, " "); // avoid breaking the .or string
      query = query.or(`pair.ilike.%${safe}%,symbol.ilike.%${safe}%,id.ilike.%${safe}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data || [], count: count || 0 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load trades" },
      { status: 500 }
    );
  }
}

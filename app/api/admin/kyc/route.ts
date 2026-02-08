// app/api/admin/kyc/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const token = auth.slice(7);
  const tokenHash = hashToken(token);

  const { data, error } = await supabaseAdmin
    .from("admin_sessions")
    .select("admin_id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;
  return { admin_id: data.admin_id as string };
}

async function signed(path?: string | null) {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage
    .from("documents")
    .createSignedUrl(path, 60 * 15);
  return data?.signedUrl ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const raw = (searchParams.get("status") || "pending").toLowerCase();

    let q = supabaseAdmin
      .from("users")
      .select("id,email,first_name,last_name,kyc_status,kyc_submitted_at,kyc_data,created_at")
      .order("created_at", { ascending: false });

    if (raw !== "all") {
      if (raw === "none") {
        q = q.or("kyc_status.is.null,kyc_status.eq.none,kyc_status.eq.not_started");
      } else {
        q = q.eq("kyc_status", raw);
      }
    }

    const { data: rows, error } = await q;
    if (error) throw error;

    const kycs = await Promise.all(
      (rows ?? []).map(async (u: any) => {
        const k = u.kyc_data || {};
        return {
          ...u,
          kyc_docs: {
            id_front: await signed(k.id_front_doc),
            id_back: await signed(k.id_back_doc),
            selfie: await signed(k.selfie_doc),
            proof: await signed(k.proof_of_address_doc),
          },
        };
      })
    );

    return NextResponse.json({ kycs });
  } catch (e: any) {
    console.error("[AdminKYC] list error:", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

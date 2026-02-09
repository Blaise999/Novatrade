import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function makeCode() {
  // short + clean for sharing
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. 8F3A12CD
}

export async function POST(req: Request) {
  try {
    const { userId, ref } = await req.json();

    if (!userId || typeof userId !== "string" || !isUuid(userId)) {
      return NextResponse.json({ error: "Bad userId" }, { status: 400 });
    }

    const referral = typeof ref === "string" ? ref.trim().toUpperCase() : "";

    // load user row
    const { data: user, error: userErr } = await admin
      .from("users")
      .select("id, referral_code, referred_by")
      .eq("id", userId)
      .maybeSingle();

    if (userErr) throw userErr;

    // if your signup didn’t create a users row yet, create a minimal one
    if (!user) {
      const { error: insErr } = await admin.from("users").insert({
        id: userId,
        email_verified: true,
      });
      if (insErr) throw insErr;
    }

    // ensure referral_code exists (unique)
    let myCode = user?.referral_code as string | null;

    if (!myCode) {
      for (let i = 0; i < 10; i++) {
        const candidate = makeCode();

        const { error: upErr } = await admin
          .from("users")
          .update({ referral_code: candidate })
          .eq("id", userId)
          .is("referral_code", null);

        if (!upErr) {
          // check if it actually updated (row may already have code from race)
          const { data: check } = await admin
            .from("users")
            .select("referral_code")
            .eq("id", userId)
            .maybeSingle();

          if (check?.referral_code) {
            myCode = check.referral_code;
            break;
          }
        } else {
          // likely unique collision → retry
          const msg = String(upErr.message || "");
          if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
            continue;
          }
          throw upErr;
        }
      }
    }

    // attach referred_by (only if not already set)
    let referredBySet = false;

    if (referral) {
      const { data: referrer } = await admin
        .from("users")
        .select("id")
        .eq("referral_code", referral)
        .maybeSingle();

      if (referrer?.id && referrer.id !== userId) {
        const { data: meNow } = await admin
          .from("users")
          .select("referred_by")
          .eq("id", userId)
          .maybeSingle();

        if (!meNow?.referred_by) {
          const { error: rbErr } = await admin
            .from("users")
            .update({ referred_by: referrer.id })
            .eq("id", userId)
            .is("referred_by", null);

          if (!rbErr) referredBySet = true;
        }
      }
    }

    // always mark verified here
    await admin.from("users").update({ email_verified: true }).eq("id", userId);

    return NextResponse.json({
      ok: true,
      referral_code: myCode || null,
      referredBySet,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

/**
 * BOT ACTIVATION KEYS API
 *
 * GET  /api/bots/keys?action=list                 — admin: list all keys
 * GET  /api/bots/keys?action=check&userId=<id>    — user: check their bot access
 * POST /api/bots/keys  { action:'generate', botType, adminId, notes, count }  — admin: generate key(s)
 * POST /api/bots/keys  { action:'redeem', key, userId }                       — user: redeem key
 * PATCH /api/bots/keys { action:'revoke', keyId }                             — admin: revoke key
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

type BotType = 'dca' | 'grid';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

// ============================================
// HELPERS
// ============================================
function generateActivationKey(botType: BotType): string {
  const prefix = botType === 'dca' ? 'DCA' : 'GRID';
  const seg1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const seg2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const seg3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${seg1}-${seg2}-${seg3}`;
}

// ============================================
// GET
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action') || 'list';
    const userId = searchParams.get('userId');

    // --- User: check their bot access ---
    if (action === 'check') {
      if (!userId) {
        return NextResponse.json(
          { success: false, error: 'userId is required' },
          { status: 400 }
        );
      }

      const { data: access, error } = await supabaseAdmin
        .from('user_bot_access')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }

      const dcaActive = (access ?? []).some((a: any) => a.bot_type === 'dca');
      const gridActive = (access ?? []).some((a: any) => a.bot_type === 'grid');

      return NextResponse.json({
        success: true,
        access: { dca: dcaActive, grid: gridActive },
        records: access ?? [],
      });
    }

    // --- Admin: list all keys ---
    const { data: keys, error } = await supabaseAdmin
      .from('bot_activation_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const total = (keys ?? []).length;
    const unused = (keys ?? []).filter((k: any) => k.status === 'unused').length;
    const active = (keys ?? []).filter((k: any) => k.status === 'active').length;
    const revoked = (keys ?? []).filter((k: any) => k.status === 'revoked').length;

    return NextResponse.json({
      success: true,
      keys: keys ?? [],
      stats: { total, unused, active, revoked },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action: string | undefined = body?.action;

    // --- Admin: generate new key(s) ---
    if (action === 'generate') {
      const botType: BotType | undefined = body?.botType;
      const adminId: string | undefined = body?.adminId;
      const notes: string | null | undefined = body?.notes;
      const count: number | undefined = body?.count;

      if (!botType || !['dca', 'grid'].includes(botType)) {
        return NextResponse.json(
          { success: false, error: 'botType must be dca or grid' },
          { status: 400 }
        );
      }

      const numKeys = Math.min(Number.isFinite(count) ? Number(count) : 1, 50);
      const generatedKeys: any[] = [];

      for (let i = 0; i < numKeys; i++) {
        // Try a few times in case of rare key collision (assuming unique constraint)
        let created: any = null;

        for (let attempt = 0; attempt < 5; attempt++) {
          const key = generateActivationKey(botType);

          const { data, error } = await supabaseAdmin
            .from('bot_activation_keys')
            .insert({
              activation_key: key,
              bot_type: botType,
              status: 'unused',
              generated_by: adminId || 'admin',
              notes: notes ?? null,
            })
            .select()
            .single();

          if (!error && data) {
            created = data;
            break;
          }
        }

        if (created) generatedKeys.push(created);
      }

      return NextResponse.json({
        success: true,
        keys: generatedKeys,
        count: generatedKeys.length,
      });
    }

    // --- User: redeem activation key ---
    if (action === 'redeem') {
      const key: string | undefined = body?.key;
      const userId: string | undefined = body?.userId;

      if (!key || !userId) {
        return NextResponse.json(
          { success: false, error: 'key and userId required' },
          { status: 400 }
        );
      }

      const normalizedKey = key.trim().toUpperCase();

      // Find the key
      const { data: keyRecord, error: findErr } = await supabaseAdmin
        .from('bot_activation_keys')
        .select('*')
        .eq('activation_key', normalizedKey)
        .single();

      if (findErr || !keyRecord) {
        return NextResponse.json(
          { success: false, error: 'Invalid activation key. Please check and try again.' },
          { status: 404 }
        );
      }

      if (keyRecord.status === 'active') {
        return NextResponse.json(
          { success: false, error: 'This key has already been used.' },
          { status: 400 }
        );
      }

      if (keyRecord.status === 'revoked') {
        return NextResponse.json(
          { success: false, error: 'This key has been revoked.' },
          { status: 400 }
        );
      }

      const botType: BotType = keyRecord.bot_type;

      // Check if user already has this bot
      const { data: existingAccess, error: existingErr } = await supabaseAdmin
        .from('user_bot_access')
        .select('id')
        .eq('user_id', userId)
        .eq('bot_type', botType)
        .eq('is_active', true)
        .maybeSingle();

      if (existingErr) {
        return NextResponse.json(
          { success: false, error: existingErr.message },
          { status: 500 }
        );
      }

      if (existingAccess) {
        return NextResponse.json(
          {
            success: false,
            error: `You already have ${botType.toUpperCase()} bot access activated.`,
          },
          { status: 400 }
        );
      }

      // Get user email for record-keeping
      const { data: userRecord } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', userId)
        .maybeSingle();

      // Activate key
      const now = new Date().toISOString();
      const { error: updateErr } = await supabaseAdmin
        .from('bot_activation_keys')
        .update({
          status: 'active',
          user_id: userId,
          user_email: userRecord?.email || null,
          activated_at: now,
        })
        .eq('id', keyRecord.id);

      if (updateErr) {
        return NextResponse.json(
          { success: false, error: 'Failed to activate key' },
          { status: 500 }
        );
      }

      // Grant bot access
      const { error: accessErr } = await supabaseAdmin.from('user_bot_access').insert({
        user_id: userId,
        bot_type: botType,
        activation_key_id: keyRecord.id,
        is_active: true,
      });

      if (accessErr) {
        console.error('[BotKeys] access grant error:', accessErr);
      }

      // Log activity (best-effort)
      const { error: logErr } = await supabaseAdmin.from('bot_activity_log').insert({
        bot_id: keyRecord.id,
        action: 'key_redeemed',
        details: { key: normalizedKey, botType, userId },
      });

      if (logErr) {
        console.warn('[BotKeys] activity log error:', logErr);
      }

      return NextResponse.json({
        success: true,
        botType,
        message: `${botType.toUpperCase()} bot activated successfully! You can now create and run ${botType.toUpperCase()} bots.`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH — Revoke key
// ============================================
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const keyId: string | undefined = body?.keyId;
    const action: string | undefined = body?.action;

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'keyId required' },
        { status: 400 }
      );
    }

    if (action !== 'revoke') {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const { data: keyRecord, error: keyErr } = await supabaseAdmin
      .from('bot_activation_keys')
      .select('*')
      .eq('id', keyId)
      .single();

    if (keyErr) {
      return NextResponse.json(
        { success: false, error: keyErr.message },
        { status: 500 }
      );
    }

    if (!keyRecord) {
      return NextResponse.json(
        { success: false, error: 'Key not found' },
        { status: 404 }
      );
    }

    // Revoke the key
    const { error: revokeErr } = await supabaseAdmin
      .from('bot_activation_keys')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', keyId);

    if (revokeErr) {
      return NextResponse.json(
        { success: false, error: revokeErr.message },
        { status: 500 }
      );
    }

    // If it was active, also revoke user's bot access
    if (keyRecord.status === 'active' && keyRecord.user_id) {
      const { error: accessRevokeErr } = await supabaseAdmin
        .from('user_bot_access')
        .update({ is_active: false })
        .eq('activation_key_id', keyId);

      if (accessRevokeErr) {
        console.warn('[BotKeys] access revoke warn:', accessRevokeErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

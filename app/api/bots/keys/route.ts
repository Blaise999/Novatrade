/**
 * BOT ACTIVATION KEYS API
 *
 * GET  /api/bots/keys?action=list           — admin: list all keys
 * GET  /api/bots/keys?action=check&userId=x — user: check their bot access
 * POST /api/bots/keys  { action: 'generate', botType, adminId, notes, count }  — admin: generate key(s)
 * POST /api/bots/keys  { action: 'redeem', key, userId }                       — user: activate key
 * PATCH /api/bots/keys { keyId, action: 'revoke' }                             — admin: revoke key
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ============================================
// KEY GENERATION
// ============================================
function generateActivationKey(botType: 'dca' | 'grid'): string {
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
    if (action === 'check' && userId) {
      const { data: access, error } = await supabaseAdmin
        .from('user_bot_access')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Stats
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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ============================================
// POST
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // --- Admin: generate new key(s) ---
    if (action === 'generate') {
      const { botType, adminId, notes, count } = body;

      if (!botType || !['dca', 'grid'].includes(botType)) {
        return NextResponse.json(
          { success: false, error: 'botType must be dca or grid' },
          { status: 400 },
        );
      }

      const numKeys = Math.min(count || 1, 50); // max 50 at a time
      const generatedKeys: any[] = [];

      for (let i = 0; i < numKeys; i++) {
        let created: any = null;

        // Try up to 10 times (handles unique collisions safely)
        for (let attempt = 0; attempt < 10; attempt++) {
          const key = generateActivationKey(botType);

          const { data, error } = await supabaseAdmin
            .from('bot_activation_keys')
            .insert({
              activation_key: key,
              bot_type: botType,
              status: 'unused',
              generated_by: adminId || 'admin',
              notes: notes || null,
            })
            .select()
            .single();

          if (!error && data) {
            created = data;
            break;
          }

          // Unique violation (Postgres): retry
          const code = (error as any)?.code;
          if (code === '23505') continue;

          // Other error: stop and surface it
          throw new Error((error as any)?.message || 'Failed to generate key');
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
      const { key, userId } = body;

      if (!key || !userId) {
        return NextResponse.json(
          { success: false, error: 'key and userId required' },
          { status: 400 },
        );
      }

      const normalizedKey = String(key).trim().toUpperCase();

      // Find the key
      const { data: keyRecord, error: findErr } = await supabaseAdmin
        .from('bot_activation_keys')
        .select('*')
        .eq('activation_key', normalizedKey)
        .single();

      if (findErr || !keyRecord) {
        return NextResponse.json(
          { success: false, error: 'Invalid activation key. Please check and try again.' },
          { status: 404 },
        );
      }

      if (keyRecord.status === 'active') {
        return NextResponse.json(
          { success: false, error: 'This key has already been used.' },
          { status: 400 },
        );
      }

      if (keyRecord.status === 'revoked') {
        return NextResponse.json(
          { success: false, error: 'This key has been revoked.' },
          { status: 400 },
        );
      }

      const botType = keyRecord.bot_type;

      // Check if user already has this bot type
      const { data: existingAccess, error: accessCheckErr } = await supabaseAdmin
        .from('user_bot_access')
        .select('id')
        .eq('user_id', userId)
        .eq('bot_type', botType)
        .eq('is_active', true)
        .maybeSingle();

      if (accessCheckErr) {
        return NextResponse.json(
          { success: false, error: accessCheckErr.message },
          { status: 500 },
        );
      }

      if (existingAccess) {
        return NextResponse.json(
          {
            success: false,
            error: `You already have ${String(botType).toUpperCase()} bot access activated.`,
          },
          { status: 400 },
        );
      }

      // Get user email for record-keeping
      const { data: userRecord } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', userId)
        .maybeSingle();

      // ✅ Atomic activate: only succeeds if status still 'unused'
      const now = new Date().toISOString();
      const { data: updatedKey, error: updateErr } = await supabaseAdmin
        .from('bot_activation_keys')
        .update({
          status: 'active',
          user_id: userId,
          user_email: userRecord?.email || null,
          activated_at: now,
        })
        .eq('id', keyRecord.id)
        .eq('status', 'unused')
        .select('id,status')
        .maybeSingle();

      if (updateErr) {
        return NextResponse.json(
          { success: false, error: 'Failed to activate key' },
          { status: 500 },
        );
      }

      if (!updatedKey) {
        return NextResponse.json(
          { success: false, error: 'This key has already been used or revoked.' },
          { status: 400 },
        );
      }

      // Grant bot access
      const { error: accessErr2 } = await supabaseAdmin
        .from('user_bot_access')
        .insert({
          user_id: userId,
          bot_type: botType,
          activation_key_id: keyRecord.id,
          is_active: true,
        });

      if (accessErr2) {
        console.error('[BotKeys] access grant error:', accessErr2);
      }

      // ✅ Log activity (no .catch on builder)
      try {
        const { error: logErr } = await supabaseAdmin
          .from('bot_activity_log')
          .insert({
            bot_id: keyRecord.id,
            action: 'key_redeemed',
            details: { key: normalizedKey, botType, userId },
          });

        if (logErr) console.warn('[BotKeys] activity log error:', logErr);
      } catch (e) {
        console.warn('[BotKeys] activity log exception:', e);
      }

      return NextResponse.json({
        success: true,
        botType,
        message: `${String(botType).toUpperCase()} bot activated successfully! You can now create and run ${String(
          botType,
        ).toUpperCase()} bots.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ============================================
// PATCH — Revoke key
// ============================================
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyId, action } = body;

    if (!keyId) {
      return NextResponse.json({ success: false, error: 'keyId required' }, { status: 400 });
    }

    if (action === 'revoke') {
      const { data: keyRecord, error: findErr } = await supabaseAdmin
        .from('bot_activation_keys')
        .select('*')
        .eq('id', keyId)
        .single();

      if (findErr || !keyRecord) {
        return NextResponse.json({ success: false, error: 'Key not found' }, { status: 404 });
      }

      // Revoke the key
      const { error: revokeErr } = await supabaseAdmin
        .from('bot_activation_keys')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('id', keyId);

      if (revokeErr) {
        return NextResponse.json({ success: false, error: revokeErr.message }, { status: 500 });
      }

      // If it was active, also revoke user's bot access
      if (keyRecord.status === 'active' && keyRecord.user_id) {
        const { error: accessRevokeErr } = await supabaseAdmin
          .from('user_bot_access')
          .update({ is_active: false })
          .eq('activation_key_id', keyId);

        if (accessRevokeErr) {
          console.error('[BotKeys] access revoke error:', accessRevokeErr);
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

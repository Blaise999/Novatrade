// Admin API Routes
// Protected routes for platform administration
// GET /api/admin/stats - Get platform statistics
// GET /api/admin/users - Get all users
// POST /api/admin/sessions - Create trading signal session
// PATCH /api/admin/users/[id] - Update user status
// POST /api/admin/deposits/approve - Approve pending deposit
// POST /api/admin/withdrawals/process - Process withdrawal

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import {
  UserDb,
  TradeDb,
  InvestmentDb,
  TransactionDb,
  AdminSessionDb,
  BalanceDb,
  KYCDb
} from '@/lib/db';
import crypto from 'crypto';

// ✅ Lazy-load email module only when needed (avoids Resend init at build time)
async function loadEmailFns() {
  const mod = await import('@/lib/email');
  return {
    sendKYCStatusEmail: mod.sendKYCStatusEmail,
    sendDepositConfirmEmail: mod.sendDepositConfirmEmail,
  };
}

// ============================================
// ADMIN MIDDLEWARE
// ============================================

async function requireAdmin(authHeader: string | null) {
  const { user, error } = await authenticateRequest(authHeader);

  if (!user) {
    return { authorized: false, error };
  }

  if (user.role !== 'admin') {
    return { authorized: false, error: 'Admin access required' };
  }

  return { authorized: true, user };
}

// ============================================
// GET /api/admin
// ============================================

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { authorized, error } = await requireAdmin(authHeader);

    if (!authorized) {
      return NextResponse.json({ success: false, error }, { status: 403 });
    }

    const { pathname, searchParams } = request.nextUrl;

    // ==========================================
    // GET /api/admin/stats
    // ==========================================
    if (pathname.includes('/stats')) {
      const users = UserDb.getAll();
      const trades = TradeDb.getAll();
      const investments = InvestmentDb.getAll();
      const transactions = TransactionDb.getAll();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return NextResponse.json({
        success: true,
        stats: {
          users: {
            total: users.length,
            active: users.filter(u => u.status === 'active').length,
            verified: users.filter(u => u.kycStatus === 'approved').length,
            newToday: users.filter(u => new Date(u.createdAt) >= today).length,
          },
          trades: {
            total: trades.length,
            active: trades.filter(t => t.status === 'active').length,
            volume: trades.reduce((sum, t) => sum + t.amount, 0),
            profit: trades.reduce((sum, t) => sum + (t.profit || 0), 0),
          },
          investments: {
            total: investments.length,
            active: investments.filter(i => i.status === 'active').length,
            totalValue: investments.filter(i => i.status === 'active').reduce((sum, i) => sum + i.amount, 0),
          },
          transactions: {
            deposits: {
              total: transactions.filter(t => t.type === 'deposit').length,
              pending: transactions.filter(t => t.type === 'deposit' && t.status === 'pending').length,
              volume: transactions
                .filter(t => t.type === 'deposit' && t.status === 'completed')
                .reduce((sum, t) => sum + t.amount, 0),
            },
            withdrawals: {
              total: transactions.filter(t => t.type === 'withdrawal').length,
              pending: transactions.filter(t => t.type === 'withdrawal' && t.status === 'processing').length,
              volume: transactions
                .filter(t => t.type === 'withdrawal' && t.status === 'completed')
                .reduce((sum, t) => sum + t.amount, 0),
            },
          },
        },
      });
    }

    // ==========================================
    // GET /api/admin/users
    // ==========================================
    if (pathname.includes('/users')) {
      const status = searchParams.get('status');
      const kycStatus = searchParams.get('kycStatus');
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');

      let users = UserDb.getAll();

      if (status) users = users.filter(u => u.status === status);
      if (kycStatus) users = users.filter(u => u.kycStatus === kycStatus);

      // Sort by date (newest first)
      users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const total = users.length;
      users = users.slice(offset, offset + limit);

      // Remove sensitive data
      const safeUsers = users.map(({ passwordHash, twoFactorSecret, ...u }) => u);

      return NextResponse.json({
        success: true,
        users: safeUsers,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      });
    }

    // ==========================================
    // GET /api/admin/sessions
    // ==========================================
    if (pathname.includes('/sessions')) {
      const status = searchParams.get('status');
      let sessions = AdminSessionDb.getAll();

      if (status) sessions = sessions.filter(s => s.status === status);

      sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return NextResponse.json({
        success: true,
        sessions,
      });
    }

    // ==========================================
    // GET /api/admin/kyc
    // ==========================================
    if (pathname.includes('/kyc')) {
      const status = searchParams.get('status') || 'pending';
      let applications = KYCDb.getAll();

      if (status !== 'all') {
        applications = applications.filter(k => k.status === status);
      }

      applications.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

      return NextResponse.json({
        success: true,
        applications,
      });
    }

    // ==========================================
    // GET /api/admin/transactions
    // ==========================================
    if (pathname.includes('/transactions')) {
      const type = searchParams.get('type');
      const status = searchParams.get('status');
      const limit = parseInt(searchParams.get('limit') || '50');

      let transactions = TransactionDb.getAll();

      if (type) transactions = transactions.filter(t => t.type === type);
      if (status) transactions = transactions.filter(t => t.status === status);

      transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      transactions = transactions.slice(0, limit);

      return NextResponse.json({
        success: true,
        transactions,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Admin API',
      endpoints: ['/stats', '/users', '/sessions', '/kyc', '/transactions'],
    });
  } catch (error: any) {
    console.error('[Admin API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/admin
// ============================================

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { authorized, error, user } = await requireAdmin(authHeader);

    if (!authorized) {
      return NextResponse.json({ success: false, error }, { status: 403 });
    }

    const { pathname } = request.nextUrl;
    const body = await request.json();

    // ==========================================
    // POST /api/admin/sessions - Create signal session
    // ==========================================
    if (pathname.includes('/sessions')) {
      const { name, description, asset, direction, confidence, duration, scheduledAt } = body;

      if (!name || !asset || !direction || !duration) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const session = AdminSessionDb.create({
        name,
        description,
        asset,
        direction,
        confidence: confidence || 80,
        duration,
        status: scheduledAt ? 'scheduled' : 'active',
        scheduledAt: scheduledAt || new Date().toISOString(),
        startedAt: scheduledAt ? undefined : new Date().toISOString(),
        createdBy: user!.id,
      });

      return NextResponse.json({
        success: true,
        session,
        message: 'Signal session created',
      });
    }

    // ==========================================
    // POST /api/admin/deposits/approve
    // ==========================================
    if (pathname.includes('/deposits/approve')) {
      const { transactionId } = body;

      if (!transactionId) {
        return NextResponse.json(
          { success: false, error: 'Transaction ID required' },
          { status: 400 }
        );
      }

      const transaction = TransactionDb.getById(transactionId);
      if (!transaction) {
        return NextResponse.json(
          { success: false, error: 'Transaction not found' },
          { status: 404 }
        );
      }

      if (transaction.type !== 'deposit' || transaction.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: 'Invalid transaction status' },
          { status: 400 }
        );
      }

      // Add to user balance
      BalanceDb.addFunds(transaction.userId, transaction.currency, transaction.amount);

      // Update transaction
      TransactionDb.update(transactionId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

      // Send email (lazy import so build won't crash)
      const depositUser = UserDb.getById(transaction.userId);
      if (depositUser) {
        try {
          const { sendDepositConfirmEmail } = await loadEmailFns();
          await sendDepositConfirmEmail(depositUser.email, {
            name: depositUser.name,
            amount: transaction.amount.toString(),
            currency: transaction.currency,
            method: transaction.method || 'Bank Transfer',
            transactionId:
              (transaction as any).orderId ??
              (transaction as any).oderId ?? // keep backward-compat if typo exists in stored data
              transaction.id ??
              transactionId,
          });
        } catch (e) {
          console.error('Failed to send deposit email:', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Deposit approved',
        transaction: TransactionDb.getById(transactionId),
      });
    }

    // ==========================================
    // POST /api/admin/kyc/review
    // ==========================================
    if (pathname.includes('/kyc/review')) {
      const { applicationId, status, notes } = body;

      if (!applicationId || !status) {
        return NextResponse.json(
          { success: false, error: 'Application ID and status required' },
          { status: 400 }
        );
      }

      const application = KYCDb.getAll().find(k => k.id === applicationId);
      if (!application) {
        return NextResponse.json(
          { success: false, error: 'Application not found' },
          { status: 404 }
        );
      }

      // Update KYC application
      KYCDb.update(applicationId, {
        status,
        notes,
        reviewedAt: new Date().toISOString(),
        reviewedBy: user!.id,
      });

      // Update user KYC status
      UserDb.update(application.userId, {
        kycStatus: status,
        kycLevel: status === 'approved' ? application.level : 0,
      });

      // Send email (lazy import so build won't crash)
      const kycUser = UserDb.getById(application.userId);
      if (kycUser) {
        try {
          const { sendKYCStatusEmail } = await loadEmailFns();
          await sendKYCStatusEmail(kycUser.email, {
            name: kycUser.name,
            status,
            reason: notes,
            level: `Level ${application.level}`,
          });
        } catch (e) {
          console.error('Failed to send KYC email:', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: `KYC ${status}`,
        application: KYCDb.getAll().find(k => k.id === applicationId),
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid endpoint' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Admin API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/admin
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { authorized, error } = await requireAdmin(authHeader);

    if (!authorized) {
      return NextResponse.json({ success: false, error }, { status: 403 });
    }

    const { pathname } = request.nextUrl;
    const body = await request.json();

    // ==========================================
    // PATCH /api/admin/users - Update user
    // ==========================================
    if (pathname.includes('/users')) {
      const { userId, status, role, kycStatus, kycLevel } = body;

      if (!userId) {
        return NextResponse.json(
          { success: false, error: 'User ID required' },
          { status: 400 }
        );
      }

      const updates: any = {};
      if (status) updates.status = status;
      if (role) updates.role = role;
      if (kycStatus) updates.kycStatus = kycStatus;
      if (kycLevel !== undefined) updates.kycLevel = kycLevel;

      const updatedUser = UserDb.update(userId, updates);

      if (!updatedUser) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      const { passwordHash, twoFactorSecret, ...safeUser } = updatedUser;

      return NextResponse.json({
        success: true,
        user: safeUser,
        message: 'User updated',
      });
    }

    // ==========================================
    // PATCH /api/admin/sessions - Update session
    // ==========================================
    if (pathname.includes('/sessions')) {
      const { sessionId, status, targetPrice } = body;

      if (!sessionId) {
        return NextResponse.json(
          { success: false, error: 'Session ID required' },
          { status: 400 }
        );
      }

      const updates: any = {};
      if (status) {
        updates.status = status;
        if (status === 'active') updates.startedAt = new Date().toISOString();
        if (status === 'completed') updates.endedAt = new Date().toISOString();
      }
      if (targetPrice) updates.targetPrice = targetPrice;

      const session = AdminSessionDb.update(sessionId, updates);

      if (!session) {
        return NextResponse.json(
          { success: false, error: 'Session not found' },
          { status: 404 }
        );
      }

      // If session completed, settle all trades
      if (status === 'completed' && targetPrice) {
        const sessionTrades = TradeDb.getBySession(sessionId);

        for (const trade of sessionTrades) {
          if (trade.status === 'active') {
            const priceChange = targetPrice - trade.entryPrice;
            const isWin =
              (trade.direction === 'up' && priceChange > 0) ||
              (trade.direction === 'down' && priceChange < 0);

            let profit: number;
            let tradeStatus: 'won' | 'lost';

            if (isWin) {
              profit = trade.amount * (trade.payout / 100);
              tradeStatus = 'won';
              BalanceDb.addFunds(trade.userId, 'USD', trade.amount + profit);
            } else {
              profit = -trade.amount;
              tradeStatus = 'lost';
            }

            TradeDb.update(trade.id, {
              exitPrice: targetPrice,
              profit,
              status: tradeStatus,
              closedAt: new Date().toISOString(),
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        session,
        message: 'Session updated',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid endpoint' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Admin API] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

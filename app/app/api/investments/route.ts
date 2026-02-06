// Investments API Routes
// GET /api/investments - Get user investments
// POST /api/investments - Create new investment
// GET /api/investments/plans - Get available plans

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { InvestmentDb, BalanceDb, TransactionDb } from '@/lib/db';
import crypto from 'crypto';

// ============================================
// INVESTMENT PLANS
// ============================================

const INVESTMENT_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    minAmount: 100,
    maxAmount: 999,
    roi: 5,
    duration: 30,
    payoutFrequency: 'end',
    description: 'Perfect for beginners. Low risk with guaranteed returns.',
    features: ['5% ROI after 30 days', 'Capital guaranteed', 'No early withdrawal'],
  },
  {
    id: 'growth',
    name: 'Growth',
    minAmount: 1000,
    maxAmount: 9999,
    roi: 12,
    duration: 60,
    payoutFrequency: 'monthly',
    description: 'Balanced returns for growing portfolios.',
    features: ['12% ROI over 60 days', 'Monthly interest payouts', 'Priority support'],
    badge: 'BEST VALUE',
  },
  {
    id: 'premium',
    name: 'Premium',
    minAmount: 10000,
    maxAmount: 49999,
    roi: 20,
    duration: 90,
    payoutFrequency: 'weekly',
    description: 'High returns for serious investors.',
    features: ['20% ROI over 90 days', 'Weekly interest payouts', 'Dedicated manager'],
  },
  {
    id: 'elite',
    name: 'Elite',
    minAmount: 50000,
    maxAmount: null,
    roi: 35,
    duration: 180,
    payoutFrequency: 'daily',
    description: 'Maximum returns with personal attention.',
    features: ['35% ROI over 180 days', 'Daily interest payouts', 'Personal account manager', 'VIP events'],
    badge: 'EXCLUSIVE',
  },
];

// ============================================
// GET /api/investments
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams, pathname } = request.nextUrl;
    
    // Handle /api/investments/plans
    if (pathname.endsWith('/plans')) {
      return NextResponse.json({
        success: true,
        plans: INVESTMENT_PLANS,
      });
    }
    
    // Authenticate for user investments
    const authHeader = request.headers.get('authorization');
    const { user, error } = await authenticateRequest(authHeader);
    
    if (!user) {
      return NextResponse.json({ success: false, error }, { status: 401 });
    }
    
    // Get user investments
    const status = searchParams.get('status');
    let investments = InvestmentDb.getByUserId(user.id);
    
    if (status) {
      investments = investments.filter(i => i.status === status);
    }
    
    // Sort by date
    investments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Calculate stats
    const stats = {
      totalInvested: investments.reduce((sum, i) => sum + i.amount, 0),
      activeInvestments: investments.filter(i => i.status === 'active').length,
      expectedReturns: investments
        .filter(i => i.status === 'active')
        .reduce((sum, i) => sum + i.expectedReturn, 0),
      completedReturns: investments
        .filter(i => i.status === 'completed')
        .reduce((sum, i) => sum + (i.actualReturn || 0), 0),
    };
    
    return NextResponse.json({
      success: true,
      investments,
      stats,
    });
  } catch (error: any) {
    console.error('[Investments API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/investments
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    const { user, error } = await authenticateRequest(authHeader);
    
    if (!user) {
      return NextResponse.json({ success: false, error }, { status: 401 });
    }
    
    const body = await request.json();
    const { planId, amount } = body;
    
    // Validation
    if (!planId || !amount) {
      return NextResponse.json(
        { success: false, error: 'Plan ID and amount required' },
        { status: 400 }
      );
    }
    
    // Get plan
    const plan = INVESTMENT_PLANS.find(p => p.id === planId);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan' },
        { status: 400 }
      );
    }
    
    // Check amount limits
    if (amount < plan.minAmount) {
      return NextResponse.json(
        { success: false, error: `Minimum amount is $${plan.minAmount}` },
        { status: 400 }
      );
    }
    
    if (plan.maxAmount && amount > plan.maxAmount) {
      return NextResponse.json(
        { success: false, error: `Maximum amount is $${plan.maxAmount}` },
        { status: 400 }
      );
    }
    
    // Check balance
    const balance = BalanceDb.get(user.id, 'USD');
    if (!balance || balance.available < amount) {
      return NextResponse.json(
        { success: false, error: 'Insufficient balance' },
        { status: 400 }
      );
    }
    
    // Deduct from balance
    BalanceDb.deductFunds(user.id, 'USD', amount, 'available');
    
    // Calculate dates
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration);
    
    // Calculate expected return
    const expectedReturn = amount * (1 + plan.roi / 100);
    
    // Create investment
    const investment = InvestmentDb.create({
      oderId: `INV-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      planId: plan.id,
      planName: plan.name,
      userId: user.id,
      amount,
      currency: 'USD',
      roi: plan.roi,
      duration: plan.duration,
      expectedReturn,
      status: 'active',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    
    // Create transaction record
    TransactionDb.create({
      oderId: investment.oderId,
      type: 'investment',
      status: 'completed',
      amount,
      currency: 'USD',
      fee: 0,
      netAmount: amount,
      description: `Investment in ${plan.name} plan`,
      userId: user.id,
    });
    
    return NextResponse.json({
      success: true,
      investment,
      message: `Successfully invested $${amount} in ${plan.name} plan`,
    });
  } catch (error: any) {
    console.error('[Investments API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

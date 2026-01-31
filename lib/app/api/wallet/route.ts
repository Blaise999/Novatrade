// Wallet API Routes
// GET /api/wallet - Get wallet balance
// POST /api/wallet/deposit - Create deposit request
// POST /api/wallet/withdraw - Create withdrawal request
// GET /api/wallet/transactions - Get transaction history

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { BalanceDb, TransactionDb } from '@/lib/db';
import { sendDepositConfirmEmail, sendWithdrawalRequestEmail, sendOTPEmail, verifyOTPCode } from '@/lib/email';
import crypto from 'crypto';

// ============================================
// GET /api/wallet
// ============================================

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { user, error } = await authenticateRequest(authHeader);
    
    if (!user) {
      return NextResponse.json({ success: false, error }, { status: 401 });
    }
    
    const { searchParams, pathname } = request.nextUrl;
    
    // Handle /api/wallet/transactions
    if (pathname.includes('/transactions')) {
      const type = searchParams.get('type');
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');
      
      let transactions = TransactionDb.getByUserId(user.id);
      
      if (type) {
        transactions = transactions.filter(t => t.type === type);
      }
      
      // Sort by date (newest first)
      transactions.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      const total = transactions.length;
      transactions = transactions.slice(offset, offset + limit);
      
      return NextResponse.json({
        success: true,
        transactions,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      });
    }
    
    // Get all balances for user
    const balances = BalanceDb.getByUserId(user.id);
    
    // Ensure USD balance exists
    if (!balances.find(b => b.currency === 'USD')) {
      BalanceDb.upsert({
        userId: user.id,
        currency: 'USD',
        available: 0,
        pending: 0,
        locked: 0,
        bonus: 100, // Welcome bonus
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalProfit: 0,
      });
    }
    
    const updatedBalances = BalanceDb.getByUserId(user.id);
    
    // Calculate totals
    const totals = {
      totalAvailable: updatedBalances.reduce((sum, b) => sum + b.available, 0),
      totalPending: updatedBalances.reduce((sum, b) => sum + b.pending, 0),
      totalBonus: updatedBalances.reduce((sum, b) => sum + b.bonus, 0),
      totalDeposited: updatedBalances.reduce((sum, b) => sum + b.totalDeposited, 0),
      totalWithdrawn: updatedBalances.reduce((sum, b) => sum + b.totalWithdrawn, 0),
    };
    
    return NextResponse.json({
      success: true,
      balances: updatedBalances,
      totals,
    });
  } catch (error: any) {
    console.error('[Wallet API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/wallet (deposit/withdraw)
// ============================================

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { user, error } = await authenticateRequest(authHeader);
    
    if (!user) {
      return NextResponse.json({ success: false, error }, { status: 401 });
    }
    
    const { pathname } = request.nextUrl;
    const body = await request.json();
    
    // Handle deposit
    if (pathname.includes('/deposit')) {
      return handleDeposit(user, body);
    }
    
    // Handle withdrawal
    if (pathname.includes('/withdraw')) {
      return handleWithdraw(user, body);
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid endpoint' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Wallet API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// DEPOSIT HANDLER
// ============================================

async function handleDeposit(user: any, body: any) {
  const { amount, currency = 'USD', method, txHash, fromAddress } = body;
  
  // Validation
  if (!amount || amount <= 0) {
    return NextResponse.json(
      { success: false, error: 'Invalid amount' },
      { status: 400 }
    );
  }
  
  if (!method) {
    return NextResponse.json(
      { success: false, error: 'Payment method required' },
      { status: 400 }
    );
  }
  
  const minDeposit = 10;
  if (amount < minDeposit) {
    return NextResponse.json(
      { success: false, error: `Minimum deposit is $${minDeposit}` },
      { status: 400 }
    );
  }
  
  // Generate transaction ID
  const transactionId = `DEP-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  
  // Create transaction (pending)
  const transaction = TransactionDb.create({
    oderId: transactionId,
    type: 'deposit',
    status: 'pending',
    amount,
    currency,
    fee: 0,
    netAmount: amount,
    method,
    txHash,
    fromAddress,
    description: `Deposit via ${method}`,
    userId: user.id,
  });
  
  // For demo: auto-approve deposits
  // In production: wait for payment confirmation
  if (process.env.AUTO_APPROVE_DEPOSITS === 'true' || method === 'demo') {
    // Add to balance
    BalanceDb.addFunds(user.id, currency, amount, 'available');
    
    // Update transaction
    TransactionDb.update(transaction.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    
    // Send confirmation email
    try {
      await sendDepositConfirmEmail(user.email, {
        name: user.name,
        amount: amount.toString(),
        currency,
        method,
        transactionId,
      });
    } catch (e) {
      console.error('Failed to send deposit email:', e);
    }
    
    return NextResponse.json({
      success: true,
      transaction: { ...transaction, status: 'completed' },
      message: 'Deposit completed successfully',
      newBalance: BalanceDb.get(user.id, currency)?.available || 0,
    });
  }
  
  return NextResponse.json({
    success: true,
    transaction,
    message: 'Deposit request created. Please complete payment.',
    paymentInstructions: getPaymentInstructions(method, amount, transactionId),
  });
}

// ============================================
// WITHDRAW HANDLER
// ============================================

async function handleWithdraw(user: any, body: any) {
  const { 
    amount, 
    currency = 'USD', 
    method, 
    destination,
    otp 
  } = body;
  
  // Validation
  if (!amount || amount <= 0) {
    return NextResponse.json(
      { success: false, error: 'Invalid amount' },
      { status: 400 }
    );
  }
  
  if (!method || !destination) {
    return NextResponse.json(
      { success: false, error: 'Method and destination required' },
      { status: 400 }
    );
  }
  
  // Check KYC
  if (user.kycStatus !== 'approved') {
    return NextResponse.json(
      { success: false, error: 'KYC verification required for withdrawals' },
      { status: 400 }
    );
  }
  
  // Check balance
  const balance = BalanceDb.get(user.id, currency);
  if (!balance || balance.available < amount) {
    return NextResponse.json(
      { success: false, error: 'Insufficient balance' },
      { status: 400 }
    );
  }
  
  // Minimum withdrawal
  const minWithdraw = 50;
  if (amount < minWithdraw) {
    return NextResponse.json(
      { success: false, error: `Minimum withdrawal is $${minWithdraw}` },
      { status: 400 }
    );
  }
  
  // Verify OTP if provided
if (otp) {
  const otpResult = await verifyOTPCode(user.email, otp, 'withdrawal');

  if (!otpResult.success) {
    return NextResponse.json(
      { success: false, error: otpResult.error ?? "Invalid OTP" },
      { status: 400 }
    );
  }

  } else {
    // Send OTP for verification
    await sendOTPEmail(user.email, user.name, 'withdrawal');
    return NextResponse.json({
      success: false,
      requiresOTP: true,
      message: 'Verification code sent to your email',
    });
  }
  
  // Calculate fee
  const feePercent = 1; // 1% withdrawal fee
  const fee = amount * (feePercent / 100);
  const netAmount = amount - fee;
  
  // Deduct from balance
  BalanceDb.deductFunds(user.id, currency, amount, 'available');
  
  // Generate request ID
  const requestId = `WD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  
  // Create transaction
  const transaction = TransactionDb.create({
    oderId: requestId,
    type: 'withdrawal',
    status: 'processing',
    amount,
    currency,
    fee,
    netAmount,
    method,
    toAddress: destination,
    description: `Withdrawal to ${destination.slice(0, 10)}...`,
    userId: user.id,
  });
  
  // Send confirmation email
  try {
    await sendWithdrawalRequestEmail(user.email, {
      name: user.name,
      amount: amount.toString(),
      currency,
      method,
      destination,
      requestId,
    });
  } catch (e) {
    console.error('Failed to send withdrawal email:', e);
  }
  
  return NextResponse.json({
    success: true,
    transaction,
    message: 'Withdrawal request submitted',
    details: {
      amount,
      fee,
      netAmount,
      estimatedTime: '1-24 hours',
    },
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getPaymentInstructions(method: string, amount: number, transactionId: string) {
  const instructions: Record<string, any> = {
    crypto: {
      BTC: { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', network: 'Bitcoin' },
      ETH: { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f...', network: 'Ethereum' },
      USDT: { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f...', network: 'ERC-20' },
    },
    bank: {
      bankName: 'Demo Bank',
      accountName: 'NOVATrADE Inc.',
      accountNumber: '1234567890',
      routingNumber: '021000021',
      reference: transactionId,
    },
    card: {
      redirectUrl: `/checkout/${transactionId}`,
    },
  };
  
  return {
    method,
    amount,
    transactionId,
    details: instructions[method] || { message: 'Contact support for payment instructions' },
    expiresIn: '30 minutes',
  };
}

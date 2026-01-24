// Database Schema & Models for NOVATrADE Backend
// Using JSON file storage for demo (use PostgreSQL/MongoDB in production)

import crypto from 'crypto';

// ============================================
// IN-MEMORY STORAGE (works in serverless)
// ============================================

const memoryStore: Record<string, unknown[]> = {
  users: [],
  trades: [],
  investments: [],
  transactions: [],
  airdrops: [],
  kyc: [],
  sessions: [],
  balances: [],
};

function readDb<T>(key: string): T[] {
  return (memoryStore[key] || []) as T[];
}

function writeDb<T>(key: string, data: T[]): void {
  memoryStore[key] = data;
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  role: 'user' | 'admin' | 'moderator';
  status: 'active' | 'suspended' | 'pending';
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  kycStatus: 'not_started' | 'pending' | 'approved' | 'rejected';
  kycLevel: 0 | 1 | 2 | 3;
  referralCode: string;
  referredBy?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
}

export interface UserBalance {
  userId: string;
  currency: string;
  available: number;
  pending: number;
  locked: number;
  bonus: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalProfit: number;
  updatedAt: string;
}

export interface Trade {
  id: string;
  oderId: string;
  type: 'buy' | 'sell';
  direction: 'up' | 'down';
  asset: string;
  assetType: 'crypto' | 'forex' | 'stock' | 'commodity';
  amount: number;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  duration: number;
  status: 'pending' | 'active' | 'won' | 'lost' | 'cancelled' | 'closed';
  profit?: number;
  payout: number;
  openedAt: string;
  closedAt?: string;
  userId: string;
  sessionId?: string;
}

export interface Investment {
  id: string;
  oderId: string;
  planId: string;
  planName: string;
  userId: string;
  amount: number;
  currency: string;
  roi: number;
  duration: number;
  expectedReturn: number;
  actualReturn?: number;
  status: 'active' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string;
  lastPayoutAt?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  oderId: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'trade' | 'investment' | 'bonus' | 'referral' | 'airdrop' | 'fee';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  fee: number;
  netAmount: number;
  method?: string;
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

export interface AirdropClaim {
  id: string;
  oderId: string;
  airdropId: string;
  amount: number;
  token: string;
  feePaid: number;
  feeToken: string;
  txHash?: string;
  merkleProof: string[];
  wonLottery: boolean;
  lotteryPrize: number;
  status: 'pending' | 'claimed' | 'failed';
  claimedAt?: string;
  createdAt: string;
}

export interface KYCDocument {
  id: string;
  userId: string;
  type: 'passport' | 'id_card' | 'drivers_license' | 'selfie' | 'proof_of_address' | 'bank_statement';
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  uploadedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface KYCApplication {
  id: string;
  userId: string;
  level: 1 | 2 | 3;
  status: 'pending' | 'approved' | 'rejected' | 'additional_info_required';
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  country: string;
  address: string;
  city: string;
  postalCode: string;
  documents: KYCDocument[];
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;
}

export interface AdminSession {
  id: string;
  name: string;
  description?: string;
  asset: string;
  direction: 'up' | 'down';
  confidence: number;
  duration: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  targetPrice?: number;
  createdBy: string;
  createdAt: string;
}

// ============================================
// USER DATABASE
// ============================================

export const UserDb = {
  getAll(): User[] {
    return readDb<User>('users');
  },

  getById(id: string): User | undefined {
    return this.getAll().find(u => u.id === id);
  },

  getByEmail(email: string): User | undefined {
    return this.getAll().find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  getByReferralCode(code: string): User | undefined {
    return this.getAll().find(u => u.referralCode === code);
  },

  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'referralCode'>): User {
    const users = this.getAll();
    const newUser: User = {
      ...user,
      id: crypto.randomUUID(),
      referralCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(newUser);
    writeDb('users', users);
    return newUser;
  },

  update(id: string, updates: Partial<User>): User | undefined {
    const users = this.getAll();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return undefined;
    users[index] = { ...users[index], ...updates, updatedAt: new Date().toISOString() };
    writeDb('users', users);
    return users[index];
  },

  delete(id: string): boolean {
    const users = this.getAll();
    const filtered = users.filter(u => u.id !== id);
    if (filtered.length === users.length) return false;
    writeDb('users', filtered);
    return true;
  },

  count(): number {
    return this.getAll().length;
  },
};

// ============================================
// TRADE DATABASE
// ============================================

export const TradeDb = {
  getAll(): Trade[] {
    return readDb<Trade>('trades');
  },

  getById(id: string): Trade | undefined {
    return this.getAll().find(t => t.id === id);
  },

  getByUserId(userId: string): Trade[] {
    return this.getAll().filter(t => t.userId === userId);
  },

  getActive(): Trade[] {
    return this.getAll().filter(t => t.status === 'active' || t.status === 'pending');
  },

  getBySession(sessionId: string): Trade[] {
    return this.getAll().filter(t => t.sessionId === sessionId);
  },

  create(trade: Omit<Trade, 'id'>): Trade {
    const trades = this.getAll();
    const newTrade: Trade = { ...trade, id: crypto.randomUUID() };
    trades.push(newTrade);
    writeDb('trades', trades);
    return newTrade;
  },

  update(id: string, updates: Partial<Trade>): Trade | undefined {
    const trades = this.getAll();
    const index = trades.findIndex(t => t.id === id);
    if (index === -1) return undefined;
    trades[index] = { ...trades[index], ...updates };
    writeDb('trades', trades);
    return trades[index];
  },

  getUserStats(userId: string): { totalTrades: number; winRate: number; totalProfit: number; totalVolume: number } {
    const userTrades = this.getByUserId(userId).filter(t => 
      t.status === 'won' || t.status === 'lost' || t.status === 'closed'
    );
    const wins = userTrades.filter(t => t.status === 'won' || (t.profit && t.profit > 0)).length;
    const totalProfit = userTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const totalVolume = userTrades.reduce((sum, t) => sum + t.amount, 0);
    return {
      totalTrades: userTrades.length,
      winRate: userTrades.length > 0 ? (wins / userTrades.length) * 100 : 0,
      totalProfit,
      totalVolume,
    };
  },
};

// ============================================
// INVESTMENT DATABASE
// ============================================

export const InvestmentDb = {
  getAll(): Investment[] {
    return readDb<Investment>('investments');
  },

  getById(id: string): Investment | undefined {
    return this.getAll().find(i => i.id === id);
  },

  getByUserId(userId: string): Investment[] {
    return this.getAll().filter(i => i.userId === userId);
  },

  getActive(): Investment[] {
    return this.getAll().filter(i => i.status === 'active');
  },

  create(investment: Omit<Investment, 'id' | 'createdAt'>): Investment {
    const investments = this.getAll();
    const newInvestment: Investment = {
      ...investment,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    investments.push(newInvestment);
    writeDb('investments', investments);
    return newInvestment;
  },

  update(id: string, updates: Partial<Investment>): Investment | undefined {
    const investments = this.getAll();
    const index = investments.findIndex(i => i.id === id);
    if (index === -1) return undefined;
    investments[index] = { ...investments[index], ...updates };
    writeDb('investments', investments);
    return investments[index];
  },
};

// ============================================
// TRANSACTION DATABASE
// ============================================

export const TransactionDb = {
  getAll(): Transaction[] {
    return readDb<Transaction>('transactions');
  },

  getById(id: string): Transaction | undefined {
    return this.getAll().find(t => t.id === id);
  },

  getByUserId(userId: string): Transaction[] {
    return this.getAll().filter(t => t.userId === userId);
  },

  getByType(type: Transaction['type']): Transaction[] {
    return this.getAll().filter(t => t.type === type);
  },

  getPending(): Transaction[] {
    return this.getAll().filter(t => t.status === 'pending' || t.status === 'processing');
  },

  create(transaction: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
    const transactions = this.getAll();
    const newTransaction: Transaction = {
      ...transaction,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    transactions.push(newTransaction);
    writeDb('transactions', transactions);
    return newTransaction;
  },

  update(id: string, updates: Partial<Transaction>): Transaction | undefined {
    const transactions = this.getAll();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return undefined;
    transactions[index] = { ...transactions[index], ...updates };
    writeDb('transactions', transactions);
    return transactions[index];
  },
};

// ============================================
// AIRDROP DATABASE
// ============================================

export const AirdropDb = {
  getAll(): AirdropClaim[] {
    return readDb<AirdropClaim>('airdrops');
  },

  getByUserId(userId: string): AirdropClaim[] {
    return this.getAll().filter(a => a.oderId === userId);
  },

  getByAirdropId(airdropId: string): AirdropClaim[] {
    return this.getAll().filter(a => a.airdropId === airdropId);
  },

  hasClaimed(userId: string, airdropId: string): boolean {
    return this.getAll().some(a => a.oderId === userId && a.airdropId === airdropId && a.status === 'claimed');
  },

  create(claim: Omit<AirdropClaim, 'id' | 'createdAt'>): AirdropClaim {
    const claims = this.getAll();
    const newClaim: AirdropClaim = {
      ...claim,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    claims.push(newClaim);
    writeDb('airdrops', claims);
    return newClaim;
  },

  update(id: string, updates: Partial<AirdropClaim>): AirdropClaim | undefined {
    const claims = this.getAll();
    const index = claims.findIndex(c => c.id === id);
    if (index === -1) return undefined;
    claims[index] = { ...claims[index], ...updates };
    writeDb('airdrops', claims);
    return claims[index];
  },

  getStats(airdropId: string): { totalClaims: number; totalAmount: number; lotteryWinners: number; totalLotteryPrize: number } {
    const claims = this.getByAirdropId(airdropId).filter(c => c.status === 'claimed');
    return {
      totalClaims: claims.length,
      totalAmount: claims.reduce((sum, c) => sum + c.amount, 0),
      lotteryWinners: claims.filter(c => c.wonLottery).length,
      totalLotteryPrize: claims.reduce((sum, c) => sum + c.lotteryPrize, 0),
    };
  },
};

// ============================================
// KYC DATABASE
// ============================================

export const KYCDb = {
  getAll(): KYCApplication[] {
    return readDb<KYCApplication>('kyc');
  },

  getByUserId(userId: string): KYCApplication | undefined {
    return this.getAll().find(k => k.userId === userId);
  },

  getPending(): KYCApplication[] {
    return this.getAll().filter(k => k.status === 'pending');
  },

  create(application: Omit<KYCApplication, 'id' | 'submittedAt'>): KYCApplication {
    const applications = this.getAll();
    const newApplication: KYCApplication = {
      ...application,
      id: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
    };
    applications.push(newApplication);
    writeDb('kyc', applications);
    return newApplication;
  },

  update(id: string, updates: Partial<KYCApplication>): KYCApplication | undefined {
    const applications = this.getAll();
    const index = applications.findIndex(k => k.id === id);
    if (index === -1) return undefined;
    applications[index] = { ...applications[index], ...updates };
    writeDb('kyc', applications);
    return applications[index];
  },
};

// ============================================
// ADMIN SESSION DATABASE
// ============================================

export const AdminSessionDb = {
  getAll(): AdminSession[] {
    return readDb<AdminSession>('sessions');
  },

  getById(id: string): AdminSession | undefined {
    return this.getAll().find(s => s.id === id);
  },

  getActive(): AdminSession[] {
    return this.getAll().filter(s => s.status === 'active');
  },

  getScheduled(): AdminSession[] {
    return this.getAll().filter(s => s.status === 'scheduled');
  },

  create(session: Omit<AdminSession, 'id' | 'createdAt'>): AdminSession {
    const sessions = this.getAll();
    const newSession: AdminSession = {
      ...session,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    sessions.push(newSession);
    writeDb('sessions', sessions);
    return newSession;
  },

  update(id: string, updates: Partial<AdminSession>): AdminSession | undefined {
    const sessions = this.getAll();
    const index = sessions.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    sessions[index] = { ...sessions[index], ...updates };
    writeDb('sessions', sessions);
    return sessions[index];
  },
};

// ============================================
// BALANCE DATABASE
// ============================================

export const BalanceDb = {
  getAll(): UserBalance[] {
    return readDb<UserBalance>('balances');
  },

  getByUserId(userId: string): UserBalance[] {
    return this.getAll().filter(b => b.userId === userId);
  },

  get(userId: string, currency: string): UserBalance | undefined {
    return this.getAll().find(b => b.userId === userId && b.currency === currency);
  },

  upsert(balance: Omit<UserBalance, 'updatedAt'>): UserBalance {
    const balances = this.getAll();
    const index = balances.findIndex(b => b.userId === balance.userId && b.currency === balance.currency);
    const updatedBalance: UserBalance = { ...balance, updatedAt: new Date().toISOString() };
    if (index === -1) {
      balances.push(updatedBalance);
    } else {
      balances[index] = updatedBalance;
    }
    writeDb('balances', balances);
    return updatedBalance;
  },

  addFunds(userId: string, currency: string, amount: number, type: 'available' | 'pending' | 'bonus' = 'available'): UserBalance {
    const existing = this.get(userId, currency);
    const current = existing || {
      userId,
      currency,
      available: 0,
      pending: 0,
      locked: 0,
      bonus: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalProfit: 0,
    };
    return this.upsert({
      ...current,
      [type]: (current[type] || 0) + amount,
      totalDeposited: type === 'available' ? current.totalDeposited + amount : current.totalDeposited,
    });
  },

  deductFunds(userId: string, currency: string, amount: number, type: 'available' | 'pending' | 'bonus' = 'available'): UserBalance | null {
    const existing = this.get(userId, currency);
    if (!existing || (existing[type] || 0) < amount) return null;
    return this.upsert({
      ...existing,
      [type]: (existing[type] || 0) - amount,
    });
  },
};

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  User: UserDb,
  Trade: TradeDb,
  Investment: InvestmentDb,
  Transaction: TransactionDb,
  Airdrop: AirdropDb,
  KYC: KYCDb,
  AdminSession: AdminSessionDb,
  Balance: BalanceDb,
};

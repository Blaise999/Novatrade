// Database layer for NOVATrADE backend
// Uses in-memory storage by default (replace with Prisma/Drizzle/etc for production)

import { type Address } from 'viem';

// ============================================
// TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  walletAddress?: Address;
  emailVerified: boolean;
  kycStatus: 'not_started' | 'pending' | 'approved' | 'rejected';
  kycLevel: 0 | 1 | 2 | 3;
  createdAt: Date;
  updatedAt: Date;
  referralCode: string;
  referredBy?: string;
}

export interface AirdropAllocation {
  id: string;
  oderId: string;
  userId?: string;
  walletAddress: Address;
  amount: bigint;
  bonusMultiplier: number;
  eligibilityTiers: string[];
  claimed: boolean;
  claimedAt?: Date;
  claimTxHash?: string;
  createdAt: Date;
}

export interface Investment {
  id: string;
  oderId: string;
  userId: string;
  type: 'plan' | 'staking' | 'vault';
  planId?: string;
  amount: bigint;
  currency: string;
  expectedReturn: bigint;
  actualReturn?: bigint;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'completed' | 'cancelled';
  txHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Trade {
  id: string;
  oderId: string;
  oderId2: string;
  userId: string;
  asset: string;
  type: 'buy' | 'sell';
  amount: bigint;
  price: bigint;
  total: bigint;
  status: 'pending' | 'filled' | 'cancelled';
  filledAt?: Date;
  txHash?: string;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  oderId: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'trade' | 'fee' | 'reward';
  amount: bigint;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface AdminSignal {
  id: string;
  sessionId: string;
  asset: string;
  direction: 'up' | 'down';
  magnitude: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  status: 'scheduled' | 'active' | 'completed';
  createdBy: string;
  createdAt: Date;
}

// ============================================
// IN-MEMORY STORAGE
// ============================================

class InMemoryDB {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, string> = new Map();
  private usersByWallet: Map<string, string> = new Map();
  
  private airdropAllocations: Map<string, AirdropAllocation> = new Map();
  private allocationsByWallet: Map<string, string> = new Map();
  
  private investments: Map<string, Investment> = new Map();
  private trades: Map<string, Trade> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private adminSignals: Map<string, AdminSignal> = new Map();
  
  // ============================================
  // USER OPERATIONS
  // ============================================
  
  async createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'referralCode'>): Promise<User> {
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const referralCode = `NOVA${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    
    const user: User = {
      ...data,
      id,
      referralCode,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.set(id, user);
    this.usersByEmail.set(data.email.toLowerCase(), id);
    if (data.walletAddress) {
      this.usersByWallet.set(data.walletAddress.toLowerCase(), id);
    }
    
    return user;
  }
  
  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
  
  async getUserByEmail(email: string): Promise<User | null> {
    const id = this.usersByEmail.get(email.toLowerCase());
    return id ? this.users.get(id) || null : null;
  }
  
  async getUserByWallet(wallet: Address): Promise<User | null> {
    const id = this.usersByWallet.get(wallet.toLowerCase());
    return id ? this.users.get(id) || null : null;
  }
  
  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    
    const updated = { ...user, ...data, updatedAt: new Date() };
    this.users.set(id, updated);
    
    if (data.walletAddress) {
      this.usersByWallet.set(data.walletAddress.toLowerCase(), id);
    }
    
    return updated;
  }
  
  // ============================================
  // AIRDROP OPERATIONS
  // ============================================
  
  async createAirdropAllocation(data: Omit<AirdropAllocation, 'id' | 'createdAt'>): Promise<AirdropAllocation> {
    const id = `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const allocation: AirdropAllocation = {
      ...data,
      id,
      createdAt: new Date()
    };
    
    this.airdropAllocations.set(id, allocation);
    this.allocationsByWallet.set(data.walletAddress.toLowerCase(), id);
    
    return allocation;
  }
  
  async getAirdropAllocation(wallet: Address): Promise<AirdropAllocation | null> {
    const id = this.allocationsByWallet.get(wallet.toLowerCase());
    return id ? this.airdropAllocations.get(id) || null : null;
  }
  
  async markAirdropClaimed(wallet: Address, txHash: string): Promise<AirdropAllocation | null> {
    const id = this.allocationsByWallet.get(wallet.toLowerCase());
    if (!id) return null;
    
    const allocation = this.airdropAllocations.get(id);
    if (!allocation) return null;
    
    const updated: AirdropAllocation = {
      ...allocation,
      claimed: true,
      claimedAt: new Date(),
      claimTxHash: txHash
    };
    
    this.airdropAllocations.set(id, updated);
    return updated;
  }
  
  async getAllAirdropAllocations(): Promise<AirdropAllocation[]> {
    return Array.from(this.airdropAllocations.values());
  }
  
  async bulkCreateAllocations(allocations: Omit<AirdropAllocation, 'id' | 'createdAt'>[]): Promise<number> {
    let created = 0;
    for (const data of allocations) {
      await this.createAirdropAllocation(data);
      created++;
    }
    return created;
  }
  
  // ============================================
  // INVESTMENT OPERATIONS
  // ============================================
  
  async createInvestment(data: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Investment> {
    const id = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const investment: Investment = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.investments.set(id, investment);
    return investment;
  }
  
  async getUserInvestments(userId: string): Promise<Investment[]> {
    return Array.from(this.investments.values())
      .filter(inv => inv.userId === userId);
  }
  
  async updateInvestment(id: string, data: Partial<Investment>): Promise<Investment | null> {
    const investment = this.investments.get(id);
    if (!investment) return null;
    
    const updated = { ...investment, ...data, updatedAt: new Date() };
    this.investments.set(id, updated);
    return updated;
  }
  
  // ============================================
  // TRADE OPERATIONS
  // ============================================
  
  async createTrade(data: Omit<Trade, 'id' | 'createdAt'>): Promise<Trade> {
    const id = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const trade: Trade = {
      ...data,
      id,
      createdAt: new Date()
    };
    
    this.trades.set(id, trade);
    return trade;
  }
  
  async getUserTrades(userId: string, limit: number = 50): Promise<Trade[]> {
    return Array.from(this.trades.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  
  // ============================================
  // TRANSACTION OPERATIONS
  // ============================================
  
  async createTransaction(data: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const transaction: Transaction = {
      ...data,
      id,
      createdAt: new Date()
    };
    
    this.transactions.set(id, transaction);
    return transaction;
  }
  
  async getUserTransactions(userId: string, limit: number = 50): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  
  // ============================================
  // ADMIN SIGNAL OPERATIONS
  // ============================================
  
  async createAdminSignal(data: Omit<AdminSignal, 'id' | 'createdAt'>): Promise<AdminSignal> {
    const id = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const signal: AdminSignal = {
      ...data,
      id,
      createdAt: new Date()
    };
    
    this.adminSignals.set(id, signal);
    return signal;
  }
  
  async getActiveSignals(): Promise<AdminSignal[]> {
    const now = new Date();
    return Array.from(this.adminSignals.values())
      .filter(s => s.status === 'active' || (s.status === 'scheduled' && s.startTime <= now));
  }
  
  async updateSignalStatus(id: string, status: AdminSignal['status']): Promise<AdminSignal | null> {
    const signal = this.adminSignals.get(id);
    if (!signal) return null;
    
    const updated = { ...signal, status };
    this.adminSignals.set(id, updated);
    return updated;
  }
  
  // ============================================
  // STATS
  // ============================================
  
  async getStats() {
    const allUsers = Array.from(this.users.values());
    const allInvestments = Array.from(this.investments.values());
    const allTrades = Array.from(this.trades.values());
    const allAllocations = Array.from(this.airdropAllocations.values());
    
    return {
      totalUsers: allUsers.length,
      verifiedUsers: allUsers.filter(u => u.emailVerified).length,
      kycApproved: allUsers.filter(u => u.kycStatus === 'approved').length,
      
      totalInvestments: allInvestments.length,
      activeInvestments: allInvestments.filter(i => i.status === 'active').length,
      totalInvestedVolume: allInvestments.reduce((sum, i) => sum + i.amount, BigInt(0)),
      
      totalTrades: allTrades.length,
      tradingVolume: allTrades.reduce((sum, t) => sum + t.total, BigInt(0)),
      
      airdropAllocations: allAllocations.length,
      airdropClaimed: allAllocations.filter(a => a.claimed).length,
      totalAirdropTokens: allAllocations.reduce((sum, a) => sum + a.amount, BigInt(0)),
      claimedAirdropTokens: allAllocations.filter(a => a.claimed).reduce((sum, a) => sum + a.amount, BigInt(0))
    };
  }
}

// Singleton instance
export const db = new InMemoryDB();

// Export for API routes
export default db;

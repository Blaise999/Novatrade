// ==========================================
// COMPREHENSIVE TRADING TYPES
// Implements both Spot (Stock) and Margin (FX/CFD) trading models
// ==========================================

// ==========================================
// ACCOUNT TYPES
// ==========================================

export interface TradingAccount {
  id: string;
  userId: string;
  type: 'spot' | 'margin' | 'binary';
  
  // Core balances
  cash: number;                    // Liquid cash available
  equity: number;                  // Total account value (computed)
  
  // For spot trading
  availableToTrade: number;
  availableToWithdraw: number;
  
  // For margin trading
  balance: number;                 // Starting collateral
  marginUsed: number;              // Currently locked in positions
  freeMargin: number;              // Available for new positions
  leverage: number;                // Account leverage (e.g., 100)
  marginLevel?: number;            // (Equity / Margin Used) * 100
  
  // PnL tracking
  unrealizedPnL: number;           // Mark-to-market on open positions
  realizedPnL: number;             // Locked in from closed trades
  totalPnL: number;                // unrealized + realized
  
  // Additional
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// POSITION TYPES
// ==========================================

export interface StockPosition {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  type: 'stock';
  
  // Position data
  qty: number;
  avgEntry: number;
  
  // Computed values (updated on price change)
  currentPrice: number;
  marketValue: number;              // qty * currentPrice
  unrealizedPnL: number;            // (currentPrice - avgEntry) * qty
  unrealizedPnLPercent: number;
  
  // Metadata
  openedAt: Date;
  updatedAt: Date;
}

export interface MarginPosition {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  type: 'forex' | 'cfd' | 'crypto';
  
  // Position data
  side: 'long' | 'short';
  qty: number;                      // Lot size or units
  avgEntry: number;
  leverage: number;
  
  // Margin requirements
  notional: number;                 // qty * avgEntry
  requiredMargin: number;           // notional / leverage
  maintenanceMargin: number;        // Usually 50% of required
  
  // Risk management
  stopLoss?: number;
  takeProfit?: number;
  liquidationPrice?: number;
  
  // Computed values (updated on price change)
  currentPrice: number;
  unrealizedPnL: number;            // Calculated based on side
  unrealizedPnLPercent: number;
  
  // Fees and funding
  openingFee: number;
  accumulatedFunding: number;
  
  // Metadata
  openedAt: Date;
  updatedAt: Date;
}

// ==========================================
// ORDER TYPES
// ==========================================

export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';

export interface Order {
  id: string;
  accountId: string;
  symbol: string;
  
  type: OrderType;
  side: OrderSide;
  
  qty: number;
  price?: number;                   // For limit orders
  stopPrice?: number;               // For stop orders
  
  filledQty: number;
  avgFillPrice?: number;
  
  status: OrderStatus;
  
  // Risk management
  stopLoss?: number;
  takeProfit?: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  filledAt?: Date;
  cancelledAt?: Date;
}

// ==========================================
// FILL / EXECUTION TYPES
// ==========================================

export interface Fill {
  id: string;
  orderId: string;
  accountId: string;
  symbol: string;
  
  side: OrderSide;
  qty: number;
  price: number;
  
  fee: number;
  feeCurrency: string;
  
  // For audit trail
  executedAt: Date;
}

// ==========================================
// LEDGER TYPES (For Audit Trail)
// ==========================================

export type LedgerEntryType = 
  | 'deposit'
  | 'withdrawal'
  | 'trade_open'
  | 'trade_close'
  | 'realized_pnl'
  | 'fee'
  | 'funding'
  | 'bonus'
  | 'adjustment'     // Admin adjustments
  | 'transfer';

export interface LedgerEntry {
  id: string;
  accountId: string;
  type: LedgerEntryType;
  
  amount: number;                   // Positive for credit, negative for debit
  balanceBefore: number;
  balanceAfter: number;
  
  // Reference to related entity
  referenceId?: string;             // Order ID, Position ID, etc.
  referenceType?: string;
  
  description: string;
  
  // For admin actions
  adminId?: string;
  adminNote?: string;
  
  createdAt: Date;
}

// ==========================================
// DEPOSIT/WITHDRAWAL TYPES
// ==========================================

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type PaymentMethod = 'crypto' | 'card' | 'bank' | 'wire';

export interface DepositAddress {
  id: string;
  currency: string;
  network: string;
  address: string;
  memo?: string;
  qrCode?: string;
  isActive: boolean;
  // Admin can update these
  updatedBy?: string;
  updatedAt: Date;
}

export interface Deposit {
  id: string;
  userId: string;
  accountId: string;
  
  method: PaymentMethod;
  currency: string;
  amount: number;
  fee: number;
  netAmount: number;
  
  status: TransactionStatus;
  
  // Crypto specific
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
  confirmations?: number;
  requiredConfirmations?: number;
  
  // Processing
  processedBy?: string;
  processedAt?: Date;
  note?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Withdrawal {
  id: string;
  userId: string;
  accountId: string;
  
  method: PaymentMethod;
  currency: string;
  amount: number;
  fee: number;
  netAmount: number;
  
  status: TransactionStatus;
  
  // Destination
  toAddress?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    routingNumber?: string;
    swiftCode?: string;
  };
  
  // Processing
  processedBy?: string;
  processedAt?: Date;
  note?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// INVESTMENT TYPES
// ==========================================

export interface Investment {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  
  principal: number;
  currentValue: number;
  totalEarned: number;
  
  roi: number;                      // Plan ROI percentage
  duration: number;                 // Days
  
  startDate: Date;
  endDate: Date;
  
  status: 'active' | 'completed' | 'cancelled';
  
  // Payouts
  payoutFrequency: 'daily' | 'weekly' | 'monthly' | 'end';
  nextPayout?: Date;
  totalPayouts: number;
  
  createdAt: Date;
}

// ==========================================
// AIRDROP TYPES
// ==========================================

export interface AirdropParticipation {
  id: string;
  userId: string;
  airdropId: string;
  airdropName: string;
  
  tasksCompleted: string[];
  totalTasks: number;
  
  pointsEarned: number;
  estimatedReward?: number;
  
  status: 'active' | 'completed' | 'claimed';
  claimedAt?: Date;
  
  createdAt: Date;
}

// ==========================================
// PRICE FEED TYPES
// ==========================================

export interface PriceFeed {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: Date;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Calculate unrealized PnL for margin position
export function calculateMarginPnL(position: MarginPosition, currentPrice: number): number {
  if (position.side === 'long') {
    return (currentPrice - position.avgEntry) * position.qty;
  } else {
    return (position.avgEntry - currentPrice) * position.qty;
  }
}

// Calculate liquidation price
export function calculateLiquidationPrice(
  position: MarginPosition,
  accountEquity: number,
  maintenanceMarginRatio: number = 0.5
): number {
  const maintenanceMargin = position.requiredMargin * maintenanceMarginRatio;
  
  if (position.side === 'long') {
    // Long liquidation: price where equity = maintenance margin
    return position.avgEntry - (accountEquity - maintenanceMargin) / position.qty;
  } else {
    // Short liquidation
    return position.avgEntry + (accountEquity - maintenanceMargin) / position.qty;
  }
}

// Calculate stock position average entry on add
// Formula: new_avg = (q_old*avg_old + q_buy*buy_price + fee) / new_q
export function calculateNewAvgEntry(
  oldQty: number,
  oldAvg: number,
  newQty: number,
  newPrice: number,
  fee: number = 0
): number {
  return (oldQty * oldAvg + newQty * newPrice + fee) / (oldQty + newQty);
}

// Calculate margin required for new position
export function calculateRequiredMargin(
  qty: number,
  price: number,
  leverage: number
): number {
  return (qty * price) / leverage;
}

// Calculate equity for margin account
export function calculateMarginEquity(
  balance: number,
  unrealizedPnL: number,
  funding: number = 0,
  fees: number = 0
): number {
  return balance + unrealizedPnL - funding - fees;
}

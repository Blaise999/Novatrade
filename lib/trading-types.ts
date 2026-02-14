// lib/trading-types.ts
// ==========================================
// COMPREHENSIVE TRADING TYPES
// Spot HOLD model (Stocks + Crypto) + Margin model (FX/CFD/Crypto leverage)
// ==========================================

// ==========================================
// ACCOUNT TYPES
// ==========================================

export type AccountType = 'spot' | 'margin' | 'binary';

export interface TradingAccount {
  id: string;
  userId: string;
  type: AccountType;

  // Core balances
  cash: number; // Liquid cash available
  equity: number; // Total account value (computed)

  // Spot trading
  availableToTrade: number;
  availableToWithdraw: number;

  // Margin trading
  balance: number; // Starting collateral
  marginUsed: number; // Locked in positions
  freeMargin: number; // Available for new positions
  leverage: number; // Default account leverage (e.g., 100)
  marginLevel?: number; // (Equity / Margin Used) * 100

  // PnL tracking
  unrealizedPnL: number; // mark-to-market
  realizedPnL: number; // locked from closed trades
  totalPnL: number; // unrealized + realized

  // Additional
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// SPOT "HOLD" POSITION TYPES (Stocks + Crypto)
// ==========================================

export type SpotAssetType = 'stock' | 'crypto';

export interface SpotPosition {
  id: string;
  accountId: string;

  symbol: string;
  name: string;

  // ✅ This is the crypto-style hold model
  type: SpotAssetType; // 'stock' | 'crypto'
  qty: number; // shares or coins
  avgEntry: number; // average entry price

  currentPrice: number;
  marketValue: number; // qty * currentPrice

  unrealizedPnL: number; // (currentPrice - avgEntry) * qty
  unrealizedPnLPercent: number;

  // Optional: accumulate realized PnL across partial sells
  realizedPnL?: number;

  openedAt: Date;
  updatedAt: Date;
}

// Back-compat: many files still call it StockPosition
export type StockPosition = SpotPosition;

// ==========================================
// MARGIN POSITION TYPES (FX/CFD/Crypto leverage)
// ==========================================

export type MarginAssetType = 'forex' | 'cfd' | 'crypto';

export interface MarginPosition {
  id: string;
  accountId: string;
  symbol: string;
  name: string;

  type: MarginAssetType;

  // Position data
  side: 'long' | 'short';
  qty: number; // units (e.g., 100000 per lot for FX)
  avgEntry: number;
  leverage: number;

  // Margin requirements
  notional: number; // qty * avgEntry
  requiredMargin: number; // notional / leverage
  maintenanceMargin: number; // usually 50% of required

  // Risk management
  stopLoss?: number;
  takeProfit?: number;
  liquidationPrice?: number;

  // Computed values (updated on price change)
  currentPrice: number;
  unrealizedPnL: number; // calculated based on side
  unrealizedPnLPercent: number;

  // Fees & funding
  openingFee: number;
  accumulatedFunding: number;

  openedAt: Date;
  updatedAt: Date;
}

// ==========================================
// ORDER TYPES
// ==========================================

export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus =
  | 'pending'
  | 'open'
  | 'filled'
  | 'partially_filled'
  | 'cancelled'
  | 'rejected';

export interface Order {
  id: string;
  accountId: string;
  symbol: string;

  type: OrderType;
  side: OrderSide;

  qty: number;

  // For limit/stop
  price?: number;
  stopPrice?: number;

  filledQty: number;
  avgFillPrice?: number;

  status: OrderStatus;

  stopLoss?: number;
  takeProfit?: number;

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

  executedAt: Date;
}

// ==========================================
// LEDGER TYPES (Audit Trail)
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
  | 'adjustment'
  | 'transfer';

export interface LedgerEntry {
  id: string;
  accountId: string;
  type: LedgerEntryType;

  amount: number; // + credit, - debit
  balanceBefore: number;
  balanceAfter: number;

  referenceId?: string;
  referenceType?: string;

  description: string;

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

  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
  confirmations?: number;
  requiredConfirmations?: number;

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

  toAddress?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    routingNumber?: string;
    swiftCode?: string;
  };

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

  roi: number;
  duration: number;

  startDate: Date;
  endDate: Date;

  status: 'active' | 'completed' | 'cancelled';

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
// HELPERS
// ==========================================

// ✅ Spot HOLD PnL (crypto-style, used for BOTH stocks and crypto)
export function calculateSpotUnrealizedPnL(avgEntry: number, currentPrice: number, qty: number): number {
  return (currentPrice - avgEntry) * qty;
}

export function calculateSpotMarketValue(currentPrice: number, qty: number): number {
  return currentPrice * qty;
}

// ✅ Margin PnL
export function calculateMarginPnL(position: MarginPosition, currentPrice: number): number {
  if (position.side === 'long') return (currentPrice - position.avgEntry) * position.qty;
  return (position.avgEntry - currentPrice) * position.qty;
}

export function calculateLiquidationPrice(
  position: MarginPosition,
  accountEquity: number,
  maintenanceMarginRatio: number = 0.5
): number {
  const maintenanceMargin = position.requiredMargin * maintenanceMarginRatio;

  if (position.side === 'long') {
    return position.avgEntry - (accountEquity - maintenanceMargin) / position.qty;
  } else {
    return position.avgEntry + (accountEquity - maintenanceMargin) / position.qty;
  }
}

export function calculateNewAvgEntry(
  oldQty: number,
  oldAvg: number,
  newQty: number,
  newPrice: number,
  fee: number = 0
): number {
  return (oldQty * oldAvg + newQty * newPrice + fee) / (oldQty + newQty);
}

export function calculateRequiredMargin(qty: number, price: number, leverage: number): number {
  return (qty * price) / leverage;
}

export function calculateMarginEquity(
  balance: number,
  unrealizedPnL: number,
  funding: number = 0,
  fees: number = 0
): number {
  return balance + unrealizedPnL - funding - fees;
}

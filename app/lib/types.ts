// Market Types
export interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap?: number;
  type: 'crypto' | 'forex' | 'stock' | 'commodity';
  icon?: string;
  payout?: number;
}

export interface Trader {
  id: string;
  name: string;
  avatar: string;
  verified: boolean;
  totalReturn: number;
  winRate: number;
  trades: number;
  followers: number;
  riskScore: number;
  assets: string[];
  bio: string;
  monthlyReturns?: number[];
}

export interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
  stat?: string;
  statLabel?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  content: string;
  profit: number;
  rating: number;
}

export interface PlatformStats {
  totalUsers: number;
  totalVolume: number;
  totalCountries: number;
  uptime: number;
}

// Auth Types
export interface User {
  id: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  kycStatus: KYCStatus;
  kycLevel: KYCLevel;
  walletConnected: boolean;
  walletAddress?: string;
  createdAt: Date;
  lastLogin?: Date;
  twoFactorEnabled: boolean;
  country?: string;
  currency: string;
  balance: AccountBalance;
}

export interface AccountBalance {
  available: number;
  pending: number;
  bonus: number;
  inTrade?: number;
  currency: string;
}

export type KYCStatus = 'not_started' | 'pending' | 'in_review' | 'approved' | 'rejected';
export type KYCLevel = 0 | 1 | 2 | 3;

export interface KYCData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  country: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  idType: 'passport' | 'drivers_license' | 'national_id';
  idNumber: string;
  idFrontImage?: string;
  idBackImage?: string;
  selfieImage?: string;
  proofOfAddress?: string;
}

export interface SignUpData {
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  acceptTerms: boolean;
  acceptMarketing?: boolean;
}

export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface OTPVerification {
  email: string;
  otp: string;
  type: 'email' | 'phone' | '2fa';
}

// Trading Types
export type TradeDirection = 'up' | 'down';
export type TradeStatus = 'open' | 'won' | 'lost' | 'cancelled' | 'pending';
export type OrderType = 'market' | 'limit' | 'stop';
export type TimeFrame = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

export interface Trade {
  id: string;
  assetId: string;
  asset: MarketAsset;
  direction: TradeDirection;
  amount: number;
  entryPrice: number;
  exitPrice?: number;
  payout: number;
  duration: number;
  expiresAt: Date;
  status: TradeStatus;
  profit?: number;
  createdAt: Date;
  closedAt?: Date;
}

export interface SpotTrade {
  id: string;
  assetId: string;
  asset: MarketAsset;
  orderType: OrderType;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  filledAmount: number;
  avgFillPrice?: number;
  status: 'open' | 'filled' | 'partially_filled' | 'cancelled';
  stopLoss?: number;
  takeProfit?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Position {
  id: string;
  assetId: string;
  asset: MarketAsset;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  leverage: number;
  margin: number;
  liquidationPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: Date;
}

export interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartData {
  candles: CandlestickData[];
  timeframe: TimeFrame;
  symbol: string;
}

// Wallet Types
export interface WalletInfo {
  address: string;
  chainId: number;
  balance: string;
  isConnected: boolean;
  connector?: string;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'trade' | 'bonus' | 'transfer';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  txHash?: string;
  from?: string;
  to?: string;
  fee?: number;
  createdAt: Date;
  completedAt?: Date;
  description?: string;
}

// Copy Trading Types
export interface CopySettings {
  traderId: string;
  maxAmount: number;
  copyRatio: number;
  stopLoss?: number;
  maxOpenTrades?: number;
  copyNewTradesOnly: boolean;
}

export interface CopiedTrade extends Trade {
  originalTradeId: string;
  traderId: string;
  traderName: string;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'trade' | 'deposit' | 'withdrawal' | 'kyc' | 'system' | 'promo';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  link?: string;
}

// Settings Types
export interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    tradeAlerts: boolean;
    priceAlerts: boolean;
    newsAlerts: boolean;
  };
  trading: {
    defaultAmount: number;
    defaultDuration: number;
    confirmTrades: boolean;
    soundEnabled: boolean;
    oneClickTrading: boolean;
  };
  display: {
    theme: 'dark' | 'light' | 'system';
    language: string;
    currency: string;
    timezone: string;
    chartType: 'candles' | 'line' | 'area';
  };
  security: {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
    ipWhitelist: string[];
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

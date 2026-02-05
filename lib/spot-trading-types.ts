// ==========================================
// SPOT ASSET TRADING TYPES
// Implements pure Spot model: Balance = Quantity × Price
// With Shield Mode (Synthetic Pause) support
// ==========================================

// ==========================================
// SPOT POSITION (Crypto Holdings)
// ==========================================

export interface SpotPosition {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  icon?: string;
  
  // Core position data
  quantity: number;              // How many coins owned
  avgBuyPrice: number;           // Weighted average purchase price
  totalCostBasis: number;        // Total USD spent to acquire
  
  // Real-time values (updated via WebSocket)
  currentPrice: number;          // Live market price
  marketValue: number;           // quantity × currentPrice
  unrealizedPnL: number;         // marketValue - totalCostBasis
  unrealizedPnLPercent: number;  // (unrealizedPnL / totalCostBasis) × 100
  
  // ==========================================
  // SHIELD MODE (Synthetic Pause)
  // ==========================================
  shieldEnabled: boolean;        // Is shield currently active?
  shieldSnapPrice: number | null;       // Price locked when shield activated
  shieldSnapValue: number | null;       // Portfolio value locked (quantity × snapPrice)
  shieldActivatedAt: Date | null;       // When shield was turned on
  
  // The "displayed" value - what user sees
  // If shield ON: uses shieldSnapValue
  // If shield OFF: uses marketValue
  displayValue: number;
  displayPnL: number;
  displayPnLPercent: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// SPOT ACCOUNT (User's Crypto Wallet)
// ==========================================

export interface SpotAccount {
  id: string;
  userId: string;
  
  // Cash balance (USD not in positions)
  cashBalance: number;
  
  // Portfolio value (sum of all position values)
  portfolioValue: number;        // Live value (ignores shield)
  displayPortfolioValue: number; // What user sees (respects shield)
  
  // Total equity
  totalEquity: number;           // cashBalance + displayPortfolioValue
  
  // P&L tracking
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  
  // Metadata
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// SPOT TRADE (Buy/Sell Transaction)
// ==========================================

export interface SpotTrade {
  id: string;
  positionId?: string;
  userId: string;
  symbol: string;
  name: string;
  
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalValue: number;            // quantity × price
  fee: number;
  netValue: number;              // For buy: totalValue + fee, For sell: totalValue - fee
  
  // For sells - realized P&L
  realizedPnL?: number;
  
  // Timestamps
  executedAt: Date;
}

// ==========================================
// PRICE FEED TYPES
// ==========================================

export interface CryptoPriceFeed {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: Date;
}

// ==========================================
// SHIELD MODE TYPES
// ==========================================

export interface ShieldActivation {
  positionId: string;
  symbol: string;
  snapPrice: number;
  snapValue: number;
  activatedAt: Date;
}

export interface ShieldSummary {
  totalShielded: number;         // Total value protected by shields
  activeShields: number;         // Number of active shields
  positions: Array<{
    symbol: string;
    quantity: number;
    snapPrice: number;
    snapValue: number;
    currentPrice: number;
    priceChangeWhileShielded: number;
    priceChangePercent: number;
  }>;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Calculate market value for a spot position
 */
export function calculateMarketValue(quantity: number, price: number): number {
  return quantity * price;
}

/**
 * Calculate unrealized P&L for a spot position
 */
export function calculateUnrealizedPnL(
  marketValue: number,
  costBasis: number
): { pnl: number; pnlPercent: number } {
  const pnl = marketValue - costBasis;
  const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  return { pnl, pnlPercent };
}

/**
 * Calculate new average price when adding to a position
 */
export function calculateNewAvgPrice(
  existingQty: number,
  existingAvg: number,
  newQty: number,
  newPrice: number
): number {
  const totalCost = (existingQty * existingAvg) + (newQty * newPrice);
  const totalQty = existingQty + newQty;
  return totalQty > 0 ? totalCost / totalQty : newPrice;
}

/**
 * Calculate realized P&L when selling
 */
export function calculateRealizedPnL(
  sellQty: number,
  sellPrice: number,
  avgBuyPrice: number
): number {
  return (sellPrice - avgBuyPrice) * sellQty;
}

/**
 * Get display values for a position (respects shield mode)
 */
export function getDisplayValues(position: SpotPosition): {
  value: number;
  pnl: number;
  pnlPercent: number;
  price: number;
} {
  if (position.shieldEnabled && position.shieldSnapPrice !== null) {
    const value = position.shieldSnapValue ?? position.quantity * position.shieldSnapPrice;
    const pnl = value - position.totalCostBasis;
    const pnlPercent = position.totalCostBasis > 0 ? (pnl / position.totalCostBasis) * 100 : 0;
    return {
      value,
      pnl,
      pnlPercent,
      price: position.shieldSnapPrice,
    };
  }
  
  return {
    value: position.marketValue,
    pnl: position.unrealizedPnL,
    pnlPercent: position.unrealizedPnLPercent,
    price: position.currentPrice,
  };
}

/**
 * Calculate how much the price has moved while shielded
 */
export function calculateShieldedPriceChange(position: SpotPosition): {
  priceChange: number;
  priceChangePercent: number;
  valueProtected: number;
} | null {
  if (!position.shieldEnabled || position.shieldSnapPrice === null) {
    return null;
  }
  
  const priceChange = position.currentPrice - position.shieldSnapPrice;
  const priceChangePercent = (priceChange / position.shieldSnapPrice) * 100;
  const currentValue = position.quantity * position.currentPrice;
  const shieldedValue = position.quantity * position.shieldSnapPrice;
  const valueProtected = shieldedValue - currentValue; // Positive = protected from loss
  
  return {
    priceChange,
    priceChangePercent,
    valueProtected,
  };
}

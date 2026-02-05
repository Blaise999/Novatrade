# Trading Engine Fixes & Improvements

## Overview
This document summarizes all fixes and improvements made to align the trading engine with the formulas specified in the FX/Stocks setup documentation.

---

## 🐛 Bug Fixes

### 1. Stock Average Entry Calculation (CRITICAL)

**Location:** `lib/trading-types.ts` → `calculateNewAvgEntry()`

**Issue:** Fee was not included in the new average price calculation.

**Document Formula:**
```
new_avg = (q_old * avg_old + q_buy * buy_price + fee) / new_q
```

**Before:**
```typescript
return (oldQty * oldAvg + newQty * newPrice) / (oldQty + newQty);
```

**After:**
```typescript
return (oldQty * oldAvg + newQty * newPrice + fee) / (oldQty + newQty);
```

---

### 2. Free Margin Calculation (CRITICAL)

**Location:** `lib/trading-store.ts` → `openMarginPosition()`

**Issue:** Free margin was calculated using `balance` instead of `equity`.

**Document Formula:**
```
free_margin = equity - used_margin
equity = balance + Σ(floating_pnl)
```

**Before:**
```typescript
freeMargin: newBalance - (state.marginAccount.marginUsed + requiredMargin)
```

**After:**
```typescript
const newEquity = newBalance + currentUnrealizedPnL;
const newFreeMargin = newEquity - newMarginUsed;
```

---

### 3. Stock Realized P&L (Display Issue)

**Location:** `lib/trading-store.ts` → `executeStockSell()`

**Issue:** Realized P&L didn't subtract the fee for display purposes.

**Document Formula:**
```
realized = (sell_price - avg) * q_sell - fee
```

**Before:**
```typescript
const realizedPnL = (price - position.avgEntry) * qty;
```

**After:**
```typescript
const grossPnL = (price - position.avgEntry) * qty;
const realizedPnL = grossPnL - fee;  // Net P&L after fee
```

---

### 4. Liquidation Logic (CRITICAL)

**Location:** `lib/trading-store.ts` → `checkLiquidation()`

**Issue:** Checked equity vs margin per-position instead of account-wide.

**Document Note:**
> Brokers usually add: Margin call threshold (e.g., < 100%) and Stop-out threshold (e.g., < 50%) → system closes worst trades first

**Changes:**
- Now calculates total account equity
- Checks margin level against 50% stop-out threshold
- Sorts positions by P&L (worst first) for liquidation order
- Progressively liquidates until margin level recovers above 100%

---

### 5. New Position Cost Basis

**Location:** `lib/trading-store.ts` → `executeStockBuy()`

**Issue:** New stock positions started with `unrealizedPnL: 0` despite paying a fee.

**After:**
```typescript
const avgEntryWithFee = (qty * price + fee) / qty;
unrealizedPnL: -fee, // Start with the fee as initial loss
```

---

### 6. Missing FX Page

**Location:** `app/dashboard/trade/fx/page.tsx`

**Issue:** The FX trading page was empty (0 bytes).

**Fix:** Restored from `lib/app/dashboard/trade/fx/page.tsx`

---

## ✨ New Features

### 1. Limit Orders & Pending Orders

**New Methods:**
```typescript
placeLimitOrder(params: {
  symbol: string;
  name: string;
  type: 'forex' | 'cfd' | 'crypto' | 'stock';
  side: 'buy' | 'sell';
  orderType: 'limit' | 'stop' | 'stop_limit';
  qty: number;
  limitPrice: number;
  stopPrice?: number;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
}) => { success: boolean; orderId?: string; error?: string };

cancelOrder(orderId: string) => { success: boolean; error?: string };

checkPendingOrders(currentPrices: Record<string, { bid: number; ask: number }>) => void;
```

**Order Types Supported:**
- **Limit Order:** Buy when price falls to limit / Sell when price rises to limit
- **Stop Order:** Buy when price rises to stop / Sell when price falls to stop  
- **Stop-Limit:** Combination of stop trigger and limit execution

---

### 2. Swap/Overnight Fees (Funding Rates)

**New Method:**
```typescript
applySwapFees(swapRates: Record<string, { 
  longSwap: number;   // Fee per lot for long positions (can be positive = credit)
  shortSwap: number;  // Fee per lot for short positions
}>) => void;
```

**Usage Example:**
```typescript
// Call this daily at rollover time (typically 5 PM EST)
useTradingAccountStore.getState().applySwapFees({
  'EUR/USD': { longSwap: -0.50, shortSwap: 0.15 },  // Long pays $0.50/lot, short earns $0.15/lot
  'GBP/USD': { longSwap: -0.75, shortSwap: 0.25 },
  'USD/JPY': { longSwap: 0.35, shortSwap: -0.60 },
});
```

**From Document:**
> Optional swap/overnight fee (charged daily after rollover)

---

## 📊 Formula Reference

### FX Trading (Margin Model)

| Metric | Formula |
|--------|---------|
| Notional Value | `units × price` |
| Long P&L | `(price - open) × units` |
| Short P&L | `(open - price) × units` |
| Margin Required | `notional / leverage` |
| Equity | `balance + Σ(floating_pnl)` |
| Free Margin | `equity - used_margin` |
| Margin Level % | `(equity / used_margin) × 100` |

### Stock Trading (Spot Model)

| Metric | Formula |
|--------|---------|
| Market Value | `qty × price` |
| Cost Basis | `qty × avg_entry` |
| Unrealized P&L | `(price - avg) × qty` |
| Unrealized % | `((price / avg) - 1) × 100` |
| New Avg (on buy) | `(q_old × avg_old + q_buy × buy_price + fee) / new_q` |
| Realized P&L (on sell) | `(sell_price - avg) × q_sell - fee` |

---

## 🔧 Files Modified

1. `lib/trading-types.ts` - Fixed `calculateNewAvgEntry` function
2. `lib/trading-store.ts` - Multiple fixes + new features
3. `app/dashboard/trade/fx/page.tsx` - Restored missing page

---

## 📋 TODO / Future Improvements

- [ ] Add order book visualization for limit orders
- [ ] Implement triple swap (Wednesday) for FX
- [ ] Add margin call notifications (< 100% warning)
- [ ] Implement trailing stop orders
- [ ] Add partial fill support for limit orders
- [ ] Create admin UI for managing swap rates

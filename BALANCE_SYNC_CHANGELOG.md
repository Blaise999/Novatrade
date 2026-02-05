# Balance Synchronization Fix - CHANGELOG

## Overview
This update fixes the balance synchronization across all trading modules (Crypto, FX, Stocks) and Supabase.

## Problem Solved
- **Double balance deduction**: Crypto trades were deducting balance twice (once in store, once manually)
- **No unified balance initialization**: Trading accounts weren't properly synced with user's Supabase balance on login
- **Balance not refreshing**: After trades, the UI didn't reflect the updated balance
- **Inconsistent state**: Different stores had different balance values

## Files Changed

### 1. NEW: `/lib/services/balance-sync.ts`
**Purpose**: Central service for all balance synchronization

Features:
- `fetchUserBalance()` - Get balance from Supabase (source of truth)
- `updateUserBalance()` - Update balance after trades
- `syncStockTrade()` / `syncFXTrade()` / `syncCryptoTrade()` - Trade-specific sync
- `notifyBalanceUpdate()` - Broadcast balance changes to all listeners
- `initializeAllTradingAccounts()` - Initialize all stores with user balance

### 2. NEW: `/hooks/useUnifiedBalance.ts`
**Purpose**: React hook for balance management

Features:
- Automatically initializes all trading accounts when user loads
- Listens for balance updates and syncs to all stores
- Provides `refreshBalance()` for manual refresh
- Returns unified balance object

### 3. UPDATED: `/app/dashboard/layout.tsx`
**Changes**:
- Added `useUnifiedBalance` hook to initialize accounts
- Balance display now uses unified balance (shows correct total)

### 4. UPDATED: `/lib/trading-store.ts`
**Changes**:
- Integrated with balance-sync service
- `syncBalanceToSupabase()` now notifies listeners after sync
- Ensures all stores stay in sync after FX/stock trades

### 5. UPDATED: `/lib/spot-trading-store.ts`
**Changes**:
- Integrated with balance-sync service
- Broadcasts balance updates after crypto trades

### 6. UPDATED: `/app/dashboard/trade/fx/page.tsx`
**Changes**:
- Added `refreshUser()` import from store
- After opening position: refreshes user balance
- After closing position: refreshes user balance

### 7. UPDATED: `/app/dashboard/trade/stocks/page.tsx`
**Changes**:
- Added `refreshUser()` import from store
- After buying stocks: refreshes user balance
- After selling stocks: refreshes user balance

### 8. UPDATED: `/app/dashboard/trade/crypto/page.tsx`
**Changes**:
- **REMOVED** duplicate Supabase balance updates (was causing double deduction!)
- The spot trading store already syncs to Supabase
- Now only refreshes user state after trades

## Balance Flow (After Fix)

```
┌──────────────┐
│   SUPABASE   │  ← Source of truth for balance
│ users.balance│
└──────┬───────┘
       │ On login/refresh
       ▼
┌──────────────┐
│ useUnified   │  ← Initializes all stores
│   Balance    │
└──────┬───────┘
       │ Syncs to
       ▼
┌─────────────────────────────────────────┐
│                TRADING STORES            │
├─────────────┬─────────────┬─────────────┤
│  Spot       │   Margin    │   Crypto    │
│  (Stocks)   │   (FX)      │   (Spot)    │
└─────────────┴─────────────┴─────────────┘
       │ On trade close
       ▼
┌──────────────┐
│ Balance Sync │  ← Updates Supabase
│   Service    │  ← Notifies listeners
└──────────────┘
       │
       ▼
    All stores refresh automatically
```

## Usage

### In Dashboard Layout (already done)
```tsx
import { useUnifiedBalance } from '@/hooks/useUnifiedBalance';

function DashboardLayout() {
  const { balance, isInitialized, refreshBalance } = useUnifiedBalance();
  
  // balance.available - cash available
  // balance.bonus - bonus balance
  // balance.total - total (available + bonus)
}
```

### After Any Trade
```tsx
import { useStore } from '@/lib/supabase/store-supabase';

const { refreshUser } = useStore();

// After trade completes:
await refreshUser?.();
```

## Key Formulas (From Your Doc)

### FX (Margin) P&L
```
Long:  pnl = (current_price - entry_price) × units
Short: pnl = (entry_price - current_price) × units
```

### Stock (Spot) P&L
```
Unrealized: (current_price - avg_entry) × quantity
Realized:   (sell_price - avg_entry) × sell_qty - fee
```

### Crypto (Spot) with Shield
```
Market Value: quantity × current_price
Display Value (Shield ON): quantity × shield_snap_price
Display Value (Shield OFF): market_value
```

## Testing Checklist

1. [ ] Login and check balance in header matches Supabase
2. [ ] Buy crypto → balance decreases by purchase amount
3. [ ] Sell crypto → balance increases by (qty × price)
4. [ ] Open FX position → margin locked, balance unchanged (only fee deducted)
5. [ ] Close FX position → realized P&L added to balance
6. [ ] Buy stocks → balance decreases by (shares × price + commission)
7. [ ] Sell stocks → balance increases by proceeds, P&L reflected
8. [ ] Deposit confirmed by admin → balance increases in all views

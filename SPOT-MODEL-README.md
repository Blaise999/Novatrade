# Crypto Trading System - Spot Asset Model with Shield Mode

## Overview

This update transforms the crypto trading system from an FX/leverage-based model to a **Spot Asset Model** with a unique **Shield Mode** feature.

---

## 1. Spot Asset Model

### The Problem (Before)
The previous system used FX logic calculating profit/loss based on pip movements with leverage, which doesn't accurately reflect how spot crypto trading works.

### The Solution (After)
**Pure Spot Model**: `Balance = Quantity × Real-time Price`

### How It Works

1. **Buy Crypto**: User spends USD to purchase a quantity of coins
   - Example: Spend $1,000 to buy 0.015 BTC at $66,666/BTC
   
2. **Real-time Updates**: Portfolio value updates automatically via WebSocket price feed
   - If BTC price moves from $66,666 to $70,000
   - Position value: 0.015 × $70,000 = $1,050
   - P&L: +$50 (+5%)

3. **Sell Crypto**: User sells coins at current market price
   - Proceeds = Quantity × Current Price
   - Realized P&L is calculated and added to cash balance

### Key Files

- `lib/spot-trading-types.ts` - Type definitions for spot positions, accounts, trades
- `lib/spot-trading-store.ts` - Zustand store managing all spot trading state
- `app/dashboard/trade/crypto/page.tsx` - Updated trading UI

---

## 2. Shield Mode (Synthetic Pause)

### The Concept

Shield Mode is a **"Synthetic Exit"** - it lets users lock their portfolio value at a specific price point without actually selling their coins.

### How It Works

#### Activating Shield
1. User owns 2 BTC purchased at $70,000 (value: $140,000)
2. BTC price rises to $72,000 (value: $144,000)
3. User activates Shield on this position
4. System captures:
   - **Snap Price**: $72,000
   - **Snap Value**: $144,000

#### While Shield is ON
- The **live price ticker continues to move** (showing market activity)
- The user's **Portfolio Value remains frozen** at $144,000
- If BTC drops to $65,000:
  - Live value would be: $130,000
  - Displayed value: $144,000 (protected!)
  - User "saved" $14,000 from the dip

#### UI Behavior
- Shielded positions show a blue "Protected" badge with lock icon
- Both the locked price and live price are displayed
- The difference shows how much the user has been protected from (or missed out on)

#### Deactivating Shield
- User can turn off Shield at any time
- Portfolio value immediately reflects live market price
- No coins were sold - it was purely a display/state change

### Shield Mode Files

- `lib/spot-trading-types.ts` - Shield-related type definitions
- `lib/spot-trading-store.ts` - `activateShield()`, `deactivateShield()`, `toggleShield()` functions
- `supabase/migrations/add-shield-mode.sql` - Database schema for persisting shield state

---

## Technical Implementation

### State Structure

```typescript
interface SpotPosition {
  id: string;
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  totalCostBasis: number;
  
  // Real-time values
  currentPrice: number;
  marketValue: number;           // quantity × currentPrice
  unrealizedPnL: number;
  
  // Shield Mode
  shieldEnabled: boolean;
  shieldSnapPrice: number | null;
  shieldSnapValue: number | null;
  shieldActivatedAt: Date | null;
  
  // Display values (respects shield)
  displayValue: number;          // Uses snapValue if shielded, else marketValue
  displayPnL: number;
  displayPnLPercent: number;
}
```

### Price Update Flow

```
WebSocket Price Update
        ↓
updatePrice(symbol, newPrice)
        ↓
┌─────────────────────────────────────┐
│ For each position with this symbol: │
│                                     │
│ 1. Update currentPrice              │
│ 2. Recalculate marketValue          │
│ 3. Recalculate unrealizedPnL        │
│                                     │
│ If shieldEnabled:                   │
│   displayValue = shieldSnapValue    │
│ Else:                               │
│   displayValue = marketValue        │
└─────────────────────────────────────┘
        ↓
Update account totals
```

### Database Schema

```sql
-- Shield Mode columns on trades table
ALTER TABLE trades ADD COLUMN shield_enabled BOOLEAN DEFAULT false;
ALTER TABLE trades ADD COLUMN shield_snap_price DECIMAL(20,8);
ALTER TABLE trades ADD COLUMN shield_snap_value DECIMAL(15,2);
ALTER TABLE trades ADD COLUMN shield_activated_at TIMESTAMPTZ;
```

---

## UI Components

### Portfolio Card with Shield

Each crypto holding displays:
- Coin symbol and quantity
- Current value (shielded or live)
- P&L (based on displayed value)
- Shield toggle button

When shielded:
- Blue border/background indicating protected status
- Lock icon next to symbol
- Shows both locked price and live price
- Shows protection amount (saved from loss or missed gains)

### Trade Panel

- Buy/Sell toggle
- Amount input with quick-select buttons
- Quantity calculation based on current price
- Current position info with Shield toggle
- Shield Mode explanation card

---

## Usage Examples

### Example 1: Protecting Gains

```
1. Buy 1 ETH at $3,000
2. ETH rises to $3,500 (+$500 profit)
3. Activate Shield at $3,500
4. ETH drops to $3,200
5. Your displayed value: still $3,500
6. You've "protected" $300 from the drop
```

### Example 2: Waiting Out Volatility

```
1. Own 0.5 BTC worth $35,000
2. Expecting short-term volatility
3. Activate Shield at current price
4. BTC swings wildly between $60k-$75k
5. Your displayed value stays constant
6. Deactivate when volatility settles
```

---

## API Reference

### Spot Trading Store

```typescript
// Initialize account
initializeAccount(userId: string, initialCash?: number)

// Sync cash balance from user profile
syncCashFromUser(cash: number)

// Execute buy order
executeBuy(symbol, name, quantity, price, fee?, icon?)
// Returns: { success: boolean; error?: string }

// Execute sell order  
executeSell(positionId, quantity, price, fee?)
// Returns: { success: boolean; realizedPnL?: number; error?: string }

// Update prices from WebSocket
updatePrice(symbol: string, price: number)
updatePrices(prices: Record<string, number>)

// Shield Mode
activateShield(positionId: string)
deactivateShield(positionId: string)
toggleShield(positionId: string)
getShieldSummary()

// Computed values
getTotalPortfolioValue()
getDisplayPortfolioValue()  // Respects shields
getTotalEquity()
getTotalUnrealizedPnL()
getPositionBySymbol(symbol: string)
```

---

## Migration Steps

1. Run the SQL migration: `supabase/migrations/add-shield-mode.sql`
2. Replace the crypto trading page
3. Add the new store files to your lib folder
4. Update imports in any components using the old trading store

---

## Future Enhancements

- [ ] Shield expiration (auto-deactivate after X hours)
- [ ] Shield notifications when price moves significantly
- [ ] Partial shields (protect only a portion of position)
- [ ] Shield history log
- [ ] Mobile push notifications for shielded positions

# NovaTrade — Tier Purchase + Airdrop Integration Notes

## What Changed

### 1. SQL Migration (`supabase/migrations/20250211_tier_system.sql`)
**Run this first in Supabase SQL Editor.**

Adds to `users` table:
- `tier_level` (int, default 0) — 0=Basic, 1=Starter, 2=Trader, 3=Professional, 4=Elite
- `tier_active` (bool, default false)
- `tier_code` (text, default 'basic')
- `tier_activated_at` (timestamptz)
- `referred_by` (uuid)
- `referral_code` (text)

Creates `tier_purchases` table with RLS policies.

Adds columns to `referrals` and `airdrop_claims` tables.

**SAFE**: All operations are additive (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`).

---

### 2. Tier Guard (`lib/tier-guard.ts`)
Shared gating logic for client and server:
- `hasTierAccess(userTierLevel, requiredLevel)` — client check
- `canUseFeature(userTierLevel, feature)` — feature name check
- `requireTier(userId, level)` — server-side Supabase check (returns 403)
- `requireFeature(userId, feature)` — same, by feature name

**Feature → Tier Mapping:**
| Feature | Required Tier |
|---------|--------------|
| Trading, Shield | >= 1 (Starter) |
| DCA Bots | >= 2 (Trader) |
| Grid/Trading Bots, AI | >= 3 (Professional) |
| Elite features | >= 4 (Elite) |

---

### 3. API Routes Added

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/tier-purchases` | GET | User's own purchases |
| `/api/tier-purchases` | POST | Submit new purchase |
| `/api/admin/tier-purchases` | GET | Admin: list all purchases |
| `/api/admin/tier-purchases` | PATCH | Admin: approve/reject |

**On Approval:**
1. `tier_purchases.status` → `approved`
2. `users.tier_level/tier_active/tier_code` updated
3. 40% bonus credited to `balance_available` and `balance_bonus`
4. `transactions` row inserted (type: `tier_bonus`)
5. Referral reward triggered (5% to referrer) if first purchase

---

### 4. Pages Added

| Route | Purpose |
|-------|---------|
| `/dashboard/tier` | Tier selection cards |
| `/dashboard/tier/checkout` | Payment & submission |
| `/dashboard/referrals` | Referral code, sharing, history |
| `/dashboard/airdrop` | Claim NOVA airdrops |
| `/admin/tier-purchases` | Admin approve/reject |

---

### 5. Hard Feature Gating

**Bots API** (`/api/bots`):
- POST (create): DCA requires tier >= 2, Grid requires tier >= 3
- PATCH (start): Same gating on start action

**Trades API** (`/api/trades`):
- POST (create): Requires tier >= 1 (graceful fallback if Supabase unavailable)

All return 403 with `requiresTier` field for UI to show upgrade prompt.

---

### 6. Navigation Updates

**Dashboard sidebar:** Added Tiers & Plans, Referrals, Airdrop links.
**Deposit button:** Now routes to `/dashboard/tier` instead of `/dashboard/wallet`.
**Admin sidebar:** Added Tier Purchases link.

---

### 7. Airdrop Smart Contract

The existing `contracts/NOVAMerkleAirdrop.sol` already implements:
- ✅ Merkle proof verification (prevents double claim)
- ✅ Pausable (claim window + owner pause)
- ✅ Owner withdrawal of unclaimed tokens
- ✅ EIP-2612 permit for gasless fee approval
- ✅ OpenZeppelin libraries (SafeERC20, ReentrancyGuard)
- ✅ No drainer patterns

**Deployment:**
```bash
npx hardhat compile
npx hardhat run scripts/deploy.ts --network <your-network>
```

Set env vars:
```
NOVA_TOKEN_ADDRESS=0x...
AIRDROP_CONTRACT=0x...
CHAIN_ID=1
```

---

### 8. Balance Model

Balances use the existing dual model:
- **Authoritative**: `users.balance_available` + `users.balance_bonus`
- **Ledger**: `transactions` table (type: deposit/withdrawal/trade_open/trade_close/bonus/tier_bonus/adjustment)

Tier bonus credits update BOTH `users.balance_available` AND insert a `transactions` row.

---

### 9. Deposit Flow (Unchanged)

Deposits remain separate from tier purchases.
Wallet page (`/dashboard/wallet`) still handles deposits.
Tier purchase is a separate flow via `/dashboard/tier/checkout`.

---

## Deployment Checklist

1. Run SQL migration in Supabase
2. Deploy code to Vercel/hosting
3. Set up admin account (existing flow)
4. Test: User signs up → sees tier page → buys tier → admin approves → balance updates
5. Test: Bot creation blocked for wrong tier
6. Test: Trade creation blocked for tier 0
7. Test: Referral flow works end-to-end

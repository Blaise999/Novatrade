# 🗺️ Nova Trade Platform - Routes & Navigation Reference

## Public Pages (No Auth Required)

| Route | Description |
|-------|-------------|
| `/` | Landing page / Homepage |
| `/auth/login` | User login |
| `/auth/signup` | User registration |
| `/auth/forgot-password` | Password reset |
| `/auth/verify-otp` | OTP verification |
| `/markets` | Markets overview |
| `/markets/commodities` | Commodities market |
| `/invest` | Investment overview |
| `/invest/plans` | Investment plans → Links to `/dashboard/wallet?plan=X` |
| `/invest/staking` | Staking page → Links to `/dashboard/wallet?stake=X` |
| `/invest/bots` | Trading bots → Links to `/dashboard/wallet?bot=X` |
| `/earn` | Earn overview |
| `/earn/airdrops` | Airdrops page |
| `/earn/referral` | Referral program |
| `/earn/rewards` | Rewards page |
| `/earn/competitions` | Trading competitions |
| `/academy` | Educational content |
| `/pricing` | Pricing / Membership tiers |
| `/kyc` | KYC verification |
| `/connect-wallet` | Connect Web3 wallet |
| `/legal/*` | Legal pages (terms, privacy, etc.) |

## User Dashboard (Auth Required)

| Route | Description |
|-------|-------------|
| `/dashboard` | Main dashboard |
| `/dashboard/trade/fx` | Forex trading |
| `/dashboard/trade/crypto` | Crypto trading |
| `/dashboard/trade/stocks` | Stocks trading |
| `/dashboard/wallet` | **MAIN DEPOSIT PAGE** - Admin-controlled |
| `/dashboard/deposit` | Redirects to `/dashboard/wallet` |
| `/dashboard/portfolio` | Portfolio overview |
| `/dashboard/history` | Transaction history |
| `/dashboard/copy-trading` | Copy trading |
| `/dashboard/settings` | User settings |
| `/dashboard/help` | Help & support |

## Admin Panel (Admin Auth Required)

| Route | Description |
|-------|-------------|
| `/admin/login` | Admin login |
| `/admin` | Admin dashboard |
| `/admin/deposits` | **DEPOSIT MANAGEMENT** - Confirm/reject deposits |
| `/admin/users` | User management |
| `/admin/markets` | Market control (price manipulation) |
| `/admin/signals` | Trading signals |
| `/admin/sessions` | Trading sessions |
| `/admin/settings` | Platform settings |

---

## 🔗 Key Deposit Flow

### User Flow:
1. User clicks "Deposit" or "Start Investing"
2. Redirected to `/dashboard/wallet`
3. Selects payment method (crypto/bank/other)
4. Sees admin-configured wallet addresses/bank details
5. Makes payment externally
6. Submits transaction proof
7. Waits for admin approval

### Admin Flow:
1. Admin sees pending deposits on `/admin/deposits`
2. Reviews transaction proof and reference
3. Clicks "Confirm" to credit user balance
4. Or "Reject" with reason

---

## 📍 Where Deposit Links Come From

| Source Page | Link Generated |
|-------------|----------------|
| `/invest/plans` | `/dashboard/wallet?plan=starter` |
| `/invest/staking` | `/dashboard/wallet?stake=ETH` |
| `/invest/bots` | `/dashboard/wallet?bot=grid-bot` |
| `/pricing` | `/dashboard/wallet?tier=pro&amount=1000` |
| Header "Deposit" button | `/dashboard/wallet` |

---

## 🔐 Navigation Components

### Public Navigation (`/components/Navigation.tsx`)
- Shows to non-authenticated users
- Links: Markets, Invest, Earn, Academy, Pricing
- Auth buttons: Sign In, Start Trading

### Dashboard Navigation (`/app/dashboard/layout.tsx`)
- Sidebar with: Dashboard, Trade, Copy Trading, Portfolio, Wallet, History
- Header with: Balance, Deposit button, Notifications, User menu

### Admin Navigation (`/app/admin/layout.tsx`)
- Sidebar with: Dashboard, **Deposits**, Sessions, Signals, Markets, Users, Settings
- Red theme to distinguish from user dashboard

---

## 💰 Admin-Controlled Payment Methods

Configured in `/admin/deposits` → Settings tab:

### Crypto Wallets
- Bitcoin (BTC)
- Ethereum (ETH)  
- USDT (TRC-20)
- USDT (ERC-20)
- Add custom wallets

### Bank Accounts
- Add bank name, account details
- Set country, currency
- Add instructions

### Other Methods
- PayPal, Cash App, etc.
- Any payment processor
- Mobile money

---

## 🛠️ Environment Variables Needed

```env
# Supabase (Required for production)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Optional
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret
```

---

## 🚀 Quick Start

1. **Install dependencies**: `npm install`
2. **Run locally**: `npm run dev`
3. **Access**: `http://localhost:3000`
4. **Admin**: `http://localhost:3000/admin/login`
   - Demo: `admin@novatrade.com` / `admin123`

5. **Configure deposits**: Go to Admin → Deposits → Add your crypto addresses and bank details

6. **For production**: Follow `SUPABASE_SETUP.md` to connect database

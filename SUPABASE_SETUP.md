# 🚀 Nova Trade Platform - Supabase Setup Guide

This guide walks you through setting up Supabase as your backend database for the Nova Trade platform.

## Table of Contents
1. [Create Supabase Project](#1-create-supabase-project)
2. [Set Up Database Schema](#2-set-up-database-schema)
3. [Configure Environment Variables](#3-configure-environment-variables)
4. [Set Up Authentication](#4-set-up-authentication)
5. [Configure Storage](#5-configure-storage)
6. [Test Connection](#6-test-connection)
7. [Admin Setup](#7-admin-setup)
8. [Production Checklist](#8-production-checklist)

---

## 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click **"New Project"**
4. Fill in:
   - **Organization**: Select or create one
   - **Project Name**: `nova-trade` (or your choice)
   - **Database Password**: Generate a strong password and **SAVE IT**
   - **Region**: Choose closest to your users
5. Click **"Create new project"**
6. Wait 2-3 minutes for project to initialize

---

## 2. Set Up Database Schema

### Option A: Using SQL Editor (Recommended)

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. **First**, copy the entire contents of `supabase/schema.sql` and run it
4. **Then**, copy the entire contents of `supabase/admin-markets-schema.sql` and run it
5. You should see "Success. No rows returned" for each

**Important**: Run them in order - the admin-markets schema depends on the main schema.

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

### Verify Tables Created

Go to **Table Editor** in your dashboard. You should see:

**Core Tables:**
- ✅ users
- ✅ payment_methods
- ✅ deposits
- ✅ withdrawals
- ✅ trades
- ✅ investments
- ✅ transactions
- ✅ platform_settings

**Admin Market Control Tables:**
- ✅ custom_pairs (admin-created trading pairs)
- ✅ price_overrides (manual price control)
- ✅ trading_sessions (scheduled trading events)
- ✅ custom_candles (chart data control)
- ✅ trade_outcomes (force win/lose)
- ✅ market_patterns (pre-built price movements)
- ✅ admin_logs (audit trail)

---

## 3. Configure Environment Variables

### Find Your Keys

1. Go to **Project Settings** → **API**
2. Copy these values:

| Value | Where to Find |
|-------|---------------|
| Project URL | Under "Project URL" |
| anon/public key | Under "Project API keys" |
| service_role key | Under "Project API keys" (click "Reveal") |

### Create Environment File

Create `.env.local` in your project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database Direct Connection (for migrations)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-ref.supabase.co:5432/postgres

# App Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-generate-with-openssl-rand-base64-32
```

### Generate NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

---

## 4. Set Up Authentication

### Enable Email Auth

1. Go to **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. Configure settings:
   - ✅ Enable email confirmations (for production)
   - ✅ Enable email change confirmations

### Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. Customize templates for:
   - Confirm signup
   - Magic Link
   - Change Email Address
   - Reset Password

### Example Custom Template (Confirm Signup)

```html
<h2>Welcome to Nova Trade!</h2>
<p>Click below to confirm your email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
<p>If you didn't create this account, you can ignore this email.</p>
```

### SMTP Setup (Required for Production)

1. Go to **Project Settings** → **Auth**
2. Under "SMTP Settings", click **Enable Custom SMTP**
3. Enter your SMTP details:

For **Gmail** (testing only):
```
Host: smtp.gmail.com
Port: 587
Username: your-email@gmail.com
Password: your-app-password (generate in Google Account settings)
```

For **Production** (use Resend, SendGrid, etc.):
```
Host: smtp.resend.com
Port: 587
Username: resend
Password: re_your_api_key
```

---

## 5. Configure Storage

### Create Buckets

1. Go to **Storage**
2. Click **"New bucket"**
3. Create these buckets:

| Bucket Name | Public | Purpose |
|-------------|--------|---------|
| `avatars` | Yes | User profile pictures |
| `deposit-proofs` | No | Payment screenshots |
| `kyc-documents` | No | ID verification docs |

### Set Storage Policies

For `avatars` bucket (public read, authenticated write):

```sql
-- Allow public read
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload avatar" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);
```

For `deposit-proofs` bucket (private):

```sql
-- Users can upload their own proofs
CREATE POLICY "Users can upload proofs" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'deposit-proofs' AND
    auth.uid() IS NOT NULL
);

-- Users can view their own proofs
CREATE POLICY "Users can view own proofs" ON storage.objects
FOR SELECT USING (
    bucket_id = 'deposit-proofs' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all proofs
CREATE POLICY "Admins can view all proofs" ON storage.objects
FOR SELECT USING (
    bucket_id = 'deposit-proofs' AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
```

---

## 6. Test Connection

### Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### Test Script

Create `test-supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function testConnection() {
    // Test read
    const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error('❌ Connection failed:', error);
    } else {
        console.log('✅ Connected successfully!');
        console.log('Payment methods:', data);
    }
}

testConnection();
```

Run:
```bash
npx ts-node test-supabase.ts
```

---

## 7. Admin Setup

### Create First Admin User

1. First, sign up through your app normally
2. Then run this SQL to make yourself admin:

```sql
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

### Or Create Admin Directly

```sql
INSERT INTO public.users (email, first_name, last_name, role, tier, is_active)
VALUES ('admin@novatrade.com', 'Admin', 'User', 'admin', 'vip', true);
```

---

## 8. Production Checklist

### Security

- [ ] Enable RLS on all tables (already done in schema)
- [ ] Set strong database password
- [ ] Enable SSL connections
- [ ] Set up proper CORS origins
- [ ] Enable email verification

### Performance

- [ ] Create indexes (already done in schema)
- [ ] Enable connection pooling (Project Settings → Database)
- [ ] Set appropriate pool size

### Monitoring

- [ ] Enable database webhooks for critical events
- [ ] Set up alerts for failed logins
- [ ] Monitor database size and performance

### Backup

- [ ] Enable Point-in-Time Recovery (Pro plan)
- [ ] Schedule regular backups
- [ ] Test backup restoration

---

## Environment Variables Summary

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# For NextAuth (if using)
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret

# Optional: Direct Database Access
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# Optional: Email
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=re_xxx

# Optional: For real market data
FINNHUB_API_KEY=your-key
ALPHA_VANTAGE_KEY=your-key
```

---

## API Usage Examples

### Create Deposit

```typescript
import { supabase } from '@/lib/supabase';

const createDeposit = async (userId: string, amount: number, method: string) => {
    const { data, error } = await supabase
        .from('deposits')
        .insert({
            user_id: userId,
            order_id: `ORD-${Date.now()}`,
            amount,
            method: 'crypto',
            method_name: 'Bitcoin',
            status: 'pending'
        })
        .select()
        .single();
    
    return { data, error };
};
```

### Get User Balance

```typescript
const getUserBalance = async (userId: string) => {
    const { data, error } = await supabase
        .from('users')
        .select('balance_available, balance_bonus, tier')
        .eq('id', userId)
        .single();
    
    return { data, error };
};
```

### Admin: Confirm Deposit

```typescript
const confirmDeposit = async (depositId: string, adminId: string) => {
    const { data, error } = await supabase
        .rpc('confirm_deposit', {
            p_deposit_id: depositId,
            p_admin_id: adminId
        });
    
    return { data, error };
};
```

### Admin: Control Market Prices

```typescript
import { 
    customPairsService, 
    priceOverrideService,
    tradingSessionService 
} from '@/lib/admin-markets-supabase';

// Create a custom trading pair
const createPair = async () => {
    const pair = await customPairsService.create({
        symbol: 'NOVA/USD',
        name: 'Nova Token',
        category: 'crypto',
        base_price: 1.00,
        current_price: 1.00,
        spread: 0.001,
        pip_value: 0.0001,
        leverage_max: 100,
        min_lot: 0.01,
        max_lot: 100,
        trading_hours: '24/7',
        is_enabled: true
    });
    return pair;
};

// Override price for a pair (make it go up/down)
const setPrice = async (adminId: string) => {
    await priceOverrideService.set(
        'EUR/USD',      // pair
        1.0850,         // forced price
        'up',           // direction hint
        adminId
    );
};

// Force a user's trade to win/lose
const forceTrade = async (tradeId: string, adminId: string) => {
    await tradeOutcomeService.force(
        tradeId,
        'win',          // outcome: 'win' | 'lose' | 'breakeven'
        500,            // target P&L in dollars
        adminId,
        'VIP user bonus'
    );
};

// Create a trading session with controlled outcome
const createSession = async () => {
    const session = await tradingSessionService.create({
        name: 'Gold Rush Hour',
        pair_symbol: 'XAU/USD',
        session_type: 'pump',
        starts_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        ends_at: new Date(Date.now() + 7200000).toISOString(),   // 2 hours from now
        start_price: 2050.00,
        target_price: 2080.00,
        price_path: 'organic',
        win_rate_override: 0.70, // 70% of trades win
        status: 'scheduled'
    });
    return session;
};
```

### Real-time Price Updates

```typescript
import { marketSubscriptions } from '@/lib/admin-markets-supabase';

// Subscribe to price changes in your component
useEffect(() => {
    const subscription = marketSubscriptions.onPriceChange((payload) => {
        console.log('Price updated:', payload.new);
        // Update your UI
    });
    
    return () => {
        subscription.unsubscribe();
    };
}, []);
```

---

## Troubleshooting

### "relation does not exist"
- Run the schema SQL again
- Check you're connected to the right project

### "permission denied"
- Check RLS policies
- Ensure user is authenticated
- For admin actions, verify user has admin role

### "CORS error"
- Add your domain to allowed origins in Project Settings → API

### "rate limit exceeded"
- Upgrade plan or implement caching
- Check for infinite loops in your code

---

## Support

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- GitHub Issues: https://github.com/supabase/supabase/issues

---

**🎉 You're all set! Your Nova Trade platform is now connected to Supabase.**

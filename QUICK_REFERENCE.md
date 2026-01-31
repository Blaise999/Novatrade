# 🎯 QUICK REFERENCE CARD

Print this out or keep it open while setting up!

---

## 📦 FILES YOU NEED

```
supabase/
├── schema.sql              ← Run this FIRST in SQL Editor
└── admin-markets-schema.sql ← Run this SECOND

.env.local                   ← Create this file with your keys
```

---

## 🔑 YOUR KEYS (Fill in from Supabase)

```
Project URL:      ________________________________
Anon Key:         ________________________________  
Service Role Key: ________________________________
Database Password: _______________________________
```

---

## 📝 .env.local TEMPLATE

Copy this, replace the `xxx` parts:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=any-random-32-characters
```

---

## 🚀 SETUP STEPS

```
[ ] 1. Create Supabase account at supabase.com
[ ] 2. Create new project (save the password!)
[ ] 3. Wait 2-3 minutes for setup
[ ] 4. Run schema.sql in SQL Editor
[ ] 5. Run admin-markets-schema.sql in SQL Editor
[ ] 6. Copy your 3 keys from Project Settings → API
[ ] 7. Create .env.local with your keys
[ ] 8. Run: npm install @supabase/supabase-js
[ ] 9. Run: npm run dev
[ ] 10. Create admin account (see SQL below)
```

---

## 👑 MAKE YOURSELF ADMIN

Run this in SQL Editor (change the email!):

```sql
INSERT INTO public.users (
    email, 
    role, 
    tier, 
    balance_available,
    is_active
) VALUES (
    'YOUR-EMAIL@example.com',
    'admin',
    'vip',
    10000.00,
    true
);
```

---

## 🔗 IMPORTANT URLS

| What | URL |
|------|-----|
| Supabase Dashboard | https://app.supabase.com |
| Your Website (dev) | http://localhost:3000 |
| Admin Panel | http://localhost:3000/admin/login |
| User Dashboard | http://localhost:3000/dashboard |
| Deposit Page | http://localhost:3000/dashboard/wallet |

---

## 🆘 COMMON FIXES

**"Invalid API key"**
→ Check .env.local has correct keys, no extra spaces

**"relation does not exist"**  
→ Run the SQL files again in order

**Page won't load**
→ Restart: stop server (Ctrl+C) then `npm run dev`

**Can't login as admin**
→ Run the INSERT SQL with your email

---

## 📊 WHAT GETS SAVED TO SUPABASE

| Data | Table |
|------|-------|
| User accounts | `users` |
| User balances | `users.balance_available` |
| Deposits | `deposits` |
| Withdrawals | `withdrawals` |
| Trades | `trades` |
| Payment methods | `payment_methods` |
| Custom pairs | `custom_pairs` |
| Price overrides | `price_overrides` |
| Trading sessions | `trading_sessions` |

---

## ✅ VERIFICATION CHECKLIST

After setup, verify these work:

```
[ ] Can create new user account
[ ] Can login
[ ] Can see payment methods on deposit page
[ ] Can submit deposit (creates pending record)
[ ] Admin can see pending deposits
[ ] Admin can confirm deposit (balance updates)
[ ] Can open a trade
[ ] Trade P&L calculates correctly
[ ] Can close a trade (balance updates)
```

---

## 🎉 YOU'RE DONE WHEN...

1. ✅ You can login to http://localhost:3000
2. ✅ You can login to admin panel
3. ✅ Deposits show YOUR wallet addresses
4. ✅ Confirming deposit adds to user balance
5. ✅ Data persists after browser refresh

---

**Good luck! You've got this! 💪**

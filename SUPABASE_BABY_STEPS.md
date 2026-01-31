# 🍼 Supabase Setup Guide - Baby Steps Edition

This guide assumes you've never used Supabase before. Follow each step exactly.

---

## 📋 What You'll Need

- A computer with internet
- An email address
- About 30 minutes

---

## Step 1: Create a Supabase Account

1. Open your web browser (Chrome, Firefox, Safari, etc.)

2. Go to: **https://supabase.com**

3. Click the big green button that says **"Start your project"** (or "Sign Up")

4. You'll see options to sign up:
   - Click **"Continue with GitHub"** (easiest if you have GitHub)
   - OR click **"Continue with Email"** and enter your email + create a password

5. If you used email, check your inbox and click the confirmation link

6. You're now logged into Supabase! 🎉

---

## Step 2: Create Your First Project

1. After logging in, you'll see a dashboard. Click **"New Project"**

2. You'll see a form. Fill it in:

   ```
   Organization: [Select "Personal" or create one - just click the dropdown]
   
   Project name: nova-trade
   
   Database Password: [Click "Generate a password" button]
   ⚠️ IMPORTANT: Copy this password and save it somewhere safe! 
   You'll need it later. Paste it in a notepad file for now.
   
   Region: [Pick the one closest to you]
   - If you're in USA: Choose "East US" or "West US"
   - If you're in Europe: Choose "EU West"
   - If you're in Asia: Choose "Singapore" or "Tokyo"
   ```

3. Click **"Create new project"**

4. Wait 2-3 minutes. You'll see a loading screen. Get some water. 💧

5. When it's done, you'll see your project dashboard!

---

## Step 3: Set Up Your Database Tables

This is where we create all the "containers" for your data.

1. Look at the left sidebar. Click **"SQL Editor"** (it has a `<>` icon)

2. You'll see a blank editor. This is where we type commands.

3. **DELETE** anything already in the editor (select all, delete)

4. Now, open the file called `supabase/schema.sql` from the code I gave you

5. **Copy EVERYTHING** in that file (Ctrl+A then Ctrl+C on Windows, Cmd+A then Cmd+C on Mac)

6. **Paste** it into the Supabase SQL Editor (Ctrl+V or Cmd+V)

7. Look at the bottom right. Click the green **"Run"** button (or press Ctrl+Enter)

8. Wait a few seconds. You should see: **"Success. No rows returned"**
   - This is GOOD! It means it worked.
   - If you see red error text, something went wrong. Try again from step 3.

9. Now we do it again for the admin controls:
   - Click **"New Query"** (top left of the editor)
   - Open the file `supabase/admin-markets-schema.sql`
   - Copy everything, paste it, click Run
   - Wait for "Success"

10. ✅ Your database is ready!

---

## Step 4: Verify Your Tables Were Created

Let's make sure everything worked:

1. In the left sidebar, click **"Table Editor"** (looks like a grid/table icon)

2. You should see a list of tables. Check that you have ALL of these:

   **✅ Core Tables (from schema.sql):**
   - [ ] users
   - [ ] payment_methods
   - [ ] deposits
   - [ ] withdrawals
   - [ ] trades
   - [ ] investments
   - [ ] transactions
   - [ ] platform_settings

   **✅ Admin Tables (from admin-markets-schema.sql):**
   - [ ] custom_pairs
   - [ ] price_overrides
   - [ ] trading_sessions
   - [ ] custom_candles
   - [ ] trade_outcomes
   - [ ] market_patterns
   - [ ] admin_logs

3. If any are missing, go back to Step 3 and run the SQL again.

---

## Step 5: Get Your API Keys

These are like passwords that let your website talk to Supabase.

1. In the left sidebar, click **"Project Settings"** (gear icon at the bottom)

2. Click **"API"** in the settings menu

3. You'll see a page with your keys. Find these THREE things:

   ### A. Project URL
   ```
   Looks like: https://abcdefghijk.supabase.co
   ```
   📋 Copy this and save it in your notepad

   ### B. anon/public key
   ```
   Looks like: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJz...
   (very long string of letters and numbers)
   ```
   📋 Copy this and save it in your notepad
   
   ### C. service_role key (SECRET!)
   ```
   Click "Reveal" to see it
   Looks like: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJz...
   ```
   ⚠️ This is SECRET! Never share it or put it in public code!
   📋 Copy this and save it in your notepad

4. Your notepad should now have:
   ```
   Project URL: https://xxxxx.supabase.co
   Anon Key: eyJhbGci...
   Service Role Key: eyJhbGci...
   Database Password: (from Step 2)
   ```

---

## Step 6: Add Keys to Your Website

1. Find your project folder (where all the code is)

2. Look for a file called `.env.local` 
   - If it doesn't exist, create it (right-click → New File → name it `.env.local`)

3. Open `.env.local` and paste this (replace with YOUR values):

```env
# Supabase - Copy these from Step 5
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-service-role-key-here

# App Settings
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=type-any-random-32-characters-here-abc123xyz
```

4. **IMPORTANT**: Replace the placeholder values with YOUR actual keys from Step 5!

5. Save the file (Ctrl+S or Cmd+S)

---

## Step 7: Install Supabase Package

1. Open your terminal/command prompt

2. Navigate to your project folder:
   ```bash
   cd path/to/your/project
   ```
   (Example: `cd Desktop/nova-trade`)

3. Install Supabase:
   ```bash
   npm install @supabase/supabase-js
   ```

4. Wait for it to finish (you'll see the cursor come back)

---

## Step 8: Create Your Admin Account

You need an admin account to access the admin panel.

1. Go back to Supabase dashboard

2. Click **"SQL Editor"** in the sidebar

3. Click **"New Query"**

4. Paste this (change the email to YOUR email):

```sql
-- Replace 'your-email@example.com' with YOUR email!
INSERT INTO public.users (
    email, 
    first_name, 
    last_name, 
    role, 
    tier, 
    balance_available,
    is_active
) VALUES (
    'your-email@example.com',  -- ← CHANGE THIS!
    'Admin',
    'User', 
    'admin',
    'vip',
    10000.00,
    true
);
```

5. Click **"Run"**

6. You should see "Success. 1 row affected"

---

## Step 9: Set Up Authentication

1. In Supabase sidebar, click **"Authentication"**

2. Click **"Providers"** tab

3. Make sure **"Email"** is enabled (it should be by default)

4. Click on **"Email"** to expand settings:
   - Turn OFF "Confirm email" for testing (you can turn it on later)
   - Click "Save"

---

## Step 10: Test Your Connection

1. Start your website:
   ```bash
   npm run dev
   ```

2. Open browser and go to: **http://localhost:3000**

3. Try to:
   - Sign up with a new account
   - Log in
   - Make a deposit (it should save to Supabase now!)

4. Go back to Supabase → Table Editor → Click on "users"
   - You should see your new user!

---

## 🎉 You're Done!

Your website is now connected to Supabase. All data will be saved permanently.

---

## ❓ Troubleshooting

### "Error: Invalid API key"
- Double-check your `.env.local` file
- Make sure there are no extra spaces
- Restart your dev server (`npm run dev`)

### "Error: relation does not exist"
- Go back to Step 3 and run the SQL files again

### "I can't see my tables"
- Click the "Refresh" button in Table Editor
- Make sure you ran BOTH SQL files

### "My changes aren't saving"
- Check browser console (F12) for errors
- Make sure `.env.local` has the correct keys

### "I forgot my database password"
- Go to Project Settings → Database → Click "Reset database password"

---

## 📱 Accessing from Phone/Other Devices

Because your data is in Supabase (the cloud), you can:
- Access admin panel from any device
- Multiple admins can work at the same time
- Data syncs automatically

---

## 🔐 Security Checklist

Before going live:
- [ ] Turn ON "Confirm email" in Authentication settings
- [ ] Never share your `service_role` key
- [ ] Keep `.env.local` out of GitHub (it's in .gitignore by default)
- [ ] Set up proper domain in Supabase → Authentication → URL Configuration

---

## 📞 Need Help?

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Video tutorials: Search "Supabase tutorial" on YouTube

---

**Congratulations! You've set up a professional database! 🚀**

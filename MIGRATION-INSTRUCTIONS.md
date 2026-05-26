# Manual Database Migration - Make gym_id Nullable

## Problem
The `otps` table has `gym_id` as NOT NULL, but we need to create OTPs before a gym exists (for gym registration).

## Solution
Run this SQL command in Neon's SQL Editor:

```sql
ALTER TABLE otps ALTER COLUMN gym_id DROP NOT NULL;
```

## Steps to Run Migration

### Option 1: Neon Dashboard (Recommended)

1. **Go to Neon Dashboard:**
   - Visit: https://console.neon.tech/
   - Login with your account

2. **Select Your Project:**
   - Find your gym project
   - Click on it

3. **Open SQL Editor:**
   - Click "SQL Editor" in the left sidebar
   - Or go to the "Tables" section

4. **Run the Migration:**
   - Copy and paste this SQL:
   ```sql
   ALTER TABLE otps ALTER COLUMN gym_id DROP NOT NULL;
   ```
   - Click "Run" or press Ctrl+Enter

5. **Verify the Change:**
   ```sql
   SELECT column_name, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'otps' AND column_name = 'gym_id';
   ```
   - Should show `is_nullable = YES`

### Option 2: Using Neon CLI (if installed)

```bash
neonctl sql "ALTER TABLE otps ALTER COLUMN gym_id DROP NOT NULL"
```

### Option 3: Using any PostgreSQL Client

Connect to your database using the connection string from `.env`:
```
postgresql://neondb_owner:npg_8N9mtOpnRliK@ep-round-wildflower-amy3drt0-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Then run:
```sql
ALTER TABLE otps ALTER COLUMN gym_id DROP NOT NULL;
```

## After Migration

1. **Restart backend server:**
   ```bash
   cd "H:\gym vercel\api-server"
   npm run dev
   ```

2. **Test registration again:**
   - Go to http://localhost:5173/register
   - Fill the form
   - Click "Start Free 14-Day Trial"
   - OTP should now save successfully!

## Verification

After running the migration, the OTP insert should work because:
- `gym_id` will be nullable
- We can omit it when creating gym registration OTPs
- It will be populated later for other OTP types

## What This Fixes

Before: `gym_id UUID NOT NULL` → Cannot insert without gym
After: `gym_id UUID NULL` → Can insert before gym exists ✅

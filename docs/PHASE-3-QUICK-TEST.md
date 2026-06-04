# Phase 3: Quick Test Guide

## Current Status
✅ Code is complete and ready
⚠️ DATABASE_URL needs to be configured

## Option 1: Create Vercel Postgres Database (Recommended)

### Step 1: Create Database via Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Select your project: **gym-admin-app**
3. Go to **Storage** tab
4. Click **Create Database**
5. Select **Postgres**
6. Name it: `gym-db`
7. Select region: **US East (closest to you)**
8. Click **Create**

### Step 2: Connect Database to Project
After creation, Vercel will automatically:
- Add `DATABASE_URL` to your environment variables
- Show you the connection string

### Step 3: Pull New Environment Variables
```bash
cd "H:\gym vercel"
vercel env pull .env --yes
```

### Step 4: Apply Database Schema
```bash
cd lib/db
pnpm push
```

This will create all tables including:
- `gyms` - Gym information
- `admin_users` - Owners and staff
- All other tables with `gym_id`

---

## Option 2: Use Neon (Free Tier - Faster Setup)

### Step 1: Create Neon Account
1. Go to https://neon.tech
2. Sign up (free tier available)
3. Create new project: `gym-db`

### Step 2: Get Connection String
Copy the connection string (looks like):
```
postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb
```

### Step 3: Add to .env
```bash
# Edit H:\gym vercel\.env
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb"
```

### Step 4: Apply Schema
```bash
cd "H:\gym vercel\lib\db"
pnpm push
```

---

## Option 3: Local PostgreSQL (For Development)

### Step 1: Install PostgreSQL
Download from: https://www.postgresql.org/download/windows/

### Step 2: Create Database
```bash
# After installation
createdb gym_db
```

### Step 3: Update .env
```bash
DATABASE_URL="postgresql://postgres:your-password@localhost:5432/gym_db"
```

### Step 4: Apply Schema
```bash
cd "H:\gym vercel\lib\db"
pnpm push
```

---

## Testing Phase 3 (After Database Setup)

### 1. Start the Server
```bash
cd "H:\gym vercel\api-server"
pnpm dev
```

### 2. Test Registration Endpoint
```bash
curl -X POST http://localhost:3000/onboarding/register \
  -H "Content-Type: application/json" \
  -d "{\"gymName\":\"Test Gym\",\"address\":\"123 Test St\",\"phone\":\"+923001234567\",\"email\":\"test@gym.com\",\"ownerName\":\"Test Owner\",\"ownerEmail\":\"owner@test.com\",\"ownerPassword\":\"password123\"}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Gym registered successfully! Your 14-day trial has started.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "gym": {
    "id": "uuid-here",
    "name": "Test Gym",
    "slug": "test-gym-a3b2",
    "subscriptionStatus": "trial",
    "trialEndsAt": "2026-06-02T..."
  },
  "owner": {
    "id": 123,
    "name": "Test Owner",
    "email": "owner@test.com",
    "role": "gym_owner"
  }
}
```

### 3. Test Authentication
Copy the token from step 2 and test:
```bash
curl -X GET http://localhost:3000/onboarding/trial-status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "status": "trial",
  "tier": "basic",
  "daysRemaining": 14,
  "expiresAt": "2026-06-02T..."
}
```

### 4. Test Admin Login
```bash
curl -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"owner@test.com\",\"password\":\"password123\"}"
```

**Expected Response:**
```json
{
  "user": {
    "id": 123,
    "name": "Test Owner",
    "email": "owner@test.com",
    "role": "gym_owner",
    "gymId": "uuid-here"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Current .env Status

Your `.env` file has:
- ✅ `JWT_SECRET` - Configured
- ✅ `BLOB_READ_WRITE_TOKEN` - Configured
- ⚠️ `DATABASE_URL` - **Needs to be set**

---

## Quick Decision

**If you want to test now:**
- Choose Option 2 (Neon) - Takes 2 minutes to setup
- Or Option 1 (Vercel Postgres) - Takes 3-5 minutes via dashboard

**If you want to skip testing for now:**
- We can proceed to Phase 4 (Billing & Subscriptions)
- Test everything together later

---

## What's Next?

After database is configured and tested:
1. ✅ Phase 3 is complete
2. 🚀 Move to Phase 4: Billing & Subscriptions
   - Stripe integration
   - Subscription plans
   - Payment processing
   - Trial to paid conversion

---

**Your choice:** Database setup karna hai ya Phase 4 start karein?

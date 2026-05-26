# Local Testing Guide - Step by Step

## Prerequisites
- ✅ Stripe keys configured in `.env`
- ✅ JWT secret configured
- ⚠️ DATABASE_URL needs to be set

---

## Step 1: Get Database URL (2 minutes)

### Option A: Neon (Recommended - Free)
1. Go to https://neon.tech
2. Sign up with GitHub/Google
3. Create new project: `gym-db`
4. Copy the connection string (looks like):
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb
   ```

### Option B: Local PostgreSQL
```bash
# If you have PostgreSQL installed
createdb gym_db
# Connection string:
postgresql://postgres:password@localhost:5432/gym_db
```

### Update .env
Open `H:\gym vercel\.env` and replace:
```env
DATABASE_URL="postgresql://REPLACE_WITH_YOUR_NEON_URL"
```

With your actual connection string:
```env
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb"
```

---

## Step 2: Apply Database Schema

```bash
cd "H:\gym vercel\lib\db"
pnpm push
```

**Expected output:**
```
✓ Applying changes...
✓ Done!
```

This creates all tables:
- gyms
- admin_users
- subscription_plans
- subscriptions
- payment_history
- members, attendance, etc.

---

## Step 3: Seed Subscription Plans

```bash
# Still in lib/db directory
pnpm tsx src/seed-plans.ts
```

**Expected output:**
```
🌱 Seeding subscription plans...
  ✅ Created plan: Basic (basic)
  ✅ Created plan: Pro (pro)
  ✅ Created plan: Enterprise (enterprise)
✨ Subscription plans seeded successfully!
```

---

## Step 4: Start API Server

Open a **new terminal** and run:

```bash
cd "H:\gym vercel\api-server"
pnpm dev
```

**Expected output:**
```
Server running on http://localhost:3000
```

Keep this terminal open. Server will run here.

---

## Step 5: Test Endpoints

Open **another terminal** for testing.

### Test 1: Health Check
```bash
curl http://localhost:3000/health
```

**Expected:**
```json
{"status":"ok"}
```

---

### Test 2: Get Subscription Plans
```bash
curl http://localhost:3000/billing/plans
```

**Expected:**
```json
{
  "success": true,
  "plans": [
    {
      "id": "uuid-here",
      "name": "Basic",
      "slug": "basic",
      "monthlyPrice": "2999",
      "yearlyPrice": "29999",
      "features": ["Up to 100 members", "..."]
    },
    ...
  ]
}
```

---

### Test 3: Register a Gym
```bash
curl -X POST http://localhost:3000/onboarding/register ^
  -H "Content-Type: application/json" ^
  -d "{\"gymName\":\"Test Gym\",\"address\":\"123 Test St\",\"phone\":\"+923001234567\",\"email\":\"test@gym.com\",\"ownerName\":\"Test Owner\",\"ownerEmail\":\"owner@test.com\",\"ownerPassword\":\"password123\"}"
```

**Expected:**
```json
{
  "success": true,
  "message": "Gym registered successfully! Your 14-day trial has started.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "gym": {
    "id": "uuid",
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

**Save the token!** You'll need it for next tests.

---

### Test 4: Get Trial Status

Replace `YOUR_TOKEN` with the token from Test 3:

```bash
curl http://localhost:3000/onboarding/trial-status ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:**
```json
{
  "status": "trial",
  "tier": "basic",
  "daysRemaining": 14,
  "expiresAt": "2026-06-02T..."
}
```

---

### Test 5: Get Current Subscription

```bash
curl http://localhost:3000/billing/subscription ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:**
```json
{
  "success": true,
  "subscription": null
}
```

(null because no paid subscription yet, still on trial)

---

### Test 6: Create Checkout Session

First, get a plan ID from Test 2, then:

```bash
curl -X POST http://localhost:3000/billing/checkout ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"planId\":\"PLAN_UUID_FROM_TEST_2\",\"billingCycle\":\"monthly\",\"successUrl\":\"http://localhost:3000/success\",\"cancelUrl\":\"http://localhost:3000/cancel\"}"
```

**Expected:**
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

---

### Test 7: Complete Payment (Browser)

1. Copy the `url` from Test 6
2. Open in browser
3. Use Stripe test card:
   - **Card:** `4242 4242 4242 4242`
   - **Expiry:** Any future date (e.g., `12/28`)
   - **CVC:** Any 3 digits (e.g., `123`)
   - **ZIP:** Any 5 digits (e.g., `12345`)
4. Click "Pay"

**What happens:**
- Stripe processes payment
- Redirects to success URL
- Sends webhook to your server
- Server creates subscription record
- Updates gym status to "active"

---

### Test 8: Verify Subscription Created

After completing payment in browser:

```bash
curl http://localhost:3000/billing/subscription ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:**
```json
{
  "success": true,
  "subscription": {
    "id": "uuid",
    "status": "active",
    "billingCycle": "monthly",
    "amount": "2999",
    "currentPeriodStart": "2026-05-19T...",
    "currentPeriodEnd": "2026-06-19T..."
  },
  "plan": {
    "name": "Basic",
    "slug": "basic",
    "features": ["..."]
  }
}
```

---

### Test 9: Check Payment History

```bash
curl http://localhost:3000/billing/payment-history ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:**
```json
{
  "success": true,
  "payments": [
    {
      "id": "uuid",
      "amount": "2999",
      "currency": "PKR",
      "status": "succeeded",
      "paidAt": "2026-05-19T...",
      "invoiceUrl": "https://invoice.stripe.com/..."
    }
  ]
}
```

---

### Test 10: Open Billing Portal

```bash
curl -X POST http://localhost:3000/billing/portal ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"returnUrl\":\"http://localhost:3000/billing\"}"
```

**Expected:**
```json
{
  "success": true,
  "url": "https://billing.stripe.com/p/session/..."
}
```

Open the URL in browser to:
- Update payment method
- View invoices
- Cancel subscription

---

## Troubleshooting

### "DATABASE_URL not found"
- Check `.env` file has correct DATABASE_URL
- Restart server after updating .env

### "Schema push failed"
- Verify database is accessible
- Check connection string format
- Try: `pnpm push-force` (warning: drops all data)

### "Plans not found"
- Run seed script: `pnpm tsx src/seed-plans.ts`
- Check database: `SELECT * FROM subscription_plans;`

### "Checkout fails"
- Verify Stripe keys in `.env`
- Check plan has `stripeMonthlyPriceId` set
- Review server logs for errors

### "Webhook not working"
- For local testing, webhook won't work (Stripe can't reach localhost)
- Use Stripe CLI: `stripe listen --forward-to localhost:3000/webhooks/stripe`
- Or test on deployed version

---

## Success Checklist

- [ ] Database schema applied
- [ ] Subscription plans seeded
- [ ] Server started successfully
- [ ] Health check passes
- [ ] Plans endpoint returns 3 plans
- [ ] Gym registration works
- [ ] Trial status shows 14 days
- [ ] Checkout session created
- [ ] Payment completed in browser
- [ ] Subscription shows as active
- [ ] Payment recorded in history

---

## Next Steps After Testing

1. **Deploy to Vercel** - Make it live
2. **Update Stripe Products** - Add real price IDs
3. **Frontend Integration** - Build billing UI
4. **Phase 5** - Super Admin Panel

---

## Quick Reference

**Start server:**
```bash
cd "H:\gym vercel\api-server"
pnpm dev
```

**Apply schema:**
```bash
cd "H:\gym vercel\lib\db"
pnpm push
```

**Seed plans:**
```bash
cd "H:\gym vercel\lib\db"
pnpm tsx src/seed-plans.ts
```

**Test registration:**
```bash
curl -X POST http://localhost:3000/onboarding/register -H "Content-Type: application/json" -d "{\"gymName\":\"Test\",\"address\":\"123\",\"phone\":\"+923001234567\",\"email\":\"test@gym.com\",\"ownerName\":\"Owner\",\"ownerEmail\":\"owner@test.com\",\"ownerPassword\":\"pass123\"}"
```

---

**Ready to start?** 

1. Get DATABASE_URL from Neon
2. Update `.env`
3. Run Step 2 (apply schema)
4. Continue with remaining steps

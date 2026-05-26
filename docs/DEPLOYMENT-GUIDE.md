# Phase 3 & 4: Vercel Deployment Guide

## Current Status
✅ Phase 3 (Gym Onboarding) - Code complete
✅ Phase 4 (Billing & Subscriptions) - Code complete
✅ Stripe keys configured locally
⚠️ Need to deploy to Vercel

---

## Deployment Steps

### Step 1: Link Project to Vercel

```bash
cd "H:\gym vercel"

# Link to existing project
vercel link --project gym-admin-app --yes
```

### Step 2: Add Environment Variables to Vercel

```bash
# JWT Secret
vercel env add JWT_SECRET production
# Paste: 4c8ca7bb19a462a5fb075459a5ae68c34e636a04a029085414af7ea0917013de

# Stripe Secret Key
vercel env add STRIPE_SECRET_KEY production
# Paste: sk_test_YOUR_STRIPE_SECRET_KEY_HERE

# Stripe Publishable Key
vercel env add STRIPE_PUBLISHABLE_KEY production
# Paste: pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_HERE

# Stripe Webhook Secret
vercel env add STRIPE_WEBHOOK_SECRET production
# Paste: whsec_NkA2VSnKlIVty0gKUSzfDAWQp1Pxa6Xl
```

**Or add via Vercel Dashboard:**
1. Go to https://vercel.com/nazakats-projects-402b6b9d/gym-admin-app/settings/environment-variables
2. Add each variable for Production environment

### Step 3: Seed Subscription Plans (One-time)

You need to run the seed script once to populate subscription plans. Two options:

#### Option A: Via Vercel CLI (Recommended)
```bash
# Deploy first
vercel --prod

# Then run seed via Vercel CLI
vercel env pull .env.production
cd lib/db
DATABASE_URL="your-production-db-url" pnpm tsx src/seed-plans.ts
```

#### Option B: Via Temporary API Endpoint
Add a temporary endpoint to seed plans, then remove it after use.

### Step 4: Deploy to Production

```bash
cd "H:\gym vercel"
vercel --prod
```

This will:
- Build the project
- Push database schema (via build command)
- Deploy to production
- Your app will be live at: https://gym-admin-app-vert.vercel.app

### Step 5: Verify Deployment

**Test Registration:**
```bash
curl -X POST https://gym-admin-app-vert.vercel.app/api/onboarding/register \
  -H "Content-Type: application/json" \
  -d '{
    "gymName": "Test Gym",
    "address": "123 Test Street",
    "phone": "+923001234567",
    "email": "test@gym.com",
    "ownerName": "Test Owner",
    "ownerEmail": "owner@test.com",
    "ownerPassword": "password123"
  }'
```

**Test Plans:**
```bash
curl https://gym-admin-app-vert.vercel.app/api/billing/plans
```

**Test Checkout:**
```bash
curl -X POST https://gym-admin-app-vert.vercel.app/api/billing/checkout \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "PLAN_UUID",
    "billingCycle": "monthly"
  }'
```

---

## Stripe Webhook Configuration

Your webhook is already configured:
- **Endpoint:** https://gym-admin-app-vert.vercel.app/api/webhooks/stripe
- **Secret:** whsec_NkA2VSnKlIVty0gKUSzfDAWQp1Pxa6Xl

Verify in Stripe Dashboard:
1. Go to https://dashboard.stripe.com/test/webhooks
2. Check endpoint is active
3. Test by sending a test event

---

## Database Setup

You need a production database. Options:

### Option 1: Vercel Postgres (Recommended)
```bash
# Create via Vercel Dashboard
# 1. Go to https://vercel.com/nazakats-projects-402b6b9d/gym-admin-app/stores
# 2. Click "Create Database"
# 3. Select "Postgres"
# 4. Name: gym-db
# 5. Region: US East
# 6. Click "Create"

# Vercel will automatically add DATABASE_URL to your environment
```

### Option 2: Neon (Free Tier)
```bash
# 1. Go to https://neon.tech
# 2. Create project: gym-db
# 3. Copy connection string
# 4. Add to Vercel:
vercel env add DATABASE_URL production
# Paste connection string
```

### Option 3: Use Existing Database
If you already have a database, just add the URL:
```bash
vercel env add DATABASE_URL production
# Paste your existing DATABASE_URL
```

---

## Post-Deployment Checklist

- [ ] Environment variables added to Vercel
- [ ] Database created and connected
- [ ] Schema pushed (happens during build)
- [ ] Subscription plans seeded
- [ ] Registration endpoint tested
- [ ] Billing endpoints tested
- [ ] Stripe webhook receiving events
- [ ] Test payment completed successfully

---

## Troubleshooting

### Build fails with "DATABASE_URL not found"
- Add DATABASE_URL to Vercel environment variables
- Redeploy: `vercel --prod`

### Webhook not receiving events
- Verify webhook URL in Stripe Dashboard
- Check STRIPE_WEBHOOK_SECRET is correct
- Test webhook: `stripe trigger checkout.session.completed`

### Plans not showing
- Run seed script: `pnpm tsx lib/db/src/seed-plans.ts`
- Or create plans manually in database

### Checkout fails
- Verify Stripe price IDs are set in subscription_plans table
- Check Stripe keys are correct
- Review Vercel function logs

---

## Quick Commands

```bash
# Link project
vercel link --project gym-admin-app --yes

# Add all env vars at once (interactive)
vercel env add JWT_SECRET production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add DATABASE_URL production

# Deploy
vercel --prod

# View logs
vercel logs --prod

# Check deployment
vercel inspect https://gym-admin-app-vert.vercel.app
```

---

## Next Steps After Deployment

1. **Test the full flow:**
   - Register a gym
   - Login as owner
   - View subscription plans
   - Create checkout session
   - Complete payment with test card
   - Verify subscription is active

2. **Update Stripe Products:**
   - Add price IDs to subscription_plans table
   - Test checkout with real Stripe prices

3. **Frontend Integration:**
   - Update frontend to use new endpoints
   - Add billing page
   - Add subscription upgrade flow

4. **Move to Phase 5:**
   - Super Admin Panel
   - Manage all gyms
   - View analytics

---

**Ready to deploy?** Run these commands:

```bash
cd "H:\gym vercel"
vercel link --project gym-admin-app --yes
vercel --prod
```

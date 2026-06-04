# Phase 4: Subscription & Billing - Implementation Complete ✅

## Overview
Phase 4 adds complete Stripe integration for subscription management, payment processing, and billing.

---

## What's Been Implemented

### 1. **Database Schema** ✅

#### Subscription Plans Table
Stores available subscription tiers (Basic, Pro, Enterprise):
- Plan details (name, slug, description)
- Pricing (monthly/yearly in PKR)
- Stripe product & price IDs
- Features list
- Limits (max members, staff, branches)

#### Subscriptions Table
Tracks each gym's active subscription:
- Gym and plan relationships
- Stripe subscription & customer IDs
- Status (trial, active, past_due, canceled)
- Billing cycle (monthly/yearly)
- Current period dates
- Cancellation info

#### Payment History Table
Records all payment transactions:
- Stripe payment intent, invoice, charge IDs
- Amount, currency, status
- Payment method details (card last 4, brand)
- Success/failure timestamps
- Failure reasons
- Invoice URLs

### 2. **Billing API Endpoints** ✅

#### `GET /billing/plans`
Get all available subscription plans.

**Response:**
```json
{
  "success": true,
  "plans": [
    {
      "id": "uuid",
      "name": "Basic",
      "slug": "basic",
      "monthlyPrice": "2999",
      "yearlyPrice": "29999",
      "features": ["Up to 100 members", "..."],
      "maxMembers": "100"
    }
  ]
}
```

#### `POST /billing/checkout`
Create Stripe checkout session for subscription upgrade.

**Request:**
```json
{
  "planId": "uuid",
  "billingCycle": "monthly",
  "successUrl": "https://yourdomain.com/success",
  "cancelUrl": "https://yourdomain.com/cancel"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

#### `GET /billing/subscription`
Get current subscription details.

**Response:**
```json
{
  "success": true,
  "subscription": {
    "id": "uuid",
    "status": "active",
    "billingCycle": "monthly",
    "amount": "2999",
    "currentPeriodEnd": "2026-06-19T..."
  },
  "plan": {
    "name": "Basic",
    "features": ["..."]
  }
}
```

#### `GET /billing/payment-history`
Get all payment transactions.

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "id": "uuid",
      "amount": "2999",
      "status": "succeeded",
      "paidAt": "2026-05-19T...",
      "invoiceUrl": "https://..."
    }
  ]
}
```

#### `POST /billing/portal`
Create Stripe billing portal session (manage subscription, payment methods).

**Request:**
```json
{
  "returnUrl": "https://yourdomain.com/billing"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://billing.stripe.com/p/session/..."
}
```

#### `POST /billing/cancel`
Cancel subscription (remains active until period end).

**Response:**
```json
{
  "success": true,
  "message": "Subscription will be canceled at the end of the billing period"
}
```

### 3. **Stripe Webhook Handler** ✅

**Endpoint:** `POST /webhooks/stripe`

Handles Stripe events:
- ✅ `checkout.session.completed` - Create subscription after successful payment
- ✅ `invoice.payment_succeeded` - Record successful payment
- ✅ `invoice.payment_failed` - Record failed payment, update status
- ✅ `customer.subscription.updated` - Update subscription details
- ✅ `customer.subscription.deleted` - Mark subscription as canceled
- ✅ `payment_intent.succeeded` - Payment success
- ✅ `payment_intent.payment_failed` - Payment failure

### 4. **Subscription Plans Seeder** ✅

Pre-configured plans:

**Basic Plan** - PKR 2,999/month or PKR 29,999/year
- Up to 100 members
- Up to 3 staff accounts
- Basic reporting
- Email support

**Pro Plan** - PKR 5,999/month or PKR 59,999/year
- Up to 500 members
- Up to 10 staff accounts
- Advanced reporting & analytics
- SMS notifications
- Priority support

**Enterprise Plan** - PKR 14,999/month or PKR 149,999/year
- Unlimited members & staff
- Multi-branch support
- Custom integrations
- Dedicated account manager
- 24/7 priority support

---

## Setup Instructions

### 1. Environment Variables

Update `.env` file:
```env
# Stripe Keys (Required)
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_HERE

# Stripe Webhook Secret (Get from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_...

# Database & JWT (from Phase 3)
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
```

### 2. Create Stripe Products & Prices

#### Option A: Via Stripe Dashboard (Recommended)
1. Go to https://dashboard.stripe.com/test/products
2. Create 3 products:
   - **Basic Plan**
     - Monthly price: PKR 2,999
     - Yearly price: PKR 29,999
   - **Pro Plan**
     - Monthly price: PKR 5,999
     - Yearly price: PKR 59,999
   - **Enterprise Plan**
     - Monthly price: PKR 14,999
     - Yearly price: PKR 149,999

3. Copy the Price IDs (e.g., `price_1ABC...`)

4. Update the database:
```sql
UPDATE subscription_plans 
SET stripe_monthly_price_id = 'price_1ABC...', 
    stripe_yearly_price_id = 'price_1DEF...'
WHERE slug = 'basic';
```

#### Option B: Via Stripe CLI
```bash
# Create Basic Plan
stripe products create --name="Basic Plan" --description="Perfect for small gyms"
stripe prices create --product=prod_XXX --currency=pkr --unit-amount=299900 --recurring[interval]=month
stripe prices create --product=prod_XXX --currency=pkr --unit-amount=2999900 --recurring[interval]=year

# Repeat for Pro and Enterprise
```

### 3. Apply Database Schema

```bash
cd lib/db
pnpm push
```

### 4. Seed Subscription Plans

```bash
cd lib/db
pnpm tsx src/seed-plans.ts
```

This creates the 3 subscription plans in your database.

### 5. Set Up Stripe Webhook

#### For Local Development:
```bash
# Install Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/webhooks/stripe
```

Copy the webhook signing secret (starts with `whsec_`) and add to `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### For Production:
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. URL: `https://yourdomain.com/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy webhook signing secret to production environment variables

---

## Testing the Flow

### 1. Start the Server
```bash
cd api-server
pnpm dev
```

### 2. Start Stripe Webhook Listener (separate terminal)
```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```

### 3. Register a Gym (Phase 3)
```bash
curl -X POST http://localhost:3000/onboarding/register \
  -H "Content-Type: application/json" \
  -d '{
    "gymName": "Test Gym",
    "address": "123 Test St",
    "phone": "+923001234567",
    "email": "test@gym.com",
    "ownerName": "Test Owner",
    "ownerEmail": "owner@test.com",
    "ownerPassword": "password123"
  }'
```

Save the returned `token`.

### 4. Get Available Plans
```bash
curl http://localhost:3000/billing/plans
```

### 5. Create Checkout Session
```bash
curl -X POST http://localhost:3000/billing/checkout \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "PLAN_UUID_FROM_STEP_4",
    "billingCycle": "monthly",
    "successUrl": "http://localhost:3000/success",
    "cancelUrl": "http://localhost:3000/cancel"
  }'
```

### 6. Complete Payment
Open the returned `url` in browser and use Stripe test card:
- Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

### 7. Verify Subscription
```bash
curl http://localhost:3000/billing/subscription \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8. Check Payment History
```bash
curl http://localhost:3000/billing/payment-history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 9. Test Billing Portal
```bash
curl -X POST http://localhost:3000/billing/portal \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"returnUrl": "http://localhost:3000/billing"}'
```

Open the returned URL to manage subscription.

---

## Stripe Test Cards

**Successful Payment:**
- `4242 4242 4242 4242` - Visa

**Payment Requires Authentication:**
- `4000 0025 0000 3155` - 3D Secure

**Payment Declined:**
- `4000 0000 0000 0002` - Generic decline
- `4000 0000 0000 9995` - Insufficient funds

**More:** https://stripe.com/docs/testing

---

## Frontend Integration

### 1. Display Plans
```typescript
const { plans } = await fetch('/billing/plans').then(r => r.json());

// Show plans with pricing
plans.forEach(plan => {
  console.log(`${plan.name}: PKR ${plan.monthlyPrice}/month`);
});
```

### 2. Upgrade Flow
```typescript
// Create checkout session
const { url } = await fetch('/billing/checkout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    planId: selectedPlan.id,
    billingCycle: 'monthly',
    successUrl: window.location.origin + '/success',
    cancelUrl: window.location.origin + '/billing'
  })
}).then(r => r.json());

// Redirect to Stripe Checkout
window.location.href = url;
```

### 3. Show Current Subscription
```typescript
const { subscription, plan } = await fetch('/billing/subscription', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

if (subscription) {
  console.log(`Current plan: ${plan.name}`);
  console.log(`Status: ${subscription.status}`);
  console.log(`Renews: ${subscription.currentPeriodEnd}`);
}
```

### 4. Manage Subscription
```typescript
// Open Stripe billing portal
const { url } = await fetch('/billing/portal', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    returnUrl: window.location.href
  })
}).then(r => r.json());

window.location.href = url;
```

---

## Files Created/Modified

### New Files:
- `lib/db/src/schema/subscription-plans.ts` - Plans schema
- `lib/db/src/schema/subscriptions.ts` - Subscriptions schema
- `lib/db/src/schema/payment-history.ts` - Payment history schema
- `lib/db/src/seed-plans.ts` - Seed script for plans
- `api-server/src/routes/billing.ts` - Billing API endpoints
- `api-server/src/routes/stripe-webhook.ts` - Webhook handler

### Modified Files:
- `lib/db/src/schema/index.ts` - Export new schemas
- `lib/db/src/schema/gyms.ts` - Add stripeCustomerId field
- `api-server/src/routes/index.ts` - Register billing routes
- `.env` - Add Stripe keys

---

## Security Notes

### ⚠️ Webhook Signature Verification
Always verify webhook signatures in production:
```typescript
const event = stripe.webhooks.constructEvent(
  req.body,
  sig,
  webhookSecret
);
```

### ⚠️ Amount Validation
Stripe amounts are in cents. Always divide by 100:
```typescript
amount: (invoice.amount_paid / 100).toString()
```

### ⚠️ Idempotency
Stripe webhooks may be sent multiple times. Use `stripePaymentIntentId` as unique constraint to prevent duplicate records.

### ⚠️ Test vs Live Keys
- Test keys start with `sk_test_` and `pk_test_`
- Live keys start with `sk_live_` and `pk_live_`
- Never commit keys to git

---

## Troubleshooting

### Webhook not receiving events
1. Check Stripe CLI is running: `stripe listen`
2. Verify webhook secret in `.env`
3. Check server logs for errors

### Checkout session fails
1. Verify Stripe price IDs are correct
2. Check plan exists in database
3. Ensure gym has valid email

### Payment not recorded
1. Check webhook handler logs
2. Verify `gymId` in session metadata
3. Check database for payment record

### Subscription status not updating
1. Verify webhook events are being received
2. Check `stripeSubscriptionId` matches
3. Review webhook handler logs

---

## Next Steps

After Phase 4 is complete:

**Phase 5: Super Admin Panel**
- Admin dashboard to manage all gyms
- View all subscriptions and payments
- Analytics and reporting
- Gym approval/suspension

**Phase 6: Production Polish**
- Subdomain routing (gym1.yourdomain.com)
- Monitoring and alerts
- Automated backups
- Performance optimization

---

## API Documentation

Full API docs available at: `http://localhost:3000/api-docs`

Billing endpoints are documented under the **"Billing"** tag.

---

**Phase 4 Status:** ✅ Complete and ready for testing

**Prerequisites for testing:**
1. ✅ Stripe account with test keys
2. ⚠️ Database configured (from Phase 3)
3. ✅ Stripe CLI installed (for webhook testing)
4. ⚠️ Subscription plans seeded

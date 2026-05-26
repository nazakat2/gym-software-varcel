#!/bin/bash

# Phase 3 & 4 Local Testing Script
# Run this after setting up DATABASE_URL in .env

set -e  # Exit on error

echo "🚀 Starting Phase 3 & 4 Local Testing..."
echo ""

# Check if DATABASE_URL is set
if grep -q "REPLACE_WITH_YOUR_NEON_URL" .env; then
    echo "❌ ERROR: DATABASE_URL not configured!"
    echo ""
    echo "Please update .env file with your Neon database URL:"
    echo "1. Go to https://neon.tech"
    echo "2. Create account and project"
    echo "3. Copy connection string"
    echo "4. Replace 'REPLACE_WITH_YOUR_NEON_URL' in .env"
    echo ""
    exit 1
fi

echo "✅ DATABASE_URL configured"
echo ""

# Step 1: Apply database schema
echo "📦 Step 1: Applying database schema..."
cd lib/db
pnpm push
echo "✅ Schema applied"
echo ""

# Step 2: Seed subscription plans
echo "🌱 Step 2: Seeding subscription plans..."
pnpm tsx src/seed-plans.ts
echo "✅ Plans seeded"
echo ""

# Step 3: Start server in background
echo "🚀 Step 3: Starting API server..."
cd ../../api-server
pnpm dev &
SERVER_PID=$!
echo "✅ Server started (PID: $SERVER_PID)"
echo ""

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
sleep 5
echo ""

# Step 4: Run tests
echo "🧪 Step 4: Running tests..."
echo ""

# Test 1: Health check
echo "Test 1: Health Check"
curl -s http://localhost:3000/health | jq '.'
echo ""

# Test 2: Get subscription plans
echo "Test 2: Get Subscription Plans"
curl -s http://localhost:3000/billing/plans | jq '.plans[] | {name, monthlyPrice, yearlyPrice}'
echo ""

# Test 3: Register a gym
echo "Test 3: Register Gym"
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/onboarding/register \
  -H "Content-Type: application/json" \
  -d '{
    "gymName": "Test Gym",
    "address": "123 Test Street",
    "phone": "+923001234567",
    "email": "test@gym.com",
    "ownerName": "Test Owner",
    "ownerEmail": "owner@test.com",
    "ownerPassword": "password123"
  }')

echo "$REGISTER_RESPONSE" | jq '.'
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')
echo ""

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo "✅ Registration successful! Token: ${TOKEN:0:20}..."
    echo ""

    # Test 4: Get trial status
    echo "Test 4: Get Trial Status"
    curl -s http://localhost:3000/onboarding/trial-status \
      -H "Authorization: Bearer $TOKEN" | jq '.'
    echo ""

    # Test 5: Get subscription
    echo "Test 5: Get Current Subscription"
    curl -s http://localhost:3000/billing/subscription \
      -H "Authorization: Bearer $TOKEN" | jq '.'
    echo ""

    # Test 6: Create checkout session
    echo "Test 6: Create Checkout Session"
    PLAN_ID=$(curl -s http://localhost:3000/billing/plans | jq -r '.plans[0].id')
    curl -s -X POST http://localhost:3000/billing/checkout \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"planId\": \"$PLAN_ID\",
        \"billingCycle\": \"monthly\",
        \"successUrl\": \"http://localhost:3000/success\",
        \"cancelUrl\": \"http://localhost:3000/cancel\"
      }" | jq '.'
    echo ""

    echo "✅ All tests passed!"
else
    echo "❌ Registration failed!"
fi

echo ""
echo "🎉 Testing complete!"
echo ""
echo "Server is still running (PID: $SERVER_PID)"
echo "To stop: kill $SERVER_PID"
echo ""
echo "Next steps:"
echo "1. Open checkout URL in browser"
echo "2. Use test card: 4242 4242 4242 4242"
echo "3. Complete payment"
echo "4. Check webhook logs"
echo ""

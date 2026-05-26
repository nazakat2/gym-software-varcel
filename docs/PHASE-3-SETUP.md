# Phase 3: Quick Setup Guide

## ✅ What's Complete

Phase 3 (Gym Onboarding) is fully implemented:
- ✅ Public gym registration API
- ✅ Automatic gym + owner account creation
- ✅ 14-day trial system
- ✅ JWT authentication
- ✅ Email availability check
- ✅ Trial status endpoint

## 🔧 Setup Required

### 1. Environment Variables

Create or update `.env` file in the root directory:

```env
# Database (Required)
DATABASE_URL=postgresql://user:password@localhost:5432/gym_db

# JWT Secret (Required) - Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-secret-key-min-32-characters-long

# Email (Optional - for password reset and notifications)
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password

# Server
PORT=3000
NODE_ENV=development
```

### 2. Database Setup

**Option A: Local PostgreSQL**
```bash
# Install PostgreSQL
# Create database
createdb gym_db

# Set DATABASE_URL
DATABASE_URL=postgresql://postgres:password@localhost:5432/gym_db
```

**Option B: Vercel Postgres (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Create Vercel Postgres database
vercel postgres create gym-db

# Pull environment variables
vercel env pull .env
```

**Option C: Neon/Supabase**
- Create database on Neon.tech or Supabase
- Copy connection string to DATABASE_URL

### 3. Apply Database Schema

```bash
cd lib/db
pnpm push
```

This will create/update all tables including:
- `gyms` - Gym information
- `admin_users` - Gym owners and staff
- All existing tables with `gym_id` foreign key

### 4. Start the Server

```bash
cd api-server
pnpm dev
```

Server will start at `http://localhost:3000`

### 5. Test Registration

**Using curl:**
```bash
curl -X POST http://localhost:3000/onboarding/register \
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

**Expected Response:**
```json
{
  "success": true,
  "message": "Gym registered successfully! Your 14-day trial has started.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "gym": { ... },
  "owner": { ... }
}
```

### 6. Test Authentication

Use the token from registration:
```bash
curl -X GET http://localhost:3000/onboarding/trial-status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📋 Verification Checklist

- [ ] DATABASE_URL is set and database is accessible
- [ ] JWT_SECRET is set (min 32 characters)
- [ ] `pnpm push` completed successfully
- [ ] Server starts without errors
- [ ] Registration endpoint returns token
- [ ] Trial status endpoint works with token
- [ ] Admin login returns token

## 🚨 Common Issues

### "DATABASE_URL not found"
- Ensure `.env` file exists in root directory
- Check DATABASE_URL format: `postgresql://user:pass@host:port/dbname`

### "JWT_SECRET not configured"
- Add JWT_SECRET to `.env`
- Generate secure secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### "Email already exists"
- Each gym email must be unique
- Each owner email must be unique
- Use different emails for testing

### Schema push fails
- Ensure database is running
- Check DATABASE_URL connection string
- Verify database user has CREATE TABLE permissions

## 📚 API Documentation

Once server is running, visit:
- Swagger UI: `http://localhost:3000/api-docs`
- Look for "Gym Onboarding" section

## 🎯 Next Steps

After setup is complete:
1. Test the registration flow
2. Update frontend to use JWT tokens
3. Create registration page UI
4. Implement trial expiry checks
5. Move to Phase 4 (Billing & Subscriptions)

## 💡 Development Tips

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Test with different gyms:**
```bash
# Gym 1
curl -X POST http://localhost:3000/onboarding/register -H "Content-Type: application/json" -d '{"gymName":"Gym One","address":"Address 1","phone":"1234567890","email":"gym1@test.com","ownerName":"Owner 1","ownerEmail":"owner1@test.com","ownerPassword":"pass123"}'

# Gym 2
curl -X POST http://localhost:3000/onboarding/register -H "Content-Type: application/json" -d '{"gymName":"Gym Two","address":"Address 2","phone":"0987654321","email":"gym2@test.com","ownerName":"Owner 2","ownerEmail":"owner2@test.com","ownerPassword":"pass123"}'
```

**Decode JWT token:**
```bash
# Visit jwt.io and paste your token
# Or use: echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d
```

## 📞 Need Help?

Check the detailed documentation:
- `docs/PHASE-3-GYM-ONBOARDING.md` - Full implementation details
- `lib/middleware/auth.ts` - Authentication middleware
- `api-server/src/routes/gym-onboarding.ts` - Registration endpoints

---

**Status:** Ready for setup and testing ✅

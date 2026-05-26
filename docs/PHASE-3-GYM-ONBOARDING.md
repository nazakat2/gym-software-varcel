# Phase 3: Gym Onboarding - Implementation Complete ✅

## Overview
Phase 3 adds public gym registration, automatic owner account creation, and 14-day trial system.

---

## What's Been Implemented

### 1. **Public Gym Registration API** ✅
**Endpoint:** `POST /onboarding/register`

**Features:**
- Public endpoint (no authentication required)
- Creates gym + owner account in single transaction
- Generates unique slug for gym (e.g., `elite-fitness-a3b2`)
- Starts 14-day trial automatically
- Returns JWT token for immediate access

**Request Body:**
```json
{
  "gymName": "Elite Fitness Center",
  "address": "123 Main Street, Block A",
  "phone": "+923001234567",
  "email": "info@elitefitness.com",
  "city": "Karachi",
  "ownerName": "Ahmed Khan",
  "ownerEmail": "ahmed@elitefitness.com",
  "ownerPassword": "securepass123",
  "currency": "PKR",
  "timezone": "Asia/Karachi"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Gym registered successfully! Your 14-day trial has started.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "gym": {
    "id": "uuid",
    "name": "Elite Fitness Center",
    "slug": "elite-fitness-a3b2",
    "subscriptionStatus": "trial",
    "trialEndsAt": "2026-06-02T..."
  },
  "owner": {
    "id": 123,
    "name": "Ahmed Khan",
    "email": "ahmed@elitefitness.com",
    "role": "gym_owner"
  }
}
```

### 2. **Email Availability Check** ✅
**Endpoint:** `POST /onboarding/check-availability`

Check if gym email or owner email is already registered before submitting the form.

```json
{
  "gymEmail": "info@gym.com",
  "ownerEmail": "owner@gym.com"
}
```

**Response:**
```json
{
  "gymEmailAvailable": true,
  "ownerEmailAvailable": false
}
```

### 3. **Trial Status Endpoint** ✅
**Endpoint:** `GET /onboarding/trial-status`

**Authentication:** Required (Bearer token)

Returns current trial status for authenticated gym:
```json
{
  "status": "trial",
  "tier": "basic",
  "daysRemaining": 12,
  "expiresAt": "2026-06-02T..."
}
```

### 4. **JWT-Based Authentication** ✅
Updated admin login to generate JWT tokens compatible with the multi-tenant middleware.

**JWT Payload Structure:**
```json
{
  "userId": "123",
  "gymId": "gym-uuid",
  "role": "gym_owner",
  "email": "owner@gym.com",
  "permissions": {
    "members": ["*"],
    "billing": ["*"],
    "attendance": ["*"],
    "reports": ["*"],
    "inventory": ["*"],
    "settings": ["*"]
  }
}
```

### 5. **Database Schema Updates** ✅
Updated `admin_users` table:
- Changed `isActive` → `status` (text: "active", "inactive", "suspended")
- Changed `lastLoginAt` → `lastLogin` (text, ISO string)

---

## Files Modified/Created

### New Files:
- `api-server/src/routes/gym-onboarding.ts` - Onboarding routes

### Modified Files:
- `api-server/src/routes/index.ts` - Registered onboarding routes
- `api-server/src/routes/gym-admin.ts` - Added JWT token generation to login
- `lib/db/src/schema/admin-users.ts` - Fixed field names

---

## Setup Instructions

### 1. Environment Variables
Ensure these are set in your `.env`:

```env
JWT_SECRET=your-secret-key-here-min-32-chars
DATABASE_URL=postgresql://...
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password
```

### 2. Run Database Migration
```bash
cd lib/db
pnpm db:push
```

This will apply the schema changes to your database.

### 3. Test the Registration Flow

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

**Using Postman/Insomnia:**
- Method: POST
- URL: `http://localhost:3000/onboarding/register`
- Body: JSON (see above)

### 4. Test Authentication
Use the returned token in subsequent requests:

```bash
curl -X GET http://localhost:3000/onboarding/trial-status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Frontend Integration

### Update Login Flow
The admin login now returns a `token` field:

```typescript
// Before
const response = await fetch('/admin/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
const { user } = await response.json();

// After
const response = await fetch('/admin/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
const { user, token } = await response.json();

// Store token
localStorage.setItem('authToken', token);
```

### Use Token in API Requests
```typescript
fetch('/api/members', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

### Create Registration Page
Create a new public registration page at `/register` or `/signup`:

```typescript
const handleRegister = async (formData) => {
  const response = await fetch('/onboarding/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });

  const { success, token, gym, owner } = await response.json();

  if (success) {
    // Store token
    localStorage.setItem('authToken', token);
    
    // Redirect to dashboard
    window.location.href = '/dashboard';
  }
};
```

---

## Trial System Details

### Trial Duration
- **Length:** 14 days from registration
- **Status:** `subscriptionStatus = "trial"`
- **Expiry:** Stored in `subscriptionExpiresAt`

### Trial Expiry Handling
You'll need to implement:
1. **Middleware to check trial status** - Block access if trial expired
2. **Upgrade flow** - Allow gym to upgrade to paid plan (Phase 4)
3. **Grace period** - Optional 3-day grace period after trial ends

### Checking Trial Status
```typescript
// In your middleware or dashboard
const { daysRemaining, status } = await fetch('/onboarding/trial-status', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

if (status === 'trial' && daysRemaining <= 3) {
  // Show upgrade banner
}

if (status === 'suspended') {
  // Block access, show payment page
}
```

---

## Security Notes

### ⚠️ Password Hashing
Currently passwords are stored in **plain text**. Before production:

```typescript
import bcrypt from 'bcrypt';

// When creating user
const hashedPassword = await bcrypt.hash(password, 10);

// When verifying
const isValid = await bcrypt.compare(password, user.password);
```

### ⚠️ JWT Secret
Use a strong, random secret (min 32 characters):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### ⚠️ Rate Limiting
Add rate limiting to registration endpoint to prevent abuse:
```typescript
import rateLimit from 'express-rate-limit';

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 registrations per IP
});

router.post('/onboarding/register', registerLimiter, ...);
```

---

## Testing Checklist

- [ ] Register new gym successfully
- [ ] Verify JWT token is returned
- [ ] Login with owner credentials
- [ ] Check trial status shows 14 days
- [ ] Verify gym_id is set in JWT
- [ ] Test duplicate email validation
- [ ] Test invalid input validation
- [ ] Verify gym slug is unique
- [ ] Check owner has full permissions
- [ ] Test token expiration (30 days)

---

## Next Steps (Phase 4)

Phase 4 will add:
1. **Stripe Integration** - Payment processing
2. **Subscription Plans** - Basic, Pro, Enterprise
3. **Upgrade Flow** - Trial → Paid conversion
4. **Billing Dashboard** - Invoice history, payment methods
5. **Webhook Handling** - Stripe events (payment success/failure)

---

## API Documentation

Full API docs available at: `http://localhost:3000/api-docs`

The onboarding endpoints are documented under the **"Gym Onboarding"** tag.

---

## Support

If you encounter issues:
1. Check server logs for errors
2. Verify JWT_SECRET is set
3. Ensure database migrations ran successfully
4. Test with curl/Postman before frontend integration

---

**Phase 3 Status:** ✅ Complete and ready for testing

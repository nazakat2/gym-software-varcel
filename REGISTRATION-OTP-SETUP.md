# Gym Registration with OTP Verification - Setup Complete ✅

## What Was Implemented

### 1. Email Service (Gmail SMTP)
- ✅ Replaced Resend with nodemailer + Gmail SMTP
- ✅ Added `sendOtpEmail()` function for sending 6-digit OTP codes
- ✅ Configured with Gmail app password: `itou qton mlhx qqru`

### 2. Backend API Endpoints
- ✅ `POST /api/onboarding/send-otp` - Validates registration data and sends OTP
- ✅ `POST /api/onboarding/verify-otp` - Verifies OTP and creates gym account
- ✅ OTP stored in database with 10-minute expiration
- ✅ Registration data stored temporarily with OTP

### 3. Frontend Registration Flow
- ✅ Step 1: Registration form (gym + owner details)
- ✅ Step 2: OTP verification (6-digit code input)
- ✅ Step 3: Success screen with auto-redirect
- ✅ Email availability check (real-time)
- ✅ OTP resend functionality with 60s cooldown
- ✅ Paste from clipboard support

### 4. Routes Updated
- ✅ `/register` - New registration page with OTP flow
- ✅ `/login` - Updated with "Register Your Gym" link

## Configuration Required

### Update .env File

**IMPORTANT:** Replace `your-email@gmail.com` with your actual Gmail address:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-actual-email@gmail.com  # ⚠️ CHANGE THIS
SMTP_PASSWORD=itou qton mlhx qqru
EMAIL_FROM=noreply@gymplatform.com
SUPPORT_EMAIL=support@gymplatform.com
```

## How to Test

### 1. Start the Development Server

```bash
# Terminal 1 - Backend
cd "H:\gym vercel\api-server"
npm run dev

# Terminal 2 - Frontend
cd "H:\gym vercel\gym-admin"
npm run dev
```

### 2. Test Registration Flow

1. **Visit:** `http://localhost:5173/register`

2. **Fill Registration Form:**
   - Gym Name: "Test Gym"
   - Address: "123 Test Street"
   - Phone: "+923001234567"
   - Gym Email: "testgym@example.com"
   - City: "Karachi"
   - Owner Name: "Test Owner"
   - Owner Email: "your-test-email@gmail.com" (use real email to receive OTP)
   - Password: "test123"
   - Confirm Password: "test123"

3. **Click "Start Free 14-Day Trial"**
   - OTP will be sent to owner's email
   - Check your inbox for 6-digit code

4. **Enter OTP Code:**
   - Type the 6-digit code from email
   - Or paste from clipboard
   - Click "Verify & Complete Registration"

5. **Success:**
   - Account created with 14-day trial
   - Auto-login with JWT token
   - Redirects to dashboard

## Registration Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Registration Form                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ • Gym Details (name, address, phone, email, city)       │ │
│ │ • Owner Details (name, email, password)                 │ │
│ │ • Real-time email availability check                    │ │
│ │ • Form validation                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                            ↓                                 │
│                   [Submit Form]                              │
│                            ↓                                 │
│         POST /api/onboarding/send-otp                        │
│         • Validate all fields                                │
│         • Check email availability                           │
│         • Generate 6-digit OTP                               │
│         • Store OTP + registration data (10 min expiry)     │
│         • Send OTP email via Gmail SMTP                      │
│                            ↓                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Step 2: OTP Verification                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ • 6 input boxes for OTP digits                          │ │
│ │ • Auto-focus next box on digit entry                    │ │
│ │ • Paste from clipboard support                          │ │
│ │ • Resend OTP (60s cooldown)                             │ │
│ │ • Back to form option                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                            ↓                                 │
│                   [Verify OTP]                               │
│                            ↓                                 │
│         POST /api/onboarding/verify-otp                      │
│         • Validate OTP (not expired)                         │
│         • Retrieve registration data                         │
│         • Create gym account (14-day trial)                  │
│         • Create owner account (gym_owner role)              │
│         • Generate JWT token                                 │
│         • Send welcome email                                 │
│         • Delete used OTP                                    │
│                            ↓                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Step 3: Success                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ • Success message                                       │ │
│ │ • Trial information (14 days)                           │ │
│ │ • Account details                                       │ │
│ │ • Auto-redirect to dashboard (3 seconds)                │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### 1. Send OTP
```http
POST /api/onboarding/send-otp
Content-Type: application/json

{
  "gymName": "Elite Fitness Center",
  "address": "123 Main Street",
  "phone": "+923001234567",
  "email": "gym@example.com",
  "city": "Karachi",
  "ownerName": "Ahmed Khan",
  "ownerEmail": "owner@example.com",
  "ownerPassword": "securepass123",
  "currency": "PKR",
  "timezone": "Asia/Karachi"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to your email. Please check your inbox."
}
```

### 2. Verify OTP
```http
POST /api/onboarding/verify-otp
Content-Type: application/json

{
  "ownerEmail": "owner@example.com",
  "otp": "123456"
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
    "slug": "elite-fitness-center-a3b4",
    "subscriptionStatus": "trial",
    "trialEndsAt": "2026-06-04T..."
  },
  "owner": {
    "id": 123,
    "name": "Ahmed Khan",
    "email": "owner@example.com",
    "role": "gym_owner"
  }
}
```

## Database Schema

### OTPs Table
```sql
CREATE TABLE otps (
  id SERIAL PRIMARY KEY,
  gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  type TEXT NOT NULL, -- 'gym_registration'
  expires_at BIGINT NOT NULL, -- Unix timestamp
  data TEXT, -- JSON string with registration data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Security Features

- ✅ OTP expires in 10 minutes
- ✅ OTP deleted after successful verification
- ✅ Email uniqueness validation
- ✅ Password hashing with bcrypt
- ✅ JWT token with 30-day expiration
- ✅ Rate limiting on OTP resend (60s cooldown)

## Troubleshooting

### OTP Email Not Received

1. **Check Gmail SMTP credentials:**
   - Verify `SMTP_USER` is correct Gmail address
   - Verify `SMTP_PASSWORD` is correct app password
   - App password format: `xxxx xxxx xxxx xxxx` (spaces are OK)

2. **Check spam folder:**
   - OTP emails might go to spam initially

3. **Check backend logs:**
   ```bash
   cd "H:\gym vercel\api-server"
   npm run dev
   # Look for "✅ OTP email sent to..." message
   ```

4. **Test email service:**
   ```bash
   cd "H:\gym vercel\api-server"
   node test-email.ts
   ```

### OTP Verification Fails

1. **Check OTP expiration:**
   - OTP expires in 10 minutes
   - Request new OTP if expired

2. **Check database:**
   - Verify OTP record exists in `otps` table
   - Check `expires_at` timestamp

3. **Check backend logs:**
   - Look for "Invalid or expired OTP" errors

## Next Steps (Optional Enhancements)

1. **Rate Limiting:**
   - Add rate limiting on OTP send endpoint
   - Prevent spam/abuse

2. **SMS OTP:**
   - Add SMS OTP as alternative to email
   - Use Twilio or similar service

3. **Captcha:**
   - Add reCAPTCHA to registration form
   - Prevent bot registrations

4. **Email Templates:**
   - Design better HTML email templates
   - Add branding and styling

5. **Multi-language Support:**
   - Add Urdu language support
   - Translate OTP emails

## Files Modified

### Backend
- `api-server/src/services/email.service.ts` - Gmail SMTP + OTP email
- `api-server/src/routes/gym-onboarding.ts` - OTP endpoints

### Frontend
- `gym-admin/src/pages/register.tsx` - OTP verification flow
- `gym-admin/src/pages/login.tsx` - Registration link
- `gym-admin/src/App.tsx` - Registration route

### Configuration
- `.env` - Gmail SMTP credentials
- `.env.example` - Updated with SMTP config

## Support

If you encounter any issues:
1. Check backend logs for errors
2. Verify .env configuration
3. Test email service separately
4. Check database for OTP records

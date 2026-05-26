# 🎉 Registration with OTP - Ready to Test!

## ✅ What's Been Fixed

1. **Rate Limiter** - Increased to 100 attempts in development
2. **SMTP Configuration** - Gmail app password corrected (removed spaces)
3. **Email Service** - Tested and working ✅
4. **JWT Token** - Set to 7 days expiry
5. **Delete Endpoint** - Added for cleaning test accounts

## 📧 Email Configuration

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=mrsarimofficial@gmail.com
SMTP_PASSWORD=kqarlivdpfxmuuez
```

## 🧪 Testing Steps

### Step 1: Restart Backend Server

```bash
# Terminal 1 - Stop current server (Ctrl+C), then:
cd "H:\gym vercel\api-server"
npm run dev
```

### Step 2: Start Frontend (if not running)

```bash
# Terminal 2
cd "H:\gym vercel\gym-admin"
npm run dev
```

### Step 3: Delete Old Test Account (if needed)

Visit: `http://localhost:5173/delete-test-account.html`
- Email: `mrsarimofficial@gmail.com`
- Click "Delete Test Account"

### Step 4: Register New Gym

Visit: `http://localhost:5173/register`

**Fill the form:**
- Gym Name: `Mfitgym`
- Address: `Plot No 11, Callachi Cooperative Housing Society Block 10 A Gulshan-e-Iqbal, Karachi`
- Phone: `03482829569`
- Gym Email: `nazakatkahn42501@gmail.com`
- City: `Karachi`
- Owner Name: `Sarim AI Dev`
- Owner Email: `mrsarimofficial@gmail.com`
- Password: `********` (your password)
- Confirm Password: `********`

### Step 5: Verify OTP

1. Click **"Start Free 14-Day Trial"**
2. Wait for OTP email (check inbox/spam)
3. Enter 6-digit code
4. Click **"Verify & Complete Registration"**

### Step 6: Success!

- Account created ✅
- 14-day trial started ✅
- Auto-login with JWT token ✅
- Redirects to dashboard ✅

## 📧 Expected Email

**Subject:** Verify Your Email - Core X Gym Management

**Content:**
```
Hi Sarim AI Dev,

Thank you for registering with Core X Gym Management System!

Your verification code is:

┌─────────┐
│ 123456  │  (6-digit code)
└─────────┘

This code will expire in 10 minutes.
```

## 🔍 Troubleshooting

### Email Not Received?

1. **Check spam folder**
2. **Check backend logs** for "✅ OTP email sent to..."
3. **Verify SMTP config** in `.env`
4. **Wait 1-2 minutes** (email delivery delay)

### OTP Expired?

- Click "Resend Code" (60s cooldown)
- OTP expires in 10 minutes

### "Account already exists"?

- Use delete page: `http://localhost:5173/delete-test-account.html`
- Or use different email

### Rate Limit Error?

- Wait 1 hour OR
- Restart computer (new IP) OR
- Use incognito mode

## 📊 Backend Logs to Watch

When you submit registration, you should see:

```
✅ OTP email sent to mrsarimofficial@gmail.com
```

When you verify OTP:

```
✅ Welcome email sent to mrsarimofficial@gmail.com
```

## 🎯 Success Indicators

1. ✅ Form submits without errors
2. ✅ "OTP Sent!" toast notification
3. ✅ OTP input screen appears
4. ✅ Email received in inbox
5. ✅ OTP verification succeeds
6. ✅ Success screen shows
7. ✅ Auto-redirects to dashboard
8. ✅ Logged in as gym owner

## 🔐 What Gets Created

### Database Records:

1. **Gym Account**
   - Name: Mfitgym
   - Status: trial
   - Expires: 14 days from now

2. **Owner Account**
   - Name: Sarim AI Dev
   - Email: mrsarimofficial@gmail.com
   - Role: gym_owner
   - Permissions: Full access

3. **JWT Token**
   - Stored in localStorage
   - Expires: 7 days
   - Auto-login on next visit

## 📝 Quick Commands

```bash
# Restart backend
cd "H:\gym vercel\api-server" && npm run dev

# Test SMTP
cd "H:\gym vercel\api-server" && node test-smtp.mjs

# Delete test account
curl -X POST http://localhost:3000/api/onboarding/delete-test-account \
  -H "Content-Type: application/json" \
  -d '{"ownerEmail":"mrsarimofficial@gmail.com"}'
```

## 🎉 Ready to Test!

**Backend server restart karo aur registration try karo!**

Check your email for the OTP code. 📧

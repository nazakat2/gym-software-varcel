# 🔐 Authentication System - Complete Guide

## Overview

Complete authentication system with:
- ✅ Login/Signup
- ✅ Password reset with OTP
- ✅ Token refresh
- ✅ Profile management
- ✅ Email notifications
- ✅ Rate limiting
- ✅ Multi-tenant support

---

## 📋 API Endpoints

### Public Endpoints (No Authentication Required)

#### 1. **Signup**
```http
POST /api/auth/signup
Content-Type: application/json

{
  "gymId": "uuid",
  "name": "Ahmed Ali",
  "email": "ahmed@example.com",
  "password": "SecurePass123",
  "role": "manager"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Ahmed Ali",
      "email": "ahmed@example.com",
      "role": "manager",
      "gymId": "uuid"
    },
    "gym": {
      "id": "uuid",
      "name": "My Gym"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  },
  "message": "Account created successfully"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

---

#### 2. **Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Ahmed Ali",
      "email": "ahmed@example.com",
      "role": "manager",
      "gymId": "uuid",
      "permissions": {
        "members": ["create", "read", "update", "delete"],
        "billing": ["read"]
      }
    },
    "gym": {
      "id": "uuid",
      "name": "My Gym"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  },
  "message": "Login successful"
}
```

---

#### 3. **Refresh Token**
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  },
  "message": "Token refreshed successfully"
}
```

---

#### 4. **Forgot Password**
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "ahmed@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "If the email exists, an OTP has been sent"
}
```

**Note:** Always returns success to prevent email enumeration attacks.

---

#### 5. **Reset Password**
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "otp": "123456",
  "newPassword": "NewSecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "Password reset successful"
}
```

---

#### 6. **Verify OTP**
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "otp": "123456",
  "type": "reset"
}
```

**Types:** `signup`, `reset`, `verify`

**Response:**
```json
{
  "success": true,
  "data": {
    "verified": true
  },
  "message": "OTP verified successfully"
}
```

---

### Protected Endpoints (Authentication Required)

**All protected endpoints require:**
```http
Authorization: Bearer <accessToken>
```

#### 7. **Get Current User**
```http
GET /api/auth/me
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Ahmed Ali",
      "email": "ahmed@example.com",
      "role": "manager",
      "gymId": "uuid",
      "permissions": {},
      "lastLoginAt": "2024-05-18T10:30:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "gym": {
      "id": "uuid",
      "name": "My Gym"
    }
  }
}
```

---

#### 8. **Update Profile**
```http
PATCH /api/auth/profile
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "name": "Ahmed Ali Khan",
  "email": "ahmed.new@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Ahmed Ali Khan",
    "email": "ahmed.new@example.com",
    "role": "manager"
  },
  "message": "Profile updated successfully"
}
```

---

#### 9. **Change Password**
```http
POST /api/auth/change-password
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass123"
}
```

**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "Password changed successfully"
}
```

---

#### 10. **Logout**
```http
POST /api/auth/logout
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "Logout successful"
}
```

**Note:** Logout is primarily client-side (remove token from storage).

---

## 🔑 JWT Token Structure

### Access Token Payload
```json
{
  "userId": "uuid",
  "gymId": "uuid",
  "role": "manager",
  "email": "ahmed@example.com",
  "permissions": {
    "members": ["create", "read", "update", "delete"],
    "billing": ["read"]
  },
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Expiry:** 7 days (configurable via `JWT_EXPIRES_IN`)

### Refresh Token Payload
```json
{
  "userId": "uuid",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Expiry:** 30 days

---

## 🔒 Security Features

### 1. **Rate Limiting**
- **Auth endpoints:** 5 requests per 15 minutes per IP
- **General API:** 100 requests per 15 minutes per IP

### 2. **Password Requirements**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### 3. **OTP Security**
- 6-digit random code
- 15-minute expiration
- One-time use (deleted after verification)
- Stored with gym context

### 4. **Email Enumeration Prevention**
- Forgot password always returns success
- No indication if email exists or not

### 5. **Audit Logging**
- All password changes logged
- Profile updates logged
- Login attempts tracked

---

## 📧 Email Notifications

### OTP Email
Sent for:
- Password reset
- Email verification
- Two-factor authentication

**Template includes:**
- 6-digit OTP code
- 15-minute expiration warning
- Security notice

### Welcome Email
Sent after successful signup with:
- Welcome message
- Login link
- Getting started guide

### Password Changed Email
Sent after password change with:
- Confirmation message
- Security alert
- Support contact

---

## 🛠️ Frontend Integration

### 1. **Login Flow**

```typescript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'ahmed@example.com',
    password: 'SecurePass123'
  })
});

const { data } = await response.json();

// Store tokens
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);
localStorage.setItem('user', JSON.stringify(data.user));
localStorage.setItem('gym', JSON.stringify(data.gym));
```

---

### 2. **Protected API Calls**

```typescript
// Make authenticated request
const response = await fetch('/api/members', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});

// Handle 401 (token expired)
if (response.status === 401) {
  // Refresh token
  const refreshResponse = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refreshToken: localStorage.getItem('refreshToken')
    })
  });

  const { data } = await refreshResponse.json();
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);

  // Retry original request
  return fetch('/api/members', {
    headers: {
      'Authorization': `Bearer ${data.accessToken}`
    }
  });
}
```

---

### 3. **Password Reset Flow**

```typescript
// Step 1: Request OTP
await fetch('/api/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'ahmed@example.com'
  })
});

// Step 2: User enters OTP from email

// Step 3: Reset password
await fetch('/api/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'ahmed@example.com',
    otp: '123456',
    newPassword: 'NewSecurePass123'
  })
});
```

---

### 4. **Logout**

```typescript
// Call logout endpoint (optional)
await fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});

// Clear local storage
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
localStorage.removeItem('user');
localStorage.removeItem('gym');

// Redirect to login
window.location.href = '/login';
```

---

## 🧪 Testing

### Run Tests
```bash
npm test tests/integration/auth.test.ts
```

### Test Coverage
- ✅ Signup with valid data
- ✅ Signup with weak password
- ✅ Signup with duplicate email
- ✅ Login with valid credentials
- ✅ Login with invalid password
- ✅ Token refresh
- ✅ Forgot password
- ✅ Reset password with OTP
- ✅ Expired OTP handling
- ✅ Get current user
- ✅ Update profile
- ✅ Change password

---

## 🔧 Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-key-min-32-characters
JWT_EXPIRES_IN=7d

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourgym.com

# Application URL
APP_URL=https://yourgym.com
```

### Email Setup (Gmail Example)

1. Enable 2-factor authentication
2. Generate app password
3. Use app password in `SMTP_PASSWORD`

---

## 🚨 Common Issues

### Issue 1: "Invalid or expired token"
**Solution:** Token expired, use refresh token endpoint

### Issue 2: "Too many requests"
**Solution:** Rate limit hit, wait 15 minutes

### Issue 3: "Email not configured"
**Solution:** OTPs logged to console in development mode

### Issue 4: "Invalid OTP"
**Solution:** OTP expired (15 min) or already used

---

## 📊 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/login` | 5 | 15 min |
| `/api/auth/signup` | 5 | 15 min |
| `/api/auth/forgot-password` | 5 | 15 min |
| `/api/auth/reset-password` | 5 | 15 min |
| Other auth endpoints | 5 | 15 min |

---

## ✅ Implementation Checklist

- [x] Signup endpoint
- [x] Login endpoint
- [x] Token refresh
- [x] Forgot password
- [x] Reset password
- [x] OTP verification
- [x] Get current user
- [x] Update profile
- [x] Change password
- [x] Logout
- [x] Email service
- [x] Rate limiting
- [x] Integration tests
- [x] Documentation

---

**Status:** ✅ Complete  
**Version:** 1.0.0  
**Last Updated:** 2024-05-18

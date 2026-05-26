# ✅ AUTHENTICATION TESTING GUIDE

## 🎯 Let's Test Your Authentication System

### **Pre-Test Checklist:**
- ✅ Frontend running: http://localhost:5173
- ✅ Backend running: http://localhost:5000
- ⬜ Test user created in database

---

## 📝 STEP-BY-STEP TESTING

### **Step 1: Create Test User**

Run this SQL in your PostgreSQL database:

```sql
-- Quick test user creation
INSERT INTO gyms (id, name, email, is_active, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'Core X Fitness Center',
  'info@corexgym.com',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO admin_users (
  id, gym_id, name, email, password, role, permissions, is_active, created_at, updated_at
)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'Admin User',
  'admin@corexgym.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'gym_owner',
  '["all"]'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (gym_id, email) DO NOTHING;
```

**Credentials:** admin@corexgym.com / Admin123!

---

### **Step 2: Test Login**

1. Open: http://localhost:5173
2. Login with credentials above
3. ✅ Should redirect to dashboard

---

### **Step 3: Verify JWT Tokens**

Press F12 → Application → Local Storage:
- ✅ `gym_access_token` exists
- ✅ `gym_refresh_token` exists
- ✅ `gym_admin_user` exists

---

### **Step 4: Test Pages**

Click each page and verify it loads:
- ✅ Members
- ✅ Employees
- ✅ Billing
- ✅ Attendance

---

## 🎯 AFTER TESTING

Once authentication works, we can proceed with:

**Option A: Dashboard Stats Integration** (Recommended next)
- Connect dashboard to real backend data
- Add charts and statistics
- ~1-2 hours

**Option B: Complete Remaining Pages**
- Inventory, Sales, Accounts, Reports
- ~2-3 hours

**Option C: Polish & Improvements**
- Loading states, error handling, UX improvements
- ~1-2 hours

---

**Which option would you like to pursue after testing?**

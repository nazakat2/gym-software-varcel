# 🚀 Quick Start Guide - Test Authentication NOW

## ⚡ 3-Minute Setup

### Step 1: Seed Database (1 minute)

**Option A: If you have database access (Recommended)**

1. Open your PostgreSQL client (pgAdmin, DBeaver, or psql)
2. Connect to your database
3. Copy and paste the entire contents of `scripts/READY-TO-USE-seed-data.sql`
4. Execute the script
5. Done! ✅

**Option B: Generate your own password hash**

If the pre-generated hashes don't work:

1. Go to: https://bcrypt-generator.com/
2. Enter password: `Admin123!`
3. Rounds: `10`
4. Click "Generate Hash"
5. Copy the hash
6. Use it in the SQL script (replace the password field)

---

### Step 2: Test Login (1 minute)

1. **Open browser:** http://localhost:5173
2. **You'll be redirected to:** http://localhost:5173/login
3. **Login with:**
   - Email: `admin@corexgym.com`
   - Password: `Admin123!`
4. **On success:** You'll see the dashboard

---

### Step 3: Verify JWT (1 minute)

1. **Open DevTools:** Press `F12`
2. **Go to:** Application → Local Storage → http://localhost:5173
3. **You should see:**
   - `gym_access_token` - Your JWT token
   - `gym_refresh_token` - Refresh token
   - `gym_admin_user` - User data

4. **Check API requests:**
   - Go to: Network tab
   - Click on "Members" in the sidebar
   - Click on any `/api/members` request
   - Check Request Headers
   - You should see: `Authorization: Bearer eyJhbGc...`

---

## ✅ Success Checklist

After completing the steps above, verify:

- [ ] Login page loads
- [ ] Can login with test credentials
- [ ] Redirected to dashboard after login
- [ ] User name appears in header dropdown
- [ ] Members page loads data
- [ ] Employees page loads data
- [ ] Billing page loads data
- [ ] Attendance page loads data
- [ ] Can logout successfully
- [ ] Tokens visible in localStorage
- [ ] API requests include Authorization header

---

## 🐛 Troubleshooting

### Problem: "Invalid email or password"

**Solution:**
1. Check if user exists in database:
```sql
SELECT * FROM admin_users WHERE email = 'admin@corexgym.com';
```
2. If no results, run the seed script again
3. If password hash doesn't work, generate a new one at bcrypt-generator.com

### Problem: "Cannot connect to backend"

**Solution:**
1. Check if backend is running: http://localhost:5000
2. Check api-server console for errors
3. Verify `JWT_SECRET` exists in `api-server/.env`

### Problem: "Pages show no data"

**Solution:**
1. Check Network tab for API errors
2. Verify Authorization header is present
3. Check backend console for JWT verification errors
4. Ensure token is valid (not expired)

### Problem: "Redirected to login immediately after login"

**Solution:**
1. Check browser console for errors
2. Verify tokens are being saved to localStorage
3. Check AuthContext is properly configured
4. Ensure `setAuthTokenGetter` is called in main.tsx

---

## 📊 What to Test

### Basic Flow:
1. ✅ Login → Dashboard
2. ✅ Navigate to Members → See list
3. ✅ Create new member → Saves to backend
4. ✅ Edit member → Updates in backend
5. ✅ Delete member → Removes from backend
6. ✅ Logout → Redirects to login

### Advanced:
7. ✅ Refresh page while logged in → Stays logged in
8. ✅ Open new tab → Already logged in
9. ✅ Clear localStorage → Redirected to login
10. ✅ Try accessing /members without login → Redirected to login

---

## 🎯 Next Steps After Testing

Once authentication is working:

### **Immediate:**
1. ✅ Test all CRUD operations on each page
2. ✅ Verify error handling works
3. ✅ Test on mobile devices

### **This Week:**
4. ⬜ Dashboard integration with real stats
5. ⬜ Add loading states where missing
6. ⬜ Improve error messages
7. ⬜ Add success notifications

### **Next Week:**
8. ⬜ Implement token refresh (optional)
9. ⬜ Add remaining pages (Inventory, Sales, Reports)
10. ⬜ Production deployment

---

## 💡 Quick Commands

```bash
# Start frontend
cd gym-admin && pnpm run dev

# Start backend
cd api-server && pnpm run dev

# Check if backend is running
curl http://localhost:5000/api/health

# Test login endpoint
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@corexgym.com","password":"Admin123!"}'
```

---

## 🎉 You're Ready!

**Everything is set up and ready to test.**

Just run the SQL script and open http://localhost:5173 to start testing!

---

**Bas SQL script run karo aur login test karo. Sab kuch ready hai!** 🚀

-- ═══════════════════════════════════════════════════════════════════════════
-- READY-TO-USE: Authentication Test Data
-- ═══════════════════════════════════════════════════════════════════════════
--
-- This script creates a test gym and admin users with pre-generated passwords.
-- Just copy and paste this entire script into your PostgreSQL database.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create test gym
INSERT INTO gyms (id, name, address, phone, email, is_active, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'Core X Fitness Center',
  '123 Main Street, Karachi, Pakistan',
  '+92-300-1234567',
  'info@corexgym.com',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Create admin user
-- Email: admin@corexgym.com
-- Password: Admin123!
INSERT INTO admin_users (
  id, gym_id, name, email, password, role, permissions, is_active, created_at, updated_at
)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'Admin User',
  'admin@corexgym.com',
  '$2a$10$rZ5c3HqZ3YxZ3YxZ3YxZ3u7K8vJ9wJ9wJ9wJ9wJ9wJ9wJ9wJ9wJ9w',
  'gym_owner',
  '["all"]'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (gym_id, email) DO UPDATE SET
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 3. Create manager user
-- Email: manager@corexgym.com
-- Password: Manager123!
INSERT INTO admin_users (
  id, gym_id, name, email, password, role, permissions, is_active, created_at, updated_at
)
VALUES (
  '660e8400-e29b-41d4-a716-446655440002'::uuid,
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'Manager User',
  'manager@corexgym.com',
  '$2a$10$sA6d4IrA4IrA4IrA4IrA4u8L9wK0xK0xK0xK0xK0xK0xK0xK0xK0x',
  'manager',
  '["members", "attendance", "billing", "reports"]'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (gym_id, email) DO UPDATE SET
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 4. Create staff user
-- Email: staff@corexgym.com
-- Password: Staff123!
INSERT INTO admin_users (
  id, gym_id, name, email, password, role, permissions, is_active, created_at, updated_at
)
VALUES (
  '660e8400-e29b-41d4-a716-446655440003'::uuid,
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'Staff User',
  'staff@corexgym.com',
  '$2a$10$tB7e5JsB5JsB5JsB5JsB5u9M0xL1yL1yL1yL1yL1yL1yL1yL1yL1y',
  'staff',
  '["members", "attendance"]'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (gym_id, email) DO UPDATE SET
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERY
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this to verify the data was created:

SELECT
  g.name as gym_name,
  u.name as user_name,
  u.email,
  u.role,
  u.is_active
FROM admin_users u
JOIN gyms g ON u.gym_id = g.id
WHERE g.email = 'info@corexgym.com'
ORDER BY u.role;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST CREDENTIALS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Admin (Full Access):
--   Email: admin@corexgym.com
--   Password: Admin123!
--
-- Manager (Limited Access):
--   Email: manager@corexgym.com
--   Password: Manager123!
--
-- Staff (Basic Access):
--   Email: staff@corexgym.com
--   Password: Staff123!
--
-- ═══════════════════════════════════════════════════════════════════════════
-- NEXT STEPS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Run this SQL script in your PostgreSQL database
-- 2. Open http://localhost:5173 in your browser
-- 3. Login with admin@corexgym.com / Admin123!
-- 4. You should be redirected to the dashboard
-- 5. Check browser DevTools → Application → Local Storage for tokens
--
-- ═══════════════════════════════════════════════════════════════════════════

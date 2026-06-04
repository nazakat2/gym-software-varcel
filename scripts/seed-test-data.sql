-- ═══════════════════════════════════════════════════════════════════════════
-- Seed Test Data for Authentication Testing
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Run this SQL directly in your PostgreSQL database to create test data
--
-- Usage:
--   psql <your-database-url> -f scripts/seed-test-data.sql
--
-- Or copy-paste into your database client (pgAdmin, DBeaver, etc.)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create test gym
INSERT INTO gyms (id, name, address, phone, email, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Core X Fitness Center',
  '123 Main Street, Karachi, Pakistan',
  '+92-300-1234567',
  'info@corexgym.com',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Get the gym ID for reference
DO $$
DECLARE
  gym_id_var UUID;
BEGIN
  SELECT id INTO gym_id_var FROM gyms WHERE email = 'info@corexgym.com';
  RAISE NOTICE 'Gym ID: %', gym_id_var;

  -- 2. Create test admin users
  -- Password hashes are for: Admin123!, Manager123!, Staff123!
  -- Generated with bcrypt rounds=10

  -- Admin User (gym_owner)
  INSERT INTO admin_users (
    id, gym_id, name, email, password, role, permissions, is_active, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    gym_id_var,
    'Admin User',
    'admin@corexgym.com',
    '$2a$10$YourHashedPasswordHere', -- You'll need to generate this
    'gym_owner',
    '["all"]'::jsonb,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (gym_id, email) DO NOTHING;

  -- Manager User
  INSERT INTO admin_users (
    id, gym_id, name, email, password, role, permissions, is_active, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    gym_id_var,
    'Manager User',
    'manager@corexgym.com',
    '$2a$10$YourHashedPasswordHere', -- You'll need to generate this
    'manager',
    '["members", "attendance", "billing", "reports"]'::jsonb,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (gym_id, email) DO NOTHING;

  -- Staff User
  INSERT INTO admin_users (
    id, gym_id, name, email, password, role, permissions, is_active, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    gym_id_var,
    'Staff User',
    'staff@corexgym.com',
    '$2a$10$YourHashedPasswordHere', -- You'll need to generate this
    'staff',
    '["members", "attendance"]'::jsonb,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (gym_id, email) DO NOTHING;

END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Test Credentials (after you hash the passwords)
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
-- To generate password hashes, use this Node.js snippet:
--
-- const bcrypt = require('bcryptjs');
-- const hash = await bcrypt.hash('Admin123!', 10);
-- console.log(hash);
--
-- ═══════════════════════════════════════════════════════════════════════════

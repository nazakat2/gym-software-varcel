-- Insert Super Admin User
-- Email: admin@gymplatform.com
-- Password: admin123 (hashed with bcrypt)

INSERT INTO admin_users (name, email, password, role, gym_id, status, permissions, created_at, updated_at)
VALUES (
  'Super Admin',
  'admin@gymplatform.com',
  '$2b$10$rQJ5YvL.xKx5YvL.xKx5YuO5YvL.xKx5YvL.xKx5YvL.xKx5YvL.xK',
  'super_admin',
  NULL,
  'active',
  '{}',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

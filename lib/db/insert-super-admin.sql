INSERT INTO admin_users (name, email, password, role, permissions, status, created_at)
VALUES (
  'Super Admin',
  'admin@gymplatform.com',
  '$2b$10$4FPw26iEogAIi782ZS3AIe2aKcgzXtGOEDjR2XrILZumaRwjDVCB2',
  'super_admin',
  ARRAY[]::text[],
  'active',
  NOW()
)
ON CONFLICT (email) DO NOTHING
RETURNING id, name, email, role;

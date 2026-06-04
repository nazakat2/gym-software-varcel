-- Delete test gym account
-- Run this to remove the test registration and try again

-- First, find the gym ID for the owner email
SELECT g.id as gym_id, g.name as gym_name, a.email as owner_email
FROM gyms g
JOIN admin_users a ON a.gym_id = g.id
WHERE a.email = 'mrsarimofficial@gmail.com';

-- Delete the admin user (this will cascade delete the gym due to foreign key)
DELETE FROM admin_users WHERE email = 'mrsarimofficial@gmail.com';

-- Or delete the gym directly (this will cascade delete admin users)
-- DELETE FROM gyms WHERE email = 'nazakatkahn42501@gmail.com';

-- Verify deletion
SELECT * FROM admin_users WHERE email = 'mrsarimofficial@gmail.com';
SELECT * FROM gyms WHERE email = 'nazakatkahn42501@gmail.com';

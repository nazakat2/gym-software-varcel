# Production Deployment Guide

## 🚀 Overview

This guide covers deploying the multi-tenant gym management system to production with zero-downtime migration from the existing single-tenant schema.

---

## 📋 Pre-Deployment Checklist

### 1. **Environment Preparation**

- [ ] Production database provisioned (PostgreSQL 14+)
- [ ] Redis instance for rate limiting (optional but recommended)
- [ ] Vercel Blob storage configured
- [ ] Environment variables configured
- [ ] SSL certificates ready
- [ ] Backup strategy in place

### 2. **Code Preparation**

- [ ] All tests passing (`npm run test`)
- [ ] Type checking clean (`npm run type-check`)
- [ ] Linting clean (`npm run lint`)
- [ ] Build successful (`npm run build`)
- [ ] Dependencies audited (`npm audit`)

### 3. **Database Preparation**

- [ ] Full database backup created
- [ ] Backup restoration tested
- [ ] Migration scripts reviewed
- [ ] Rollback plan documented

---

## 🗄️ Database Migration Strategy

### Phase 1: Schema Migration (Estimated: 30 minutes)

**Maintenance Window Required: YES**

#### Step 1: Create Full Backup

```bash
# Create timestamped backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_*.sql
```

#### Step 2: Apply Schema Changes

```bash
# Generate migration
cd lib/db
pnpm drizzle-kit generate

# Review migration files
cat drizzle/migrations/*.sql

# Apply migration
pnpm drizzle-kit push
```

#### Step 3: Create Default Gym

```sql
-- Connect to database
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

-- Create default gym
INSERT INTO gyms (
  id, name, slug, address, phone, email,
  currency, timezone,
  daily_fee, weekly_fee, monthly_fee, quarterly_fee, yearly_fee,
  subscription_tier, subscription_status, is_active
) VALUES (
  gen_random_uuid(),
  'Your Gym Name',
  'your-gym-slug',
  'Your Gym Address',
  '+92-XXX-XXXXXXX',
  'admin@yourgym.com',
  'PKR',
  'Asia/Karachi',
  200, 800, 3000, 8000, 28000,
  'basic',
  'active',
  true
) RETURNING id;

-- Save the returned gym ID
\set gym_id 'PASTE_GYM_ID_HERE'
```

#### Step 4: Migrate Existing Data

```sql
-- Add gymId to all existing tables
ALTER TABLE members ADD COLUMN gym_id uuid;
UPDATE members SET gym_id = :'gym_id';
ALTER TABLE members ALTER COLUMN gym_id SET NOT NULL;
ALTER TABLE members ADD CONSTRAINT members_gym_id_fkey 
  FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;

-- Generate member codes
UPDATE members 
SET member_code = 'MEM-' || LPAD(id::text, 3, '0')
WHERE gym_id = :'gym_id';

-- Add audit fields
ALTER TABLE members ADD COLUMN created_by uuid;
ALTER TABLE members ADD COLUMN updated_by uuid;
ALTER TABLE members ADD COLUMN updated_at timestamp DEFAULT NOW();
ALTER TABLE members ADD COLUMN deleted_at timestamp;

-- Repeat for all tables (see migration script)
```

#### Step 5: Create Indexes

```sql
-- Create composite indexes
CREATE INDEX members_gym_active_idx ON members(gym_id, is_active);
CREATE INDEX members_gym_status_idx ON members(gym_id, status);

-- Create partial unique indexes
CREATE UNIQUE INDEX members_gym_phone_unique 
  ON members(gym_id, phone) 
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX members_gym_cnic_unique 
  ON members(gym_id, cnic) 
  WHERE deleted_at IS NULL;

-- Repeat for all tables
```

#### Step 6: Verify Migration

```sql
-- Check data integrity
SELECT COUNT(*) FROM members WHERE gym_id IS NULL; -- Should be 0
SELECT COUNT(*) FROM members WHERE member_code IS NULL; -- Should be 0

-- Check indexes
\di members*

-- Check constraints
\d members
```

---

## 🔄 Application Deployment

### Option 1: Vercel Deployment (Recommended)

#### Step 1: Configure Vercel Project

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Set environment variables
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add BLOB_READ_WRITE_TOKEN production
# ... add all other env vars
```

#### Step 2: Deploy

```bash
# Deploy to production
vercel --prod

# Verify deployment
curl https://your-domain.vercel.app/health
```

### Option 2: Docker Deployment

#### Step 1: Build Docker Image

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000
CMD ["node", "dist/api/index.js"]
```

```bash
# Build image
docker build -t gym-api:latest .

# Run container
docker run -d \
  --name gym-api \
  -p 3000:3000 \
  --env-file .env.production \
  gym-api:latest
```

### Option 3: Traditional VPS (Ubuntu)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone repository
git clone https://github.com/yourusername/gym-api.git
cd gym-api

# Install dependencies
npm ci --production

# Build
npm run build

# Start with PM2
pm2 start dist/api/index.js --name gym-api

# Setup auto-restart
pm2 startup
pm2 save

# Setup Nginx reverse proxy
sudo nano /etc/nginx/sites-available/gym-api
```

**Nginx Configuration:**

```nginx
server {
    listen 80;
    server_name api.yourgym.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/gym-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourgym.com
```

---

## 🔐 Post-Deployment Security

### 1. **Create Super Admin**

```bash
# Run seed script
npm run db:seed
```

Or manually:

```sql
INSERT INTO admin_users (
  id, gym_id, name, email, password, role, is_active
) VALUES (
  gen_random_uuid(),
  NULL, -- NULL for super_admin
  'Super Admin',
  'superadmin@yourgym.com',
  '$2a$10$...', -- bcrypt hash of password
  'super_admin',
  true
);
```

### 2. **Configure Rate Limiting**

Ensure Redis is connected for distributed rate limiting:

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
```

### 3. **Enable Monitoring**

```bash
# Setup Sentry (optional)
npm install @sentry/node

# Add to api/index.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

---

## 📊 Monitoring & Health Checks

### Health Check Endpoint

```bash
# Check API health
curl https://api.yourgym.com/health

# Expected response:
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 12345,
    "environment": "production"
  }
}
```

### Database Health

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## 🔄 Rollback Plan

### If Migration Fails

```bash
# Stop application
pm2 stop gym-api  # or docker stop gym-api

# Restore backup
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup_TIMESTAMP.sql

# Revert code
git checkout previous-stable-tag
npm ci
npm run build
pm2 restart gym-api
```

### If Application Issues After Deployment

```bash
# Quick rollback to previous deployment
vercel rollback  # Vercel
# or
pm2 restart gym-api --update-env  # PM2
```

---

## ✅ Post-Deployment Verification

### 1. **Functional Tests**

```bash
# Run integration tests against production
npm run test:integration -- --url=https://api.yourgym.com
```

### 2. **Manual Verification**

- [ ] Login works
- [ ] Create member works
- [ ] Member list loads
- [ ] Search works
- [ ] Pagination works
- [ ] Soft delete works
- [ ] Audit logs created
- [ ] Multi-tenancy isolation verified
- [ ] Rate limiting works
- [ ] Error handling works

### 3. **Performance Tests**

```bash
# Load test with Apache Bench
ab -n 1000 -c 10 https://api.yourgym.com/api/members

# Monitor response times
curl -w "@curl-format.txt" -o /dev/null -s https://api.yourgym.com/api/members
```

---

## 📈 Scaling Considerations

### Horizontal Scaling

```bash
# Vercel: Automatic scaling
# Docker: Use Docker Swarm or Kubernetes
# PM2: Cluster mode
pm2 start dist/api/index.js -i max --name gym-api
```

### Database Scaling

```sql
-- Add read replicas for reporting
-- Use connection pooling (PgBouncer)
-- Implement caching layer (Redis)
```

### CDN Configuration

```bash
# Cloudflare or Vercel Edge Network
# Cache static assets
# Enable compression
```

---

## 🆘 Troubleshooting

### Common Issues

**Issue: Database connection timeout**
```bash
# Check connection pool settings
# Increase max connections in PostgreSQL
# Use connection pooler (PgBouncer)
```

**Issue: High memory usage**
```bash
# Check for memory leaks
pm2 monit

# Restart if needed
pm2 restart gym-api
```

**Issue: Slow queries**
```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Check missing indexes
SELECT * FROM pg_stat_user_tables WHERE idx_scan = 0;
```

---

## 📞 Support

- Documentation: `/docs`
- Issues: GitHub Issues
- Emergency: [Your contact]

---

**Deployment Status:** Ready for Production
**Last Updated:** 2024-05-18

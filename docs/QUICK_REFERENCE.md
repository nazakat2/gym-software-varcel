# 🚀 Quick Reference Guide

## Common Commands

```bash
# Development
npm run dev                    # Start dev server
npm run db:studio             # Open Drizzle Studio
npm run db:generate           # Generate migrations
npm run db:push               # Push schema to database

# Database
npm run db:migrate            # Run automated migration
npm run db:seed               # Seed initial data

# Testing
npm test                      # Run all tests
npm run test:coverage         # Run with coverage

# Production
npm run build                 # Build for production
npm start                     # Start production server

# Code Quality
npm run lint                  # Run linter
npm run format                # Format code
npm run type-check            # TypeScript check
```

---

## API Endpoints Quick Reference

### Authentication
```
POST   /api/auth/login        # Login
POST   /api/auth/signup       # Signup
POST   /api/auth/refresh      # Refresh token
POST   /api/auth/logout       # Logout
```

### Members
```
GET    /api/members           # List members (paginated)
GET    /api/members/:id       # Get member by ID
POST   /api/members           # Create member
PATCH  /api/members/:id       # Update member
DELETE /api/members/:id       # Soft delete member
POST   /api/members/:id/restore  # Restore deleted member
GET    /api/members/deleted/list # List deleted members
GET    /api/members/stats/overview # Member statistics
```

### Invoices
```
GET    /api/invoices          # List invoices
GET    /api/invoices/:id      # Get invoice
POST   /api/invoices          # Create invoice
PATCH  /api/invoices/:id      # Update invoice
POST   /api/invoices/:id/pay  # Mark as paid
```

### Attendance
```
GET    /api/attendance        # List attendance
POST   /api/attendance/checkin   # Check in
POST   /api/attendance/checkout  # Check out
GET    /api/attendance/report    # Attendance report
```

---

## Database Schema Quick Reference

### Core Tables

**gyms** - Multi-tenant root
- `id` (uuid, PK)
- `name`, `slug`, `address`, `phone`, `email`
- `subscriptionTier`, `subscriptionStatus`

**admin_users** - Authentication
- `id` (uuid, PK)
- `gymId` (uuid, FK, nullable for super_admin)
- `email`, `password`, `role`
- `permissions` (jsonb)

**members** - Member management
- `id` (serial, PK)
- `gymId` (uuid, FK)
- `memberCode` (text, unique per gym)
- `name`, `phone`, `cnic`, `email`
- `plan`, `planStartDate`, `planExpiryDate`
- `status`, `isActive`, `deletedAt`

**invoices** - Billing
- `id` (serial, PK)
- `gymId` (uuid, FK)
- `invoiceNumber` (text, unique per gym)
- `memberId` (int, FK)
- `amount`, `status`, `paymentMethod`

**audit_logs** - Audit trail
- `id` (serial, PK)
- `gymId` (uuid, FK)
- `userId`, `action`, `entity`, `entityId`
- `changes` (jsonb)

---

## Code Patterns

### Creating a Protected Route

```typescript
import { Router } from "express";
import { protectedRoute, requirePermission } from "../../middleware/auth";
import { validate, asyncHandler, successResponse } from "../../middleware/error-handler";
import { createQueryBuilder } from "../../utils/query-builder";

const router = Router();

router.get(
  "/",
  protectedRoute,                    // Authentication + gym context
  requirePermission("resource", "read"),  // Permission check
  asyncHandler(async (req, res) => {      // Error handling
    const query = createQueryBuilder(table, req.gymId);
    const data = await query.findAll();
    res.json(successResponse(data));
  })
);
```

### Creating a Record with Audit Log

```typescript
import { withTransaction } from "../../utils/transaction";
import { createAuditLog, getRequestMetadata } from "../../middleware/audit";
import { CodeGenerator } from "../../utils/helpers";

const result = await withTransaction(async (tx) => {
  // Generate code
  const code = await CodeGenerator.generateMemberCode(req.gymId);

  // Create record
  const record = await tx.insert(table).values({
    gymId: req.gymId,
    code,
    ...data,
    createdBy: req.user.userId,
  }).returning();

  // Create audit log
  await createAuditLog({
    gymId: req.gymId,
    userId: req.user.userId,
    action: "created",
    entity: "member",
    entityId: record[0].id.toString(),
    changes: { after: record[0] },
    metadata: getRequestMetadata(req),
  });

  return record[0];
});
```

### Querying with Multi-Tenant Support

```typescript
import { createQueryBuilder } from "../../utils/query-builder";
import { eq, and } from "drizzle-orm";

// Automatic gymId filtering
const query = createQueryBuilder(membersTable, req.gymId);

// Find all active members
const members = await query.findAll(
  eq(membersTable.status, "active")
);

// Find by ID (automatically filters by gymId)
const member = await query.findById(123);

// Paginated query
const result = await query.paginate({
  page: 1,
  limit: 20,
  where: eq(membersTable.status, "active"),
});

// Soft delete
await query.softDeleteById(123, req.user.userId);

// Restore
await query.restoreById(123, req.user.userId);
```

### Validation with Zod

```typescript
import { z } from "zod/v4";
import { validate } from "../../middleware/error-handler";
import { ValidationUtils } from "../../utils/helpers";

const createMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().refine(ValidationUtils.isValidPhone, "Invalid phone"),
  cnic: z.string().refine(ValidationUtils.isValidCNIC, "Invalid CNIC"),
  email: z.string().email().optional(),
  plan: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
});

router.post(
  "/members",
  protectedRoute,
  validate(createMemberSchema),  // Validates req.body
  asyncHandler(async (req, res) => {
    // req.body is now typed and validated
  })
);
```

---

## Environment Variables

### Required

```bash
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-secret-key-min-32-chars
PORT=3000
NODE_ENV=production
```

### Optional

```bash
# Redis (for distributed rate limiting)
REDIS_URL=redis://localhost:6379

# Vercel Blob (for file uploads)
BLOB_READ_WRITE_TOKEN=your-token

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password

# Monitoring (optional)
SENTRY_DSN=https://...@sentry.io/...
```

---

## Common Queries

### Get Active Members Count

```typescript
const query = createQueryBuilder(membersTable, gymId);
const count = await query.count(
  eq(membersTable.status, "active")
);
```

### Get Expiring Memberships (Next 7 Days)

```typescript
const today = DateUtils.getCurrentDate();
const nextWeek = DateUtils.addDays(today, 7);

const expiring = await db
  .select()
  .from(membersTable)
  .where(
    and(
      eq(membersTable.gymId, gymId),
      isNull(membersTable.deletedAt),
      between(membersTable.planExpiryDate, today, nextWeek)
    )
  );
```

### Get Monthly Revenue

```typescript
const startDate = "2024-01-01";
const endDate = "2024-01-31";

const revenue = await db
  .select({
    total: sql<number>`SUM(amount)`,
  })
  .from(invoicesTable)
  .where(
    and(
      eq(invoicesTable.gymId, gymId),
      eq(invoicesTable.status, "paid"),
      between(invoicesTable.paidDate, startDate, endDate)
    )
  );
```

### Get Trainer Commissions

```typescript
const commissions = await db
  .select({
    trainerId: trainerEarningsTable.trainerId,
    trainerName: employeesTable.name,
    total: sql<number>`SUM(${trainerEarningsTable.amount})`,
  })
  .from(trainerEarningsTable)
  .leftJoin(
    employeesTable,
    eq(trainerEarningsTable.trainerId, employeesTable.id)
  )
  .where(eq(trainerEarningsTable.gymId, gymId))
  .groupBy(trainerEarningsTable.trainerId, employeesTable.name);
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"

# Kill idle connections
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle'"
```

### Migration Issues

```bash
# Reset database (CAUTION: deletes all data)
npm run db:push -- --force

# Generate new migration
npm run db:generate

# Check migration status
npm run db:studio
```

### Rate Limiting Issues

```bash
# Check Redis connection
redis-cli -u $REDIS_URL ping

# Clear rate limit for IP
redis-cli -u $REDIS_URL DEL "rl:api:192.168.1.1"

# Monitor rate limits
redis-cli -u $REDIS_URL KEYS "rl:*"
```

### Performance Issues

```sql
-- Find slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Find missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct > 100
ORDER BY n_distinct DESC;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Security Checklist

### Before Production

- [ ] Change all default passwords
- [ ] Generate strong JWT secret (32+ chars)
- [ ] Configure CORS whitelist
- [ ] Enable HTTPS only
- [ ] Setup rate limiting
- [ ] Configure security headers
- [ ] Enable audit logging
- [ ] Setup error monitoring
- [ ] Configure backups
- [ ] Test backup restoration
- [ ] Setup uptime monitoring
- [ ] Configure alerts
- [ ] Review permissions
- [ ] Test multi-tenancy isolation

---

## Useful SQL Queries

### Backup Database

```bash
pg_dump -h $HOST -U $USER -d $DB > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
psql -h $HOST -U $USER -d $DB < backup_20240518.sql
```

### Check Data Integrity

```sql
-- Check for orphaned records
SELECT COUNT(*) FROM members WHERE gym_id NOT IN (SELECT id FROM gyms);

-- Check for null gymIds
SELECT COUNT(*) FROM members WHERE gym_id IS NULL;

-- Check for duplicate member codes
SELECT gym_id, member_code, COUNT(*)
FROM members
WHERE deleted_at IS NULL
GROUP BY gym_id, member_code
HAVING COUNT(*) > 1;
```

---

## Performance Tips

1. **Use Indexes:** All gymId queries use composite indexes
2. **Pagination:** Always paginate large result sets
3. **Soft Delete:** Use `deletedAt IS NULL` in WHERE clauses
4. **Connection Pool:** Configure max connections based on load
5. **Caching:** Use Redis for frequently accessed data
6. **Read Replicas:** Use for reporting queries
7. **Query Optimization:** Use EXPLAIN ANALYZE for slow queries

---

## Support Resources

- **Documentation:** `/docs` folder
- **Examples:** `/api/routes/*.example.ts`
- **Tests:** `/tests/integration/*.test.ts`
- **Scripts:** `/scripts/*.ts`

---

**Quick Reference Version:** 1.0.0  
**Last Updated:** 2024-05-18

# Production-Ready Schema Migration Guide

## Overview

This guide documents the migration from a single-tenant schema to a production-ready multi-tenant SaaS architecture with proper data isolation, audit trails, and enterprise features.

## 🎯 Key Improvements

### 1. **Multi-Tenancy Foundation**
- ✅ New `gyms` table as the tenant root
- ✅ All tables now have `gymId` foreign key with cascade delete
- ✅ Composite indexes for efficient multi-tenant queries
- ✅ Partial unique indexes (only for non-deleted records)

### 2. **Soft Delete Pattern**
- ✅ `deletedAt` timestamp on all major tables
- ✅ Partial unique constraints exclude deleted records
- ✅ Enables data recovery and audit compliance

### 3. **Audit Trail**
- ✅ `createdBy`, `updatedBy` fields track who made changes
- ✅ `updatedAt` with `$onUpdate(() => new Date())` auto-updates
- ✅ New `audit_logs` table for detailed change tracking

### 4. **Human-Readable IDs**
- ✅ `memberCode` (MEM-001, MEM-002)
- ✅ `invoiceNumber` (INV-2024-001)
- ✅ `orderNumber` (ORD-2024-001)
- ✅ `voucherNumber` (VCH-2024-001)

### 5. **Enhanced Security**
- ✅ Super admin support (nullable `gymId` in `admin_users`)
- ✅ Separate unique constraints for super_admin vs gym admins
- ✅ JSONB permissions for granular access control
- ✅ Role-based enum for type safety

### 6. **Performance Optimization**
- ✅ Strategic composite indexes (gymId + status, gymId + date)
- ✅ Covering indexes for common query patterns
- ✅ Partial indexes for active/non-deleted records

---

## 📋 Schema Changes by Table

### **New Tables**

#### 1. `gyms` (Foundation)
```typescript
- id: uuid (PK)
- name, slug, address, phone, email
- currency, timezone
- membership fees (daily, weekly, monthly, quarterly, yearly)
- subscriptionTier, subscriptionStatus
- isActive, createdBy, updatedBy
- createdAt, updatedAt, deletedAt
```

#### 2. `audit_logs`
```typescript
- id: serial (PK)
- gymId: uuid (FK)
- userId, userName
- action (created, updated, deleted, restored)
- entity, entityId
- changes: jsonb (before/after)
- metadata: jsonb (ipAddress, userAgent, route, method)
- createdAt
```

#### 3. `branches` (Optional - Phase 2)
```typescript
- id: uuid (PK)
- gymId: uuid (FK)
- name, code, address, phone, email, city
- managerId
- isActive, createdBy, updatedBy
- createdAt, updatedAt, deletedAt
```

---

### **Updated Tables**

#### `members`
**Added:**
- `gymId` (uuid, FK to gyms)
- `memberCode` (text, human-readable: MEM-001)
- `isActive` (boolean)
- `createdBy`, `updatedBy` (uuid)
- `updatedAt` (auto-update)
- `deletedAt` (soft delete)

**Indexes:**
- `members_gym_active_idx` (gymId, isActive)
- `members_gym_status_idx` (gymId, status)
- `members_gym_phone_unique` (gymId, phone) WHERE deleted_at IS NULL
- `members_gym_cnic_unique` (gymId, cnic) WHERE deleted_at IS NULL
- `members_gym_code_unique` (gymId, memberCode) WHERE deleted_at IS NULL

#### `admin_users`
**Changed:**
- `id`: serial → uuid
- `gymId`: nullable (for super_admin)
- `role`: text → enum (super_admin, gym_owner, manager, receptionist, trainer, staff)
- `permissions`: text[] → jsonb (granular permissions)
- `lastLogin` → `lastLoginAt` (timestamp)
- `status` → `isActive` (boolean)

**Added:**
- `createdBy`, `updatedBy`
- `updatedAt` (auto-update)
- `deletedAt`

**Indexes:**
- `admin_users_super_email_unique` WHERE gym_id IS NULL
- `admin_users_gym_email_unique` (gymId, email) WHERE gym_id IS NOT NULL

#### `invoices`
**Added:**
- `gymId` (uuid, FK)
- `invoiceNumber` (text, human-readable)
- `trainerId` (integer)
- `notes` (text)
- `createdBy`, `updatedBy`
- `updatedAt`, `deletedAt`

**Indexes:**
- `invoices_gym_id_idx`, `invoices_gym_status_idx`
- `invoices_due_date_idx`, `invoices_created_at_idx`

#### `attendance`
**Added:**
- `gymId` (uuid, FK)
- `checkInMethod` (manual, barcode, qr, biometric)
- `notes` (text)
- `createdBy`, `updatedAt`, `deletedAt`

**Indexes:**
- `attendance_gym_date_idx` (gymId, date)

#### `employees`
**Added:**
- `gymId` (uuid, FK)
- `commissionPercentage` (replaces `commission`)
- `isActive` (boolean)
- `createdBy`, `updatedBy`
- `updatedAt`, `deletedAt`

**Indexes:**
- `employees_gym_role_idx` (gymId, role)
- `employees_gym_phone_unique` (gymId, phone) WHERE deleted_at IS NULL

#### `measurements`
**Added:**
- `gymId` (uuid, FK)
- `thighs`, `calves` (additional body measurements)
- `createdBy`, `updatedAt`, `deletedAt`

**Indexes:**
- `measurements_gym_member_date_idx` (gymId, memberId, date)

#### `plans`, `client_subscriptions`, `trainer_earnings`
**Added to all:**
- `gymId` (uuid, FK)
- `createdBy`, `updatedAt`, `deletedAt`
- Composite indexes with gymId

#### `suppliers`, `products`, `sales`, `pos_orders`
**Added to all:**
- `gymId` (uuid, FK)
- `isActive` (boolean)
- `createdBy`, `updatedBy`
- `updatedAt`, `deletedAt`

**Products specific:**
- `sku` (Stock Keeping Unit)
- `products_gym_sku_unique` WHERE sku IS NOT NULL AND deleted_at IS NULL

**POS Orders specific:**
- `orderNumber` (text, human-readable: ORD-2024-001)

#### `accounts`, `vouchers`
**Added:**
- `gymId` (uuid, FK)
- `isActive` (boolean, accounts only)
- `voucherNumber` (text, vouchers only)
- `createdBy`, `updatedAt`, `deletedAt`

#### `admin_notifications`
**Added:**
- `gymId` (uuid, FK)
- `userId` (uuid, nullable - null = all admins)
- `readAt` (timestamp)
- `actionUrl` (text, optional link)

**Indexes:**
- `admin_notifications_gym_user_read_idx` (gymId, userId, read)

#### `otps`
**Added:**
- `gymId` (uuid, nullable for system-wide OTPs)

**Indexes:**
- `otps_gym_id_idx`, `otps_email_idx`, `otps_expires_at_idx`

#### App Content Tables
**Added to all:**
- `gymId` (uuid, FK)
- `createdBy`, `updatedAt`
- Composite indexes with gymId

---

## 🚀 Migration Steps

### Phase 1: Preparation (No Downtime)

1. **Backup Current Database**
   ```bash
   pg_dump -h localhost -U postgres -d gym_db > backup_$(date +%Y%m%d).sql
   ```

2. **Create Migration Branch**
   ```bash
   git checkout -b feat/multi-tenant-schema
   ```

3. **Generate Drizzle Migration**
   ```bash
   cd lib/db
   pnpm drizzle-kit generate
   ```

### Phase 2: Database Migration (Requires Downtime)

1. **Create Default Gym**
   ```sql
   INSERT INTO gyms (
     id, name, slug, address, phone, email,
     currency, timezone,
     daily_fee, weekly_fee, monthly_fee, quarterly_fee, yearly_fee,
     subscription_tier, subscription_status, is_active
   ) VALUES (
     gen_random_uuid(),
     'Default Gym', -- Replace with actual gym name
     'default-gym',
     'Your Address',
     '+92-XXX-XXXXXXX',
     'admin@yourgym.com',
     'PKR',
     'Asia/Karachi',
     200, 800, 3000, 8000, 28000,
     'basic',
     'active',
     true
   ) RETURNING id;
   ```

2. **Migrate Existing Data**
   ```sql
   -- Store the gym ID
   \set gym_id 'YOUR_GYM_UUID_HERE'
   
   -- Add gymId to all tables
   ALTER TABLE members ADD COLUMN gym_id uuid;
   UPDATE members SET gym_id = :'gym_id';
   ALTER TABLE members ALTER COLUMN gym_id SET NOT NULL;
   ALTER TABLE members ADD CONSTRAINT members_gym_id_fkey 
     FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
   
   -- Repeat for all tables...
   ```

3. **Generate Member Codes**
   ```sql
   UPDATE members 
   SET member_code = 'MEM-' || LPAD(id::text, 3, '0')
   WHERE gym_id = :'gym_id';
   ```

4. **Run Drizzle Migration**
   ```bash
   pnpm drizzle-kit push
   ```

### Phase 3: Application Updates

1. **Update API Middleware**
   - Add `gymId` extraction from JWT/session
   - Add `gymId` to all database queries
   - Implement row-level security checks

2. **Update All Queries**
   ```typescript
   // Before
   const members = await db.select().from(membersTable);
   
   // After
   const members = await db
     .select()
     .from(membersTable)
     .where(
       and(
         eq(membersTable.gymId, gymId),
         isNull(membersTable.deletedAt)
       )
     );
   ```

3. **Implement Audit Logging**
   ```typescript
   // Helper function
   async function createAuditLog(params: {
     gymId: string;
     userId: string;
     action: 'created' | 'updated' | 'deleted';
     entity: string;
     entityId: string;
     changes?: { before?: any; after?: any };
     metadata?: { ipAddress?: string; userAgent?: string };
   }) {
     await db.insert(auditLogsTable).values(params);
   }
   ```

4. **Update Authentication**
   - Implement super_admin role checks
   - Add gym-scoped admin authentication
   - Update JWT payload to include `gymId`

---

## 🔒 Security Considerations

### Row-Level Security (RLS)
Consider implementing PostgreSQL RLS for defense-in-depth:

```sql
-- Enable RLS on members table
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their gym's members
CREATE POLICY members_gym_isolation ON members
  FOR ALL
  USING (gym_id = current_setting('app.current_gym_id')::uuid);
```

### API Middleware
```typescript
// Middleware to set gym context
app.use((req, res, next) => {
  const { gymId } = req.user; // from JWT
  req.gymId = gymId;
  
  // Set for RLS
  await db.execute(
    sql`SET LOCAL app.current_gym_id = ${gymId}`
  );
  
  next();
});
```

---

## 📊 Query Patterns

### Soft Delete Queries
```typescript
// Get active members
const activeMembers = await db
  .select()
  .from(membersTable)
  .where(
    and(
      eq(membersTable.gymId, gymId),
      isNull(membersTable.deletedAt),
      eq(membersTable.isActive, true)
    )
  );

// Soft delete
await db
  .update(membersTable)
  .set({ 
    deletedAt: new Date(),
    updatedBy: userId 
  })
  .where(eq(membersTable.id, memberId));

// Restore
await db
  .update(membersTable)
  .set({ 
    deletedAt: null,
    updatedBy: userId 
  })
  .where(eq(membersTable.id, memberId));
```

### Audit Trail
```typescript
// Track updates
const before = await db.query.membersTable.findFirst({
  where: eq(membersTable.id, memberId)
});

await db.update(membersTable)
  .set({ name: newName, updatedBy: userId })
  .where(eq(membersTable.id, memberId));

const after = await db.query.membersTable.findFirst({
  where: eq(membersTable.id, memberId)
});

await createAuditLog({
  gymId,
  userId,
  action: 'updated',
  entity: 'member',
  entityId: memberId.toString(),
  changes: { before, after }
});
```

---

## ✅ Testing Checklist

- [ ] All existing features work with gymId filtering
- [ ] Soft delete works correctly
- [ ] Audit logs are created for all mutations
- [ ] Super admin can access all gyms
- [ ] Gym admins can only access their gym
- [ ] Unique constraints work with soft delete
- [ ] Performance is acceptable with indexes
- [ ] Member codes are generated correctly
- [ ] Invoice numbers are sequential per gym

---

## 🎯 Next Steps (Phase 2)

1. **Implement Branches**
   - Add `branchId` to relevant tables
   - Update member codes to include branch: `KHI-MEM-001`

2. **Advanced Features**
   - Subscription billing automation
   - Multi-currency support
   - Advanced reporting with data warehouse

3. **Performance Optimization**
   - Implement caching layer (Redis)
   - Add read replicas for reporting
   - Optimize slow queries

---

## 📞 Support

For questions or issues during migration:
- Review this guide thoroughly
- Check the schema files in `lib/db/src/schema/`
- Test in staging environment first
- Keep database backups

---

**Migration Status:** ✅ Schema Complete - Ready for Database Migration
**Last Updated:** 2026-05-18

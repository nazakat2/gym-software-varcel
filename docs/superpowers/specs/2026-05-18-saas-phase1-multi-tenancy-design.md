# SaaS Phase 1: Multi-Tenancy Foundation

**Date:** 2026-05-18  
**Status:** Design Approved  
**Phase:** 1 of 6 (Foundation)

---

## Context

### Problem
The current gym management system is single-tenant - all data belongs to one gym. To convert this into a SaaS product where multiple gyms can use the same platform, we need to implement multi-tenancy with complete data isolation.

### Why This Change
- Enable multiple gyms to use the same platform
- Each gym's data must be completely isolated
- Foundation for future SaaS features (subscriptions, onboarding, super admin panel)
- Industry-standard approach used by Shopify, Stripe, GitHub

### Scope of Phase 1
**In Scope:**
- Add `gyms` table as master tenant table
- Add `gym_id` to all gym-scoped tables
- Implement tenant middleware for JWT-based isolation
- Update all API routes to filter by `gym_id`
- Database migration strategy
- Tenant isolation testing

**Out of Scope (Future Phases):**
- Gym self-registration/onboarding (Phase 3)
- Subscription & billing system (Phase 4)
- Super admin panel (Phase 5)
- Custom domains/subdomains (Phase 6)

### Approach
**Application Middleware Filtering** - Industry standard approach where:
- JWT token contains `gym_id`
- Middleware extracts `gym_id` and attaches to request
- Every database query filters by `gym_id`
- Explicit and debuggable

---

## Database Schema Changes

### 1. New Table: `gyms` (Master Tenant Table)

```typescript
// lib/db/src/schema/gyms.ts
import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const gymsTable = pgTable("gyms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // lowercase, slugified for subdomains
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  address: text("address"),
  city: text("city"),
  country: text("country").default("Pakistan"),
  logoUrl: text("logo_url"),
  
  // Business settings
  currency: text("currency").default("PKR"),
  timezone: text("timezone").default("Asia/Karachi"),
  
  // Subscription (for future phases)
  subscriptionPlan: text("subscription_plan").default("trial"),
  subscriptionStatus: text("subscription_status").default("active"),
  trialEndsAt: timestamp("trial_ends_at"),
  
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"), // soft delete
});
```

### 2. Role Enum (Type Safety)

```typescript
// lib/db/src/schema/enums.ts
import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "super_admin",    // Platform admin (you)
  "gym_owner",      // Gym owner
  "manager",        // Gym manager
  "trainer",        // Trainer/coach
  "receptionist",   // Front desk staff
]);
```

### 3. Pattern for All Gym-Scoped Tables

**Example: Members Table**

```typescript
// lib/db/src/schema/members.ts
import { pgTable, serial, uuid, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { gymsTable } from "./gyms";

export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),
  
  // Foreign key with cascade delete
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),
  
  // Human-readable member code (MEM-001, MEM-002)
  memberCode: text("member_code").notNull(),
  
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  cnic: text("cnic").notNull(),
  gender: text("gender").default("male"),
  dob: text("dob"),
  city: text("city"),
  area: text("area"),
  address: text("address"),
  bloodGroup: text("blood_group"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  fitnessGoal: text("fitness_goal").default("general"),
  referralSource: text("referral_source"),
  photoUrl: text("photo_url"),
  plan: text("plan").notNull().default("monthly"),
  planStartDate: text("plan_start_date").notNull(),
  planExpiryDate: text("plan_expiry_date").notNull(),
  frozenUntil: text("frozen_until"),
  assignedTrainerId: integer("assigned_trainer_id"),
  blacklisted: boolean("blacklisted").default(false),
  
  isActive: boolean("is_active").default(true),
  
  // Audit fields
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  // Composite index for common queries
  gymActiveIdx: index("members_gym_active_idx")
    .on(table.gymId, table.isActive),
  
  // Partial unique indexes (only for non-deleted records)
  gymPhoneUnique: uniqueIndex("members_gym_phone_unique")
    .on(table.gymId, table.phone)
    .where(sql`deleted_at IS NULL`),
  
  gymCnicUnique: uniqueIndex("members_gym_cnic_unique")
    .on(table.gymId, table.cnic)
    .where(sql`deleted_at IS NULL`),
  
  gymMemberCodeUnique: uniqueIndex("members_gym_code_unique")
    .on(table.gymId, table.memberCode)
    .where(sql`deleted_at IS NULL`),
}));
```

### 4. Admin Users Table (Special Case)

```typescript
// lib/db/src/schema/admin-users.ts
export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  
  // Nullable for super_admin (platform admin)
  gymId: uuid("gym_id")
    .references(() => gymsTable.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  email: text("email").notNull(),
  password: text("password"),
  
  role: roleEnum("role").notNull().default("receptionist"),
  
  // JSONB for granular permissions
  permissions: jsonb("permissions").$type<{
    members?: string[];
    billing?: string[];
    attendance?: string[];
    reports?: string[];
  }>().default({}),
  
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  gymIdIdx: index("admin_users_gym_id_idx").on(table.gymId),
  
  // Separate unique constraints for super_admin vs gym admins
  superAdminEmailUnique: uniqueIndex("admin_users_super_email_unique")
    .on(table.email)
    .where(sql`gym_id IS NULL AND deleted_at IS NULL`),
  
  gymEmailUnique: uniqueIndex("admin_users_gym_email_unique")
    .on(table.gymId, table.email)
    .where(sql`gym_id IS NOT NULL AND deleted_at IS NULL`),
}));
```

### 5. Audit Logs Table (Essential for SaaS)

```typescript
// lib/db/src/schema/audit-logs.ts
export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),
  
  userId: uuid("user_id").notNull(), // ✅ Required: who performed the action
  action: text("action").notNull(), // "created", "updated", "deleted"
  entity: text("entity").notNull(), // "member", "invoice", "attendance"
  entityId: text("entity_id").notNull(),
  
  changes: jsonb("changes"), // before/after values
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  gymIdIdx: index("audit_logs_gym_id_idx").on(table.gymId),
  entityIdx: index("audit_logs_entity_idx").on(table.entity, table.entityId),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
}));
```

**Critical Actions to Audit:**
```typescript
// api-server/src/lib/audit.ts
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";

export async function logAudit(params: {
  gymId: string;
  userId: string;
  action: "created" | "updated" | "deleted";
  entity: string;
  entityId: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  await db.insert(auditLogsTable).values(params);
}

// Usage examples:
// Member created
await logAudit({
  gymId: req.tenant.gymId,
  userId: req.tenant.userId,
  action: "created",
  entity: "member",
  entityId: newMember.id.toString(),
  changes: { name: newMember.name, phone: newMember.phone },
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"],
});

// Invoice deleted
await logAudit({
  gymId: req.tenant.gymId,
  userId: req.tenant.userId,
  action: "deleted",
  entity: "invoice",
  entityId: invoice.id.toString(),
  changes: { before: invoice },
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"],
});

// Payment marked paid
await logAudit({
  gymId: req.tenant.gymId,
  userId: req.tenant.userId,
  action: "updated",
  entity: "invoice",
  entityId: invoice.id.toString(),
  changes: { 
    before: { status: "unpaid" }, 
    after: { status: "paid", paidDate: new Date() } 
  },
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"],
});
```

### 6. Tables to Modify

**Add `gym_id` + indexes + unique constraints to:**
- ✅ `members`
- ✅ `member_health`
- ✅ `member_notes`
- ✅ `membership_history`
- ✅ `measurements`
- ✅ `attendance`
- ✅ `employees`
- ✅ `invoices`
- ✅ `products`
- ✅ `sales`
- ✅ `pos_orders`
- ✅ `pos_order_items`
- ✅ `accounts`
- ✅ `vouchers`
- ✅ `admin_users`
- ✅ `admin_notifications`
- ✅ `business_settings` (keep table, just add gym_id)
- ✅ `app_announcements`
- ✅ `app_classes`
- ✅ `app_class_bookings`
- ✅ `app_workout_plans`
- ✅ `app_workout_exercises`
- ✅ `app_diet_plans`
- ✅ `app_diet_meals`
- ✅ `trainer_earnings`
- ✅ `client_subscriptions`
- ✅ `plans`

**Shared tables (NO gym_id):**
- ✅ `otps` - email verification for all gyms
- ✅ `app_onboarding_slides` - same onboarding for everyone

---

## Middleware & Security

### JWT Token Structure

```typescript
// api-server/src/types/jwt.ts
export interface JWTPayload {
  userId: string;
  gymId?: string | null;  // ✅ Nullable for super_admin
  role: "super_admin" | "gym_owner" | "manager" | "trainer" | "receptionist";
  email: string;
  permissions: {
    members?: string[];
    billing?: string[];
    attendance?: string[];
    reports?: string[];
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        gymId?: string | null;  // ✅ Nullable for super_admin
        userId: string;
        role: string;
        permissions: object;
      };
    }
  }
}
```

### Tenant Middleware

```typescript
// api-server/src/middleware/tenant.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWTPayload } from "../types/jwt";

// ✅ No fallback - force proper configuration
const SECRET = process.env["SESSION_SECRET"];
if (!SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }
  
  const token = authHeader.slice(7);
  
  try {
    const decoded = jwt.verify(token, SECRET) as JWTPayload;
    
    // ✅ Super admin must provide gymId via query param
    if (decoded.role === "super_admin") {
      const selectedGymId = req.query.gymId as string;
      if (!selectedGymId) {
        return res.status(400).json({ 
          message: "Super admin must specify gymId query parameter" 
        });
      }
      req.tenant = {
        gymId: selectedGymId,
        userId: decoded.userId,
        role: decoded.role,
        permissions: decoded.permissions,
      };
    } else {
      // Normal users: gymId from JWT
      if (!decoded.gymId) {
        return res.status(401).json({ message: "Invalid token: missing gymId" });
      }
      req.tenant = {
        gymId: decoded.gymId,
        userId: decoded.userId,
        role: decoded.role,
        permissions: decoded.permissions,
      };
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
}

// ✅ Permission guard middleware
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Super admin has all permissions
    if (req.tenant.role === "super_admin") {
      return next();
    }
    
    const [resource, action] = permission.split(".");
    const userPermissions = req.tenant.permissions as any;
    
    if (!userPermissions[resource]?.includes(action)) {
      return res.status(403).json({ 
        message: `Forbidden: requires ${permission} permission` 
      });
    }
    
    next();
  };
}

// Optional: Super admin bypass middleware
export function optionalTenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith("Bearer ")) {
    return next(); // Allow unauthenticated access
  }
  
  const token = authHeader.slice(7);
  
  try {
    const decoded = jwt.verify(token, SECRET) as JWTPayload;
    req.tenant = {
      gymId: decoded.gymId,
      userId: decoded.userId,
      role: decoded.role,
      permissions: decoded.permissions,
    };
  } catch (error) {
    // Invalid token, but don't block request
  }
  
  next();
}
```

### Security Rules

**Critical Security Principles:**

1. **Never trust gym_id from request body** ⚠️
   ```typescript
   // ❌ WRONG - User can send any gym_id
   const { gymId, name } = req.body;
   await db.insert(membersTable).values({ gymId, name });
   
   // ✅ CORRECT - Always use JWT gym_id
   const { name } = req.body;
   await db.insert(membersTable).values({ 
     gymId: req.tenant.gymId, 
     name 
   });
   ```

2. **Super admin must specify gym via query param** ⚠️
   ```typescript
   // Super admin MUST provide ?gymId=xxx in query string
   // This forces explicit gym selection, preventing accidental cross-gym queries
   
   router.get("/members", tenantMiddleware, async (req, res) => {
     // req.tenant.gymId is set from query param for super_admin
     // req.tenant.gymId is set from JWT for normal users
     
     const members = await db.select()
       .from(membersTable)
       .where(
         and(
           eq(membersTable.gymId, req.tenant.gymId),
           isNull(membersTable.deletedAt)
         )
       );
     
     return res.json(members);
   });
   ```

3. **Frontend should never send gym_id**
   - Frontend doesn't know gym_id
   - Backend extracts it from JWT (or query param for super_admin)
   - Prevents gym_id spoofing attacks

4. **Always filter soft-deleted records** ⚠️
   ```typescript
   // ❌ WRONG - Shows deleted records
   const members = await db.select()
     .from(membersTable)
     .where(eq(membersTable.gymId, req.tenant.gymId));
   
   // ✅ CORRECT - Excludes deleted records
   const members = await db.select()
     .from(membersTable)
     .where(
       and(
         eq(membersTable.gymId, req.tenant.gymId),
         isNull(membersTable.deletedAt)
       )
     );
   ```

5. **Use permission guards on sensitive routes** ⚠️
   ```typescript
   // Require specific permissions
   router.post("/members", 
     tenantMiddleware,
     requirePermission("members.create"),  // ✅ Permission check
     async (req, res) => {
       // Only users with members.create permission can access
     }
   );
   
   router.delete("/invoices/:id",
     tenantMiddleware,
     requirePermission("billing.delete"),  // ✅ Permission check
     async (req, res) => {
       // Only users with billing.delete permission can access
     }
   );
   ```

---

## API Route Changes

### Pattern for All Endpoints

**Before (single-tenant):**
```typescript
// api-server/src/routes/gym-admin.ts
router.get("/members", async (req, res) => {
  const members = await db.select().from(membersTable);
  return res.json(members);
});
```

**After (multi-tenant):**
```typescript
router.get("/members", 
  tenantMiddleware, 
  requirePermission("members.read"),  // ✅ Permission guard
  async (req, res) => {
    const members = await db.select()
      .from(membersTable)
      .where(
        and(
          eq(membersTable.gymId, req.tenant.gymId),
          isNull(membersTable.deletedAt)  // ✅ Exclude deleted
        )
      );
    
    return res.json(members);
  }
);
```

### Helper Functions (DRY Principle)

```typescript
// api-server/src/lib/tenant-query.ts
import { eq, and, isNull } from "drizzle-orm";

// ✅ Filter by gym_id AND exclude soft-deleted records
export function withTenant<T>(
  query: any,
  table: any,
  gymId: string
) {
  return query.where(
    and(
      eq(table.gymId, gymId),
      isNull(table.deletedAt)  // ✅ Always exclude deleted records
    )
  );
}

// Usage:
const members = await withTenant(
  db.select().from(membersTable),
  membersTable,
  req.tenant.gymId
);
```

### Routes to Update

**Files to modify:**
- `api-server/src/routes/gym-admin.ts` (~3500 lines)
  - All member endpoints
  - All billing endpoints
  - All attendance endpoints
  - All employee endpoints
  - All product/inventory endpoints
  - All sales/POS endpoints
  - All reports endpoints
  - All app content endpoints
- `api-server/src/routes/gym.ts` (member mobile app routes)
  - All member profile endpoints
  - All workout/diet plan endpoints
  - All class booking endpoints
  - All attendance endpoints
  - All announcement endpoints

**Estimated changes:** ~70-80 route handlers (admin + mobile app)

**Pattern for each route:**
1. Add `tenantMiddleware` to route
2. Add `requirePermission()` for sensitive operations
3. Add `.where(and(eq(table.gymId, req.tenant.gymId), isNull(table.deletedAt)))` to all queries
4. For GET by ID: return 404 if record not found (don't leak existence with 403)
5. Add audit logging for create/update/delete operations
6. Remove any hardcoded gym assumptions

**Example: Complete route with all security measures:**
```typescript
router.get("/members/:id",
  tenantMiddleware,
  requirePermission("members.read"),
  async (req, res) => {
    const [member] = await db.select()
      .from(membersTable)
      .where(
        and(
          eq(membersTable.id, parseInt(req.params.id)),
          eq(membersTable.gymId, req.tenant.gymId),  // ✅ Tenant filter
          isNull(membersTable.deletedAt)  // ✅ Exclude deleted
        )
      );
    
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    
    return res.json(member);
  }
);

router.delete("/members/:id",
  tenantMiddleware,
  requirePermission("members.delete"),
  async (req, res) => {
    const [member] = await db.select()
      .from(membersTable)
      .where(
        and(
          eq(membersTable.id, parseInt(req.params.id)),
          eq(membersTable.gymId, req.tenant.gymId),
          isNull(membersTable.deletedAt)
        )
      );
    
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    
    // Soft delete
    await db.update(membersTable)
      .set({ deletedAt: new Date(), updatedBy: req.tenant.userId })
      .where(eq(membersTable.id, member.id));
    
    // ✅ Audit log
    await logAudit({
      gymId: req.tenant.gymId,
      userId: req.tenant.userId,
      action: "deleted",
      entity: "member",
      entityId: member.id.toString(),
      changes: { before: member },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    
    return res.json({ message: "Member deleted successfully" });
  }
);
```

---

## Migration Strategy

### Step-by-Step Migration (SAFE)

**Step 1: Add New Schema (Non-Breaking)**

```bash
# Update schema files with gym_id (nullable initially)
# Run migration
cd lib/db
pnpm db:push
```

**Step 2: Create Default Gym**

```typescript
// scripts/create-default-gym.ts
import { db } from "@workspace/db";
import { gymsTable } from "@workspace/db";

async function createDefaultGym() {
  const [gym] = await db.insert(gymsTable).values({
    name: "Core X Gym",
    slug: "core-x-gym",
    email: "admin@corexgym.com",
    phone: "+92-300-1234567",
    address: "Karachi, Pakistan",
    subscriptionPlan: "enterprise",
    subscriptionStatus: "active",
    isActive: true,
  }).returning();
  
  console.log("Default gym created:", gym.id);
  return gym;
}

createDefaultGym();
```

**Step 3: Backfill Existing Data (if any)**

Since you confirmed starting fresh, this step is optional. But for reference:

```typescript
// scripts/backfill-gym-id.ts
import { db } from "@workspace/db";
import { membersTable, attendanceTable, invoicesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

async function backfillGymId(defaultGymId: string) {
  // Update all tables
  await db.update(membersTable)
    .set({ gymId: defaultGymId })
    .where(sql`gym_id IS NULL`);
  
  await db.update(attendanceTable)
    .set({ gymId: defaultGymId })
    .where(sql`gym_id IS NULL`);
  
  // ... repeat for all tables
  
  console.log("Backfill complete");
}
```

**Step 4: Make gym_id NOT NULL**

After backfill, update schema to make gym_id required:

```typescript
gymId: uuid("gym_id")
  .notNull()  // Add this
  .references(() => gymsTable.id, { onDelete: "cascade" }),
```

**Step 5: Deploy New API**

```bash
# Deploy with tenant middleware
git add .
git commit -m "feat: add multi-tenancy support (Phase 1)"
git push
vercel --prod
```

---

## Testing & Verification

### Critical Test Cases

**Test 1: Tenant Isolation**

```typescript
// Create 2 test gyms
const gym1 = await db.insert(gymsTable).values({
  name: "Gold Gym",
  slug: "gold-gym",
  email: "admin@goldgym.com",
  phone: "0300-1111111",
}).returning();

const gym2 = await db.insert(gymsTable).values({
  name: "Iron Fitness",
  slug: "iron-fitness",
  email: "admin@ironfitness.com",
  phone: "0300-2222222",
}).returning();

// Create members in each
await db.insert(membersTable).values({
  gymId: gym1[0].id,
  memberCode: "MEM-001",
  name: "Ali",
  phone: "0300-1234567",
  cnic: "12345-1234567-1",
  plan: "monthly",
  planStartDate: "2026-05-01",
  planExpiryDate: "2026-06-01",
});

await db.insert(membersTable).values({
  gymId: gym2[0].id,
  memberCode: "MEM-001",
  name: "Ahmed",
  phone: "0300-7654321",
  cnic: "54321-7654321-1",
  plan: "monthly",
  planStartDate: "2026-05-01",
  planExpiryDate: "2026-06-01",
});

// Login as gym1 admin
const token1 = jwt.sign({
  userId: "user1",
  gymId: gym1[0].id,
  role: "gym_owner",
  email: "admin@goldgym.com",
  permissions: {},
}, SECRET);

// Fetch members
const response = await fetch("http://localhost:5000/api/members", {
  headers: { Authorization: `Bearer ${token1}` }
});

const members = await response.json();

// Verify: Can only see gym1 members
expect(members).toHaveLength(1);
expect(members[0].name).toBe("Ali");
```

**Test 2: Unique Constraints Per Gym**

```typescript
// Same phone in different gyms should work
await db.insert(membersTable).values({
  gymId: gym1[0].id,
  memberCode: "MEM-002",
  name: "Bilal",
  phone: "0300-9999999",
  cnic: "11111-1111111-1",
  plan: "monthly",
  planStartDate: "2026-05-01",
  planExpiryDate: "2026-06-01",
}); // ✅ Success

await db.insert(membersTable).values({
  gymId: gym2[0].id,
  memberCode: "MEM-002",
  name: "Kamran",
  phone: "0300-9999999", // Same phone, different gym
  cnic: "22222-2222222-2",
  plan: "monthly",
  planStartDate: "2026-05-01",
  planExpiryDate: "2026-06-01",
}); // ✅ Success

// Same phone in same gym should fail
await db.insert(membersTable).values({
  gymId: gym1[0].id,
  memberCode: "MEM-003",
  name: "Duplicate",
  phone: "0300-9999999", // Duplicate in gym1
  cnic: "33333-3333333-3",
  plan: "monthly",
  planStartDate: "2026-05-01",
  planExpiryDate: "2026-06-01",
}); // ❌ Should throw unique constraint error
```

**Test 3: Soft Delete + Unique Constraint**

```typescript
// Delete member
await db.update(membersTable)
  .set({ deletedAt: new Date() })
  .where(eq(membersTable.id, member1.id));

// Should be able to create new member with same phone
await db.insert(membersTable).values({
  gymId: gym1[0].id,
  memberCode: "MEM-004",
  name: "New Ali",
  phone: "0300-1234567", // Same phone as deleted member
  cnic: "44444-4444444-4",
  plan: "monthly",
  planStartDate: "2026-05-01",
  planExpiryDate: "2026-06-01",
}); // ✅ Should work because of partial unique index
```

**Test 4: Direct ID Attack (CRITICAL SECURITY TEST)** ⚠️

```typescript
// Create member in gym2
const gym2Member = await db.insert(membersTable).values({
  gymId: gym2[0].id,
  memberCode: "MEM-001",
  name: "Gym2 Member",
  phone: "0300-8888888",
  cnic: "99999-9999999-9",
  plan: "monthly",
  planStartDate: "2026-05-01",
  planExpiryDate: "2026-06-01",
}).returning();

// Login as gym1 admin
const token1 = jwt.sign({
  userId: "user1",
  gymId: gym1[0].id,
  role: "gym_owner",
  email: "admin@goldgym.com",
  permissions: { members: ["read", "update"] },
}, SECRET);

// Try to access gym2 member by ID
const response = await fetch(`http://localhost:5000/api/members/${gym2Member[0].id}`, {
  headers: { Authorization: `Bearer ${token1}` }
});

// ✅ Should return 404 (not 403, to avoid leaking existence)
expect(response.status).toBe(404);
expect(response.json()).toEqual({ message: "Member not found" });

// Try to update gym2 member
const updateResponse = await fetch(`http://localhost:5000/api/members/${gym2Member[0].id}`, {
  method: "PUT",
  headers: { 
    Authorization: `Bearer ${token1}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ name: "Hacked Name" })
});

// ✅ Should return 404
expect(updateResponse.status).toBe(404);

// Try to delete gym2 member
const deleteResponse = await fetch(`http://localhost:5000/api/members/${gym2Member[0].id}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${token1}` }
});

// ✅ Should return 404
expect(deleteResponse.status).toBe(404);

// Verify gym2 member is unchanged
const [verifyMember] = await db.select()
  .from(membersTable)
  .where(eq(membersTable.id, gym2Member[0].id));

expect(verifyMember.name).toBe("Gym2 Member"); // ✅ Not "Hacked Name"
expect(verifyMember.deletedAt).toBeNull(); // ✅ Not deleted
```

### Manual Testing Checklist

**Tenant Isolation:**
- [ ] Create 2 test gyms via SQL or API
- [ ] Add members to each gym
- [ ] Login as gym1 admin → verify can't see gym2 data
- [ ] Login as gym2 admin → verify can't see gym1 data
- [ ] Try to edit gym2 member while logged in as gym1 → should return 404
- [ ] Delete member in gym1 → verify gym2 members unaffected

**Unique Constraints:**
- [ ] Create member with duplicate phone in different gyms → should work
- [ ] Create member with duplicate phone in same gym → should fail
- [ ] Soft delete member → create new member with same phone → should work

**Security (CRITICAL):**
- [ ] Direct ID attack: Try to GET gym2 member ID while logged in as gym1 → 404
- [ ] Direct ID attack: Try to UPDATE gym2 member ID while logged in as gym1 → 404
- [ ] Direct ID attack: Try to DELETE gym2 member ID while logged in as gym1 → 404
- [ ] Verify gym2 data unchanged after attack attempts
- [ ] Try to access deleted member → should return 404
- [ ] Try to access endpoint without permission → should return 403

**Super Admin:**
- [ ] Login as super admin without gymId query param → should return 400
- [ ] Login as super admin with gymId query param → should see that gym's data
- [ ] Super admin can switch between gyms by changing gymId param

**Audit Logs:**
- [ ] Create member → verify audit log entry created
- [ ] Update invoice → verify audit log with before/after values
- [ ] Delete attendance → verify audit log entry
- [ ] Check audit log includes userId, ipAddress, userAgent

### Performance Testing

```bash
# Test query performance with gym_id index
EXPLAIN ANALYZE 
SELECT * FROM members 
WHERE gym_id = 'abc-123' AND is_active = true;

# Should use index: members_gym_active_idx
```

---

## Critical Files to Modify

### Database Schema
- `lib/db/src/schema/gyms.ts` (NEW)
- `lib/db/src/schema/enums.ts` (NEW)
- `lib/db/src/schema/audit-logs.ts` (NEW)
- `lib/db/src/schema/members.ts` (MODIFY)
- `lib/db/src/schema/member-health.ts` (MODIFY)
- `lib/db/src/schema/member-notes.ts` (MODIFY)
- `lib/db/src/schema/membership-history.ts` (MODIFY)
- `lib/db/src/schema/measurements.ts` (MODIFY)
- `lib/db/src/schema/attendance.ts` (MODIFY)
- `lib/db/src/schema/employees.ts` (MODIFY)
- `lib/db/src/schema/billing.ts` (MODIFY)
- `lib/db/src/schema/inventory.ts` (MODIFY)
- `lib/db/src/schema/accounts.ts` (MODIFY)
- `lib/db/src/schema/admin-users.ts` (MODIFY)
- `lib/db/src/schema/notifications.ts` (MODIFY)
- `lib/db/src/schema/business.ts` (MODIFY)
- `lib/db/src/schema/app-content.ts` (MODIFY)
- `lib/db/src/schema/trainer-commission.ts` (MODIFY)
- `lib/db/src/schema/index.ts` (UPDATE exports)

### Middleware
- `api-server/src/middleware/tenant.ts` (NEW - tenant isolation + permission guards)
- `api-server/src/types/jwt.ts` (NEW - JWT payload types)
- `api-server/src/lib/tenant-query.ts` (NEW - helper functions)
- `api-server/src/lib/audit.ts` (NEW - audit logging helper)

### API Routes
- `api-server/src/routes/gym-admin.ts` (MODIFY - add tenant filtering to all routes)
- `api-server/src/routes/gym.ts` (MODIFY - add tenant filtering to member app routes)
- `api-server/src/app.ts` (MODIFY - register tenant middleware)

### Scripts
- `scripts/create-default-gym.ts` (NEW)
- `scripts/backfill-gym-id.ts` (NEW - optional)

---

## Success Criteria

Phase 1 is complete when:

✅ **Database:**
- `gyms` table exists
- All gym-scoped tables have `gym_id` column
- Indexes and unique constraints are in place
- Soft delete works with unique constraints

✅ **Middleware:**
- Tenant middleware extracts `gym_id` from JWT
- All protected routes use tenant middleware
- Super admin bypass works

✅ **API:**
- All queries filter by `gym_id`
- No route can access other gym's data
- Member app routes filter by `gym_id`

✅ **Testing:**
- Tenant isolation verified
- Unique constraints per gym verified
- Soft delete + unique constraints verified
- Performance acceptable (queries use indexes)

✅ **Documentation:**
- Migration steps documented
- Testing checklist completed
- Known limitations documented

---

## Known Limitations & Future Work

**Phase 1 Limitations:**
- Manual gym creation (no self-registration yet)
- No subscription/billing system
- No super admin panel
- No custom domains/subdomains
- No automated tenant provisioning

**Future Phases:**
- **Phase 2:** SaaS Authentication (multi-tenant JWT, gym-scoped login)
- **Phase 3:** Gym Onboarding (self-registration, trial system)
- **Phase 4:** Subscription & Billing (Stripe, plans, payments)
- **Phase 5:** Super Admin Panel (gym management, analytics)
- **Phase 6:** Production Polish (subdomains, monitoring, backups)

---

## Risk Mitigation

**Risk 1: Forgetting gym_id filter in a query**
- **Mitigation:** Helper functions (`withTenant`)
- **Mitigation:** Code review checklist
- **Mitigation:** Integration tests for each endpoint

**Risk 2: Performance degradation**
- **Mitigation:** Composite indexes on `(gym_id, is_active)`
- **Mitigation:** Query performance testing
- **Mitigation:** Monitor slow queries in production

**Risk 3: Data migration errors**
- **Mitigation:** Start fresh (no existing data to migrate)
- **Mitigation:** Test migration on staging first
- **Mitigation:** Backup before migration

**Risk 4: JWT token size**
- **Mitigation:** Keep JWT payload minimal
- **Mitigation:** Don't store large permissions object in JWT
- **Mitigation:** Use short UUIDs

---

## Estimated Effort

- **Database schema changes:** 4-6 hours
- **Middleware implementation:** 2-3 hours
- **API route updates:** 8-12 hours (50-60 routes)
- **Testing & verification:** 3-4 hours
- **Documentation & cleanup:** 2-3 hours

**Total:** 19-28 hours (2.5-3.5 days)

---

## Next Steps

After Phase 1 completion:
1. Review and test thoroughly
2. Deploy to staging
3. Verify tenant isolation in staging
4. Plan Phase 2 (SaaS Authentication)
5. Document learnings and improvements

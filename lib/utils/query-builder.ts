import { db } from "../db";
import { SQL, and, eq, isNull, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

/**
 * Base Query Builder with Multi-Tenant & Soft Delete Support
 */
export class TenantQueryBuilder<T extends PgTable> {
  constructor(
    private table: T,
    private gymId: string
  ) {}

  /**
   * Get base WHERE clause with gymId and soft delete filter
   */
  private getBaseWhere(additionalConditions?: SQL): SQL {
    const conditions: SQL[] = [
      eq(this.table.gymId, this.gymId),
      isNull(this.table.deletedAt),
    ];

    if (additionalConditions) {
      conditions.push(additionalConditions);
    }

    return and(...conditions)!;
  }

  /**
   * Find all records (active only)
   */
  async findAll(where?: SQL) {
    return db
      .select()
      .from(this.table)
      .where(this.getBaseWhere(where));
  }

  /**
   * Find one record by ID
   */
  async findById(id: number | string) {
    const results = await db
      .select()
      .from(this.table)
      .where(
        this.getBaseWhere(
          eq(this.table.id, typeof id === "string" ? id : id)
        )
      )
      .limit(1);

    return results[0] || null;
  }

  /**
   * Find one record by custom condition
   */
  async findOne(where: SQL) {
    const results = await db
      .select()
      .from(this.table)
      .where(this.getBaseWhere(where))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Count records
   */
  async count(where?: SQL) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(this.table)
      .where(this.getBaseWhere(where));

    return result[0]?.count || 0;
  }

  /**
   * Check if record exists
   */
  async exists(where: SQL): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * Create a new record
   */
  async create(data: any, userId: string) {
    const values = {
      ...data,
      gymId: this.gymId,
      createdBy: userId,
      updatedBy: userId,
    };

    const result = await db.insert(this.table).values(values).returning();
    return result[0];
  }

  /**
   * Update a record by ID
   */
  async updateById(id: number | string, data: any, userId: string) {
    const values = {
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    const result = await db
      .update(this.table)
      .set(values)
      .where(
        this.getBaseWhere(
          eq(this.table.id, typeof id === "string" ? id : id)
        )
      )
      .returning();

    return result[0] || null;
  }

  /**
   * Soft delete a record by ID
   */
  async softDeleteById(id: number | string, userId: string) {
    const result = await db
      .update(this.table)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        this.getBaseWhere(
          eq(this.table.id, typeof id === "string" ? id : id)
        )
      )
      .returning();

    return result[0] || null;
  }

  /**
   * Restore a soft-deleted record
   */
  async restoreById(id: number | string, userId: string) {
    const result = await db
      .update(this.table)
      .set({
        deletedAt: null,
        updatedBy: userId,
      })
      .where(
        and(
          eq(this.table.gymId, this.gymId),
          eq(this.table.id, typeof id === "string" ? id : id)
        )!
      )
      .returning();

    return result[0] || null;
  }

  /**
   * Hard delete a record (permanent)
   * Use with caution!
   */
  async hardDeleteById(id: number | string) {
    const result = await db
      .delete(this.table)
      .where(
        and(
          eq(this.table.gymId, this.gymId),
          eq(this.table.id, typeof id === "string" ? id : id)
        )!
      )
      .returning();

    return result[0] || null;
  }

  /**
   * Find deleted records (for recovery)
   */
  async findDeleted(where?: SQL) {
    const conditions: SQL[] = [
      eq(this.table.gymId, this.gymId),
      sql`${this.table.deletedAt} IS NOT NULL`,
    ];

    if (where) {
      conditions.push(where);
    }

    return db
      .select()
      .from(this.table)
      .where(and(...conditions)!);
  }

  /**
   * Paginated query
   */
  async paginate(options: {
    page: number;
    limit: number;
    where?: SQL;
    orderBy?: SQL;
  }) {
    const { page, limit, where, orderBy } = options;
    const offset = (page - 1) * limit;

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(this.table)
        .where(this.getBaseWhere(where))
        .limit(limit)
        .offset(offset)
        .orderBy(orderBy || sql`${this.table.createdAt} DESC`),
      this.count(where),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total: totalResult,
        totalPages: Math.ceil(totalResult / limit),
        hasNext: page * limit < totalResult,
        hasPrev: page > 1,
      },
    };
  }
}

/**
 * Factory function to create a query builder
 */
export function createQueryBuilder<T extends PgTable>(
  table: T,
  gymId: string
) {
  return new TenantQueryBuilder(table, gymId);
}

/**
 * Example Usage:
 *
 * // In your route handler
 * const memberQuery = createQueryBuilder(membersTable, req.gymId);
 *
 * // Find all active members
 * const members = await memberQuery.findAll();
 *
 * // Find member by ID
 * const member = await memberQuery.findById(123);
 *
 * // Find with custom condition
 * const activeMember = await memberQuery.findOne(
 *   eq(membersTable.status, "active")
 * );
 *
 * // Create member
 * const newMember = await memberQuery.create(
 *   { name: "John", phone: "123456" },
 *   req.user.userId
 * );
 *
 * // Update member
 * const updated = await memberQuery.updateById(
 *   123,
 *   { name: "John Doe" },
 *   req.user.userId
 * );
 *
 * // Soft delete
 * await memberQuery.softDeleteById(123, req.user.userId);
 *
 * // Restore
 * await memberQuery.restoreById(123, req.user.userId);
 *
 * // Paginate
 * const result = await memberQuery.paginate({
 *   page: 1,
 *   limit: 20,
 *   where: eq(membersTable.status, "active"),
 * });
 */

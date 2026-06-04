import { db } from "../db";
import { auditLogsTable } from "../db/src/schema";
import { Request } from "express";

/**
 * Audit Log Entry
 */
export interface AuditLogEntry {
  gymId: string;
  userId: string;
  userName?: string;
  action: "created" | "updated" | "deleted" | "restored";
  entity: string;
  entityId: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    route?: string;
    method?: string;
  };
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      gymId: entry.gymId,
      userId: entry.userId,
      userName: entry.userName,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      changes: entry.changes,
      metadata: entry.metadata,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Extract request metadata for audit logs
 */
export function getRequestMetadata(req: Request) {
  return {
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers["user-agent"],
    route: req.path,
    method: req.method,
  };
}

/**
 * Audit Log Decorator for Express Handlers
 * Automatically logs create/update/delete operations
 */
export function withAuditLog(
  entity: string,
  action: AuditLogEntry["action"],
  getEntityId: (req: Request, result: any) => string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const req = args[0] as Request & { user: any; gymId: string };
      const res = args[1];

      // Get "before" state for updates/deletes
      let before: any = undefined;
      if (action === "updated" || action === "deleted") {
        // This would need to be implemented based on your specific entity
        // For now, we'll skip the before state
      }

      // Execute the original handler
      const result = await originalMethod.apply(this, args);

      // Get "after" state for creates/updates
      let after: any = undefined;
      if (action === "created" || action === "updated") {
        after = result;
      }

      // Create audit log
      await createAuditLog({
        gymId: req.gymId,
        userId: req.user.userId,
        userName: req.user.email,
        action,
        entity,
        entityId: getEntityId(req, result),
        changes: { before, after },
        metadata: getRequestMetadata(req),
      });

      return result;
    };

    return descriptor;
  };
}

/**
 * Helper: Track changes between two objects
 */
export function getChanges(
  before: Record<string, any>,
  after: Record<string, any>
): { before: Record<string, any>; after: Record<string, any> } {
  const changes: { before: Record<string, any>; after: Record<string, any> } = {
    before: {},
    after: {},
  };

  // Find changed fields
  for (const key in after) {
    if (before[key] !== after[key]) {
      changes.before[key] = before[key];
      changes.after[key] = after[key];
    }
  }

  return changes;
}

/**
 * Example Usage:
 *
 * // Manual audit logging
 * await createAuditLog({
 *   gymId: req.gymId,
 *   userId: req.user.userId,
 *   userName: req.user.email,
 *   action: "created",
 *   entity: "member",
 *   entityId: newMember.id.toString(),
 *   changes: { after: newMember },
 *   metadata: getRequestMetadata(req),
 * });
 *
 * // With change tracking
 * const before = await getMember(memberId);
 * await updateMember(memberId, updates);
 * const after = await getMember(memberId);
 *
 * await createAuditLog({
 *   gymId: req.gymId,
 *   userId: req.user.userId,
 *   action: "updated",
 *   entity: "member",
 *   entityId: memberId.toString(),
 *   changes: getChanges(before, after),
 *   metadata: getRequestMetadata(req),
 * });
 */

import { db } from "../db";

/**
 * Transaction wrapper with automatic rollback on error
 */
export async function withTransaction<T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    try {
      return await callback(tx);
    } catch (error) {
      // Transaction will automatically rollback
      throw error;
    }
  });
}

/**
 * Example Usage:
 *
 * // Create member with initial invoice in a transaction
 * const result = await withTransaction(async (tx) => {
 *   // Create member
 *   const member = await tx.insert(membersTable).values({
 *     gymId,
 *     memberCode: await CodeGenerator.generateMemberCode(gymId),
 *     name: "John Doe",
 *     phone: "03001234567",
 *     cnic: "12345-1234567-1",
 *     plan: "monthly",
 *     planStartDate: DateUtils.getCurrentDate(),
 *     planExpiryDate: DateUtils.calculateExpiryDate(DateUtils.getCurrentDate(), "monthly"),
 *     createdBy: userId,
 *   }).returning();
 *
 *   // Create invoice
 *   const invoice = await tx.insert(invoicesTable).values({
 *     gymId,
 *     invoiceNumber: await CodeGenerator.generateInvoiceNumber(gymId),
 *     memberId: member[0].id,
 *     amount: "3000",
 *     plan: "monthly",
 *     dueDate: DateUtils.getCurrentDate(),
 *     status: "unpaid",
 *     createdBy: userId,
 *   }).returning();
 *
 *   // Create audit log
 *   await tx.insert(auditLogsTable).values({
 *     gymId,
 *     userId,
 *     action: "created",
 *     entity: "member",
 *     entityId: member[0].id.toString(),
 *     changes: { after: member[0] },
 *   });
 *
 *   return { member: member[0], invoice: invoice[0] };
 * });
 *
 * // If any operation fails, all changes are rolled back
 */

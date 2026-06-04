import { pgTable, text, uuid, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gymsTable } from "./gyms";
import { subscriptionsTable } from "./subscriptions";

/**
 * Payment History Table
 * Tracks all payment transactions
 */
export const paymentHistoryTable = pgTable("payment_history", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Relationships
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id")
    .references(() => subscriptionsTable.id, { onDelete: "set null" }),

  // Stripe IDs
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  stripeInvoiceId: text("stripe_invoice_id"),
  stripeChargeId: text("stripe_charge_id"),

  // Payment Details
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("PKR"),
  status: text("status").notNull(), // succeeded, pending, failed, refunded
  paymentMethod: text("payment_method"), // card, bank_transfer, etc.

  // Card Details (last 4 digits only)
  cardLast4: text("card_last4"),
  cardBrand: text("card_brand"), // visa, mastercard, etc.

  // Description
  description: text("description"),
  invoiceUrl: text("invoice_url"), // Stripe hosted invoice URL

  // Dates
  paidAt: timestamp("paid_at"),
  failedAt: timestamp("failed_at"),
  refundedAt: timestamp("refunded_at"),

  // Failure Details
  failureReason: text("failure_reason"),
  failureMessage: text("failure_message"),

  // Audit
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  gymIdIdx: index("payment_history_gym_id_idx").on(table.gymId),
  statusIdx: index("payment_history_status_idx").on(table.status),
  stripePaymentIntentIdIdx: index("payment_history_stripe_payment_intent_id_idx").on(table.stripePaymentIntentId),
  createdAtIdx: index("payment_history_created_at_idx").on(table.createdAt),
}));

export const insertPaymentHistorySchema = createInsertSchema(paymentHistoryTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentHistory = z.infer<typeof insertPaymentHistorySchema>;
export type PaymentHistory = typeof paymentHistoryTable.$inferSelect;

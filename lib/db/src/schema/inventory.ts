import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  email: text("email"),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("paid"),
  customerName: text("customer_name"),
  date: text("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── POS Orders (multi-item cart system) ────────────────────────────────────
export const posOrdersTable = pgTable("pos_orders", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => membersTable.id, { onDelete: "set null" }),
  customerName: text("customer_name"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  discountType: text("discount_type").notNull().default("fixed"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  dueAmount: numeric("due_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("cash"),
  status: text("status").notNull().default("paid"),
  notes: text("notes"),
  date: text("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posOrderItemsTable = pgTable("pos_order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => posOrdersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  returned: integer("returned").notNull().default(0),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true });
export const insertPosOrderSchema = createInsertSchema(posOrdersTable).omit({ id: true, createdAt: true });
export const insertPosOrderItemSchema = createInsertSchema(posOrderItemsTable).omit({ id: true });

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
export type PosOrder = typeof posOrdersTable.$inferSelect;
export type PosOrderItem = typeof posOrderItemsTable.$inferSelect;

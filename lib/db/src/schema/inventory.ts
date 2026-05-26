import { pgTable, text, serial, timestamp, integer, numeric, uuid, index, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { membersTable } from "./members";
import { gymsTable } from "./gyms";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Supplier Information
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  email: text("email"),
  address: text("address"),

  isActive: boolean("is_active").default(true),

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  gymIdIdx: index("suppliers_gym_id_idx").on(table.gymId),
}));

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Product Information
  name: text("name").notNull(),
  category: text("category").notNull(), // supplements, equipment, apparel, accessories
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),

  // Supplier
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),

  // Inventory Management
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  sku: text("sku"), // Stock Keeping Unit

  isActive: boolean("is_active").default(true),

  // Audit Trail
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  gymIdIdx: index("products_gym_id_idx").on(table.gymId),
  gymCategoryIdx: index("products_gym_category_idx").on(table.gymId, table.category),
  gymStockIdx: index("products_gym_stock_idx").on(table.gymId, table.stock),

  // Partial unique constraint for SKU (only non-deleted)
  gymSkuUnique: uniqueIndex("products_gym_sku_unique")
    .on(table.gymId, table.sku)
    .where(sql`sku IS NOT NULL AND deleted_at IS NULL`),
}));

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "restrict" }),

  // Sale Details
  quantity: integer("quantity").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("paid"), // paid, pending, cancelled

  // Customer
  customerName: text("customer_name"),
  date: text("date").notNull(),

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  gymIdIdx: index("sales_gym_id_idx").on(table.gymId),
  productIdIdx: index("sales_product_id_idx").on(table.productId),
  dateIdx: index("sales_date_idx").on(table.date),
  gymDateIdx: index("sales_gym_date_idx").on(table.gymId, table.date),
}));

// ── POS Orders (multi-item cart system) ────────────────────────────────────
export const posOrdersTable = pgTable("pos_orders", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Human-readable order number (ORD-2024-001)
  orderNumber: text("order_number").notNull(),

  // Customer
  memberId: integer("member_id").references(() => membersTable.id, { onDelete: "set null" }),
  customerName: text("customer_name"),

  // Pricing
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  discountType: text("discount_type").notNull().default("fixed"), // fixed, percentage
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),

  // Payment
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  dueAmount: numeric("due_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("cash"), // cash, card, bank_transfer
  status: text("status").notNull().default("paid"), // paid, partial, pending

  notes: text("notes"),
  date: text("date").notNull(),

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  gymIdIdx: index("pos_orders_gym_id_idx").on(table.gymId),
  memberIdIdx: index("pos_orders_member_id_idx").on(table.memberId),
  dateIdx: index("pos_orders_date_idx").on(table.date),
  gymDateIdx: index("pos_orders_gym_date_idx").on(table.gymId, table.date),
  statusIdx: index("pos_orders_status_idx").on(table.status),
}));

export const posOrderItemsTable = pgTable("pos_order_items", {
  id: serial("id").primaryKey(),

  orderId: integer("order_id").notNull().references(() => posOrdersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),

  // Cached product info (in case product is deleted)
  productName: text("product_name").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),

  // Quantity
  quantity: integer("quantity").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),

  // Returns
  returned: integer("returned").notNull().default(0),
}, (table) => ({
  orderIdIdx: index("pos_order_items_order_id_idx").on(table.orderId),
  productIdIdx: index("pos_order_items_product_id_idx").on(table.productId),
}));

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

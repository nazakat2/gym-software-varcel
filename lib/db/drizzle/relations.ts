import { relations } from "drizzle-orm/relations";
import { members, attendance, posOrders, suppliers, products, sales, invoices, measurements, posOrderItems, accounts, vouchers, membershipHistory, memberHealth, memberNotes, clientSubscriptions, employees, plans, trainerEarnings } from "./schema";

export const attendanceRelations = relations(attendance, ({one}) => ({
	member: one(members, {
		fields: [attendance.memberId],
		references: [members.id]
	}),
}));

export const membersRelations = relations(members, ({many}) => ({
	attendances: many(attendance),
	posOrders: many(posOrders),
	invoices: many(invoices),
	measurements: many(measurements),
	membershipHistories: many(membershipHistory),
	memberHealths: many(memberHealth),
	memberNotes: many(memberNotes),
	clientSubscriptions: many(clientSubscriptions),
}));

export const posOrdersRelations = relations(posOrders, ({one, many}) => ({
	member: one(members, {
		fields: [posOrders.memberId],
		references: [members.id]
	}),
	posOrderItems: many(posOrderItems),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	supplier: one(suppliers, {
		fields: [products.supplierId],
		references: [suppliers.id]
	}),
	sales: many(sales),
	posOrderItems: many(posOrderItems),
}));

export const suppliersRelations = relations(suppliers, ({many}) => ({
	products: many(products),
}));

export const salesRelations = relations(sales, ({one}) => ({
	product: one(products, {
		fields: [sales.productId],
		references: [products.id]
	}),
}));

export const invoicesRelations = relations(invoices, ({one, many}) => ({
	member: one(members, {
		fields: [invoices.memberId],
		references: [members.id]
	}),
	trainerEarnings: many(trainerEarnings),
}));

export const measurementsRelations = relations(measurements, ({one}) => ({
	member: one(members, {
		fields: [measurements.memberId],
		references: [members.id]
	}),
}));

export const posOrderItemsRelations = relations(posOrderItems, ({one}) => ({
	posOrder: one(posOrders, {
		fields: [posOrderItems.orderId],
		references: [posOrders.id]
	}),
	product: one(products, {
		fields: [posOrderItems.productId],
		references: [products.id]
	}),
}));

export const vouchersRelations = relations(vouchers, ({one}) => ({
	account: one(accounts, {
		fields: [vouchers.accountId],
		references: [accounts.id]
	}),
}));

export const accountsRelations = relations(accounts, ({many}) => ({
	vouchers: many(vouchers),
}));

export const membershipHistoryRelations = relations(membershipHistory, ({one}) => ({
	member: one(members, {
		fields: [membershipHistory.memberId],
		references: [members.id]
	}),
}));

export const memberHealthRelations = relations(memberHealth, ({one}) => ({
	member: one(members, {
		fields: [memberHealth.memberId],
		references: [members.id]
	}),
}));

export const memberNotesRelations = relations(memberNotes, ({one}) => ({
	member: one(members, {
		fields: [memberNotes.memberId],
		references: [members.id]
	}),
}));

export const clientSubscriptionsRelations = relations(clientSubscriptions, ({one, many}) => ({
	member: one(members, {
		fields: [clientSubscriptions.memberId],
		references: [members.id]
	}),
	employee: one(employees, {
		fields: [clientSubscriptions.trainerId],
		references: [employees.id]
	}),
	plan: one(plans, {
		fields: [clientSubscriptions.planId],
		references: [plans.id]
	}),
	trainerEarnings: many(trainerEarnings),
}));

export const employeesRelations = relations(employees, ({many}) => ({
	clientSubscriptions: many(clientSubscriptions),
	trainerEarnings: many(trainerEarnings),
}));

export const plansRelations = relations(plans, ({many}) => ({
	clientSubscriptions: many(clientSubscriptions),
}));

export const trainerEarningsRelations = relations(trainerEarnings, ({one}) => ({
	employee: one(employees, {
		fields: [trainerEarnings.trainerId],
		references: [employees.id]
	}),
	invoice: one(invoices, {
		fields: [trainerEarnings.sourcePaymentId],
		references: [invoices.id]
	}),
	clientSubscription: one(clientSubscriptions, {
		fields: [trainerEarnings.subscriptionId],
		references: [clientSubscriptions.id]
	}),
}));
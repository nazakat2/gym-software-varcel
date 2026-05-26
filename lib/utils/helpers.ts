import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Generate human-readable sequential codes
 */
export class CodeGenerator {
  /**
   * Generate member code (MEM-001, MEM-002, etc.)
   */
  static async generateMemberCode(gymId: string): Promise<string> {
    const result = await db.execute(sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER)), 0) + 1 as next_num
      FROM members
      WHERE gym_id = ${gymId}
      AND member_code ~ '^MEM-[0-9]+$'
    `);

    const nextNum = result.rows[0]?.next_num || 1;
    return `MEM-${String(nextNum).padStart(3, "0")}`;
  }

  /**
   * Generate invoice number (INV-2024-001, INV-2024-002, etc.)
   */
  static async generateInvoiceNumber(gymId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const result = await db.execute(sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM ${prefix.length + 1}) AS INTEGER)), 0) + 1 as next_num
      FROM invoices
      WHERE gym_id = ${gymId}
      AND invoice_number LIKE ${prefix + "%"}
    `);

    const nextNum = result.rows[0]?.next_num || 1;
    return `${prefix}${String(nextNum).padStart(3, "0")}`;
  }

  /**
   * Generate order number (ORD-2024-001, ORD-2024-002, etc.)
   */
  static async generateOrderNumber(gymId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;

    const result = await db.execute(sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM ${prefix.length + 1}) AS INTEGER)), 0) + 1 as next_num
      FROM pos_orders
      WHERE gym_id = ${gymId}
      AND order_number LIKE ${prefix + "%"}
    `);

    const nextNum = result.rows[0]?.next_num || 1;
    return `${prefix}${String(nextNum).padStart(3, "0")}`;
  }

  /**
   * Generate voucher number (VCH-2024-001, VCH-2024-002, etc.)
   */
  static async generateVoucherNumber(gymId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `VCH-${year}-`;

    const result = await db.execute(sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(voucher_number FROM ${prefix.length + 1}) AS INTEGER)), 0) + 1 as next_num
      FROM vouchers
      WHERE gym_id = ${gymId}
      AND voucher_number LIKE ${prefix + "%"}
    `);

    const nextNum = result.rows[0]?.next_num || 1;
    return `${prefix}${String(nextNum).padStart(3, "0")}`;
  }

  /**
   * Generate branch code (KHI, LHR, ISB, etc.)
   * This is manual - admin provides the code
   */
  static validateBranchCode(code: string): boolean {
    return /^[A-Z]{2,4}$/.test(code);
  }

  /**
   * Generate member code with branch prefix (KHI-MEM-001)
   * For Phase 2 when branches are implemented
   */
  static async generateBranchMemberCode(
    gymId: string,
    branchCode: string
  ): Promise<string> {
    const prefix = `${branchCode}-MEM-`;

    const result = await db.execute(sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(member_code FROM ${prefix.length + 1}) AS INTEGER)), 0) + 1 as next_num
      FROM members
      WHERE gym_id = ${gymId}
      AND member_code LIKE ${prefix + "%"}
    `);

    const nextNum = result.rows[0]?.next_num || 1;
    return `${prefix}${String(nextNum).padStart(3, "0")}`;
  }
}

/**
 * Date/Time Utilities
 */
export class DateUtils {
  /**
   * Get current date in YYYY-MM-DD format
   */
  static getCurrentDate(): string {
    return new Date().toISOString().split("T")[0];
  }

  /**
   * Get current time in HH:MM:SS format
   */
  static getCurrentTime(): string {
    return new Date().toTimeString().split(" ")[0];
  }

  /**
   * Add days to a date
   */
  static addDays(date: string, days: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  /**
   * Add months to a date
   */
  static addMonths(date: string, months: number): string {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split("T")[0];
  }

  /**
   * Calculate plan expiry date based on plan type
   */
  static calculateExpiryDate(
    startDate: string,
    planType: "daily" | "weekly" | "monthly" | "quarterly" | "yearly"
  ): string {
    const daysMap = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      yearly: 365,
    };

    return this.addDays(startDate, daysMap[planType]);
  }

  /**
   * Check if membership is expired
   */
  static isExpired(expiryDate: string): boolean {
    return new Date(expiryDate) < new Date();
  }

  /**
   * Get days until expiry
   */
  static getDaysUntilExpiry(expiryDate: string): number {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Format date for display (DD/MM/YYYY)
   */
  static formatDate(date: string): string {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  }

  /**
   * Parse DD/MM/YYYY to YYYY-MM-DD
   */
  static parseDate(date: string): string {
    const [day, month, year] = date.split("/");
    return `${year}-${month}-${day}`;
  }
}

/**
 * Validation Utilities
 */
export class ValidationUtils {
  /**
   * Validate Pakistani phone number
   */
  static isValidPhone(phone: string): boolean {
    // Accepts: +92-XXX-XXXXXXX, 03XXXXXXXXX, etc.
    return /^(\+92|0)?3[0-9]{9}$/.test(phone.replace(/[-\s]/g, ""));
  }

  /**
   * Validate Pakistani CNIC
   */
  static isValidCNIC(cnic: string): boolean {
    // Format: XXXXX-XXXXXXX-X
    return /^[0-9]{5}-[0-9]{7}-[0-9]$/.test(cnic);
  }

  /**
   * Validate email
   */
  static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Format phone number
   */
  static formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("92")) {
      return `+${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
    }
    if (cleaned.startsWith("0")) {
      return `0${cleaned.slice(1, 4)}-${cleaned.slice(4)}`;
    }
    return phone;
  }

  /**
   * Format CNIC
   */
  static formatCNIC(cnic: string): string {
    const cleaned = cnic.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12)}`;
    }
    return cnic;
  }
}

/**
 * Currency Utilities
 */
export class CurrencyUtils {
  /**
   * Format amount in PKR
   */
  static formatPKR(amount: number | string): string {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `Rs. ${num.toLocaleString("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Calculate discount
   */
  static calculateDiscount(
    amount: number,
    discount: number,
    type: "fixed" | "percentage"
  ): number {
    if (type === "fixed") {
      return Math.max(0, amount - discount);
    }
    return amount - (amount * discount) / 100;
  }

  /**
   * Calculate trainer commission
   */
  static calculateCommission(
    amount: number,
    commissionValue: number,
    commissionType: "fixed" | "percentage"
  ): { commission: number; gymRevenue: number } {
    const commission =
      commissionType === "fixed"
        ? commissionValue
        : (amount * commissionValue) / 100;

    return {
      commission,
      gymRevenue: amount - commission,
    };
  }
}

/**
 * Example Usage:
 *
 * // Generate codes
 * const memberCode = await CodeGenerator.generateMemberCode(gymId);
 * const invoiceNumber = await CodeGenerator.generateInvoiceNumber(gymId);
 *
 * // Date utilities
 * const today = DateUtils.getCurrentDate();
 * const expiryDate = DateUtils.calculateExpiryDate(today, "monthly");
 * const isExpired = DateUtils.isExpired(expiryDate);
 *
 * // Validation
 * if (!ValidationUtils.isValidPhone(phone)) {
 *   throw new ValidationError("Invalid phone number");
 * }
 *
 * // Currency
 * const formatted = CurrencyUtils.formatPKR(3000);
 * const discounted = CurrencyUtils.calculateDiscount(3000, 10, "percentage");
 */

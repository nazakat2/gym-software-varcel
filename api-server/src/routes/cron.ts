import { Router } from "express";
import { trialReminderHandler } from "../tasks/trial-reminders";
import { backupHandler, restoreHandler } from "../services/backup.service";

const router = Router();

/**
 * @openapi
 * /cron/trial-reminders:
 *   get:
 *     tags:
 *       - Cron Jobs
 *     summary: Send trial expiry reminders
 *     description: |
 *       Scheduled task to send trial expiry reminders (7, 3, 1 day before expiry).
 *       Should be called daily via Vercel Cron or external scheduler.
 *       Requires CRON_SECRET in Authorization header.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reminders sent successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/cron/trial-reminders", trialReminderHandler);

/**
 * @openapi
 * /cron/backup:
 *   get:
 *     tags:
 *       - Cron Jobs
 *     summary: Create database backup
 *     description: |
 *       Scheduled task to create database backup and upload to Vercel Blob.
 *       Should be called daily via Vercel Cron or external scheduler.
 *       Requires CRON_SECRET in Authorization header.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup created successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/cron/backup", backupHandler);

/**
 * @openapi
 * /cron/restore:
 *   post:
 *     tags:
 *       - Cron Jobs
 *     summary: Restore database from backup
 *     description: |
 *       Restore database from a backup URL.
 *       WARNING: This will overwrite the current database!
 *       Requires CRON_SECRET in Authorization header.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - backupUrl
 *             properties:
 *               backupUrl:
 *                 type: string
 *                 example: "https://blob.vercel-storage.com/backup-2026-05-19.sql"
 *     responses:
 *       200:
 *         description: Database restored successfully
 *       400:
 *         description: Missing backupUrl
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/cron/restore", restoreHandler);

export default router;

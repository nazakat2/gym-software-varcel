import { exec } from "child_process";
import { promisify } from "util";
import { put } from "@vercel/blob";
import { createReadStream, unlinkSync, existsSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

/**
 * Automated database backup service
 * Creates PostgreSQL backups and stores them in Vercel Blob
 */
export class BackupService {
  /**
   * Create a database backup
   */
  static async createBackup(): Promise<string> {
    console.log("🔄 Starting database backup...");

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL not configured");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `backup-${timestamp}.sql`;
    const backupPath = join("/tmp", backupFileName);

    try {
      // Create backup using pg_dump
      console.log("  📦 Creating SQL dump...");
      await execAsync(`pg_dump "${databaseUrl}" > ${backupPath}`);

      // Check if backup file exists
      if (!existsSync(backupPath)) {
        throw new Error("Backup file was not created");
      }

      console.log("  ✅ SQL dump created successfully");

      // Upload to Vercel Blob
      console.log("  ☁️  Uploading to Vercel Blob...");
      const blob = await put(backupFileName, createReadStream(backupPath), {
        access: "public",
        addRandomSuffix: false,
      });

      console.log(`  ✅ Backup uploaded: ${blob.url}`);

      // Clean up local file
      unlinkSync(backupPath);
      console.log("  🧹 Cleaned up temporary file");

      console.log("✨ Backup completed successfully!");
      return blob.url;
    } catch (error: any) {
      console.error("❌ Backup failed:", error.message);

      // Clean up on error
      if (existsSync(backupPath)) {
        unlinkSync(backupPath);
      }

      throw error;
    }
  }

  /**
   * Restore database from backup
   * WARNING: This will overwrite the current database!
   */
  static async restoreBackup(backupUrl: string): Promise<void> {
    console.log("🔄 Starting database restore...");
    console.warn("⚠️  WARNING: This will overwrite the current database!");

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL not configured");
    }

    const backupPath = join("/tmp", "restore.sql");

    try {
      // Download backup file
      console.log("  📥 Downloading backup...");
      const response = await fetch(backupUrl);
      if (!response.ok) {
        throw new Error(`Failed to download backup: ${response.statusText}`);
      }

      const backupContent = await response.text();
      const fs = await import("fs/promises");
      await fs.writeFile(backupPath, backupContent);

      console.log("  ✅ Backup downloaded");

      // Restore using psql
      console.log("  🔄 Restoring database...");
      await execAsync(`psql "${databaseUrl}" < ${backupPath}`);

      console.log("  ✅ Database restored successfully");

      // Clean up
      unlinkSync(backupPath);
      console.log("  🧹 Cleaned up temporary file");

      console.log("✨ Restore completed successfully!");
    } catch (error: any) {
      console.error("❌ Restore failed:", error.message);

      // Clean up on error
      if (existsSync(backupPath)) {
        unlinkSync(backupPath);
      }

      throw error;
    }
  }

  /**
   * List all backups
   */
  static async listBackups(): Promise<string[]> {
    // This would require Vercel Blob list API
    // For now, return empty array
    console.log("📋 Listing backups...");
    return [];
  }

  /**
   * Delete old backups (keep last N backups)
   */
  static async cleanupOldBackups(keepCount: number = 7): Promise<void> {
    console.log(`🧹 Cleaning up old backups (keeping last ${keepCount})...`);
    // This would require Vercel Blob list and delete APIs
    // Implementation depends on Vercel Blob capabilities
    console.log("  ℹ️  Cleanup not implemented yet");
  }
}

/**
 * Express route handler for backup endpoint
 */
export async function backupHandler(req: any, res: any) {
  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const backupUrl = await BackupService.createBackup();
    res.json({
      success: true,
      message: "Backup created successfully",
      backupUrl,
    });
  } catch (error: any) {
    console.error("Error in backup handler:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Express route handler for restore endpoint
 */
export async function restoreHandler(req: any, res: any) {
  try {
    // Verify admin authorization
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { backupUrl } = req.body;
    if (!backupUrl) {
      return res.status(400).json({ error: "backupUrl is required" });
    }

    await BackupService.restoreBackup(backupUrl);
    res.json({
      success: true,
      message: "Database restored successfully",
    });
  } catch (error: any) {
    console.error("Error in restore handler:", error);
    res.status(500).json({ error: error.message });
  }
}

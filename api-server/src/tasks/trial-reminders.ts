import { db } from "@workspace/db";
import { gymsTable, adminUsersTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { EmailService } from "../services/email.service";
import { SMSService } from "../services/sms.service";
import { WhatsAppService } from "../services/whatsapp.service";

/**
 * Scheduled task to send trial expiry reminders
 * Should run daily (e.g., via cron job or Vercel Cron)
 */
export async function sendTrialExpiryReminders() {
  console.log("🔔 Running trial expiry reminder task...");

  try {
    const now = new Date();

    // Calculate dates for 7, 3, and 1 day reminders
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const oneDayFromNow = new Date(now);
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

    // Get gyms with trials expiring in 7, 3, or 1 day
    const gymsOnTrial = await db
      .select()
      .from(gymsTable)
      .where(
        and(
          eq(gymsTable.subscriptionStatus, "trial"),
          eq(gymsTable.isActive, true)
        )
      );

    let remindersSent = 0;

    for (const gym of gymsOnTrial) {
      if (!gym.subscriptionExpiresAt) continue;

      const expiryDate = new Date(gym.subscriptionExpiresAt);
      const daysRemaining = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Send reminder if trial expires in 7, 3, or 1 day
      if (daysRemaining === 7 || daysRemaining === 3 || daysRemaining === 1) {
        // Get gym owner email
        const [owner] = await db
          .select()
          .from(adminUsersTable)
          .where(
            and(
              eq(adminUsersTable.gymId, gym.id),
              eq(adminUsersTable.role, "gym_owner")
            )
          )
          .limit(1);

        if (owner) {
          await EmailService.sendTrialExpiryReminder(
            owner.email,
            gym.name,
            daysRemaining
          );

          // Send SMS notification if phone number available
          if (gym.phone) {
            SMSService.sendTrialExpiryReminder(
              gym.phone,
              gym.name,
              daysRemaining
            ).catch((err) => console.error("Failed to send trial reminder SMS:", err));

            // Send WhatsApp notification
            WhatsAppService.sendTrialExpiryReminder(
              gym.phone,
              gym.name,
              daysRemaining
            ).catch((err) => console.error("Failed to send trial reminder WhatsApp:", err));
          }

          remindersSent++;
          console.log(`  ✅ Sent ${daysRemaining}-day reminder to ${gym.name}`);
        }
      }

      // Send trial expired email if trial has expired
      if (daysRemaining <= 0) {
        const [owner] = await db
          .select()
          .from(adminUsersTable)
          .where(
            and(
              eq(adminUsersTable.gymId, gym.id),
              eq(adminUsersTable.role, "gym_owner")
            )
          )
          .limit(1);

        if (owner) {
          await EmailService.sendTrialExpiredEmail(owner.email, gym.name);

          // Send SMS notification if phone number available
          if (gym.phone) {
            SMSService.sendTrialExpiredSMS(gym.phone, gym.name).catch((err) =>
              console.error("Failed to send trial expired SMS:", err)
            );

            // Send WhatsApp notification
            WhatsAppService.sendTrialExpiredMessage(gym.phone, gym.name).catch((err) =>
              console.error("Failed to send trial expired WhatsApp:", err)
            );
          }

          console.log(`  ✅ Sent trial expired email to ${gym.name}`);
        }

        // Update gym status to suspended
        await db
          .update(gymsTable)
          .set({
            subscriptionStatus: "suspended",
            isActive: false,
          })
          .where(eq(gymsTable.id, gym.id));

        console.log(`  🔒 Suspended gym: ${gym.name}`);
      }
    }

    console.log(`✨ Trial reminder task complete. Sent ${remindersSent} reminders.`);
  } catch (error) {
    console.error("❌ Error in trial reminder task:", error);
    throw error;
  }
}

/**
 * Express route handler for manual trigger or cron endpoint
 */
export async function trialReminderHandler(req: any, res: any) {
  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await sendTrialExpiryReminders();
    res.json({ success: true, message: "Trial reminders sent" });
  } catch (error: any) {
    console.error("Error in trial reminder handler:", error);
    res.status(500).json({ error: error.message });
  }
}

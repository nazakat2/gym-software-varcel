import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables FIRST before importing email service
config({ path: resolve(__dirname, "../.env") });

import { EmailService } from "./src/services/email.service";

/**
 * Test email notifications
 */
async function testEmailService() {
  console.log("🧪 Testing Email Service with Resend...\n");

  // Check if RESEND_API_KEY is configured
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY not found in environment variables");
    process.exit(1);
  }

  console.log("✅ RESEND_API_KEY found");
  console.log(`📧 FROM_EMAIL: ${process.env.FROM_EMAIL || "noreply@gymplatform.com"}`);
  console.log(`📧 SUPPORT_EMAIL: ${process.env.SUPPORT_EMAIL || "support@gymplatform.com"}\n`);

  // Get test email from command line or use default
  const testEmail = process.argv[2] || "test@example.com";
  console.log(`📬 Sending test emails to: ${testEmail}\n`);

  try {
    // Test 1: Welcome Email
    console.log("1️⃣ Testing Welcome Email...");
    await EmailService.sendWelcomeEmail(testEmail, "Test Gym", "Test Owner");
    console.log("   ✅ Welcome email sent successfully\n");

    // Test 2: Trial Expiry Reminder
    console.log("2️⃣ Testing Trial Expiry Reminder (7 days)...");
    await EmailService.sendTrialExpiryReminder(testEmail, "Test Gym", 7);
    console.log("   ✅ Trial reminder sent successfully\n");

    // Test 3: Payment Success
    console.log("3️⃣ Testing Payment Success Email...");
    await EmailService.sendPaymentSuccessEmail(
      testEmail,
      "Test Gym",
      2999,
      "Basic",
      "monthly"
    );
    console.log("   ✅ Payment success email sent successfully\n");

    // Test 4: Payment Failure
    console.log("4️⃣ Testing Payment Failure Email...");
    await EmailService.sendPaymentFailureEmail(
      testEmail,
      "Test Gym",
      "Card declined"
    );
    console.log("   ✅ Payment failure email sent successfully\n");

    console.log("✨ All email tests passed!");
    console.log(`\n📬 Check your inbox at ${testEmail} for 4 test emails.`);
    console.log("\n💡 Tip: Check spam folder if emails don't appear in inbox.");
  } catch (error: any) {
    console.error("\n❌ Email test failed:", error.message);
    console.error("\nPossible issues:");
    console.error("- Invalid RESEND_API_KEY");
    console.error("- Resend account not verified");
    console.error("- Network connectivity issues");
    process.exit(1);
  }
}

// Run tests
testEmailService()
  .then(() => {
    console.log("\n✅ Email service test complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });

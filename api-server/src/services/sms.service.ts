import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: twilio.Twilio | null = null;

// Initialize Twilio client
if (accountSid && authToken && fromNumber) {
  twilioClient = twilio(accountSid, authToken);
  console.log("✅ Twilio SMS service initialized");
} else {
  console.warn("⚠️  Twilio credentials not configured - SMS notifications disabled");
}

/**
 * SMS notification service using Twilio
 */
export class SMSService {
  /**
   * Send SMS notification
   */
  private static async sendSMS(to: string, message: string) {
    if (!twilioClient || !fromNumber) {
      console.warn("SMS not sent - Twilio not configured");
      return;
    }

    try {
      // Format phone number (ensure it starts with +)
      const formattedPhone = to.startsWith("+") ? to : `+${to}`;

      const result = await twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: formattedPhone,
      });

      console.log(`✅ SMS sent to ${to}: ${result.sid}`);
      return result;
    } catch (error: any) {
      console.error("Failed to send SMS:", error.message);
      throw error;
    }
  }

  /**
   * Send trial expiry reminder SMS
   */
  static async sendTrialExpiryReminder(
    to: string,
    gymName: string,
    daysRemaining: number
  ) {
    const message = `${gymName}: Your trial expires in ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}. Upgrade now to continue using all features. Visit your dashboard to upgrade.`;

    try {
      await this.sendSMS(to, message);
      console.log(`✅ Trial expiry SMS sent to ${to} (${daysRemaining} days)`);
    } catch (error) {
      console.error("Failed to send trial expiry SMS:", error);
    }
  }

  /**
   * Send trial expired SMS
   */
  static async sendTrialExpiredSMS(to: string, gymName: string) {
    const message = `${gymName}: Your trial has expired. Your account is now suspended. Upgrade to a paid plan to regain access. Visit your dashboard.`;

    try {
      await this.sendSMS(to, message);
      console.log(`✅ Trial expired SMS sent to ${to}`);
    } catch (error) {
      console.error("Failed to send trial expired SMS:", error);
    }
  }

  /**
   * Send payment failure SMS
   */
  static async sendPaymentFailureSMS(to: string, gymName: string) {
    const message = `${gymName}: Payment failed. Please update your payment method to avoid service interruption. Visit your dashboard.`;

    try {
      await this.sendSMS(to, message);
      console.log(`✅ Payment failure SMS sent to ${to}`);
    } catch (error) {
      console.error("Failed to send payment failure SMS:", error);
    }
  }

  /**
   * Send payment success SMS
   */
  static async sendPaymentSuccessSMS(
    to: string,
    gymName: string,
    amount: number
  ) {
    const message = `${gymName}: Payment of PKR ${amount.toLocaleString()} received successfully. Your subscription is active. Thank you!`;

    try {
      await this.sendSMS(to, message);
      console.log(`✅ Payment success SMS sent to ${to}`);
    } catch (error) {
      console.error("Failed to send payment success SMS:", error);
    }
  }

  /**
   * Send subscription cancelled SMS
   */
  static async sendSubscriptionCancelledSMS(
    to: string,
    gymName: string,
    expiryDate: string
  ) {
    const message = `${gymName}: Your subscription has been cancelled. You have access until ${new Date(expiryDate).toLocaleDateString()}. Reactivate anytime from your dashboard.`;

    try {
      await this.sendSMS(to, message);
      console.log(`✅ Subscription cancelled SMS sent to ${to}`);
    } catch (error) {
      console.error("Failed to send subscription cancelled SMS:", error);
    }
  }

  /**
   * Send welcome SMS
   */
  static async sendWelcomeSMS(to: string, gymName: string) {
    const message = `Welcome to Gym Platform! ${gymName} has been registered successfully. Your 14-day trial has started. Login to your dashboard to get started.`;

    try {
      await this.sendSMS(to, message);
      console.log(`✅ Welcome SMS sent to ${to}`);
    } catch (error) {
      console.error("Failed to send welcome SMS:", error);
    }
  }
}

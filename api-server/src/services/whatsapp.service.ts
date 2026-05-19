import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import { join } from "path";

let sock: WASocket | null = null;
let isConnected = false;

/**
 * WhatsApp notification service using Baileys
 * Free WhatsApp Web automation for notifications
 */
export class WhatsAppService {
  /**
   * Initialize WhatsApp connection
   */
  static async initialize() {
    try {
      // Store auth state in .whatsapp-auth folder
      const authFolder = join(process.cwd(), ".whatsapp-auth");
      const { state, saveCreds } = await useMultiFileAuthState(authFolder);

      sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Show QR code in terminal
      });

      // Handle connection updates
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log("\n📱 WhatsApp QR Code:");
          qrcode.generate(qr, { small: true });
          console.log("\n👆 Scan this QR code with WhatsApp to connect\n");
        }

        if (connection === "close") {
          const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !==
            DisconnectReason.loggedOut;

          console.log(
            "❌ WhatsApp connection closed. Reconnecting:",
            shouldReconnect
          );

          if (shouldReconnect) {
            await this.initialize();
          } else {
            isConnected = false;
          }
        } else if (connection === "open") {
          console.log("✅ WhatsApp connected successfully!");
          isConnected = true;
        }
      });

      // Save credentials when updated
      sock.ev.on("creds.update", saveCreds);

      console.log("🔄 WhatsApp service initialized");
    } catch (error: any) {
      console.error("❌ Failed to initialize WhatsApp:", error.message);
    }
  }

  /**
   * Format phone number for WhatsApp
   * Converts +923001234567 to 923001234567@s.whatsapp.net
   */
  private static formatPhoneNumber(phone: string): string {
    // Remove + and any spaces/dashes
    const cleaned = phone.replace(/[\s\-+]/g, "");
    return `${cleaned}@s.whatsapp.net`;
  }

  /**
   * Send WhatsApp message
   */
  private static async sendMessage(to: string, message: string) {
    if (!sock || !isConnected) {
      console.warn("⚠️  WhatsApp not connected - message not sent");
      return;
    }

    try {
      const formattedNumber = this.formatPhoneNumber(to);
      await sock.sendMessage(formattedNumber, { text: message });
      console.log(`✅ WhatsApp message sent to ${to}`);
    } catch (error: any) {
      console.error("❌ Failed to send WhatsApp message:", error.message);
    }
  }

  /**
   * Send welcome message
   */
  static async sendWelcomeMessage(to: string, gymName: string, ownerName: string) {
    const message = `🎉 *Welcome to Gym Platform!*

Hi ${ownerName},

Thank you for registering *${gymName}* with us!

Your *14-day free trial* has started. You now have access to:
✅ Member management
✅ Attendance tracking
✅ Billing & invoicing
✅ Employee management
✅ Reports & analytics

Get started by logging into your dashboard.

Need help? Contact us anytime!`;

    await this.sendMessage(to, message);
  }

  /**
   * Send trial expiry reminder
   */
  static async sendTrialExpiryReminder(
    to: string,
    gymName: string,
    daysRemaining: number
  ) {
    const message = `⏰ *Trial Expiring Soon*

Hi there,

Your free trial for *${gymName}* will expire in *${daysRemaining} day${daysRemaining > 1 ? "s" : ""}*.

To continue using all features without interruption, please upgrade to a paid plan.

⚠️ After trial expires, your account will be suspended.

Upgrade now from your dashboard!`;

    await this.sendMessage(to, message);
  }

  /**
   * Send trial expired message
   */
  static async sendTrialExpiredMessage(to: string, gymName: string) {
    const message = `🔒 *Trial Expired*

Hi there,

Your free trial for *${gymName}* has expired.

Your account is now suspended. To regain access to your data and continue using all features, please upgrade to a paid plan.

Visit your dashboard to upgrade.`;

    await this.sendMessage(to, message);
  }

  /**
   * Send payment success message
   */
  static async sendPaymentSuccessMessage(
    to: string,
    gymName: string,
    amount: number,
    plan: string
  ) {
    const message = `✅ *Payment Successful!*

Hi there,

Your payment for *${gymName}* has been processed successfully.

💳 *Payment Details:*
Plan: ${plan}
Amount: PKR ${amount.toLocaleString()}

Your subscription is now active and you have full access to all features.

Thank you for your payment!`;

    await this.sendMessage(to, message);
  }

  /**
   * Send payment failure message
   */
  static async sendPaymentFailureMessage(to: string, gymName: string) {
    const message = `❌ *Payment Failed*

Hi there,

We were unable to process your payment for *${gymName}*.

Please update your payment method and try again to avoid service interruption.

Visit your dashboard to update payment details.`;

    await this.sendMessage(to, message);
  }

  /**
   * Send subscription cancelled message
   */
  static async sendSubscriptionCancelledMessage(
    to: string,
    gymName: string,
    expiryDate: string
  ) {
    const message = `🔔 *Subscription Cancelled*

Hi there,

Your subscription for *${gymName}* has been cancelled.

You will continue to have access until *${new Date(expiryDate).toLocaleDateString()}*.

Changed your mind? You can reactivate your subscription anytime from your dashboard.`;

    await this.sendMessage(to, message);
  }

  /**
   * Send membership expiry reminder (for gym members)
   */
  static async sendMembershipExpiryReminder(
    to: string,
    memberName: string,
    gymName: string,
    daysRemaining: number
  ) {
    const message = `⏰ *Membership Expiring Soon*

Hi ${memberName},

Your membership at *${gymName}* will expire in *${daysRemaining} day${daysRemaining > 1 ? "s" : ""}*.

Please renew your membership to continue enjoying our facilities.

Contact us to renew!`;

    await this.sendMessage(to, message);
  }

  /**
   * Send invoice reminder
   */
  static async sendInvoiceReminder(
    to: string,
    memberName: string,
    gymName: string,
    amount: number,
    dueDate: string
  ) {
    const message = `💰 *Payment Reminder*

Hi ${memberName},

You have an outstanding invoice at *${gymName}*.

Amount: PKR ${amount.toLocaleString()}
Due Date: ${new Date(dueDate).toLocaleDateString()}

Please make payment at your earliest convenience.

Thank you!`;

    await this.sendMessage(to, message);
  }

  /**
   * Send attendance alert
   */
  static async sendAttendanceAlert(
    to: string,
    memberName: string,
    gymName: string,
    daysAbsent: number
  ) {
    const message = `🏋️ *We Miss You!*

Hi ${memberName},

We noticed you haven't visited *${gymName}* in ${daysAbsent} days.

Your fitness goals are waiting! Come back and continue your journey.

See you soon! 💪`;

    await this.sendMessage(to, message);
  }

  /**
   * Check if WhatsApp is connected
   */
  static isConnected(): boolean {
    return isConnected;
  }

  /**
   * Disconnect WhatsApp
   */
  static async disconnect() {
    if (sock) {
      await sock.logout();
      sock = null;
      isConnected = false;
      console.log("✅ WhatsApp disconnected");
    }
  }
}

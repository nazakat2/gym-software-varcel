import nodemailer from "nodemailer";

// Lazy-load nodemailer transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!smtpUser || !smtpPassword) {
      throw new Error("SMTP_USER and SMTP_PASSWORD environment variables are required");
    }

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });
  }
  return transporter;
}

const FROM_EMAIL = process.env.EMAIL_FROM || process.env.SMTP_USER || "noreply@gymplatform.com";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@gymplatform.com";

/**
 * Email service for sending transactional emails
 */
export class EmailService {
  /**
   * Send OTP verification email
   */
  static async sendOtpEmail(to: string, otp: string, name?: string) {
    try {
      await getTransporter().sendMail({
        from: FROM_EMAIL,
        to,
        subject: "Verify Your Email - Core X Gym Management",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #8b5cf6;">Email Verification 🔐</h1>
            <p>Hi${name ? ` ${name}` : ""},</p>
            <p>Thank you for registering with Core X Gym Management System!</p>
            <p>Your verification code is:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
              <h2 style="color: #8b5cf6; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h2>
            </div>
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you didn't request this code, please ignore this email.
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
            </p>
          </div>
        `,
      });
      console.log(`✅ OTP email sent to ${to}`);
    } catch (error) {
      console.error("Failed to send OTP email:", error);
      throw error;
    }
  }

  /**
   * Send password reset OTP email
   */
  static async sendPasswordResetEmail(to: string, otp: string, name?: string) {
    try {
      await getTransporter().sendMail({
        from: FROM_EMAIL,
        to,
        subject: "Password Reset OTP - Core X Gym Management",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #E31C25;">Password Reset 🔑</h1>
            <p>Hi${name ? ` <strong>${name}</strong>` : ""},</p>
            <p>We received a request to reset your GymAdmin password.</p>
            <p>Your password reset code is:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
              <h2 style="color: #E31C25; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h2>
            </div>
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you did not request a password reset, please ignore this email. Your password will remain unchanged.
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
            </p>
          </div>
        `,
      });
      console.log(`✅ Password reset email sent to ${to}`);
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      throw error;
    }
  }

  /**
   * Send welcome email to new gym owner
   */
  static async sendWelcomeEmail(to: string, gymName: string, ownerName: string) {
    try {
      await getTransporter().sendMail({
        from: FROM_EMAIL,
        to,
        subject: `Welcome to Gym Platform - ${gymName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #8b5cf6;">Welcome to Gym Platform! 🎉</h1>
            <p>Hi ${ownerName},</p>
            <p>Thank you for registering <strong>${gymName}</strong> with us!</p>
            <p>Your 14-day free trial has started. You now have access to:</p>
            <ul>
              <li>Member management</li>
              <li>Attendance tracking</li>
              <li>Billing & invoicing</li>
              <li>Employee management</li>
              <li>Reports & analytics</li>
              <li>And much more!</li>
            </ul>
            <p>Get started by logging into your dashboard and exploring the features.</p>
            <p style="margin-top: 30px;">
              <a href="${process.env.APP_URL || 'https://yourdomain.com'}"
                 style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Go to Dashboard
              </a>
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
            </p>
          </div>
        `,
      });
      console.log(`✅ Welcome email sent to ${to}`);
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      throw error;
    }
  }

  /**
   * Send trial expiry reminder
   */
  static async sendTrialExpiryReminder(
    to: string,
    gymName: string,
    daysRemaining: number
  ) {
    try {
      await getTransporter().sendMail({
        from: FROM_EMAIL,
        to,
        subject: `Your trial expires in ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #f59e0b;">Trial Expiring Soon ⏰</h1>
            <p>Hi there,</p>
            <p>Your free trial for <strong>${gymName}</strong> will expire in <strong>${daysRemaining} day${daysRemaining > 1 ? "s" : ""}</strong>.</p>
            <p>To continue using all features without interruption, please upgrade to a paid plan.</p>
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e;">
                <strong>What happens after trial expires?</strong><br>
                Your account will be suspended and you won't be able to access your data until you upgrade.
              </p>
            </div>
            <p style="margin-top: 30px;">
              <a href="${process.env.APP_URL || 'https://yourdomain.com'}/subscription"
                 style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Upgrade Now
              </a>
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
            </p>
          </div>
        `,
      });
      console.log(`✅ Trial expiry reminder sent to ${to} (${daysRemaining} days)`);
    } catch (error) {
      console.error("Failed to send trial expiry reminder:", error);
    }
  }

  /**
   * Send payment success email
   */
  static async sendPaymentSuccessEmail(
    to: string,
    gymName: string,
    amount: number,
    plan: string,
    billingCycle: string
  ) {
    try {
      await getTransporter().sendMail({
        from: FROM_EMAIL,
        to,
        subject: "Payment Successful - Subscription Active",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #10b981;">Payment Successful! ✅</h1>
            <p>Hi there,</p>
            <p>Your payment for <strong>${gymName}</strong> has been processed successfully.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Payment Details</h3>
              <p style="margin: 5px 0;"><strong>Plan:</strong> ${plan}</p>
              <p style="margin: 5px 0;"><strong>Billing Cycle:</strong> ${billingCycle}</p>
              <p style="margin: 5px 0;"><strong>Amount:</strong> PKR ${amount.toLocaleString()}</p>
            </div>
            <p>Your subscription is now active and you have full access to all features.</p>
            <p style="margin-top: 30px;">
              <a href="${process.env.APP_URL || 'https://yourdomain.com'}/billing"
                 style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Invoice
              </a>
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
            </p>
          </div>
        `,
      });
      console.log(`✅ Payment success email sent to ${to}`);
    } catch (error) {
      console.error("Failed to send payment success email:", error);
    }
  }

  /**
   * Send payment failure email
   */
  static async sendPaymentFailureEmail(
    to: string,
    gymName: string,
    reason: string
  ) {
    try {
      await getTransporter().sendMail({
        from: FROM_EMAIL,
        to,
        subject: "Payment Failed - Action Required",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #ef4444;">Payment Failed ❌</h1>
            <p>Hi there,</p>
            <p>We were unable to process your payment for <strong>${gymName}</strong>.</p>
            <div style="background-color: #fee2e2; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #991b1b;">
                <strong>Reason:</strong> ${reason}
              </p>
            </div>
            <p>Please update your payment method and try again to avoid service interruption.</p>
            <p style="margin-top: 30px;">
              <a href="${process.env.APP_URL || 'https://yourdomain.com'}/subscription"
                 style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Update Payment Method
              </a>
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
            </p>
          </div>
        `,
      });
      console.log(`✅ Payment failure email sent to ${to}`);
    } catch (error) {
      console.error("Failed to send payment failure email:", error);
    }
  }

  /**
   * Send subscription cancelled email
   */
  static async sendSubscriptionCancelledEmail(
    to: string,
    gymName: string,
    expiryDate: string
  ) {
    try {
      await getTransporter().sendMail({
        from: FROM_EMAIL,
        to,
        subject: "Subscription Cancelled",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #6b7280;">Subscription Cancelled</h1>
            <p>Hi there,</p>
            <p>Your subscription for <strong>${gymName}</strong> has been cancelled.</p>
            <p>You will continue to have access until <strong>${new Date(expiryDate).toLocaleDateString()}</strong>.</p>
            <p>After this date, your account will be suspended and you won't be able to access your data.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0;">
                Changed your mind? You can reactivate your subscription anytime before the expiry date.
              </p>
            </div>
            <p style="margin-top: 30px;">
              <a href="${process.env.APP_URL || 'https://yourdomain.com'}/subscription"
                 style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reactivate Subscription
              </a>
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              We're sorry to see you go. If you have feedback, please let us know at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
            </p>
          </div>
        `,
      });
      console.log(`✅ Subscription cancelled email sent to ${to}`);
    } catch (error) {
      console.error("Failed to send subscription cancelled email:", error);
    }
  }

  /**
   * Send trial expired email
   */
  static async sendTrialExpiredEmail(to: string, gymName: string) {
    try {
      await getTransporter().sendMail({
        from: FROM_EMAIL,
        to,
        subject: "Your Trial Has Expired",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #ef4444;">Trial Expired</h1>
            <p>Hi there,</p>
            <p>Your free trial for <strong>${gymName}</strong> has expired.</p>
            <p>Your account is now suspended. To regain access to your data and continue using all features, please upgrade to a paid plan.</p>
            <p style="margin-top: 30px;">
              <a href="${process.env.APP_URL || 'https://yourdomain.com'}/subscription"
                 style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Upgrade Now
              </a>
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
            </p>
          </div>
        `,
      });
      console.log(`✅ Trial expired email sent to ${to}`);
    } catch (error) {
      console.error("Failed to send trial expired email:", error);
    }
  }
}

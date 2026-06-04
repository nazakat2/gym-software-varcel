import nodemailer from "nodemailer";

/**
 * Email Service
 * Handles sending emails for OTP, password reset, etc.
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      console.warn("⚠️  Email service not configured. Emails will be logged to console.");
      return;
    }

    this.transporter = nodemailer.createTransporter({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: parseInt(smtpPort) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.transporter) {
      // Development mode - log to console
      console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║ Email (Development Mode)                                                 ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ To: ${options.to.padEnd(69)}║
║ Subject: ${options.subject.padEnd(64)}║
╠═══════════════════════════════════════════════════════════════════════════╣
║ ${options.text?.padEnd(69) || ""}║
╚═══════════════════════════════════════════════════════════════════════════╝
      `);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
    } catch (error) {
      console.error("Failed to send email:", error);
      throw new Error("Failed to send email");
    }
  }

  /**
   * Send OTP email
   */
  async sendOTP(email: string, otp: string, type: "signup" | "reset" | "verify"): Promise<void> {
    const subjects = {
      signup: "Verify Your Email - Gym Management",
      reset: "Reset Your Password - Gym Management",
      verify: "Verification Code - Gym Management",
    };

    const messages = {
      signup: "Welcome! Please verify your email address.",
      reset: "You requested to reset your password.",
      verify: "Here is your verification code.",
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subjects[type]}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2563eb;
      margin: 0;
      font-size: 24px;
    }
    .otp-box {
      background: #f3f4f6;
      border: 2px dashed #2563eb;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 30px 0;
    }
    .otp-code {
      font-size: 32px;
      font-weight: bold;
      color: #2563eb;
      letter-spacing: 8px;
      font-family: 'Courier New', monospace;
    }
    .message {
      color: #666;
      margin: 20px 0;
    }
    .warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px;
      margin: 20px 0;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏋️ Gym Management System</h1>
    </div>

    <p class="message">${messages[type]}</p>

    <div class="otp-box">
      <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your verification code is:</p>
      <div class="otp-code">${otp}</div>
    </div>

    <div class="warning">
      ⚠️ This code will expire in 15 minutes. Do not share this code with anyone.
    </div>

    <p class="message">
      If you didn't request this code, please ignore this email or contact support if you have concerns.
    </p>

    <div class="footer">
      <p>© ${new Date().getFullYear()} Gym Management System. All rights reserved.</p>
      <p>This is an automated email. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
${messages[type]}

Your verification code is: ${otp}

This code will expire in 15 minutes.

If you didn't request this code, please ignore this email.

© ${new Date().getFullYear()} Gym Management System
    `;

    await this.sendEmail({
      to: email,
      subject: subjects[type],
      html,
      text,
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, name: string, gymName: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${gymName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2563eb;
      margin: 0;
      font-size: 28px;
    }
    .button {
      display: inline-block;
      background: #2563eb;
      color: #ffffff;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to ${gymName}!</h1>
    </div>

    <p>Hi ${name},</p>

    <p>Your account has been successfully created. You can now access the gym management system.</p>

    <p style="text-align: center;">
      <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" class="button">
        Login to Dashboard
      </a>
    </p>

    <p>If you have any questions, feel free to reach out to your gym administrator.</p>

    <div class="footer">
      <p>© ${new Date().getFullYear()} ${gymName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    await this.sendEmail({
      to: email,
      subject: `Welcome to ${gymName}!`,
      html,
      text: `Welcome to ${gymName}!\n\nYour account has been successfully created.`,
    });
  }

  /**
   * Send password changed notification
   */
  async sendPasswordChangedEmail(email: string, name: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>🔐 Password Changed</h2>

    <p>Hi ${name},</p>

    <p>Your password has been successfully changed.</p>

    <div class="warning">
      ⚠️ If you didn't make this change, please contact support immediately.
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} Gym Management System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    await this.sendEmail({
      to: email,
      subject: "Password Changed - Gym Management",
      html,
      text: `Your password has been successfully changed. If you didn't make this change, please contact support immediately.`,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();

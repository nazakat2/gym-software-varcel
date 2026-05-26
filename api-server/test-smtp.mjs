import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'mrsarimofficial@gmail.com',
    pass: 'kqarlivdpfxmuuez'
  }
});

console.log('🔄 Testing Gmail SMTP connection...');

transporter.sendMail({
  from: 'mrsarimofficial@gmail.com',
  to: 'nazakatkahn42501@gmail.com',
  subject: 'Test Email - Core X OTP System',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #8b5cf6;">Email Test Successful! 🎉</h1>
      <p>This is a test email to verify SMTP configuration.</p>
      <p>If you received this, the email service is working correctly.</p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
        <h2 style="color: #8b5cf6; font-size: 36px; letter-spacing: 8px; margin: 0;">123456</h2>
      </div>
      <p>This is how your OTP emails will look.</p>
    </div>
  `
}, (error, info) => {
  if (error) {
    console.log('❌ SMTP Error:', error.message);
    console.log('Full error:', error);
  } else {
    console.log('✅ Email sent successfully!');
    console.log('Response:', info.response);
    console.log('Message ID:', info.messageId);
  }
  process.exit(error ? 1 : 0);
});

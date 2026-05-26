const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'mrsarimofficial@gmail.com',
    pass: 'kqarlivdpfxmuuez'
  }
});

transporter.sendMail({
  from: 'mrsarimofficial@gmail.com',
  to: 'nazakatkahn42501@gmail.com',
  subject: 'Test Email - Core X',
  text: 'This is a test email to verify SMTP configuration.'
}, (error, info) => {
  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('✅ Email sent:', info.response);
  }
  process.exit(error ? 1 : 0);
});

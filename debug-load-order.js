// Simulates what bookings.js does at module init
require('dotenv').config();
console.log('SMTP_HOST at load time:', process.env.SMTP_HOST);
console.log('SMTP_PORT at load time:', process.env.SMTP_PORT);
console.log('SMTP_SECURE at load time:', process.env.SMTP_SECURE);
var transporter = null;
try {
  if (process.env.SMTP_HOST) {
    var nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
} catch(e) {
  console.error('Transporter creation error:', e.message);
}
console.log('Transporter:', !!transporter);

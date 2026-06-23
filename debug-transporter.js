require('dotenv').config();
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_SECURE:', process.env.SMTP_SECURE);
console.log('SMTP_USER:', process.env.SMTP_USER);

var nodemailer = require('nodemailer');
var transporter = null;
try {
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    console.log('Transporter created:', !!transporter);
    console.log('Transporter verified:', !!transporter.verify);
    transporter.verify().then(function() {
      console.log('Transporter VERIFIED OK');
    }).catch(function(e) {
      console.error('Transporter verify FAILED:', e.message);
    });
  } else {
    console.log('SMTP_HOST not set');
  }
} catch(e) {
  console.error('Transporter creation error:', e.message);
}

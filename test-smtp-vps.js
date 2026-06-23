var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
  host: 'mail.privateemail.com',
  port: 587,
  secure: false,
  auth: { user: 'listings@viewing.one', pass: 'geofreyBot1mail!' }
});
console.log('Sending test email...');
transporter.sendMail({
  from: '"Viewing.One Test" <listings@viewing.one>',
  to: 'hilmar.d.samuels@gmail.com',
  subject: 'SMTP Test from VPS',
  html: '<h1>Test</h1><p>If you see this, SMTP is working from the VPS.</p>'
}).then(function(info) {
  console.log('Email sent:', info.messageId);
}).catch(function(e) {
  console.error('SMTP error:', e.message, e.code);
});

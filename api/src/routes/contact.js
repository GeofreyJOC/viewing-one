// POST /api/contact — contact form submission → email to admin
const express = require('express');
var router = express.Router();

router.post('/', async function(req, res) {
  try {
    var name = (req.body.name || '').trim();
    var email = (req.body.email || '').trim();
    var message = (req.body.message || '').trim();

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Send email to admin
    try {
      var nodemailer = require('nodemailer');

      var transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mail.privateemail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || 'listings@viewing.one',
          pass: process.env.SMTP_PASS || ''
        },
        tls: { rejectUnauthorized: false }
      });

      var mailOptions = {
        from: process.env.SMTP_USER || 'listings@viewing.one',
        replyTo: email,
        to: process.env.ADMIN_EMAIL || 'admin@viewing.one',
        subject: 'Contact Form: ' + name + ' <' + email + '>',
        text: 'Name: ' + name + '\nEmail: ' + email + '\n\nMessage:\n' + message,
        html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">' +
          '<h2 style="color:#c9a96e;">New Contact Form Submission</h2>' +
          '<table style="width:100%;border-collapse:collapse;margin:16px 0;">' +
          '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;width:80px;">Name</td>' +
          '<td style="padding:8px;border:1px solid #ddd;">' + name + '</td></tr>' +
          '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Email</td>' +
          '<td style="padding:8px;border:1px solid #ddd;"><a href="mailto:' + email + '">' + email + '</a></td></tr>' +
          '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Message</td>' +
          '<td style="padding:8px;border:1px solid #ddd;white-space:pre-wrap;">' + message + '</td></tr>' +
          '</table></div>'
      };

      await transporter.sendMail(mailOptions);
    } catch (emailErr) {
      console.error('Contact email send error:', emailErr.message);
      // Don't fail the request if email fails — still log it
    }

    // Also log to admin panel via in-memory contact log
    if (!global.__contactMessages) global.__contactMessages = [];
    global.__contactMessages.push({
      name: name,
      email: email,
      message: message,
      receivedAt: new Date().toISOString()
    });

    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Contact route error:', error.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

module.exports = router;

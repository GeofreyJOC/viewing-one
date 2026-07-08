// POST /api/contact — contact form submission → email to admin
// Includes spam protection: honeypot, rate limiting, content validation
const express = require('express');
var router = express.Router();

// Simple in-memory rate limiter per IP
var rateLimitStore = {};

function getRateLimit(ip) {
  var now = Date.now();
  var windowMs = 3600000; // 1 hour
  var maxRequests = 5;    // max 5 per hour

  // Clean old entries
  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = { count: 0, windowStart: now };
  }

  var entry = rateLimitStore[ip];
  if (now - entry.windowStart > windowMs) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count++;
  return entry.count <= maxRequests;
}

// Gibberish detection — checks if a string looks randomly generated
function isGibberish(str) {
  if (!str) return false;
  var cleaned = str.replace(/[^a-zA-Z]/g, '');
  if (cleaned.length < 4) return false; // too short to judge

  // Count uppercase letters (random strings often have mixed case)
  var upperCount = (cleaned.match(/[A-Z]/g) || []).length;
  var upperRatio = upperCount / cleaned.length;

  // Count consecutive consonants (random strings have weird patterns)
  var consecConsonants = 0;
  var maxConsecConsonants = 0;
  for (var i = 0; i < str.length; i++) {
    if ('bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ'.indexOf(str[i]) !== -1) {
      consecConsonants++;
      if (consecConsonants > maxConsecConsonants) maxConsecConsonants = consecConsonants;
    } else {
      consecConsonants = 0;
    }
  }

  // Random strings often have high uppercase ratio or very long consonant runs
  return upperRatio > 0.5 || maxConsecConsonants > 8;
}

router.post('/', async function(req, res) {
  try {
    // 1. Honeypot check — hidden field that humans can't see, bots fill
    var honeypot = (req.body.website || req.body.url || '').trim();
    if (honeypot) {
      // Bot filled the hidden field — silently accept to not tip them off
      return res.json({ success: true, message: 'Message sent successfully.' });
    }

    // 2. Rate limiting by IP
    var clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    if (!getRateLimit(clientIp)) {
      return res.status(429).json({ success: false, message: 'Too many messages. Please try again later.' });
    }

    var name = (req.body.name || '').trim();
    var email = (req.body.email || '').trim();
    var message = (req.body.message || '').trim();

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // 3. Content validation — reject gibberish
    if (isGibberish(name) || isGibberish(message)) {
      // Silently accept to not teach bots what fails
      return res.json({ success: true, message: 'Message sent successfully.' });
    }

    // 4. Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    // 5. Check if name + message has content diversity (random bots often repeat)
    var uniqueChars = new Set((name + message).toLowerCase().split(''));
    if (uniqueChars.size < 10) {
      // Silently accept
      return res.json({ success: true, message: 'Message sent successfully.' });
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

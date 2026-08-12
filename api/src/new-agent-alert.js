// new-agent-alert.js — fires when a new agent registers on viewing.one
// Channels (all optional, fire-and-forget, never block registration):
//   1. Telegram → workgroup topic (env: TG_BOT_TOKEN, TG_CHAT_ID, TG_THREAD_ID)
//   2. Email → Hilmar (env: ALERT_EMAIL + existing SMTP_* vars)
//   3. Local log → api/.data/new-agents.log (always)
const https = require('https');
const fs = require('fs');
const path = require('path');

function logFile() {
  return path.join(__dirname, '..', '.data', 'new-agents.log');
}

function logAlert(agent) {
  try {
    const f = logFile();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, JSON.stringify({
      at: new Date().toISOString(),
      name: agent.name || '',
      email: agent.email || '',
      company: agent.companyName || '',
      slug: agent.slug || '',
      phone: agent.phone || '',
      plan: agent.plan || 'demo'
    }) + '\n');
  } catch (e) { console.error('Alert log error:', e.message); }
}

function zaTime() {
  try {
    return new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
  } catch (e) { return new Date().toString(); }
}

function postTelegram(text) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId) return Promise.resolve(false);
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };
  if (process.env.TG_THREAD_ID) payload.message_thread_id = process.env.TG_THREAD_ID;
  return new Promise(function (resolve) {
    const body = JSON.stringify(payload);
    const req = https.request('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, function (res) {
      let d = '';
      res.on('data', function (c) { d += c; });
      res.on('end', function () {
        try {
          const j = JSON.parse(d);
          if (!j.ok) console.error('TG alert API error:', JSON.stringify(j).slice(0, 300));
          resolve(!!j.ok);
        } catch (e) { console.error('TG alert response parse error:', d.slice(0, 200)); resolve(false); }
      });
    });
    req.on('error', function (e) { console.error('TG alert send error:', e.message); resolve(false); });
    req.write(body);
    req.end();
  });
}

function telegramText(agent) {
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  return '🚨 <b>New agent joined viewing.one</b>\n' +
    '👤 ' + esc(agent.name) + '\n' +
    '🏢 ' + esc(agent.companyName || '—') + '\n' +
    '📧 ' + esc(agent.email) + '\n' +
    '📞 ' + esc(agent.phone || '—') + '\n' +
    '🔗 https://viewing.one/' + esc(agent.slug) + '\n' +
    '🕐 ' + zaTime();
}

function alertEmail(agent) {
  const to = process.env.ALERT_EMAIL;
  if (!to || !process.env.SMTP_HOST) return Promise.resolve(false);
  try {
    var nodemailer = require('nodemailer');
    var t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    var pageUrl = 'https://viewing.one/' + agent.slug;
    var html = '<h2 style="color:#4f46e5;">New agent registered 🎉</h2>' +
      '<table cellpadding="6">' +
      '<tr><td><b>Name:</b></td><td>' + (agent.name || '') + '</td></tr>' +
      '<tr><td><b>Company:</b></td><td>' + (agent.companyName || '') + '</td></tr>' +
      '<tr><td><b>Email:</b></td><td>' + (agent.email || '') + '</td></tr>' +
      '<tr><td><b>Phone:</b></td><td>' + (agent.phone || '') + '</td></tr>' +
      '<tr><td><b>Plan:</b></td><td>' + (agent.plan || 'demo') + '</td></tr>' +
      '<tr><td><b>Agent page:</b></td><td><a href="' + pageUrl + '">' + pageUrl + '</a></td></tr>' +
      '<tr><td><b>Time:</b></td><td>' + zaTime() + '</td></tr>' +
      '</table>';
    return t.sendMail({
      from: '"Viewing.One Alerts" <' + (process.env.SMTP_USER || 'listings@viewing.one') + '>',
      to: to,
      subject: '🚨 New agent joined viewing.one: ' + (agent.name || '?') + ' (' + (agent.companyName || '') + ')',
      html: html
    }).then(function (info) {
      console.log('New-agent alert email sent:', info.messageId);
      return true;
    }).catch(function (e) {
      console.error('Alert email error:', e.message);
      return false;
    });
  } catch (e) {
    console.error('Alert email setup error:', e.message);
    return Promise.resolve(false);
  }
}

function notifyNewAgent(agent) {
  logAlert(agent);
  postTelegram(telegramText(agent));
  // Email channel intentionally disabled (Hilmar 2026-08-12): Telegram-only alerts
}

module.exports = { notifyNewAgent };

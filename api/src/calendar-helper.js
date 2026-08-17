// calendar-helper.js — Path 1: .ics generation + "Add to Calendar" links for booking notifications.
// No OAuth, no API keys. Works with Google Calendar, Outlook, Apple Calendar, and any client that reads .ics.

// Viewing slots are entered by agents as SA local time (SAST, UTC+2, no DST).
var SA_TZ_OFFSET_MS = 2 * 60 * 60 * 1000; // +02:00
var VIEWING_DURATION_MINUTES = 45; // default viewing length; bump when slots grow a duration field

function pad(n) { return (n < 10 ? '0' : '') + n; }

// Date -> iCal UTC "YYYYMMDDTHHMMSSZ"
function toIcsUtc(d) {
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
}

function toIsoUtc(d) {
  return d.toISOString();
}

// Escape a value for an iCal TEXT field
function icsEscape(text) {
  return String(text == null ? '' : text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function urlEscape(text) {
  return encodeURIComponent(String(text == null ? '' : text));
}

// Escape HTML for the email body
function htmlEscape(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseTime(t) {
  var m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  var hour = parseInt(m[1], 10);
  var minute = parseInt(m[2], 10);
  var second = m[3] ? parseInt(m[3], 10) : 0;
  var ampm = (m[4] || '').toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return { hour: hour, minute: minute, second: second };
}

// Interpret wall-clock (date + time) as SAST and return the correct absolute Date.
function wallClockToSastDate(y, mo, da, hour, minute, second) {
  return new Date(Date.UTC(y, mo - 1, da, hour, minute || 0, second || 0) - SA_TZ_OFFSET_MS);
}

// Parse a slot's date ("2026-08-20", "2026-08-20T00:00:00.000Z", or Date) + time ("10:00", "10:00 AM").
// Returns a Date, or null if it can't be parsed.
function parseSlotDateTime(date, time) {
  var y, mo, da, tm;
  if (date instanceof Date && !isNaN(date.getTime())) {
    y = date.getUTCFullYear(); mo = date.getUTCMonth() + 1; da = date.getUTCDate();
  } else if (typeof date === 'number') {
    var d2 = new Date(date);
    y = d2.getUTCFullYear(); mo = d2.getUTCMonth() + 1; da = d2.getUTCDate();
  } else {
    var ds = String(date || '').trim().slice(0, 10);
    var dm = ds.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dm) return null;
    y = parseInt(dm[1], 10); mo = parseInt(dm[2], 10); da = parseInt(dm[3], 10);
  }
  tm = parseTime(time);
  if (!tm) return null;
  return wallClockToSastDate(y, mo, da, tm.hour, tm.minute, tm.second);
}

// Build a .ics string for a viewing event.
// opts: { start: Date, end?: Date, title, description, location, uid?, organizerName?, organizerEmail? }
function buildIcs(opts) {
  var start = opts.start;
  var end = opts.end || new Date(start.getTime() + VIEWING_DURATION_MINUTES * 60000);
  var uid = opts.uid || ('viewing-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '@viewing.one');
  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Viewing.One//Viewing Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + toIcsUtc(new Date()),
    'DTSTART:' + toIcsUtc(start),
    'DTEND:' + toIcsUtc(end),
    'SUMMARY:' + icsEscape(opts.title || 'Viewing'),
    'DESCRIPTION:' + icsEscape(opts.description || ''),
    'LOCATION:' + icsEscape(opts.location || ''),
    'STATUS:CONFIRMED'
  ];
  if (opts.organizerEmail) {
    lines.push('ORGANIZER;CN=' + icsEscape(opts.organizerName || 'Viewing.One') + ':mailto:' + opts.organizerEmail);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// Build "Add to Calendar" deep links.
// opts: { start: Date, end?: Date, title, description, location }
function buildCalendarLinks(opts) {
  var start = opts.start;
  var end = opts.end || new Date(start.getTime() + VIEWING_DURATION_MINUTES * 60000);
  var title = opts.title || 'Viewing';
  var details = opts.description || '';
  var location = opts.location || '';
  var startIcs = toIcsUtc(start);
  var endIcs = toIcsUtc(end);
  var google = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + urlEscape(title) +
    '&dates=' + startIcs + '/' + endIcs +
    '&details=' + urlEscape(details) +
    '&location=' + urlEscape(location);
  var outlook = 'https://outlook.live.com/calendar/0/action/compose' +
    '?subject=' + urlEscape(title) +
    '&startdt=' + toIsoUtc(start) +
    '&enddt=' + toIsoUtc(end) +
    '&body=' + urlEscape(details) +
    '&location=' + urlEscape(location);
  return { google: google, outlook: outlook };
}

module.exports = {
  VIEWING_DURATION_MINUTES: VIEWING_DURATION_MINUTES,
  toIcsUtc: toIcsUtc,
  toIsoUtc: toIsoUtc,
  icsEscape: icsEscape,
  htmlEscape: htmlEscape,
  parseSlotDateTime: parseSlotDateTime,
  buildIcs: buildIcs,
  buildCalendarLinks: buildCalendarLinks
};

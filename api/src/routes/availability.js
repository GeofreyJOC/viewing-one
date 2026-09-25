// availability.js — Seller availability links + two-stage slot publishing.
//
// Flow: seller marks available times via a tokenised link  ->  slots land on the
// property as { source:'seller', status:'pending' }  ->  agent publishes selected
// slots  ->  { status:'published' }  ->  buyer sees them (existing booking flow).
//
// Agent-added slots can be published directly (vacant properties, agent discretion).
//
// Exports two routers:
//   agent  -> mounted at /api/availability  (JWT auth)
//   seller -> mounted at /api/seller        (public, token-gated)

const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { ObjectId } = require('mongodb');

// ---- email transport (same env as the rest of the app) ----
var transporter = null;
try {
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
} catch (e) {}

var JWT_SECRET = process.env.JWT_SECRET || 'viewingone-dev-secret-key-2026';

// ---- helpers ----
function getDb() {
  try {
    var p = typeof global.getMongoDbPromise === 'function' ? global.getMongoDbPromise() : global.__mongoDbPromise;
    if (p) return p;
  } catch (e) {}
  return null;
}

function persistCache() {
  try { require('fs').writeFileSync('/tmp/properties.json', JSON.stringify(global.__inMemoryProperties || [])); } catch (e) {}
}

function memFind(id) {
  if (!global.__inMemoryProperties) return null;
  return global.__inMemoryProperties.find(function (p) {
    return String(p._id) === String(id) || p.id === id;
  }) || null;
}

function idQuery(id) {
  return /^[0-9a-f]{24}$/i.test(String(id)) ? { _id: new ObjectId(String(id)) } : { _id: String(id) };
}

async function getPropRef(id) {
  var mem = memFind(id);
  if (mem) return mem;
  try {
    var db = await getDb();
    if (db) {
      var doc = await db.collection('properties').findOne(idQuery(id));
      if (doc) {
        doc._id = String(doc._id);
        if (!global.__inMemoryProperties) global.__inMemoryProperties = [];
        global.__inMemoryProperties.push(doc);
        return doc;
      }
    }
  } catch (e) {}
  return null;
}

async function findByToken(tok) {
  if (!tok) return null;
  var m = (global.__inMemoryProperties || []).find(function (p) { return p.sellerToken === tok; });
  if (m) return m;
  try {
    var fs = require('fs');
    if (fs.existsSync('/tmp/properties.json')) {
      var arr = JSON.parse(fs.readFileSync('/tmp/properties.json', 'utf8')) || [];
      var f = arr.find(function (p) { return p.sellerToken === tok; });
      if (f) {
        global.__inMemoryProperties = global.__inMemoryProperties || [];
        global.__inMemoryProperties.push(f);
        return f;
      }
    }
  } catch (e) {}
  try {
    var db = await getDb();
    if (db) {
      var doc = await db.collection('properties').findOne({ sellerToken: tok });
      if (doc) {
        doc._id = String(doc._id);
        global.__inMemoryProperties = global.__inMemoryProperties || [];
        global.__inMemoryProperties.push(doc);
        return doc;
      }
    }
  } catch (e) {}
  return null;
}

async function persistProp(prop) {
  persistCache();
  try {
    var db = await getDb();
    if (db) {
      await db.collection('properties').updateOne(idQuery(prop._id), {
        $set: {
          viewingSlots: prop.viewingSlots || [],
          sellerToken: prop.sellerToken || '',
          availability: prop.availability || null,
          notifySeller: !!prop.notifySeller,
          sellerName: prop.sellerName || '',
          sellerEmail: prop.sellerEmail || '',
          updatedAt: new Date()
        }
      });
    }
  } catch (e) {}
}

function verifyAuth(req) {
  var h = req.header('Authorization') || '';
  var t = h.replace('Bearer ', '');
  if (!t) return null;
  try { return require('jsonwebtoken').verify(t, JWT_SECRET); }
  catch (e) {
    try { return require('jsonwebtoken').verify(t, 'viewing-one-dev-secret'); } catch (e2) { return null; }
  }
}

function defaultAvailability(prop) {
  var a = prop.availability || {};
  var days = (Array.isArray(a.daysOfWeek) ? a.daysOfWeek : []).map(function (d) { return parseInt(d, 10); })
    .filter(function (d) { return d >= 0 && d <= 6; });
  return {
    windowStart: a.windowStart || '08:00',
    windowEnd: a.windowEnd || '20:00',
    slotMinutes: parseInt(a.slotMinutes, 10) || 60,
    daysOfWeek: days.length ? days : [0, 1, 2, 3, 4, 5, 6]
  };
}

async function resolveAgent(prop) {
  var agent = null;
  var email = prop.agentEmail || null;
  var agents = global.__inMemoryAgents || [];
  agent = agents.find(function (a) { return a._id === prop.agentId || a.id === prop.agentId; }) || null;
  if (!agent) {
    try {
      var db = await getDb();
      if (db && prop.agentId) {
        var q = /^[0-9a-f]{24}$/i.test(String(prop.agentId)) ? { _id: new ObjectId(String(prop.agentId)) } : { _id: String(prop.agentId) };
        agent = await db.collection('agents').findOne(q);
      }
    } catch (e) {}
  }
  return {
    name: (agent && agent.name) || 'your agent',
    companyName: (agent && agent.companyName) || '',
    email: (agent && agent.email) || email || null
  };
}

function sortSlots(arr) {
  return (arr || []).slice().sort(function (a, b) {
    return String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time));
  });
}

// ---------------------------------------------------------------------------
// Agent router (JWT protected)
// ---------------------------------------------------------------------------
const agentRouter = express.Router();

// Create (or return) the seller availability link. POST body { regenerate?:bool }
agentRouter.post('/:propertyId/link', async function (req, res) {
  try {
    var decoded = verifyAuth(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Auth required' });

    var prop = await getPropRef(req.params.propertyId);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found' });

    var wantNew = !!req.body.regenerate;
    if (!prop.sellerToken || wantNew) {
      prop.sellerToken = crypto.randomBytes(16).toString('hex');
      await persistProp(prop);
    }
    res.json({ success: true, token: prop.sellerToken, url: 'https://viewing.one/s/' + prop.sellerToken });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Revoke the seller link (clears the token — old link stops working).
agentRouter.delete('/:propertyId/link', async function (req, res) {
  try {
    var decoded = verifyAuth(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Auth required' });
    var prop = await getPropRef(req.params.propertyId);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found' });
    prop.sellerToken = '';
    await persistProp(prop);
    res.json({ success: true, message: 'Seller link revoked' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Update viewing settings for this property.
agentRouter.post('/:propertyId/settings', async function (req, res) {
  try {
    var decoded = verifyAuth(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Auth required' });
    var prop = await getPropRef(req.params.propertyId);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found' });

    var b = req.body || {};
    var a = defaultAvailability(prop);
    if (b.windowStart) a.windowStart = b.windowStart;
    if (b.windowEnd) a.windowEnd = b.windowEnd;
    if (b.slotMinutes) a.slotMinutes = parseInt(b.slotMinutes, 10) || 60;
    if (typeof b.daysOfWeek !== 'undefined') {
      var dd = (Array.isArray(b.daysOfWeek) ? b.daysOfWeek : []).map(function (x) { return parseInt(x, 10); })
        .filter(function (x) { return x >= 0 && x <= 6; });
      a.daysOfWeek = dd.length ? dd : [0, 1, 2, 3, 4, 5, 6];
    }
    prop.availability = a;
    if (typeof b.notifySeller !== 'undefined') prop.notifySeller = !!b.notifySeller;
    if (typeof b.sellerName !== 'undefined') prop.sellerName = b.sellerName || '';
    if (typeof b.sellerEmail !== 'undefined') prop.sellerEmail = b.sellerEmail || '';
    await persistProp(prop);
    res.json({ success: true, settings: { availability: a, notifySeller: !!prop.notifySeller, sellerName: prop.sellerName || '', sellerEmail: prop.sellerEmail || '' } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Publish selected slots (make them bookable by buyers).
agentRouter.post('/:propertyId/publish', async function (req, res) {
  try {
    var decoded = verifyAuth(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Auth required' });
    var prop = await getPropRef(req.params.propertyId);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found' });

    var ids = (req.body && req.body.slotIds) || [];
    var set = {};
    ids.forEach(function (i) { set[i] = true; });
    var n = 0;
    (prop.viewingSlots || []).forEach(function (s) {
      if (set[s.id] && s.status !== 'booked') { s.status = 'published'; n++; }
    });
    prop.viewingSlots = sortSlots(prop.viewingSlots);
    await persistProp(prop);
    res.json({ success: true, published: n });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Unpublish selected slots (back to pending — only if not booked).
agentRouter.post('/:propertyId/unpublish', async function (req, res) {
  try {
    var decoded = verifyAuth(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Auth required' });
    var prop = await getPropRef(req.params.propertyId);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found' });

    var ids = (req.body && req.body.slotIds) || [];
    var set = {};
    ids.forEach(function (i) { set[i] = true; });
    var n = 0;
    (prop.viewingSlots || []).forEach(function (s) {
      if (set[s.id] && s.status !== 'booked') { s.status = 'pending'; n++; }
    });
    prop.viewingSlots = sortSlots(prop.viewingSlots);
    await persistProp(prop);
    res.json({ success: true, unpublished: n });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// Public seller router (token gated)
// ---------------------------------------------------------------------------
const sellerRouter = express.Router();

sellerRouter.get('/:token', async function (req, res) {
  try {
    var prop = await findByToken(req.params.token);
    if (!prop) return res.status(404).json({ success: false, message: 'This availability link is no longer valid.' });
    var agent = await resolveAgent(prop);
    var slots = (prop.viewingSlots || []).filter(function (s) {
      return s.source === 'seller' || s.status === 'booked' || s.status === 'published';
    }).map(function (s) {
      return { id: s.id, date: s.date, time: s.time, status: s.status || 'pending', source: s.source || 'agent' };
    });
    res.json({
      success: true,
      property: { id: String(prop._id), title: prop.title || 'Property', location: prop.location || '' },
      agent: { name: agent.name, companyName: agent.companyName },
      settings: defaultAvailability(prop),
      slots: sortSlots(slots),
      sellerName: prop.sellerName || ''
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

sellerRouter.post('/:token', async function (req, res) {
  try {
    var prop = await findByToken(req.params.token);
    if (!prop) return res.status(404).json({ success: false, message: 'This availability link is no longer valid.' });

    var incoming = ((req.body && req.body.slots) || []).filter(function (s) {
      return s && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && /^\d{1,2}:\d{2}/.test(String(s.time || ''));
    }).map(function (s) {
      return { date: s.date, time: String(s.time).slice(0, 5) };
    });

    var existing = prop.viewingSlots || [];
    // Locked = anything already public or booked. Never removed by the seller.
    var locked = existing.filter(function (s) { return s.status === 'booked' || s.status === 'published'; });
    // Agent-sourced pending slots are also left alone (agent entered them manually).
    var agentPending = existing.filter(function (s) { return s.source === 'agent' && s.status !== 'booked' && s.status !== 'published'; });

    function isLocked(d, t) { return locked.some(function (k) { return k.date === d && k.time === t; }); }

    var newPending = incoming.filter(function (iv) { return !isLocked(iv.date, iv.time); }).map(function (iv) {
      return {
        id: crypto.randomUUID(),
        date: iv.date,
        time: iv.time,
        source: 'seller',
        status: 'pending',
        maxBookings: 10,
        currentBookings: 0,
        bookings: [],
        bookingCount: 0,
        isActive: true,
        createdAt: new Date().toISOString()
      };
    });

    prop.viewingSlots = sortSlots(locked.concat(agentPending, newPending));
    await persistProp(prop);

    // Notify the agent that the seller submitted availability.
    var agent = await resolveAgent(prop);
    if (transporter && agent.email) {
      try {
        await transporter.sendMail({
          from: '"Viewing.One" <listings@viewing.one>',
          to: agent.email,
          subject: 'Seller availability submitted: ' + (prop.title || 'Property'),
          html: '<h2>Seller availability submitted</h2>' +
            '<p><strong>Property:</strong> ' + (prop.title || '') + '</p>' +
            '<p><strong>Times submitted:</strong> ' + newPending.length + '</p>' +
            '<p>The seller has marked when they are available for viewings. ' +
            '<a href="https://viewing.one/dashboard.html">Open your dashboard</a> to review and publish the ones you can attend.</p>' +
            '<hr><p style="color:#888;">Viewing.One - Property Viewing Management</p>'
        });
      } catch (e2) { console.error('Seller availability email error:', e2.message); }
    }

    res.json({ success: true, submitted: newPending.length, agent: { name: agent.name, companyName: agent.companyName } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = { agent: agentRouter, seller: sellerRouter };

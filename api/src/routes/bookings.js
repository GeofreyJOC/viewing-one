const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

let Property;
let Agent;
try {
  Property = require('../models/Property');
  Agent = require('../models/Agent');
} catch (e) {
  Property = null;
  Agent = null;
}

// Email transport for agent notifications
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
} catch(e) {}

async function resolveAgentEmail(propertyId) {
  // Try to find the agent email from in-memory, gist, or MongoDB
  var prop = (global.__inMemoryProperties || []).find(function(p) { return p._id === propertyId || p.id === propertyId; });
  if (prop && prop.agentEmail) return prop.agentEmail;
  if (prop && prop.agentId) {
    // Try gist
    try {
      var gist = require('../gist-persistence');
      var email = await new Promise(function(re) {
        gist.getAgent(prop.agentId, function(err, agent) {
          if (err || !agent) { re(null); return; }
          re(agent.email || null);
        });
      });
      if (email) return email;
    } catch(e) {}
    // Try in-memory agents
    var agents = global.__inMemoryAgents || [];
    var a = agents.find(function(a) { return a.id === prop.agentId || a._id === prop.agentId; });
    if (a) return a.email;
  }
  return null;
}

async function notifyAgentBooking(agentEmail, propertyTitle, visitorName, visitorWhatsApp, visitorEmail, date, time) {
  if (!transporter || !agentEmail) return;
  try {
    var isRequest = (date === 'To be arranged');
    await transporter.sendMail({
      from: '"Viewing.One" <bookings@viewing.one>',
      to: agentEmail,
      subject: (isRequest ? 'New Viewing Request: ' : 'New Viewing Booking: ') + propertyTitle,
      html: '<h2>' + (isRequest ? 'New Viewing Request' : 'New Viewing Booking') + '</h2>' +
        '<p><strong>Property:</strong> ' + propertyTitle + '</p>' +
        (isRequest
          ? '<p><strong>Status:</strong> ⏳ No time set yet - <a href="https://viewing.one/dashboard.html">Set a viewing time</a></p>'
          : '<p><strong>Date:</strong> ' + date + '</p>' +
            '<p><strong>Time:</strong> ' + time + '</p>'
        ) +
        '<p><strong>Visitor:</strong> ' + visitorName + '</p>' +
        '<p><strong>WhatsApp:</strong> ' + visitorWhatsApp + '</p>' +
        (visitorEmail ? '<p><strong>Email:</strong> ' + visitorEmail + '</p>' : '') +
        '<hr><p style="color:#888;">Viewing.One - Property Viewing Management</p>'
    });
  } catch(e) {
    console.error('Booking notification email error:', e.message);
  }
}

// POST /api/bookings - Create a new booking
router.post('/', async (req, res) => {
  try {
    const { propertyId, slotId, visitorName, visitorWhatsApp, visitorEmail } = req.body;

    if (!propertyId || !slotId || !visitorName || !visitorWhatsApp || !visitorEmail) {
      return res.status(400).json({
        success: false,
        message: 'Property ID, slot ID, visitor name, WhatsApp, and email are required'
      });
    }

    var agentEmail = null;

    if (Property) {
      try {
        const property = await Property.findById(propertyId);
        if (!property) {
          return res.status(404).json({ success: false, message: 'Property not found' });
        }
        if (property.status !== 'active') {
          return res.status(400).json({ success: false, message: 'This property is not available' });
        }

        if (slotId === '__request__') {
          // No time slot selected - visitor requests the agent to set a time
          if (!property.viewingRequests) property.viewingRequests = [];
          property.viewingRequests.push({
            visitorName: visitorName,
            visitorWhatsApp: visitorWhatsApp,
            visitorEmail: visitorEmail || '',
            requestedAt: new Date()
          });
          await property.save();

          if (Agent) {
            try {
              const agent = await Agent.findById(property.agentId);
              if (agent) agentEmail = agent.email;
            } catch(e) {}
          }

          notifyAgentBooking(agentEmail, property.title, visitorName, visitorWhatsApp, visitorEmail, 'To be arranged', 'To be arranged');

          return res.status(201).json({
            success: true, message: 'Viewing request sent! The agent will contact you with available times.',
            booking: { propertyTitle: property.title, date: 'To be arranged', time: 'To be arranged', visitorName }
          });
        }

        const slot = property.viewingSlots.find(function(s) { var sid = (s._doc && s._doc.id) || s.id || s._id; return sid === slotId || String(s._id) === slotId; });
        if (!slot) {
          throw new Error('Slot not found in Mongoose, falling through');
        }

        // Allow multiple bookings per slot
        if (!slot.bookings) slot.bookings = [];
        slot.bookings.push({
          visitorName: visitorName,
          visitorWhatsApp: visitorWhatsApp,
          visitorEmail: visitorEmail || '',
          bookedAt: new Date()
        });
        slot.bookingCount = slot.bookings.length;
        property.bookingCount = (property.bookingCount || 0) + 1;
        await property.save();

        if (Agent) {
          try {
            const agent = await Agent.findById(property.agentId);
            if (agent) agentEmail = agent.email;
          } catch(e) {}
        }

        // Send email notification async (don't block response)
        notifyAgentBooking(agentEmail, property.title, visitorName, visitorWhatsApp, visitorEmail, slot.date, slot.time);

        return res.status(201).json({
          success: true, message: 'Viewing booked successfully!',
          booking: { propertyTitle: property.title, date: slot.date, time: slot.time, visitorName }
        });
      } catch (dbErr) {
        // Fall through to in-memory
      }
    }

    // In-memory fallback
    var prop = global.__inMemoryProperties?.find(p => String(p._id) === propertyId || p.id === propertyId);
    if (!prop) {
      // Fallback: try MongoDB directly
      try {
        var mP = typeof global.getMongoDbPromise === 'function' ? global.getMongoDbPromise() : null;
        if (mP) {
          var mDbP = await mP;
          if (mDbP) {
            var findId = propertyId;
            var findQ = /^[0-9a-f]{24}$/i.test(findId)
              ? { _id: new (require('mongodb').ObjectId)(findId) }
              : { _id: findId };
            var mDoc = await mDbP.collection('properties').findOne(findQ);
            if (mDoc) {
              mDoc._id = String(mDoc._id);
              prop = mDoc;
              // Cache in memory for this instance
              if (!global.__inMemoryProperties) global.__inMemoryProperties = [];
              global.__inMemoryProperties.push(mDoc);
            }
          }
        }
      } catch(e2) { console.error('Booking MongoDB fallback error:', e2.message); }
    }
    if (!prop) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    // Resolve agent email from property (for notification)
    if (!agentEmail) {
      try { agentEmail = await resolveAgentEmail(propertyId); } catch(e) {}
    }

    if (slotId === '__request__') {
      // Request mode - add to viewingRequests
      if (!prop.viewingRequests) prop.viewingRequests = [];
      prop.viewingRequests.push({
        visitorName: visitorName,
        visitorWhatsApp: visitorWhatsApp,
        visitorEmail: visitorEmail || '',
        requestedAt: new Date()
      });

      // Sync to gist (blocking)
      try {
        var gistR = require('../gist-persistence');
        await new Promise(function(resolve) {
          gistR.saveProperty(prop, function(err) {
            if (err) console.error('Gist request save error:', err.message);
            resolve();
          });
        });
      } catch(e) { console.error('Gist request save exception:', e.message); }
      
      // Sync viewingRequests to MongoDB for cross-instance visibility
      try {
        var pR = typeof global.getMongoDbPromise === 'function' ? global.getMongoDbPromise() : null;
        if (pR) {
          var mDbR = await pR;
          if (mDbR) {
            var propIdStrR = String(prop._id || prop.id);
            var matchQueryR = /^[0-9a-f]{24}$/i.test(propIdStrR)
              ? { _id: new (require('mongodb').ObjectId)(propIdStrR) }
              : { _id: propIdStrR };
            await mDbR.collection('properties').updateOne(
              matchQueryR,
              { $set: { viewingRequests: prop.viewingRequests || [] } }
            );
          }
        }
      } catch(e) { console.error('MongoDB request sync error:', e.message); }

      // Send notification email async
      notifyAgentBooking(agentEmail, prop.title, visitorName, visitorWhatsApp, visitorEmail, 'To be arranged', 'To be arranged');

      return res.status(201).json({
        success: true, message: 'Viewing request sent! The agent will contact you with available times.',
        booking: { propertyTitle: prop.title, date: 'To be arranged', time: 'To be arranged', visitorName }
      });
    }

    const slot = prop.viewingSlots.find(s => s.id === slotId || s._id === slotId);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    // Allow multiple bookings per slot
    if (!slot.bookings) slot.bookings = [];
    slot.bookings.push({
      visitorName: visitorName,
      visitorWhatsApp: visitorWhatsApp,
      visitorEmail: visitorEmail || '',
      bookedAt: new Date()
    });
    slot.bookingCount = slot.bookings.length;

    // Persist booking to Gist (blocking — ensures cross-instance consistency)
    try {
      var gistBook = require('../gist-persistence');
      await new Promise(function(resolve) {
        gistBook.saveProperty(prop, function(err) {
          if (err) console.error('Gist booking save error:', err.message);
          resolve();
        });
      });
      // Also cache to /tmp for same-VM failover
      try {
        var fs = require('fs');
        var existing = [];
        if (fs.existsSync('/tmp/properties.json')) {
          existing = JSON.parse(fs.readFileSync('/tmp/properties.json', 'utf8')) || [];
        }
        var found = existing.findIndex(function(op) { return op._id === prop._id; });
        if (found !== -1) existing[found] = prop;
        else existing.push(prop);
        fs.writeFileSync('/tmp/properties.json', JSON.stringify(existing));
      } catch(e2) {}
    } catch(e){ console.error('Gist booking save exception:', e.message); }
    
    // Sync booking to MongoDB for cross-instance visibility
    try {
      var p = typeof global.getMongoDbPromise === 'function' ? global.getMongoDbPromise() : null;
      if (p) {
        var mDb = await p;
        if (mDb) {
          var propIdStr = String(prop._id || prop.id);
          var matchQuery = /^[0-9a-f]{24}$/i.test(propIdStr)
            ? { _id: new (require('mongodb').ObjectId)(propIdStr) }
            : { _id: propIdStr };
          await mDb.collection('properties').updateOne(
            matchQuery,
            { $set: { viewingSlots: prop.viewingSlots || [], viewingRequests: prop.viewingRequests || [] } }
          );
        }
      }
    } catch(e2) { console.error('MongoDB booking sync error:', e2.message); }

    // Send notification email async
    notifyAgentBooking(agentEmail, prop.title, visitorName, visitorWhatsApp, visitorEmail, slot.date, slot.time);

    res.status(201).json({
      success: true, message: 'Viewing booked successfully!',
      booking: { propertyTitle: prop.title, date: slot.date, time: slot.time, visitorName }
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ success: false, message: 'Server error creating booking' });
  }
});

// GET /api/bookings/agent-bookings - Get all bookings for an agent's properties
router.get('/agent-bookings', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Auth required' });
    let decoded;
    try { decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'viewing-one-dev-secret'); }
    catch(e) { return res.status(401).json({ success: false, message: 'Invalid token' }); }

    // Try MongoDB first (only return if it has data)
    if (Property) {
      try {
        const properties = await Property.find({ agentId: decoded.id, status: 'active' });
        if (properties && properties.length > 0) {
          var allBookings = [];
          properties.forEach(function(p) {
            // Regular booking slots
            (p.viewingSlots || []).forEach(function(s) {
              (s.bookings || []).forEach(function(b) {
                allBookings.push({
                  propertyTitle: p.title,
                  propertyId: p._id,
                  slotDate: s.date,
                  slotTime: s.time,
                  visitorName: b.visitorName,
                  visitorWhatsApp: b.visitorWhatsApp,
                  visitorEmail: b.visitorEmail,
                  bookedAt: b.bookedAt
                });
              });
            });
            // Viewing requests (no time set yet)
            (p.viewingRequests || []).forEach(function(r) {
              allBookings.push({
                propertyTitle: p.title,
                propertyId: p._id,
                slotDate: 'To be arranged',
                slotTime: 'To be arranged',
                isRequest: true,
                visitorName: r.visitorName,
                visitorWhatsApp: r.visitorWhatsApp,
                visitorEmail: r.visitorEmail,
                bookedAt: r.requestedAt
              });
            });
          });
          return res.json({ success: true, bookings: allBookings });
        }
      } catch(e) {}
    }

    // Priority: Gist is authoritative source of truth
    var props = [];
    var fs = require('fs');
    try {
      var gistB = require('../gist-persistence');
      var gistResult = await new Promise(function(resolve) {
        gistB.getPropertiesByAgent(decoded.id, function(err, results) {
          if (err) { resolve(null); return; }
          resolve(results || []);
        });
      });
      if (gistResult && gistResult.length > 0) {
        props = gistResult.filter(function(p) { return p.status === 'active'; });
        // Sync to /tmp for warm-cache
        try {
          var existing = [];
          if (fs.existsSync('/tmp/properties.json')) {
            existing = JSON.parse(fs.readFileSync('/tmp/properties.json', 'utf8')) || [];
          }
          props.forEach(function(np) {
            var found = existing.findIndex(function(op) { return op._id === np._id; });
            if (found !== -1) existing[found] = np;
            else existing.push(np);
          });
          fs.writeFileSync('/tmp/properties.json', JSON.stringify(existing));
        } catch(e2) {}
        // Also update in-memory
        if (global.__inMemoryProperties) {
          props.forEach(function(np) {
            var found = global.__inMemoryProperties.findIndex(function(ip) { return ip._id === np._id; });
            if (found !== -1) global.__inMemoryProperties[found] = np;
            else global.__inMemoryProperties.push(np);
          });
        }
      }
    } catch(e) {}
    
    // Fallback: /tmp cache (cosmetic only — same VM)
    if (!props.length) {
      try {
        if (fs.existsSync('/tmp/properties.json')) {
          var cached = JSON.parse(fs.readFileSync('/tmp/properties.json', 'utf8')) || [];
          props = cached.filter(function(p) {
            return p.agentId === decoded.id && p.status !== 'deleted';
          });
        }
      } catch(e2) {}
    }
    
    // Last fallback: in-memory (local instance only)
    if (!props.length) {
      props = (global.__inMemoryProperties || []).filter(function(p) {
        return p.agentId === decoded.id && p.status === 'active';
      });
    }
    
    var bookings = [];
    props.forEach(function(p) {
      (p.viewingSlots || []).forEach(function(s) {
        (s.bookings || []).forEach(function(b) {
          bookings.push({
            propertyTitle: p.title,
            propertyId: p._id,
            slotId: s.id || s._id,
            slotDate: s.date,
            slotTime: s.time,
            visitorName: b.visitorName,
            visitorWhatsApp: b.visitorWhatsApp,
            visitorEmail: b.visitorEmail,
            bookedAt: b.bookedAt
          });
        });
      });
      (p.viewingRequests || []).forEach(function(r) {
        bookings.push({
          propertyTitle: p.title,
          propertyId: p._id,
          slotDate: 'To be arranged',
          slotTime: 'To be arranged',
          isRequest: true,
          visitorName: r.visitorName,
          visitorWhatsApp: r.visitorWhatsApp,
          visitorEmail: r.visitorEmail,
          bookedAt: r.requestedAt
        });
      });
    });
    res.json({ success: true, bookings: bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/bookings/:propertyId/:slotId/:visitorEmail - Cancel a booking
router.delete('/:propertyId/:slotId/:visitorEmail', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Auth required' });
    let decoded;
    try { decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'viewing-one-dev-secret'); }
    catch(e) { return res.status(401).json({ success: false, message: 'Invalid token' }); }

    const { propertyId, slotId, visitorEmail } = req.params;
    const decodedEmail = decodeURIComponent(visitorEmail);

    // Find property in-memory first
    var props = global.__inMemoryProperties || [];
    var prop = props.find(function(p) { return p._id === propertyId || p.id === propertyId; });
    
    // Also try gist
    if (!prop) {
      try {
        var gistDel = require('../gist-persistence');
        prop = await new Promise(function(resolve) {
          gistDel.readData(function(err, data) {
            if (err || !data || !data.properties) return resolve(null);
            var found = data.properties.find(function(p) { return p._id === propertyId || p.id === propertyId; });
            resolve(found || null);
          });
        });
        // Sync to in-memory
        if (prop && global.__inMemoryProperties) {
          global.__inMemoryProperties.push(prop);
        }
      } catch(e) {}
    }

    if (!prop) return res.status(404).json({ success: false, message: 'Property not found' });
    if (prop.agentId !== decoded.id) return res.status(403).json({ success: false, message: 'Not your property' });

    var removed = false;

    // Try to remove from viewing slots
    (prop.viewingSlots || []).forEach(function(slot) {
      if (slot.id === slotId || slot._id === slotId) {
        var before = (slot.bookings || []).length;
        slot.bookings = (slot.bookings || []).filter(function(b) {
          return b.visitorEmail !== decodedEmail;
        });
        if ((slot.bookings || []).length < before) {
          removed = true;
          slot.bookingCount = slot.bookings.length;
        }
      }
    });

    // Try to remove from viewing requests
    if (!removed) {
      var before = (prop.viewingRequests || []).length;
      prop.viewingRequests = (prop.viewingRequests || []).filter(function(r) {
        return r.visitorEmail !== decodedEmail;
      });
      if ((prop.viewingRequests || []).length < before) removed = true;
    }

    if (!removed) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Persist to gist
    try {
      var gistSave = require('../gist-persistence');
      await new Promise(function(resolve) {
        gistSave.saveProperty(prop, function(err) {
          if (err) console.error('Gist delete booking save error:', err.message);
          resolve();
        });
      });
    } catch(e) { console.error('Gist delete booking exception:', e.message); }

    res.json({ success: true, message: 'Booking cancelled' });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

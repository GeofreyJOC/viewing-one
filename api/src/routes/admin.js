const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'viewing-one-dev-secret';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@viewing.one').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Middleware: verify admin JWT
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid or expired admin token' });
  }
}

// GET /api/admin/stats — dashboard stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    var agents = global.__inMemoryAgents || [];
    var properties = global.__inMemoryProperties || [];
    var bookings = global.__bookingCache || [];

    // Try MongoDB for more accurate counts
    var mongoAgentCount = 0, mongoPropCount = 0, mongoBookingCount = 0;
    try {
      if (typeof global.getMongoDbPromise === 'function') {
        var db = await Promise.race([
          global.getMongoDbPromise(),
          new Promise(function(r) { setTimeout(function() { r('__TIMEOUT__'); }, 5000); })
        ]);
        if (db && db !== '__TIMEOUT__') {
          mongoAgentCount = await db.collection('agents').countDocuments();
          mongoPropCount = await db.collection('properties').countDocuments();
          mongoBookingCount = await db.collection('bookings').countDocuments();
        }
      }
    } catch(e) {}

    res.json({
      success: true,
      stats: {
        agents: Math.max(agents.length, mongoAgentCount),
        properties: Math.max(properties.length, mongoPropCount),
        bookings: Math.max(bookings.length, mongoBookingCount),
        activeProperties: properties.filter(function(p) { return p.status !== 'hidden' && p.isActive !== false; }).length,
        inMemoryAgents: agents.length,
        inMemoryProps: properties.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/agents — list all agents
router.get('/agents', requireAdmin, async (req, res) => {
  try {
    var agents = global.__inMemoryAgents || [];

    // Enhance with MongoDB data
    try {
      if (typeof global.getMongoDbPromise === 'function') {
        var db = await Promise.race([
          global.getMongoDbPromise(),
          new Promise(function(r) { setTimeout(function() { r('__TIMEOUT__'); }, 5000); })
        ]);
        if (db && db !== '__TIMEOUT__') {
          var mongoAgents = await db.collection('agents').find({}).toArray();
          // Merge: MongoDB has the most accurate data
          var merged = {};
          mongoAgents.forEach(function(a) { merged[a.email] = a; });
          agents.forEach(function(a) {
            if (!merged[a.email]) merged[a.email] = a;
            else {
              // Merge fields, prefer in-memory for active session data
              Object.keys(a).forEach(function(k) { merged[a.email][k] = a[k]; });
            }
          });
          agents = Object.values(merged);
        }
      }
    } catch(e) {}

    // Sanitize: remove password hashes
    var safe = agents.map(function(a) {
      var out = {};
      Object.keys(a).forEach(function(k) {
        if (k !== 'password' && k !== 'resetToken' && k !== 'resetTokenExpiry' && k !== '__v') {
          out[k] = a[k];
        }
      });
      return out;
    });

    // Count properties per agent
    var properties = global.__inMemoryProperties || [];
    safe.forEach(function(a) {
      a.propertyCount = properties.filter(function(p) {
        return p.agentEmail === a.email || p.createdBy === a._id;
      }).length;
    });

    res.json({ success: true, agents: safe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/agents/:id — single agent details
router.get('/agents/:id', requireAdmin, async (req, res) => {
  try {
    var agents = global.__inMemoryAgents || [];
    var agent = agents.find(function(a) {
      return a._id && (String(a._id) === req.params.id || a.email === req.params.id);
    });

    if (!agent) {
      // Try MongoDB
      try {
        if (typeof global.getMongoDbPromise === 'function') {
          var db = await Promise.race([
            global.getMongoDbPromise(),
            new Promise(function(r) { setTimeout(function() { r('__TIMEOUT__'); }, 5000); })
          ]);
          if (db && db !== '__TIMEOUT__') {
            agent = await db.collection('agents').findOne({
              $or: [{ _id: req.params.id }, { email: req.params.id }]
            });
          }
        }
      } catch(e) {}
    }

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    // Get agent's properties
    var properties = global.__inMemoryProperties || [];
    var agentProps = properties.filter(function(p) {
      return p.agentEmail === agent.email || p.createdBy === agent._id;
    });

    // Get agent's bookings
    var bookings = global.__bookingCache || [];
    var agentBookingsList = bookings.filter(function(b) {
      return b.agentEmail === agent.email;
    });

    // Sanitize
    var safe = {};
    Object.keys(agent).forEach(function(k) {
      if (k !== 'password' && k !== 'resetToken' && k !== 'resetTokenExpiry' && k !== '__v') {
        safe[k] = agent[k];
      }
    });
    safe.properties = agentProps;
    safe.bookings = agentBookingsList;

    res.json({ success: true, agent: safe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/admin/agents/:id — update agent
router.patch('/agents/:id', requireAdmin, async (req, res) => {
  try {
    var agents = global.__inMemoryAgents || [];
    var index = agents.findIndex(function(a) {
      return a._id && (String(a._id) === req.params.id || a.email === req.params.id);
    });

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    var allowedFields = ['isActive', 'plan', 'companyName', 'name', 'phone', 'tagline'];
    allowedFields.forEach(function(field) {
      if (req.body[field] !== undefined) {
        agents[index][field] = req.body[field];
      }
    });

    // Update MongoDB
    try {
      if (typeof global.getMongoDbPromise === 'function') {
        global.getMongoDbPromise().then(function(conn) {
          if (conn) {
            var update = {};
            allowedFields.forEach(function(f) {
              if (req.body[f] !== undefined) update[f] = req.body[f];
            });
            if (Object.keys(update).length > 0) {
              conn.collection('agents').updateOne(
                { email: agents[index].email },
                { $set: update }
              ).catch(function(e) {});
            }
          }
        }).catch(function(e) {});
      }
    } catch(e) {}

    res.json({ success: true, message: 'Agent updated', agent: agents[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/agents/:id/reset-password
router.post('/agents/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    var { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    var agents = global.__inMemoryAgents || [];
    var agent = agents.find(function(a) {
      return a._id && (String(a._id) === req.params.id || a.email === req.params.id);
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update in-memory
    agent.password = hashedPassword;

    // Update MongoDB
    try {
      if (typeof global.getMongoDbPromise === 'function') {
        global.getMongoDbPromise().then(function(conn) {
          if (conn) {
            conn.collection('agents').updateOne(
              { email: agent.email },
              { $set: { password: hashedPassword } }
            ).catch(function(e) {});
          }
        }).catch(function(e) {});
      }
    } catch(e) {}

    // Update Mongoose
    try {
      var AgentModel = require('../models/Agent');
      AgentModel.updateOne(
        { email: agent.email },
        { $set: { password: hashedPassword } }
      ).catch(function(e) {});
    } catch(e) {}

    res.json({ success: true, message: 'Password reset successfully for ' + agent.name });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/properties — list all properties
router.get('/properties', requireAdmin, async (req, res) => {
  try {
    var properties = global.__inMemoryProperties || [];

    // Try MongoDB for more
    try {
      if (typeof global.getMongoDbPromise === 'function') {
        var db = await Promise.race([
          global.getMongoDbPromise(),
          new Promise(function(r) { setTimeout(function() { r('__TIMEOUT__'); }, 5000); })
        ]);
        if (db && db !== '__TIMEOUT__') {
          var mongoProps = await db.collection('properties').find({}).sort({ createdAt: -1 }).limit(100).toArray();
          // Merge, dedup by URL
          var seen = {};
          mongoProps.forEach(function(p) { seen[p._id || p.url] = p; });
          properties.forEach(function(p) {
            var key = p._id || p.url;
            if (!seen[key]) seen[key] = p;
          });
          properties = Object.values(seen);
        }
      }
    } catch(e) {}

    // Remove sensitive fields
    var safe = properties.map(function(p) {
      var out = {};
      Object.keys(p).forEach(function(k) {
        if (k !== '__v') out[k] = p[k];
      });
      return out;
    });

    res.json({ success: true, properties: safe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();

// In-memory storage (persists across requests on warm instances)
if (!global.__inMemoryFeedback) global.__inMemoryFeedback = [];

// Auth middleware
function auth(req, res, next) {
  var token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, message: 'Auth required' });
  
  // Validate token against in-memory agents
  var agents = global.__inMemoryAgents || [];
  var agent = agents.find(function(a) { return a.token === token || a._token === token; });
  
  if (!agent) {
    // Try verifying JWT
    try {
      var jwt = require('jsonwebtoken');
      var decoded = jwt.verify(token, process.env.JWT_SECRET || 'viewing-one-secret-key-change-me');
      agent = agents.find(function(a) { return a.id === decoded.agentId || a._id === decoded.agentId; });
      if (agent) req.agent = agent;
    } catch(e) {}
    if (!agent) return res.status(401).json({ success: false, message: 'Invalid token' });
  } else {
    req.agent = agent;
  }
  next();
}

// POST /api/feedback - Submit feedback
router.post('/', auth, async function(req, res) {
  try {
    var message = req.body.message;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Feedback message is required' });
    }

    var feedback = {
      _id: require('crypto').randomUUID(),
      agentId: req.agent._id || req.agent.id,
      agentSlug: req.agent.slug || req.agent.id,
      message: message.trim(),
      createdAt: new Date().toISOString()
    };

    // Store in memory
    global.__inMemoryFeedback.push(feedback);

    // Try to store in MongoDB
    try {
      var db = await (require('../db-with-timeout') || Promise.resolve(null));
      if (db) {
        var col = db.collection('feedback');
        await col.insertOne(feedback);
      }
    } catch(e) {
      console.error('MongoDB feedback store failed:', e.message);
    }

    res.json({ success: true, message: 'Feedback received' });
  } catch(e) {
    console.error('Feedback error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/feedback - Get feedback for the logged-in agent
router.get('/', auth, async function(req, res) {
  try {
    var agentId = req.agent._id || req.agent.id;
    var feedback = global.__inMemoryFeedback.filter(function(f) {
      return f.agentId === agentId;
    });

    // Also try MongoDB for any stored feedback not in memory
    try {
      var db = await (require('../db-with-timeout') || Promise.resolve(null));
      if (db) {
        var col = db.collection('feedback');
        var mongoFeedback = await col.find({ agentId: agentId }).toArray();
        // Merge, deduplicate by _id
        var seen = {};
        feedback.forEach(function(f) { seen[f._id] = true; });
        mongoFeedback.forEach(function(f) {
          if (!seen[f._id]) {
            seen[f._id] = true;
            feedback.push(f);
          }
        });
      }
    } catch(e) {
      console.error('MongoDB feedback fetch failed:', e.message);
    }

    res.json({ success: true, feedback: feedback });
  } catch(e) {
    console.error('Feedback fetch error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;

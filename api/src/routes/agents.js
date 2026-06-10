const express = require('express');
const router = express.Router();

let Agent;
let Property;
try {
  Agent = require('../models/Agent');
  Property = require('../models/Property');
} catch (e) {
  Agent = null;
  Property = null;
}

// Raw MongoDB connection (shared via global cached promise from api/index.js)
function getDb() {
  if (!global.__mongoDbPromise) return null;
  // Never block more than 9.5s waiting for MongoDB (Vercel limit is 10s)
  return Promise.race([
    global.__mongoDbPromise,
    new Promise(function(r) { setTimeout(function() { r(null); }, 9500); })
  ]);
}

// In-memory collections (shared with other routes via global)
if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
if (!global.__inMemoryProperties) global.__inMemoryProperties = [];

// GET /api/agents/:slug - Public agent page data
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    let agent = null;
    let properties = [];

    // 1. Try in-memory first (always fastest, most reliable)
    var memAgent = (global.__inMemoryAgents || []).find(a => a.slug === slug && a.isActive);

    // 2. Try raw MongoDB as fallback
    var mongoAgent = null;
    try {
      var mongoPromise = getDb();
      if (mongoPromise && !memAgent) {
        var db = await mongoPromise;
        if (db) {
          mongoAgent = await db.collection('agents').findOne({ slug: slug, isActive: true });
        }
      }
    } catch (mongoErr) {}

    // 2b. Retry MongoDB if first attempt failed — promise might have resolved by now
    if (!mongoAgent && !memAgent && typeof global.getMongoDbPromise === 'function') {
      try {
        var retryDb = await Promise.race([
          global.getMongoDbPromise(),
          new Promise(function(r) { setTimeout(function() { r(null); }, 9500); })
        ]);
        if (retryDb) {
          var retryMongo = await retryDb.collection('agents').findOne({ slug: slug, isActive: true });
          if (retryMongo) mongoAgent = retryMongo;
          mongoAgent = retryMongo || mongoAgent;
        }
      } catch (e) {}
    }

    // Pick whichever agent we found
    agent = mongoAgent || memAgent;
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found or not active' });
    }

    // Collect properties from ALL sources
    var allProps = [];
    var seenIds = new Set();

    // 3a. From in-memory (match by agent._id string or hex)
    var agentIdStr = agent._id.toString();
    var memProps = (global.__inMemoryProperties || []).filter(p => {
      var pid = typeof p.agentId === 'object' ? (p.agentId.toString ? p.agentId.toString() : '') : String(p.agentId || '');
      return pid === agentIdStr && p.status === 'active';
    });
    for (var p of memProps) {
      var idStr = p._id ? p._id.toString() : '';
      if (idStr && !seenIds.has(idStr)) {
        seenIds.add(idStr);
        allProps.push(p);
      }
    }

    // 3b. From MongoDB raw (append to in-memory)
    // Use whichever agent has data (mongoAgent if available, fallback to memAgent's _id)
    var agentIdForQuery = null;
    if (mongoAgent) agentIdForQuery = mongoAgent._id;
    else if (memAgent) agentIdForQuery = memAgent._id;
    
    try {
      var mongoPromise2 = getDb();
      if (mongoPromise2) {
        var db2 = await mongoPromise2;
        if (db2 && agentIdForQuery) {
          var mongoProps = await db2.collection('properties')
            .find({ agentId: agentIdForQuery, status: 'active' })
            .sort({ createdAt: -1 })
            .toArray();
          for (var p of mongoProps) {
            var idStr = p._id.toString();
            if (!seenIds.has(idStr)) {
              seenIds.add(idStr);
              allProps.push(p);
            }
          }
        }
      }
    } catch (e) {}

    // 3c. From Mongoose (MongoDB via model) as last resort
    try {
      if (Agent && Property && agentIdForQuery) {
        var mongooseProps = await Property.find({ agentId: agentIdForQuery, status: 'active' }).sort({ createdAt: -1 }).lean();
        for (var p of mongooseProps) {
          var idStr = p._id.toString();
          if (!seenIds.has(idStr)) {
            seenIds.add(idStr);
            allProps.push(p);
          }
        }
      }
    } catch (e) {}

    properties = allProps;

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found or not active' });
    }

    // Deduplicate properties by sourceUrl (prevents /tmp cache ghosts on warm instances)
    var seenUrls = {};
    properties = properties.filter(function(pp) {
      var url = (pp.sourceUrl || '').replace(/\/+$/, '').toLowerCase();
      if (!url) return true;
      if (seenUrls[url]) return false;
      seenUrls[url] = true;
      return true;
    });

    res.json({
      success: true,
      agent: {
        id: agent._id.toString(), name: agent.name, companyName: agent.companyName,
        slug: agent.slug, tagline: agent.tagline || '', logo: agent.logo || '',
        primaryColor: agent.primaryColor || '#1a73e8',
        secondaryColor: agent.secondaryColor || '#2c3e50',
        accentColor: agent.accentColor || '#e74c3c',
        template: agent.template || 'modern-corporate',
        showPoweredBy: agent.showPoweredBy !== false,
        phone: agent.phone || ''
      },
      properties: properties.map(p => ({
        id: p._id.toString(), title: p.title, description: p.description || '',
        price: p.price, location: p.location,
        bedrooms: p.bedrooms, bathrooms: p.bathrooms, size: p.size,
        propertyType: p.propertyType, images: p.images || [], sourceUrl: p.sourceUrl || '',
        viewingSlots: (p.viewingSlots || []).map(s => ({
          id: s.id || (s._id ? s._id.toString() : Date.now().toString()),
          date: s.date, time: s.time,
          bookings: s.bookings || [],
          bookingCount: s.bookingCount || (s.bookings ? s.bookings.length : 0)
        })),
        viewingRequests: p.viewingRequests || []
      }))
    });

  } catch (error) {
    console.error('Get agent page error:', error);
    res.status(500).json({ success: false, message: 'Server error loading agent page' });
  }
});

// POST /api/agents/migrate - Copy MongoDB properties into in-memory for a slug
router.post('/migrate', async (req, res) => {
  try {
    var { slug } = req.body;
    if (!slug) return res.status(400).json({ success: false, message: 'slug required' });
    
    // Find agent in MongoDB
    var mongoPromise = getDb();
    if (!mongoPromise) return res.json({ success: false, message: 'MongoDB not available' });
    var db = await mongoPromise;
    if (!db) return res.json({ success: false, message: 'MongoDB not connected' });
    
    var rawAgent = await db.collection('agents').findOne({ slug: slug, isActive: true });
    if (!rawAgent) return res.json({ success: false, message: 'Agent not found in MongoDB' });
    
    var mongoProps = await db.collection('properties').find({ agentId: rawAgent._id }).toArray();
    
    // Find or create in-memory agent for this slug
    if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
    var memAgent = global.__inMemoryAgents.find(function(a) { return a.slug === slug; });
    if (!memAgent) {
      memAgent = {
        _id: rawAgent._id.toString(),
        name: rawAgent.name,
        email: rawAgent.email,
        slug: rawAgent.slug,
        companyName: rawAgent.companyName,
        password: 'migrated-' + Date.now(),
        isActive: true,
        createdAt: new Date()
      };
      global.__inMemoryAgents.push(memAgent);
    }
    
    // Copy MongoDB properties into in-memory with the string agentId
    if (!global.__inMemoryProperties) global.__inMemoryProperties = [];
    var copied = 0;
    var memPropIds = new Set(global.__inMemoryProperties.map(function(p) { return p._id ? p._id.toString() : ''; }).filter(function(i) { return i; }));
    
    for (var p of mongoProps) {
      var idStr = p._id && p._id.toString ? p._id.toString() : '';
      if (idStr && !memPropIds.has(idStr)) {
        var memProp = {
          _id: idStr,
          agentId: memAgent._id,
          title: p.title || 'Property listing',
          price: p.price || 'Price on request',
          location: p.location || 'Cape Town',
          description: p.description || '',
          images: (p.images || []).map(function(i) { return typeof i === 'string' ? i : (i.url || ''); }).filter(function(i) { return i; }),
          sourceUrl: p.sourceUrl || '',
          status: p.status || 'active',
          createdAt: p.createdAt || new Date()
        };
        global.__inMemoryProperties.push(memProp);
        copied++;
      }
    }
    
    res.json({ success: true, message: 'Migrated ' + copied + ' properties', total: mongoProps.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/agents - List all active agents
router.get('/', async (req, res) => {
  try {
    // Try raw MongoDB first
    try {
      var mongoPromise = getDb();
      if (mongoPromise) {
        var db = await mongoPromise;
        if (db) {
          var rawAgents = await db.collection('agents')
            .find({ isActive: true })
            .project({ name: 1, companyName: 1, slug: 1, tagline: 1, primaryColor: 1, template: 1 })
            .sort({ createdAt: -1 })
            .toArray();
          if (rawAgents && rawAgents.length > 0) {
            return res.json({ success: true, count: rawAgents.length, agents: rawAgents });
          }
        }
      }
    } catch (e) {}

    if (Agent) {
      try {
        const agents = await Agent.find({ isActive: true })
          .select('name companyName slug tagline primaryColor template')
          .sort({ createdAt: -1 });
        return res.json({ success: true, count: agents.length, agents });
      } catch (e) {}
    }

    const agents = global.__inMemoryAgents.filter(a => a.isActive)
      .map(a => ({ name: a.name, companyName: a.companyName, slug: a.slug,
        tagline: a.tagline, primaryColor: a.primaryColor, template: a.template }));
    
    res.json({ success: true, count: agents.length, agents });

  } catch (error) {
    console.error('List agents error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

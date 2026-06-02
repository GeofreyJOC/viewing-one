const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'viewing-one-dev-secret';

// Try to use MongoDB model, fall back to in-memory
let Agent;
try {
  Agent = require('../models/Agent');
} catch (e) {
  Agent = null;
}

if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
const inMemoryAgents = global.__inMemoryAgents;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, companyName, phone, website, plan } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false, message: 'Name, email, and password are required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check existing (in-memory only - skip MongoDB check to avoid stale agents)
    if (inMemoryAgents.find(a => a.email === normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'An agent with this email already exists' });
    }

    // Generate unique slug
    var slugBase = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
    let slug = slugBase;
    
    // Check slug uniqueness (in-memory only)
    let counter = 0;
    let testSlug = slug;
    while (inMemoryAgents.find(a => a.slug === testSlug)) {
      counter++;
      testSlug = `${slug}-${counter}`;
    }
    slug = testSlug;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // In-memory only (no MongoDB save - avoids stale agent collision)
    const agent = {
      _id: require('crypto').createHash('md5').update(normalizedEmail).digest('hex').slice(0,12), name, email: normalizedEmail,
      password: hashedPassword, companyName, slug, phone, website,
      plan: plan || 'starter', primaryColor: '#1a73e8', secondaryColor: '#2c3e50',
      accentColor: '#e74c3c', template: 'modern-corporate', tagline: '',
      isActive: true, isVerified: false, createdAt: new Date()
    };
    inMemoryAgents.push(agent);
    var agentId = agent._id;
    var agentName = agent.name;
    var agentCompany = agent.companyName;
    // Persist to /tmp for warm serverless function reuse
    try { require('fs').writeFileSync('/tmp/agents.json', JSON.stringify(inMemoryAgents)); } catch(e){}
    // Persist to Gist for cross-instance sharing
    try {
      var gist = require('../gist-persistence');
      gist.saveAgent(agent, function(err, result) {
        if (err) console.error('Gist save error:', err.message);
      });
    } catch(e){ console.error('Gist require error:', e.message); }
    // Persist to MongoDB so agent survives cold restarts
    try {
      if (typeof global.getMongoDbPromise === 'function') {
        global.getMongoDbPromise().then(function(conn) {
          if (conn && conn) {
            conn.db.collection('agents').updateOne(
              { email: normalizedEmail },
              { $set: agent },
              { upsert: true }
            ).catch(function(e) { console.error('Mongo register save:', e.message); });
          }
        }).catch(function(e) { console.error('Mongo register connect:', e.message); });
      }
    } catch(e) { console.error('Mongo register error:', e.message); }
    // Also try Mongoose model (alternative connection)
    try {
      if (Agent) {
        (new Agent(agent)).save().catch(function(e){});
      }
    } catch(e){}

    const token = jwt.sign({ id: agentId.toString(), email: normalizedEmail }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      success: true, message: 'Agent registered successfully', token,
      agent: {
        id: agentId.toString(), name: agentName, email: normalizedEmail,
        companyName: agentCompany, slug, plan: plan || 'starter',
        logo: '', url: `https://viewing.one/${slug}`, dashboardUrl: `/dashboard.html?registered=1`
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let agent = null;

    // 1. Try in-memory (fast, reliable)
    agent = inMemoryAgents.find(a => a.email === normalizedEmail);
    
    // 2. Try global Mongoose connection (getMongoDbPromise)
    if (!agent) {
      try {
        if (typeof global.getMongoDbPromise === 'function') {
          var db = await global.getMongoDbPromise();
          if (db) {
            agent = await db.collection('agents').findOne({ email: normalizedEmail });
            if (agent) {
              if (agent._id && agent._id.toString) agent._id = agent._id.toString();
              if (agent.password) {
                if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
                var already = global.__inMemoryAgents.find(function(a) { return a._id === agent._id; });
                if (!already) global.__inMemoryAgents.push(agent);
              }
            }
          }
        }
      } catch(e) { console.log('Mongoose login fallback error:', e.message); }
    }
    
        // 2b. Direct MongoDB connection (bypass Mongoose, uses raw MongoClient)
    if (!agent) {
      try {
        var uri = process.env.MONGODB_URI;
        if (uri && (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'))) {
          var MongoClient = require('mongodb').MongoClient;
          // Try non-SRV with specific shard hostnames (clustervo hostname has only SRV records)
          try {
            var atIdx = uri.indexOf('@');
            var creds = uri.substring(0, atIdx + 1).replace('mongodb+srv://', 'mongodb://');
            var shardUri = creds + 'ac-mwb77et-shard-00-00.dwom1k2.mongodb.net:27017,ac-mwb77et-shard-00-01.dwom1k2.mongodb.net:27017,ac-mwb77et-shard-00-02.dwom1k2.mongodb.net:27017/viewing-one?ssl=true&replicaSet=atlas-coeo9w-shard-0&retryWrites=true&w=majority&directConnection=true';
            var shardClient = new MongoClient(shardUri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
            await shardClient.connect();
            var shardDb = shardClient.db();
            agent = await shardDb.collection('agents').findOne({ email: normalizedEmail });
            if (agent) {
              if (agent._id && agent._id.toString) agent._id = agent._id.toString();
              if (agent.password) {
                if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
                var alreadyDirect = global.__inMemoryAgents.find(function(a) { return a._id === agent._id; });
                if (!alreadyDirect) global.__inMemoryAgents.push(agent);
              }
            }
            await shardClient.close();
          } catch(e1) { console.log('Shard MongoClient login error:', e1.message); }
          // Try SRV connection as second fallback
          if (!agent) {
            try {
              var srvClient = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
              await srvClient.connect();
              var srvDb = srvClient.db('viewingone');
              agent = await srvDb.collection('agents').findOne({ email: normalizedEmail });
              if (agent) {
                if (agent._id && agent._id.toString) agent._id = agent._id.toString();
                if (agent.password) {
                  if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
                  var alreadySrv = global.__inMemoryAgents.find(function(a) { return a._id === agent._id; });
                  if (!alreadySrv) global.__inMemoryAgents.push(agent);
                }
              }
              await srvClient.close();
            } catch(e2) { console.log('SRV MongoClient login error:', e2.message); }
          }
        }
      } catch(e) { console.log('Direct Mongo login error:', e.message); }
    }// 3. Fall back to /tmp/agents.json for cross-instance persistence
    if (!agent) {
      try {
        var fs = require('fs');
        if (fs.existsSync('/tmp/agents.json')) {
          var tmpAgents = JSON.parse(fs.readFileSync('/tmp/agents.json', 'utf8'));
          agent = tmpAgents.find(a => a.email === normalizedEmail);
          if (agent) {
            if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
            var alreadyCached = global.__inMemoryAgents.find(a => a._id === agent._id);
            if (!alreadyCached) global.__inMemoryAgents.push(agent);
          }
        }
      } catch (e) {
        console.error('Error reading /tmp/agents.json:', e.message);
      }
    }
    
    // 4. Fall back to Gist persistence
    if (!agent) {
      try {
        var gistLogin = require('../gist-persistence');
        var gistAgent = await new Promise(function(resolve) {
          gistLogin.getAgentByEmail(normalizedEmail, function(err, a) {
            resolve(err ? null : a);
          });
        });
        if (gistAgent) {
          agent = gistAgent;
          // Sync into in-memory
          if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
          var alreadyCached = global.__inMemoryAgents.find(function(a) { return a._id === agent._id; });
          if (!alreadyCached) global.__inMemoryAgents.push(agent);
        }
      } catch(e) { console.log('Gist login fallback error:', e.message); }
    }

    if (!agent) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    var passwordHash = agent.password || '';
    if (!passwordHash || typeof passwordHash !== 'string' || passwordHash.length < 20) {
      console.error('Login: Invalid password hash for', normalizedEmail);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    var isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, passwordHash);
    } catch(bcErr) {
      console.error('bcrypt compare error:', bcErr.message);
    }
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: agent._id.toString(), email: normalizedEmail }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true, message: 'Login successful', token,
      agent: {
        id: agent._id.toString(), name: agent.name, email: agent.email,
        companyName: agent.companyName, slug: agent.slug, plan: agent.plan,
        tagline: agent.tagline || '', phone: agent.phone || '',
        primaryColor: agent.primaryColor || '#1a73e8',
        secondaryColor: agent.secondaryColor || '#2c3e50',
        accentColor: agent.accentColor || '#e74c3c',
        template: agent.template || 'modern-corporate',
        logo: agent.logo || '',
        url: `https://viewing.one/${agent.slug}`
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token' });

    const decoded = jwt.verify(token, JWT_SECRET);
    let agent = inMemoryAgents.find(a => a._id.toString() === decoded.id);
    
    // Try raw MongoDB driver if not found in-memory
    if (!agent && typeof global.getMongoDbPromise === 'function') {
      try {
        var db = await getMongoDbPromise();
        if (db) {
          agent = await db.collection('agents').findOne({ email: decoded.email });
          if (agent && agent._id && agent._id.toString) agent._id = agent._id.toString();
          // Cache in memory
          if (agent && !inMemoryAgents.find(function(a){return a._id===agent._id})) {
            inMemoryAgents.push(agent);
          }
        }
      } catch(e) {}
    }
    
    // Try Mongoose
    if (!agent && Agent) {
      try { agent = await Agent.findById(decoded.id); } catch (e) {}
    }

    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

    res.json({
      success: true,
      agent: {
        id: agent._id.toString(), name: agent.name, email: agent.email,
        companyName: agent.companyName, slug: agent.slug, plan: agent.plan,
        phone: agent.phone || '', tagline: agent.tagline || '',
        primaryColor: agent.primaryColor || '#1a73e8',
        secondaryColor: agent.secondaryColor || '#2c3e50',
        accentColor: agent.accentColor || '#e74c3c',
        template: agent.template || 'modern-corporate',
        logo: agent.logo || '',
        url: `https://viewing.one/${agent.slug}`
      }
    });

  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/auth/me - Update agent profile/branding
// PUT /api/auth/me/logo - Upload profile picture
router.put('/me/logo', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { logo } = req.body;
    if (!logo) return res.status(400).json({ success: false, message: 'Image data required' });
    
    let updated = false;
    const idx = inMemoryAgents.findIndex(a => a._id.toString() === decoded.id);
    if (idx !== -1) {
      inMemoryAgents[idx].logo = logo;
      updated = true;
    }
    
    if (!updated) return res.status(404).json({ success: false, message: 'Agent not found' });
    try { require('fs').writeFileSync('/tmp/agents.json', JSON.stringify(inMemoryAgents)); } catch(e){}
    res.json({ success: true, message: 'Logo updated' });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/auth/password - Change password
router.put('/password', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    
    const idx = inMemoryAgents.findIndex(a => a._id.toString() === decoded.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Agent not found' });
    
    const isValid = await bcrypt.compare(currentPassword, inMemoryAgents[idx].password);
    if (!isValid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    
    const salt = await bcrypt.genSalt(10);
    inMemoryAgents[idx].password = await bcrypt.hash(newPassword, salt);
    try { require('fs').writeFileSync('/tmp/agents.json', JSON.stringify(inMemoryAgents)); } catch(e){}
    
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const updates = req.body;

    // Only allow specific fields
    const allowedFields = ['tagline', 'phone', 'primaryColor', 'secondaryColor', 'accentColor', 'template', 'logo', 'name', 'companyName'];
    const sanitized = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) sanitized[key] = updates[key];
    }

    let updated = false;
    var updatedAgent = null;

    if (Agent) {
      try {
        const result = await Agent.findByIdAndUpdate(decoded.id, { $set: sanitized }, { new: true });
        if (result) { updated = true; updatedAgent = result.toObject(); }
      } catch (e) {}
    }

    if (!updated) {
      const idx = inMemoryAgents.findIndex(a => a._id.toString() === decoded.id);
      if (idx !== -1) {
        Object.assign(inMemoryAgents[idx], sanitized);
        updated = true;
        updatedAgent = inMemoryAgents[idx];
      }
    }

    if (!updated) return res.status(404).json({ success: false, message: 'Agent not found' });
    
    // Persist to /tmp for cross-instance
    try { require('fs').writeFileSync('/tmp/agents.json', JSON.stringify(inMemoryAgents)); } catch(e){}
    // Persist to Gist for cross-instance sharing
    try {
      var gist = require('../gist-persistence');
      if (updatedAgent) gist.saveAgent(updatedAgent, function(err, result) {
        if (err) console.error('Gist save error:', err.message);
      });
    } catch(e){ console.error('Gist require error:', e.message); }

    res.json({ success: true, message: 'Profile updated' });

  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/auth/:email — Delete agent (for password reset / cleanup)
router.delete('/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });
    
    let deleted = false;
    
    // Try MongoDB
    try {
      if (typeof global.getMongoDbPromise === 'function') {
        const mongo = await global.getMongoDbPromise();
        if (mongo) {
          const result = await mongo.collectionon('agents').deleteOne({ email: email });
          if (result.deletedCount > 0) deleted = true;
        }
      }
    } catch(e) {}
    
    // Remove from in-memory
    if (global.__inMemoryAgents) {
      const before = global.__inMemoryAgents.length;
      global.__inMemoryAgents = global.__inMemoryAgents.filter(a => a.email !== email);
      if (global.__inMemoryAgents.length < before) deleted = true;
    }
    
    res.json({ success: true, message: deleted ? 'Agent deleted: ' + email : 'Agent not found: ' + email, deleted: deleted });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
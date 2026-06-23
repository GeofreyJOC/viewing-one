// Vercel Serverless Function
const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize in-memory stores FIRST
if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
if (!global.__inMemoryProperties) global.__inMemoryProperties = [];

// Seed known agents from bundled file (permanent fallback, no MongoDB/Gist needed)
(function seedAgents() {
  if (global.__inMemoryAgents.length === 0) {
    try {
      var seedPath = path.join(__dirname, 'seed-agents.json');
      if (require('fs').existsSync(seedPath)) {
        var seedData = JSON.parse(require('fs').readFileSync(seedPath, 'utf8'));
        if (seedData && seedData.length > 0) {
          global.__inMemoryAgents = seedData.map(function(a) {
            if (a._id) a._id = String(a._id);
            return a;
          });
          console.log('🌱 Seeded ' + seedData.length + ' agents from seed-agents.json');
        }
      }
    } catch(e) { console.log('Seed load error:', e.message); }
  }
})();

// Load from Gist (shared across all Vercel instances)
try {
  var gistPersistence = require('./src/gist-persistence');
  gistPersistence.loadAllIntoMemory(function(err) {
    if (err) console.log('Gist load error (non-fatal):', err.message);
    else console.log('Gist data loaded: ' + (global.__inMemoryAgents||[]).length + ' agents, ' + (global.__inMemoryProperties||[]).length + ' properties');
  });
} catch(e) {
  console.log('Gist persistence not available, falling back to /tmp:', e.message);
  try { require('./src/routes/persistence'); } catch(e2) {}
}

// // Pre-populate agent if env vars set
(function bootstrap() {
  var slug = process.env.BOOTSTRAP_AGENT_SLUG;
  var pass = process.env.BOOTSTRAP_AGENT_PASSWORD;
  var name = process.env.BOOTSTRAP_AGENT_NAME || 'Agent';
  var email = process.env.BOOTSTRAP_AGENT_EMAIL || 'agent@viewing.one';
  if (slug && pass && !global.__bootstrapped) {
    global.__bootstrapped = true;
    var exists = global.__inMemoryAgents.find(function(a) { return a.slug === slug; });
    if (!exists) {
      try {
        var bcrypt = require('bcryptjs');
        var crypto = require('crypto');
        var hash = bcrypt.hashSync(pass, 10);
        global.__inMemoryAgents.push({
          _id: require('crypto').createHash('md5').update(email).digest('hex').slice(0,12),
          name: name,
          email: email,
          slug: slug,
          password: hash,
          companyName: 'ViewingOne',
          isActive: true,
          createdAt: new Date()
        });
      } catch(e) {}
    }
  }
})();

// NOW load routes (they'll see the seeded data)
const authRoutes = require('./src/routes/auth');
const propertyRoutes = require('./src/routes/properties');
const agentRoutes = require('./src/routes/agents');
const bookingRoutes = require('./src/routes/bookings');
const emailRoutes = require('./src/routes/email-inbound');
const scrapeRoutes = require('./src/routes/scrape');
const uploadRoutes = require('./src/routes/upload-images');
const feedbackRoutes = require('./src/routes/feedback');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/properties', uploadRoutes);
app.use('/api/properties', emailRoutes);
app.use('/api', scrapeRoutes);
app.use('/api/feedback', feedbackRoutes);

// Serve static
app.use(express.static(path.join(__dirname, '..', 'public')));

// MongoDB connection (lazy, never blocks startup)
let dbStatus = 'in-memory';
let mongoClient = null;
// Lazy MongoDB connection - starts immediately on cold start
global.getMongoDbPromise = function getMongoDbPromise() {
  // If already resolving AND not failed yet, return it
  if (global.__mongoDbPromise && !global.__mongoDbFailed) return global.__mongoDbPromise;
  // If previous attempt failed, retry
  if (global.__mongoDbFailed) {
    global.__mongoDbPromise = null;
    global.__mongoDbFailed = false;
  }
  // Create a lazy promise that fires immediately
  global.__mongoDbPromise = new Promise(function(resolve) {
    (async function() {
      try {
        var MongoClient = require('mongodb').MongoClient;
        var uri = process.env.MONGODB_URI;
        if (!uri || !uri.startsWith('mongodb')) {
          resolve(null);
          return;
        }
        console.log('MongoDB connecting...');
        
        // Try SRV first, then fall back to non-SRV shard hostnames
        async function tryConnect(mongoUri) {
          try {
            var c = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000 });
            await c.connect();
            return c;
          } catch(e) {
            console.log('MongoDB attempt failed:', (e.message || '').slice(0, 80));
            return null;
          }
        }
        
        var client = await tryConnect(uri);
        if (!client && uri.startsWith('mongodb+srv')) {
          // Non-SRV fallback with known shard hostnames
          var atIdx = uri.indexOf('@');
          var creds = uri.substring(0, atIdx + 1).replace('mongodb+srv://', 'mongodb://');
          var shardUri = creds + 'ac-mwb77et-shard-00-00.dwom1k2.mongodb.net:27017,ac-mwb77et-shard-00-01.dwom1k2.mongodb.net:27017,ac-mwb77et-shard-00-02.dwom1k2.mongodb.net:27017/viewingone?ssl=true&replicaSet=atlas-coeo9w-shard-0&retryWrites=true&w=majority';
          client = await tryConnect(shardUri);
          // Also try direct connection without shard
          if (!client) {
            var directUri = creds + 'clustervo.dwom1k2.mongodb.net:27017/viewingone?ssl=true&retryWrites=true&w=majority';
            client = await tryConnect(directUri);
          }
        }
        
        if (client) {
          dbStatus = 'connected';
          console.log('MongoDB connected!');
          global.__mongoDbFailed = false;
          // Extract database name from URI (use default if none specified)
          var dbName = 'viewingone';
          try {
            var uriPath = uri.split('?')[0].split('/');
            if (uriPath.length > 1 && uriPath[uriPath.length-1]) dbName = uriPath[uriPath.length-1];
          } catch(e) {}
          resolve(client.db(dbName));
        } else {
          global.__mongoDbFailed = true;
          console.log('MongoDB: all connection attempts failed');
          resolve(null);
        }
      } catch(e) {
        global.__mongoDbFailed = true;
        console.log('MongoDB error:', (e.message || '').slice(0, 80));
        resolve(null);
      }
    })();
  });
  return global.__mongoDbPromise;
}

// Timeout wrapper — never blocks more than 4s waiting for MongoDB
function dbWithTimeout(ms) {
  var promise = getMongoDbPromise();
  if (!promise) return Promise.resolve(null);
  return Promise.race([
    promise,
    new Promise(function(r) { setTimeout(function() { r(null); }, ms || 4000); })
  ]);
}

// Kick it off immediately (non-blocking - returns a lazy promise)
getMongoDbPromise();

// Debug - check DB connection (behind require)

// Debug: test PP scraping from Vercel
app.get('/api/debug-pp', async (req, res) => {
  try {
    var url = req.query.url;
    if (!url) return res.json({ error: 'Provide ?url= parameter' });
    var f = require('node-fetch');
    var start = Date.now();
    var r = await f(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36', 'Accept-Language': 'en-ZA,en;q=0.9' }, timeout: 15000 });
    var elapsed = Date.now() - start;
    var body = await r.text();
    res.json({ status: r.status, elapsed: elapsed + 'ms', bodyLength: body.length, hasOgTitle: body.indexOf('og:title') >= 0, hasOgImage: body.indexOf('og:image') >= 0, hasPPImages: body.indexOf('images.pp.co.za') >= 0, first200: body.substring(0, 200) });
  } catch(e) { res.json({ error: e.message }); }
});
app.get('/api/debug-db', async (req, res) => {
  const info = { env: {}, mongoose: null, serverTime: new Date().toISOString() };
  info.env.hasMongoUri = !!process.env.MONGODB_URI;
  info.env.mongoUriPrefix = process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 25) + '...' : 'NOT SET';
  info.env.nodeVersion = process.version;
  info.dbStatus = dbStatus;
  
  // DNS/network test
  try {
    const dns = require('dns').promises;
    info.dns = await dns.resolve4('clustervo.dwom1k2.mongodb.net').catch(e => ({ error: e.message }));
  } catch(e) { info.dns = { error: e.message }; }
  
  try {
    const mongoose = require('mongoose');
    info.mongoose = { readyState: mongoose.connection.readyState };
    info.mongoose.readyStateLabel = ['disconnected','connected','connecting','disconnecting'][mongoose.connection.readyState] || 'unknown';
    
    if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
      console.log('Attempting MongoDB connect from debug endpoint...');
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000, connectTimeoutMS: 30000 });
      info.mongoose.afterAttempt = mongoose.connection.readyState;
      info.mongoose.afterAttemptLabel = ['disconnected','connected','connecting','disconnecting'][mongoose.connection.readyState] || 'unknown';
      info.mongoose.host = mongoose.connection.host;
      info.mongoose.name = mongoose.connection.name;
    }
  } catch(e) {
    info.mongoose.error = e.message.substring(0, 200);
  }
  
  
  res.json(info);
});

// Setup endpoint: creates agent + properties in ONE request (avoids Vercel cross-instance issues)
app.post('/api/setup', async (req, res) => {
  try {
    var body = req.body || {};
    var agent = body.agent || {};
    var properties = body.properties || [];
    
    if (!agent.slug || !agent.password) {
      return res.status(400).json({ success: false, message: 'agent.slug and agent.password required' });
    }
    
    global.__inMemoryAgents.length = 0;
    global.__inMemoryProperties.length = 0;
    
    // Wipe MongoDB (wait for connection)
    try {
      var mDb = null;
      var mStart = Date.now();
      while (Date.now() - mStart < 8000) {
        mDb = await getMongoDbPromise();
        if (mDb) break;
        await new Promise(function(r2){setTimeout(r2, 500)});
      }
      if (mDb) {
        await mDb.collection('agents').deleteMany({});
        await mDb.collection('properties').deleteMany({});
      }
      // Also clean /tmp cache so old properties don't reappear on warm instances
      try { require('fs').unlinkSync('/tmp/properties.json'); } catch(e){}
      try { require('fs').unlinkSync('/tmp/agents.json'); } catch(e){}
    } catch(e) {}
    
    // Create agent
    var bcrypt2 = require('bcryptjs');
    var hash = bcrypt2.hashSync(agent.password, 10);
    var agentId = require('crypto').createHash('md5').update(agent.email).digest('hex').slice(0,12);
    global.__inMemoryAgents.push({
      _id: agentId,
      name: agent.name || agent.slug,
      email: agent.email || agent.slug + '@viewing.one',
      slug: agent.slug,
      password: hash,
      companyName: agent.companyName || '',
      isActive: true,
      createdAt: new Date()
    });
    
    // Create properties
    var crypto = require('crypto');
    var createdProps = [];
    for (var pi = 0; pi < properties.length; pi++) {
      var p = properties[pi];
      var prop = {
        _id: crypto.randomUUID(),
        agentId: agentId,
        title: p.title || 'Property',
        price: p.price || 'Price on request',
        location: p.location || '',
        description: p.description || '',
        images: (p.images || []).slice(0, 8),
        sourceUrl: p.sourceUrl || '',
        status: 'active',
        createdAt: new Date()
      };
      global.__inMemoryProperties.push(prop);
      createdProps.push(prop);
    }
    
    // Persist to /tmp and MongoDB
    try { require('fs').writeFileSync('/tmp/agents.json', JSON.stringify(global.__inMemoryAgents)); } catch(e){}
    try { require('fs').writeFileSync('/tmp/properties.json', JSON.stringify(global.__inMemoryProperties)); } catch(e){}
    
    // Fire-and-forget MongoDB write (don't block setup response)
    (async function() {
      try {
        var mdb = typeof getMongoDbPromise === 'function' ? await getMongoDbPromise() : null;
        if (mdb) {
          if (global.__inMemoryAgents && global.__inMemoryAgents[0]) {
            await mdb.collection('agents').updateOne({ slug: global.__inMemoryAgents[0].slug }, { $set: global.__inMemoryAgents[0] }, { upsert: true });
          }
          if (global.__inMemoryProperties) {
            for (var pj = 0; pj < global.__inMemoryProperties.length; pj++) {
              await mdb.collection('properties').updateOne({ _id: global.__inMemoryProperties[pj]._id }, { $set: global.__inMemoryProperties[pj] }, { upsert: true });
            }
          }
        }
      } catch(e){}
    })();
    
    // Generate JWT
    var jwt = require('jsonwebtoken');
    var JWT_SECRET = process.env.JWT_SECRET || 'viewing-one-dev-secret';
    var token = jwt.sign({ id: agentId, email: global.__inMemoryAgents[0].email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      message: 'Setup complete: agent + ' + createdProps.length + ' properties',
      token: token,
      agent: {
        id: agentId, slug: agent.slug, name: global.__inMemoryAgents[0].name,
        email: global.__inMemoryAgents[0].email
      },
      propertiesCount: createdProps.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Health endpoint (no setup/reset — those destroyed real data too many times)
app.get('/api/health', async (req, res) => {
  res.json({
    status: 'healthy', version: '1.0.0', timestamp: new Date().toISOString(),
    database: dbStatus, environment: process.env.NODE_ENV || 'production'
  });
});

// Agent page routing
app.get('/:slug', async (req, res, next) => {
  const { slug } = req.params;
  const reserved = ['api', 'register', 'dashboard', 'admin', 'index', 'favicon.ico', 'robots.txt'];
  if (reserved.includes(slug) || slug.includes('.')) return next();

  let found = (global.__inMemoryAgents || []).some(a => a.slug === slug && a.isActive);

  if (!found && dbStatus === 'connected') {
    try {
      const Agent = require('./src/models/Agent');
      found = !!(await Agent.findOne({ slug, isActive: true }).select('_id').lean());
    } catch (e) {}
  }

  // Try to embed agent data directly to avoid cross-instance fetch failure
  var agentData = null;
  var fs = require('fs');
  
  var memAgent = null;
  
  // Prefer /tmp/agents.json as authoritative (written by every profile update)
  try {
    var filePath = '/tmp/agents.json';
    if (fs.existsSync(filePath)) {
      var fileAgents = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      memAgent = (fileAgents || []).find(a => a.slug === slug && a.isActive);
    }
  } catch(e) { console.log('File load error:', e.message); }
  
  // Fallback: try in-memory
  if (!memAgent) {
    memAgent = (global.__inMemoryAgents || []).find(a => a.slug === slug && a.isActive);
  }
  
  // Re-sync in-memory with the authoritative file version
  if (memAgent && !(global.__inMemoryAgents || []).some(a => a._id && a._id.toString() === memAgent._id.toString())) {
    if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
    global.__inMemoryAgents.push(memAgent);
  }
  
  // Fallback: try Gist persistence for agent
  if (!memAgent) {
    try {
      var gistPersist = require('./src/gist-persistence');
      var rawAgent = await new Promise(function(resolve) {
        gistPersist.getAgentBySlug(slug, function(err, agent) {
          resolve(err ? null : agent);
        });
      });
      if (rawAgent) {
        memAgent = rawAgent;
        if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
        global.__inMemoryAgents.push(memAgent);
      }
    } catch(e) { console.log('Gist agent fallback:', e.message); }
  }
  
  // Tertiary fallback: try MongoDB (Promise.race with 8s timeout)
  if (!memAgent) {
    try {
      var mDbPromise = getMongoDbPromise();
      if (mDbPromise) {
        var mDb2 = await Promise.race([
          mDbPromise,
          new Promise(function(r) { setTimeout(function() { r('__TIMEOUT__'); }, 10000); })
        ]);
        if (mDb2 && mDb2 !== '__TIMEOUT__') {
          var rawAgent = await mDb2.collection('agents').findOne({ slug: slug, isActive: true });
          if (rawAgent) {
            memAgent = rawAgent;
            if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
            global.__inMemoryAgents.push(memAgent);
          }
        }
      }
    } catch(e) { console.log('MongoDB agent fallback:', e.message); }
  }
  
  if (memAgent) {
    // Always try MongoDB first for fresh data (cross-instance consistency)
    var memProps = [];
    try {
      var mDb = await dbWithTimeout(4000);
      if (mDb) {
        var mProps = await mDb.collection('properties').find({ agentId: memAgent._id.toString(), status: 'active' }).toArray();
        if (mProps && mProps.length > 0) {
          memProps = mProps.map(function(p) {
            p._id = p._id.toString ? p._id.toString() : p._id;
            return p;
          });
          // Update in-memory cache
          global.__inMemoryProperties = memProps.slice();
          try { require('fs').writeFileSync('/tmp/properties.json', JSON.stringify(global.__inMemoryProperties)); } catch(e){}
        }
      }
    } catch(e) { console.log('MongoDB prop fallback:', e.message); }
    
    // Fall back to in-memory
    if (!memProps.length) {
      memProps = (global.__inMemoryProperties || []).filter(p => {
        var pid = typeof p.agentId === 'object' ? (p.agentId.toString ? p.agentId.toString() : '') : String(p.agentId || '');
        return pid === memAgent._id.toString() && p.status === 'active';
      });
    }
    
    // Fall back to /tmp/properties.json
    if (!memProps.length) {
      try {
        var filePath2 = '/tmp/properties.json';
        if (fs.existsSync(filePath2)) {
          var fileProps = JSON.parse(fs.readFileSync(filePath2, 'utf8'));
          memProps = (fileProps || []).filter(p => {
            var pid = typeof p.agentId === 'object' ? (p.agentId.toString ? p.agentId.toString() : '') : String(p.agentId || '');
            return pid === memAgent._id.toString() && p.status === 'active';
          });
          global.__inMemoryProperties = global.__inMemoryProperties || [];
          global.__inMemoryProperties.push.apply(global.__inMemoryProperties, fileProps);
        }
      } catch(e) {}
    }
    
    // Fall back to Gist
    if (!memProps.length) {
      try {
        var gistProps = await new Promise(function(resolve) {
          try {
            require('./src/gist-persistence').getPropertiesByAgent(memAgent._id.toString(), function(err, props) {
              resolve(err ? [] : props);
            });
          } catch(e) { resolve([]); }
        });
        if (gistProps && gistProps.length > 0) {
          memProps = gistProps.filter(function(p) { return p.status === 'active'; });
        }
      } catch(e) {}
    }
    
    // Deduplicate by sourceUrl (prevents TOCTOU duplicates from Cloudflare retries)
    var seenUrls = {};
    memProps = memProps.filter(function(p) {
      var url = (p.sourceUrl || '').replace(/\/+$/, '').toLowerCase();
      if (!url) return true;
      if (seenUrls[url]) return false;
      seenUrls[url] = true;
      return true;
    });
    
    // Strip reference numbers from titles (defense-in-depth against stale cache)
    memProps.forEach(function(p) {
      if (p.title) {
        p.title = p.title.replace(/\s*\|\s*T\d+\s*$/i, '');
      }
    });

    // Build the same format as the /api/agents/:slug response (agent-template.js expects this)
    agentData = {
      success: true,
      agent: {
        id: memAgent._id.toString(), name: memAgent.name, companyName: memAgent.companyName,
        slug: memAgent.slug, tagline: memAgent.tagline || '', logo: memAgent.logo || '',
        primaryColor: memAgent.primaryColor || '#1a73e8',
        secondaryColor: memAgent.secondaryColor || '#2c3e50',
        accentColor: memAgent.accentColor || '#e74c3c',
        template: memAgent.template || 'modern-corporate',
        showPoweredBy: memAgent.showPoweredBy !== false,
        phone: memAgent.phone || ''
      },
      properties: memProps.map(function(p) {
        return {
          id: p._id.toString(), title: p.title, description: p.description || '',
          price: p.price, location: p.location, sourceUrl: p.sourceUrl || '',
          images: (p.images || []).map(function(i) { return typeof i === 'string' ? { url: i } : i; }),
          features: p.features || [],
          bedrooms: p.bedrooms, bathrooms: p.bathrooms, parkingSpaces: p.parkingSpaces,
          type: p.type, status: p.status,
          viewingSlots: p.viewingSlots || p.availableSlots || p.slots || [],
          viewingRequests: p.viewingRequests || [],
          createdAt: p.createdAt
        };
      })
    };
  }

  var templatePath = path.join(__dirname, '..', 'public', 'agent-template.html');
  var html = fs.readFileSync(templatePath, 'utf8');

  if (agentData) {
    var injected = '<script>window.__INITIAL_AGENT_DATA = ' + JSON.stringify(agentData) + ';</script>';
    html = html.replace('</head>', injected + '</head>');
  }

  return res.send(html);

  res.status(404).sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});


// MongoDB diagnostic
// Debug: check agent in MongoDB directly
app.get('/api/debug-agent', async (req, res) => {
  try {
    var { MongoClient } = require('mongodb');
    var uri = process.env.MONGODB_URI;
    if (!uri || !uri.startsWith('mongodb')) return res.json({ error: 'no mongo uri' });
    var client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    var db = client.db('viewingone');
    var agents = await db.collection('agents').find({}).toArray();
    var info = { count: agents.length };
    info.agents = agents.map(function(a) {
      return {
        email: a.email,
        slug: a.slug,
        hasPassword: !!a.password,
        passwordLen: a.password ? a.password.length : 0,
        idType: typeof a._id,
        isActive: a.isActive
      };
    });
    await client.close();
    res.json(info);
  } catch(e) {
    res.json({ error: e.message });
  }
});

app.get('/api/db-status', async (req, res) => {
  const info = { database: dbStatus, mongoUri: process.env.MONGODB_URI ? 'set' : 'not-set' };
  if (mongoClient) {
    try {
      info.isConnected = !!(await mongoClient.db('viewingone').command({ ping: 1 }));
    } catch(e) {
      info.pingError = e.message.slice(0, 100);
      info.isConnected = false;
    }
  }
  try {
    const mongoose = require('mongoose');
    info.mongoose = { readyState: mongoose.connection.readyState };
    info.mongoose.readyStateLabel = ['disconnected','connected','connecting','disconnecting'][mongoose.connection.readyState] || 'unknown';
  } catch(e) {}
  res.json(info);
});

// Debug endpoint to check in-memory cache
app.get('/api/debug-inmem', async (req, res) => {
  var data = {
    agentsCount: (global.__inMemoryAgents || []).length,
    propsCount: (global.__inMemoryProperties || []).length,
    props: (global.__inMemoryProperties || []).slice(0, 20).map(function(p) {
      return { id: (p._id || '').toString().slice(-6), title: p.title, agentId: typeof p.agentId === 'object' ? (p.agentId.toString ? p.agentId.toString().slice(-6) : '?') : String(p.agentId || '').slice(-6) };
    }),
    dbStatus: dbStatus
  };
  res.json(data);
});

module.exports = app;
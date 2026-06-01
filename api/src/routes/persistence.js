// Simple file-based persistence for Vercel's /tmp directory
// This survives cold starts within the same deployment
const fs = require('fs');
const path = require('path');

// Vercel provides /tmp for temporary file storage
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', '..', '.data');

function getFilePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}

function loadCollection(collection) {
  try {
    const filePath = getFilePath(collection);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`Failed to load ${collection}:`, e.message);
  }
  return [];
}

function saveCollection(collection, data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(getFilePath(collection), JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`Failed to save ${collection}:`, e.message);
    return false;
  }
}

// Sync from MongoDB into in-memory (survives across Vercel deployments)
async function syncFromMongo() {
  try {
    if (typeof global.getMongoDbPromise !== 'function') return;
    var db = await getMongoDbPromise();
    if (!db) return;
    
    // Load agents from MongoDB
    var mongoAgents = await db.collection('agents').find({}).toArray();
    if (mongoAgents && mongoAgents.length > 0 && (!global.__inMemoryAgents || global.__inMemoryAgents.length === 0)) {
      global.__inMemoryAgents = mongoAgents.map(function(a) {
        // Normalise ObjectId to string
        a._id = a._id.toString ? a._id.toString() : a._id;
        return a;
      });
      console.log('📦 Synced ' + mongoAgents.length + ' agents from MongoDB');
      // Also save to /tmp for faster cold-start next time
      saveCollection('agents', global.__inMemoryAgents);
    }
    
    // Load properties from MongoDB
    var mongoProps = await db.collection('properties').find({}).toArray();
    if (mongoProps && mongoProps.length > 0 && (!global.__inMemoryProperties || global.__inMemoryProperties.length === 0)) {
      global.__inMemoryProperties = mongoProps.map(function(p) {
        p._id = p._id.toString ? p._id.toString() : p._id;
        p.agentId = p.agentId.toString ? p.agentId.toString() : p.agentId;
        return p;
      });
      console.log('📦 Synced ' + mongoProps.length + ' properties from MongoDB');
      saveCollection('properties', global.__inMemoryProperties);
    }
  } catch (e) {
    console.log('MongoDB sync failed (non-fatal):', e.message);
  }
}

// Initialize from file if available, with in-memory fallback
if (!global.__fileBacked) {
  global.__fileBacked = true;
  
  // Only load if in-memory arrays are empty (fresh start)
  if (global.__inMemoryAgents && global.__inMemoryAgents.length === 0) {
    // Try /tmp/ first (faster, works within same deployment)
    const agents = loadCollection('agents');
    if (agents.length > 0) {
      global.__inMemoryAgents = agents;
      console.log('📂 Loaded ' + agents.length + ' agents from file backup');
    }
  }
  
  if (global.__inMemoryProperties && global.__inMemoryProperties.length <= 3) {
    const props = loadCollection('properties');
    if (props.length > 0) {
      global.__inMemoryProperties = props;
      console.log('📂 Loaded ' + props.length + ' properties from file backup');
    }
  }
  
  // If still empty, try MongoDB (survives deploys)
  if (!global.__inMemoryAgents || global.__inMemoryAgents.length === 0) {
    // Fire and forget - don't block startup
    syncFromMongo();
  }
  
  // Auto-save on process exit
  process.on('exit', () => {
    if (global.__inMemoryAgents) saveCollection('agents', global.__inMemoryAgents);
    if (global.__inMemoryProperties) saveCollection('properties', global.__inMemoryProperties);
  });
  
  // Periodic save to BOTH /tmp/ and MongoDB (every 30 seconds)
  setInterval(() => {
    if (global.__inMemoryAgents && global.__inMemoryAgents.length > 0) {
      saveCollection('agents', global.__inMemoryAgents);
      // Also try MongoDB (fire & forget)
      syncToMongo();
    }
    if (global.__inMemoryProperties && global.__inMemoryProperties.length > 0) {
      saveCollection('properties', global.__inMemoryProperties);
    }
  }, 30000);
}

// Periodic sync from MongoDB (every 60s) to pick up data from other instances
if (!global.__syncTimer) {
  global.__syncTimer = true;
  // Fire immediately on cold start, then every 60s
  syncFromMongo();
  setInterval(syncFromMongo, 60000);
}

// Save in-memory to MongoDB
async function syncToMongo() {
  try {
    if (typeof global.getMongoDbPromise !== 'function') return;
    var db = await getMongoDbPromise();
    if (!db) return;
    
    // Upsert agents
    if (global.__inMemoryAgents && global.__inMemoryAgents.length > 0) {
      for (var a of global.__inMemoryAgents) {
        try {
          await db.collection('agents').updateOne(
            { slug: a.slug },
            { $set: a },
            { upsert: true }
          );
        } catch(e2) {}
      }
    }
    
    // Upsert properties
    if (global.__inMemoryProperties && global.__inMemoryProperties.length > 0) {
      for (var p of global.__inMemoryProperties) {
        try {
          await db.collection('properties').updateOne(
            { _id: p._id },
            { $set: p },
            { upsert: true }
          );
        } catch(e2) {}
      }
    }
  } catch(e) {}
}

// Fire once immediately if we have data already
setTimeout(syncToMongo, 5000);

// Patch save functions onto global
global.persistAgent = function(agent) {
  if (!global.__inMemoryAgents) global.__inMemoryAgents = [];
  global.__inMemoryAgents.push(agent);
  saveCollection('agents', global.__inMemoryAgents);
};

global.persistProperty = function(prop) {
  if (!global.__inMemoryProperties) global.__inMemoryProperties = [];
  global.__inMemoryProperties.push(prop);
  saveCollection('properties', global.__inMemoryProperties);
};

global.persistAll = function() {
  if (global.__inMemoryAgents) saveCollection('agents', global.__inMemoryAgents);
  if (global.__inMemoryProperties) saveCollection('properties', global.__inMemoryProperties);
};

module.exports = { loadCollection, saveCollection };
// Properties routes — CRUD for properties, viewing slots, images
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Helper: get the raw MongoDB database
async function getDb() {
  try {
    var p = typeof global.getMongoDbPromise === 'function' ? global.getMongoDbPromise() : global.__mongoDbPromise;
    if (p) return await p;
  } catch(e) {}
  return null;
}

// Helper: find property in in-memory or /tmp cache
function findInMemory(id) {
  if (!global.__inMemoryProperties) return null;
  return global.__inMemoryProperties.find(function(p) {
    return String(p._id) === id || p.id === id;
  }) || null;
}

// Helper: persist in-memory to /tmp
function persistCache() {
  try {
    require('fs').writeFileSync('/tmp/properties.json', JSON.stringify(global.__inMemoryProperties || []));
  } catch(e) {}
}

// POST /api/properties — Create a new property (URL paste or manual)
router.post('/', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Auth required' });
    
    // Dedup: check if same sourceUrl already exists for this agent
    if (req.body.sourceUrl && global.__inMemoryProperties) {
      var existing = global.__inMemoryProperties.find(function(p) { 
        return p.sourceUrl === req.body.sourceUrl; 
      });
      if (existing) {
        return res.json({ success: true, property: existing, duplicate: true });
      }
    }

    var prop = {
      _id: require('crypto').randomUUID(),
      title: req.body.title || 'New Listing',
      description: req.body.description || '',
      price: req.body.price || '',
      location: req.body.location || '',
      bedrooms: parseInt(req.body.bedrooms) || 0,
      bathrooms: parseInt(req.body.bathrooms) || 0,
      size: req.body.size || '',
      images: req.body.images || (req.body.sourceUrl ? [] : []),
      sourceUrl: req.body.sourceUrl || '',
      agentId: req.body.agentId || '',
      status: 'active',
      viewingSlots: [],
      viewingRequests: [],
      createdAt: new Date(),
      updatedAt: new Date(),

    };

    // Assign agentId from token
    try {
      var jwt = require('jsonwebtoken');
      var decoded = jwt.verify(token, process.env.JWT_SECRET || 'viewingone-dev-secret-key-2026');
      prop.agentId = decoded.agentId || decoded.id || '';
      if (!prop.agentId) {
        // Fallback: search in-memory agents
        if (global.__inMemoryAgents && global.__inMemoryAgents.length > 0) {
          prop.agentId = global.__inMemoryAgents[0]._id || global.__inMemoryAgents[0].id || '';
        }
      }
    } catch(e) {}

    // If sourceUrl is provided, try to scrape title/price/images server-side
    var scrapeAttempted = false;
    if (prop.sourceUrl && prop.sourceUrl.includes('privateproperty')) {
      scrapeAttempted = true;
      try {
        var html = await new Promise(function(resolve) {
          var req2 = require('https').get(prop.sourceUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          }, function(r) {
            var d = []; r.on('data', function(c) { d.push(c); });
            r.on('end', function() { resolve(Buffer.concat(d).toString()); });
          });
          req2.setTimeout(5000, function() { req2.destroy(); resolve(''); });
          req2.on('error', function() { resolve(''); });
        });
        if (html) {
          // Price from og:title first (most reliable — eg. "R 3&#160;395&#160;000 | 1 Bedroom...")
          var ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
          if (ogTitleMatch) {
            var ogTitle = ogTitleMatch[1].replace(/&#\d+;/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
            // Extract price from og:title (first segment before |)
            var ogPrice = ogTitle.match(/^(R[\d,\s]+)/);
            if (ogPrice) prop.price = ogPrice[1].trim();
          }

          var titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            prop.title = titleMatch[1]
              .replace(/\s*\|\s*[A-Z]{2}\d+.*$/, '')  // Strip | RR{number} or | T{number}
              .replace(/\s*[\-–]\s*Private Property.*$/, '') // Strip - Private Property
              .replace(/\s*\|\s*Private Property.*$/, '') // Strip | Private Property
              .replace(/^[Rr][\d,\s]+\|\s*/, '') // Strip price prefix like "R 3 395 000 | "
              .replace(/\/\s*for sale in\s*/i, ' for sale in ') // Clean up slash
              .trim();
          }
          // Also try to extract price from meta/JSON-LD
          if (!prop.price) {
            var pm = html.match(/(?:price|amount)["\s:]+(["']?)(R?[\s]?[\d][\d\s,\.]+[\d])\1/i);
            if (pm && pm[2]) prop.price = pm[2].replace(/\s+/g, ' ').trim();
          }
          // Extract images
          var imgUrls = [];
          var imgRe = /<img[^>]+src=["'](https?:\/\/[^"']*images\.pp\.co\.za[^"']*)["']/gi;
          var m;
          while ((m = imgRe.exec(html)) !== null) {
            if (imgUrls.indexOf(m[1]) < 0) imgUrls.push(m[1]);
          }
          if (imgUrls.length === 0) {
            var jm = html.match(/"contentUrl":\s*"([^"]+)"/);
            if (jm && jm[1].indexOf('images.pp.co.za') >= 0) imgUrls.push(jm[1]);
          }
          if (imgUrls.length > 0) {
            // Deduplicate
            var seen = {};
            var deduped = [];
            for (var ui = 0; ui < imgUrls.length; ui++) {
              var base = imgUrls[ui].split('?')[0].split('#')[0];
              if (!seen[base]) { seen[base] = true; deduped.push(imgUrls[ui]); }
            }
            prop.images = deduped.slice(0, 1);
          }
        }
      } catch(e) {}
    }
    
    // Don't reject on scrape failure — Vercel can't scrape PP from iad1 region
    // The watcher handles filtering locally

    // Add to in-memory
    if (!global.__inMemoryProperties) global.__inMemoryProperties = [];
    global.__inMemoryProperties.push(prop);
    persistCache();

    // Fire-and-forget MongoDB write
    (async function() {
      try {
        var db = await getDb();
        if (db) {
          await db.collection('properties').insertOne(JSON.parse(JSON.stringify(prop)));
        }
      } catch(e) {}
    })();

    // Sync MongoDB write for read-after-write consistency
    try {
      var db = await getDb();
      if (db) {
        await db.collection('properties').insertOne(JSON.parse(JSON.stringify(prop)));
      }
    } catch(e) {}

    res.json({ success: true, message: 'Property created', property: prop });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/properties — List agent's properties
router.get('/', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Auth required' });

    try {
      var jwt = require('jsonwebtoken');
      var decoded = jwt.verify(token, process.env.JWT_SECRET || 'viewingone-dev-secret-key-2026');
      var agentId = decoded.agentId || decoded.id || '';
      
      // Try MongoDB first
      var db = await getDb();
      if (db) {
        // Query by agentId as string, or just get all active properties
        var props = await db.collection('properties').find({ status: 'active' }).sort({ createdAt: -1 }).toArray();
        if (props && props.length > 0) {
          props = props.map(function(p) {
            p._id = p._id.toString ? p._id.toString() : p._id;
            return p;
          });
          // Deduplicate by sourceUrl
          props = deduplicateProperties(props);
          global.__inMemoryProperties = props.slice();
          persistCache();
          return res.json({ success: true, properties: props });
        }
      }
    } catch(e) {}

    // In-memory / tmp fallback — only if MongoDB never connected at all
    if (!db) {
      var props = global.__inMemoryProperties || [];
      if (!props.length) {
        try { props = JSON.parse(require('fs').readFileSync('/tmp/properties.json','utf8')); } catch(e){}
      }
      props = deduplicateProperties(props);
      return res.json({ success: true, properties: props, fromCache: true });
    }
    // MongoDB connected but returned empty — that IS the truth, no fallback
    res.json({ success: true, properties: [] });
  } catch (error) {
    console.error('List properties error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/properties/:id
router.delete('/:id', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Auth required' });

    var found = false;
    var removed = false;
    
    // In-memory first (mutate in-place, never replace array)
    if (global.__inMemoryProperties) {
      for (var i = global.__inMemoryProperties.length - 1; i >= 0; i--) {
        if (String(global.__inMemoryProperties[i]._id) === req.params.id || global.__inMemoryProperties[i].id === req.params.id) {
          var matched = global.__inMemoryProperties[i];
          global.__inMemoryProperties.splice(i, 1);
          found = true;
          persistCache();
          // Persist delete to Gist
          try {
            var gistDel = require('../../gist-persistence');
            gistDel.deleteProperty(matched._id || req.params.id, function(){});
          } catch(e){}
          // Sync MongoDB delete (blocks so other instances see it)
          try {
            var db = await getDb();
            if (db) {
              await db.collection('properties').deleteOne({ _id: matched._id });
              try { await db.collection('properties').deleteOne({ _id: new ObjectId(matched._id) }); } catch(e2){}
            }
          } catch(e) {}
          break;
        }
      }
    }

    if (!found) {
      // Fallback: try MongoDB directly
      try {
        if (typeof global.getMongoDbPromise === 'function') {
          var mConn = await global.getMongoDbPromise();
          if (mConn && mConn.db) {
            var mDb = mConn.db;
            var delResult = await mDb.collection('properties').deleteOne({ _id: req.params.id });
            if (delResult.deletedCount > 0) {
              found = true;
              console.log('Deleted from MongoDB fallback:', req.params.id);
            }
          }
        }
      } catch(e) {
        console.error('MongoDB fallback delete failed:', e.message);
      }
    }

    if (found) {
      res.json({ success: true, message: 'Property deleted' });
    } else {
      res.status(404).json({ success: false, message: 'Property not found' });
    }
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/properties/:id — Update property fields (title, price, etc)
router.patch('/:id', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Auth required' });

    var found = false;
    
    // In-memory first
    if (global.__inMemoryProperties) {
      for (var i = 0; i < global.__inMemoryProperties.length; i++) {
        if (String(global.__inMemoryProperties[i]._id) === req.params.id || global.__inMemoryProperties[i].id === req.params.id) {
          var prop = global.__inMemoryProperties[i];
          if (req.body.title) prop.title = req.body.title;
          if (req.body.price) prop.price = req.body.price;
          if (req.body.bedrooms !== undefined) prop.bedrooms = req.body.bedrooms;
          if (req.body.bathrooms !== undefined) prop.bathrooms = req.body.bathrooms;
          if (req.body.location) prop.location = req.body.location;
          found = true;
          persistCache();
          // Persist to Gist
          try {
            var gistUpd = require('../../gist-persistence');
            await new Promise(function(re) { gistUpd.saveProperty(prop, function() { re(); }); });
          } catch(e) {}
          break;
        }
      }
    }

    if (found) {
      res.json({ success: true, message: 'Property updated' });
    } else {
      res.status(404).json({ success: false, message: 'Property not found' });
    }
  } catch (error) {
    console.error('Patch property error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/properties/:id/slots — Add a viewing slot (date + time based)
router.post('/:id/slots', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Auth required' });

    var { date, time, maxBookings } = req.body;
    if (!date || !time) return res.status(400).json({ success: false, message: 'Date and time required' });

    var slot = {
      id: require('crypto').randomUUID(),
      date: date,
      time: time,
      maxBookings: parseInt(maxBookings, 10) || 1,
      currentBookings: 0,
      bookings: [],
      bookingCount: 0,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    // In-memory first (authoritative source), with async MongoDB backup
    var idx = -1;
    var foundProp = null;
    if (global.__inMemoryProperties) {
      idx = global.__inMemoryProperties.findIndex(function(p) { return String(p._id) === req.params.id || p.id === req.params.id; });
      if (idx !== -1) foundProp = global.__inMemoryProperties[idx];
    }
    
    if (!foundProp) {
      // Fallback: try MongoDB directly
      try {
        if (typeof global.getMongoDbPromise === 'function') {
          var mConn = await global.getMongoDbPromise();
          if (mConn && mConn.db) {
            var mDb = mConn.db;
            var findId = req.params.id;
            var findQuery = /^[0-9a-f]{24}$/i.test(findId)
              ? { _id: new ObjectId(findId) }
              : { _id: findId };
            var mProp = await mDb.collection('properties').findOne(findQuery);
            if (mProp) {
              foundProp = mProp;
              // Pull into in-memory
              if (!global.__inMemoryProperties) global.__inMemoryProperties = [];
              var existingIdx = global.__inMemoryProperties.findIndex(function(p) { return String(p._id) === String(foundProp._id); });
              if (existingIdx === -1) {
                global.__inMemoryProperties.push(foundProp);
                idx = global.__inMemoryProperties.length - 1;
              } else {
                idx = existingIdx;
              }
            }
          }
        }
      } catch(e) {
        console.error('MongoDB fallback for slot add:', e.message);
      }
    }
    
    if (!foundProp) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    
    if (!global.__inMemoryProperties[idx].viewingSlots) {
      global.__inMemoryProperties[idx].viewingSlots = [];
    }
    global.__inMemoryProperties[idx].viewingSlots.push(slot);
    global.__inMemoryProperties[idx].viewingSlots.sort(function(a, b) { return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); });
    persistCache();
    
    // Sync MongoDB write (short timeout — if it works, cross-instance GET sees it)
    try {
      var db = await Promise.race([
        getDb(),
        new Promise(function(re) { setTimeout(function() { re(null); }, 2000); })
      ]);
      if (db) {
        try {
          var propIdStr = String(foundProp._id);
          // Try ObjectId first if it looks like a 24-hex ObjectId
          var result = null;
          if (/^[0-9a-f]{24}$/i.test(propIdStr)) {
            result = await db.collection('properties').updateOne(
              { _id: new ObjectId(propIdStr) },
              { $push: { viewingSlots: slot } }
            );
          }
          // Fallback to string match (for UUID or other string _ids)
          if (!result || result.modifiedCount === 0) {
            result = await db.collection('properties').updateOne(
              { _id: propIdStr },
              { $push: { viewingSlots: slot } }
            );
          }
        } catch(e) {}
      }
    } catch(e) {}
    
    return res.json({ success: true, message: 'Slot added', slot: slot });
  } catch (error) {
    console.error('Add slot error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// DELETE /api/properties/:id/slots/:slotId — Remove a viewing slot
router.delete('/:id/slots/:slotId', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Auth required' });

    var removed = false;
    var targetPropId = req.params.id;

    // In-memory first
    if (global.__inMemoryProperties) {
      var idx = global.__inMemoryProperties.findIndex(function(p) { return String(p._id) === req.params.id || p.id === req.params.id; });
      if (idx !== -1 && global.__inMemoryProperties[idx].viewingSlots) {
        var before = global.__inMemoryProperties[idx].viewingSlots.length;
        global.__inMemoryProperties[idx].viewingSlots = global.__inMemoryProperties[idx].viewingSlots.filter(function(s) { return s.id !== req.params.slotId; });
        if (global.__inMemoryProperties[idx].viewingSlots.length < before) {
          removed = true;
          persistCache();
        }
      }
    }

    if (!removed) {
      // Fallback: try MongoDB directly
      try {
        if (typeof global.getMongoDbPromise === 'function') {
          var mConn = await global.getMongoDbPromise();
          if (mConn && mConn.db) {
            var mDb = mConn.db;
            var delId = req.params.id;
            var delQuery = {};
            if (/^[0-9a-f]{24}$/i.test(delId)) {
              delQuery._id = new ObjectId(delId);
            } else {
              delQuery._id = delId;
            }
            var mResult = await mDb.collection('properties').updateOne(
              delQuery,
              { $pull: { viewingSlots: { id: req.params.slotId } } }
            );
            if (mResult.modifiedCount > 0) {
              removed = true;
            }
          }
        }
      } catch(e) {
        console.error('MongoDB fallback for slot delete:', e.message);
      }
    }
    
    // Fire-and-forget MongoDB sync (always runs if removed in-memory)
    if (removed) {
      (async function() {
        try {
          var db = await getDb();
          if (db) {
            await db.collection('properties').updateOne(
              { _id: req.params.id },
              { $pull: { viewingSlots: { id: req.params.slotId } } }
            );
          }
        } catch(e) {}
      })();
    }

    if (removed) {
      return res.json({ success: true, message: 'Slot deleted' });
    } else {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }
  } catch (error) {
    console.error('Delete slot error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/properties/upload-images — Upload URLs for a property
router.post('/upload-images', async (req, res) => {
  try {
    var { propertyId, images } = req.body;
    if (!propertyId || !images || !Array.isArray(images) || images.length === 0) {
      return res.json({ success: false, message: 'propertyId and images[] required' });
    }

    var imageUrls = images.slice(0, 1).filter(function(img) {
      return typeof img === 'string' && !img.startsWith('data:');
    });

    if (imageUrls.length === 0) {
      return res.json({ success: false, message: 'No valid image URLs' });
    }

    var stored = false;

    // Update in-memory
    if (global.__inMemoryProperties) {
      var idx = -1;
      for (var i = 0; i < global.__inMemoryProperties.length; i++) {
        var pid = String(global.__inMemoryProperties[i]._id || global.__inMemoryProperties[i].id || '');
        if (pid === String(propertyId)) { idx = i; break; }
      }
      if (idx !== -1) {
        global.__inMemoryProperties[idx].images = imageUrls;
        stored = true;
        persistCache();
      } else {
        // Try writing to /tmp/properties.json directly via MongoDB read
        // First check: maybe the property exists in Mongo but not in memory yet
      }
    }

    // Write to MongoDB
    try {
      var db = await getDb();
      if (db) {
        await db.collection('properties').updateOne(
          { _id: propertyId },
          { $set: { images: imageUrls, updatedAt: new Date() } }
        ).catch(function(){});
        // Also try as string _id
        await db.collection('properties').updateOne(
          { id: propertyId },
          { $set: { images: imageUrls, updatedAt: new Date() } }
        ).catch(function(){});
        stored = true;
      }
    } catch(e) {}

    res.json({
      success: stored,
      message: stored ? 'Stored ' + imageUrls.length + ' image URL(s)' : 'Property not found',
      imageCount: imageUrls.length
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Deduplicate properties by sourceUrl (keep the most recently created one)
function deduplicateProperties(props) {
  var seen = {};
  var result = [];
  for (var i = 0; i < props.length; i++) {
    var p = props[i];
    var url = (p.sourceUrl || '').replace(/\/+$/, '').toLowerCase();
    if (!url) {
      // No sourceUrl — always include
      result.push(p);
    } else if (!seen[url]) {
      seen[url] = true;
      result.push(p);
    }
    // If already seen by url, skip the duplicate
  }
  return result;
}

module.exports = router;

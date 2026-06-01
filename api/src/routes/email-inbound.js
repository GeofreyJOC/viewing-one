// Email Inbound Endpoint -- processes property URLs submitted by email
// POST /api/properties/email-inbound

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Cache the MongoDB connection promise so multiple calls share it
let mongoConnectionPromise = null;

function getMongoDb() {
  if (mongoConnectionPromise) return mongoConnectionPromise;
  mongoConnectionPromise = new Promise(async (resolve) => {
    try {
      const { MongoClient } = require('mongodb');
      const uri = process.env.MONGODB_URI;
      if (uri && uri.startsWith('mongodb')) {
        for (var tries = 0; tries < 3; tries++) {
          try {
            const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000, connectTimeoutMS: 20000 });
            await client.connect();
            resolve({ db: client.db('viewingone'), client });
            return;
          } catch(cErr) {
            if (tries < 2) await new Promise(r => setTimeout(r, 2000));
            else throw cErr;
          }
        }
      }
    } catch (e) {
      console.log('Email-inbound: MongoDB connection failed:', e.message);
    }
    resolve(null);
  });
  return mongoConnectionPromise;
}

router.post('/email-inbound', async (req, res) => {
  try {
    const { from, sender, fromEmail, subject, text, body } = extractFields(req);
    const email = (fromEmail || from || sender || '').toLowerCase().trim();
    const content = (text || body || '') + ' ' + (subject || '');
    const emailSubject = (subject || '').replace(/^Fwd:\s*/i, '').replace(/^FW:\s*/i, '').replace(/^RE:\s*/i, '').replace(/^RE:\s*/i, '').trim();

    if (!email) {
      return res.json({ success: false, message: 'No sender email found' });
    }

    // 1. FIND AGENT -- try Mongoose (getDb), then raw MongoDB, then in-memory
    let agent = null;
    
    // Try Mongoose connection first (same one dashboard uses)
    try {
      if (typeof global.getMongoDbPromise === 'function') {
        const mongooseConn = await global.getMongoDbPromise();
        if (mongooseConn && mongooseConn.db) {
          agent = await mongooseConn.db.collection('agents').findOne({ email: email });
        }
      }
    } catch(e) {
      console.error('Mongoose agent query failed:', e.message);
    }
    
    if (!agent) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          agent = await mongo.db.collection('agents').findOne({ email: email });
        }
      } catch(e) {
        console.error('Mongo agent query failed:', e.message);
      }
    }
    
    if (!agent && global.__inMemoryAgents) {
      // Exact email match
      agent = global.__inMemoryAgents.find(a => a.email === email);
      
      // Also try matching by name in the sender field
      if (!agent && req.body.from) {
        var senderName = req.body.from.toLowerCase().replace(/[^a-z\s]/g, '').trim();
        agent = global.__inMemoryAgents.find(function(a) {
          var agentName = (a.name || '').toLowerCase().trim();
          return senderName.indexOf(agentName) >= 0 || agentName.indexOf(senderName) >= 0;
        });
      }
    }

    if (!agent) {
      // Last resort: try matching by slug
      var slugMatch = (req.body.text || req.body.body || '').match(/viewing\.one\/([a-z-]+)/i);
      if (slugMatch && global.__inMemoryAgents) {
        agent = global.__inMemoryAgents.find(function(a) {
          return a.slug === slugMatch[1];
        });
      }
    }

    if (!agent) {
      return res.json({
        success: false,
        message: 'No agent found for this email. Register at https://viewing.one/register.html first',
        email: email
      });
    }

    // 2. EXTRACT URLs
    const urls = extractUrls(content);
    if (urls.length === 0) {
      return res.json({
        success: false,
        message: 'No privateproperty.co.za URLs found. Only Private Property listings are supported.',
        agentSlug: agent.slug
      });
    }

    // 3. DEDUPLICATE URLs before processing
    var uniqueUrls = [];
    var seenUrls = {};
    for (var ui = 0; ui < urls.length; ui++) {
      // Normalize: trim trailing slash, lower case
      var normUrl = urls[ui].replace(/\/$/, '').toLowerCase();
      if (!seenUrls[normUrl]) {
        seenUrls[normUrl] = true;
        uniqueUrls.push(urls[ui]);
      }
    }
    
    // 4. PROCESS each unique URL
    const results = [];

    for (var ui2 = 0; ui2 < uniqueUrls.length; ui2++) {
      const url = uniqueUrls[ui2];
      try {
        const scraped = await scrapeUrl(url);
        
        // Use email subject as title (Property24 forwards use the listing name as subject)
        var bestTitle = emailSubject && emailSubject.length > 3
          ? emailSubject
          : (scraped.title || 'Property listing');
        
        // Extract title from Private Property URL path
        if (bestTitle === 'Property listing' || bestTitle === '') {
          var ppPath = url.match(/privateproperty\.co\.za\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/([^/]+)/i);
          if (ppPath) {
            var ppName = ppPath[1].replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
            if (ppName.length > 2) bestTitle = ppName.charAt(0).toUpperCase() + ppName.slice(1);
          }
        }
        
        // Fallback: extract price/beds/baths from subject
        if (!scraped.price || scraped.price === '' || scraped.price === 'Price on request') {
          var subjPrice = emailSubject.match(/R\s*[\d,]+(?:\.\d{2})?/);
          if (subjPrice) scraped.price = subjPrice[0].trim();
        }
        if (!scraped.bedrooms || scraped.bedrooms === 0) {
          var subjBed = emailSubject.match(/(\d+)\s*Bed/i);
          if (subjBed) scraped.bedrooms = parseInt(subjBed[1], 10);
        }
        if (!scraped.bathrooms || scraped.bathrooms === 0) {
          var subjBath = emailSubject.match(/(\d+)\s*(?:Bath|Bathroom)/i);
          if (subjBath) scraped.bathrooms = parseInt(subjBath[1], 10);
        }

        var propData = {
          title: bestTitle.substring(0, 200),
          description: scraped.description || 'Imported from ' + url,
          price: scraped.price || 'Price on request',
          location: scraped.location || 'To be confirmed',
          bedrooms: scraped.bedrooms || 0,
          bathrooms: scraped.bathrooms || 0,
          size: scraped.size || '',
          propertyType: scraped.propertyType || 'house',
          images: [], // DO NOT store base64 images on MongoDB - they're too large for Vercel
          sourceUrl: url,
          source: 'email',
          status: 'active',
          viewingSlots: generateSlots(),
          viewCount: 0,
          bookingCount: 0,
          createdAt: new Date()
        };

        let saved = false;

        // Try MongoDB insert
        try {
          const mongo = await getMongoDb();
          if (mongo) {
            var agentId = typeof agent._id === 'string' ? agent._id : agent._id.toString();
            const { ObjectId } = require('mongodb');
            try {
              propData.agentId = new ObjectId(agentId);
            } catch(e) {
              propData.agentId = agentId;
            }
            
            const result = await mongo.db.collection('properties').insertOne(propData);
            
            results.push({
              url: url,
              success: true,
              id: result.insertedId.toString(),
              title: propData.title,
              storage: 'mongodb'
            });
            
            try {
              await mongo.db.collection('agents').updateOne(
                { _id: propData.agentId },
                { $inc: { totalProperties: 1 } }
              );
            } catch(e) {}
            
            // Also add to global in-memory so /api/properties and /api/agents/:slug can find it
            propData._id = result.insertedId.toString();
            if (!global.__inMemoryProperties) global.__inMemoryProperties = [];
            global.__inMemoryProperties.unshift(propData);
            try {
              require('fs').writeFileSync('/tmp/properties.json', JSON.stringify(global.__inMemoryProperties));
            } catch(e) {}
            
            saved = true;
          }
        } catch(dbErr) {
          console.error('Mongo insert error:', dbErr.message);
        }

        // In-memory fallback
        if (!saved) {
          propData._id = crypto.randomUUID();
          propData.agentId = (typeof agent._id === 'string' ? agent._id : agent._id.toString());
          if (!global.__inMemoryProperties) global.__inMemoryProperties = [];
          global.__inMemoryProperties.push(propData);
          try { require('fs').writeFileSync('/tmp/properties.json', JSON.stringify(inMemoryProperties)); } catch(e){}
          results.push({
            url: url,
            success: true,
            title: propData.title,
            storage: 'memory'
          });
          try {
            require('fs').writeFileSync('/tmp/properties.json', JSON.stringify(global.__inMemoryProperties));
          } catch(e) {}
        }
      } catch(err) {
        results.push({
          url: url,
          success: false,
          message: err.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Processed ' + results.filter(r => r.success).length + '/' + results.length + ' URL(s)',
      results: results,
      agentPage: 'https://viewing.one/' + agent.slug
    });

  } catch(error) {
    console.error('Email inbound error:', error);
    res.status(500).json({ success: false, message: 'Server error', detail: error.message });
  }
});

function extractFields(req) {
  var b = req.body || {};
  if (b.envelope) return { from: b.envelope.from, subject: b.subject, text: b.text || b.body, body: b.html };
  return b;
}

function extractUrls(text) {
  if (!text) return [];
  // First, join broken lines: if a URL ends with '=' or a hyphen at line-break, join with next line
  var processed = text.replace(/\n/g, ' ').replace(/\r/g, '');
  // Normalise whitespace
  processed = processed.replace(/\s+/g, ' ');
  
  var patterns = [
    /https?:\/\/(?:www\.)?privateproperty\.co\.za\/[^\s<>"')]+/gi
  ];
  var found = [];
  for (var pi = 0; pi < patterns.length; pi++) {
    var matches = processed.match(patterns[pi]);
    if (matches) {
      for (var mi = 0; mi < matches.length; mi++) {
        var clean = matches[mi].replace(/[>"').,;:\s]+$/, '').replace(/=$/, '');
        if (found.indexOf(clean) === -1) found.push(clean);
      }
    }
  }
  return found;
}

async function scrapeUrl(url) {
  var data = { title: 'Property listing', price: '', location: '', bedrooms: 0, bathrooms: 0, size: '', propertyType: 'house', description: 'Imported from ' + url, images: [] };
  try {
    var fetch = require('node-fetch');
    var resp = null;
    for (var ai = 0; ai < 2; ai++) {
      try {
        resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 20000
        });
        if (resp.ok) break;
      } catch(fe) {
        if (ai === 0) { await new Promise(function(rr) { setTimeout(rr, 2000); }); continue; }
        throw fe;
      }
    }
    if (!resp || !resp.ok) return data;
    var html = await resp.text();

    // Standard OG tags
    var ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    if (ogTitle) data.title = ogTitle[1].trim().substring(0, 200);
    
    if (!ogTitle) {
      var titleTag = html.match(/<title>([^<]+)<\/title>/i);
      if (titleTag) data.title = titleTag[1].trim().substring(0, 200);
    }

    var ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (ogImage) data.images.push({ url: ogImage[1].trim(), alt: data.title });
    
    var ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (ogDesc) data.description = ogDesc[1].trim().substring(0, 500);

    // Private Property extraction
    if (url.indexOf('privateproperty.co.za') !== -1) {
      // Price from og:title (PP puts R price in title with &nbsp; separators)
      var ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
      if (ogTitle) {
        var ppPrice = ogTitle[1].match(/R[\d,&nbsp;\s]+/i);
        if (ppPrice) {
          data.price = ppPrice[0].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }
      var ppBed = html.match(/(\d+)\s*[Bb]ed/i);
      if (ppBed) data.bedrooms = parseInt(ppBed[1], 10);
      var ppBath = html.match(/(\d+)\s*(?:[Bb]athroom|[Bb]ath)/i);
      if (ppBath) data.bathrooms = parseInt(ppBath[1], 10);
      
      // Extract PP image URLs from HTML (URLs end with 'contain/jpegorpng' not a standard extension)
      var ppImgRegex = /https?:\/\/images\.pp\.co\.za[^"'\s]+/gi;
      var ppImgs = html.match(ppImgRegex);
      if (ppImgs) {
        var ppSeen = {};
        for (var pi = 0; pi < ppImgs.length && data.images.length < 8; pi++) {
          var ppurl = ppImgs[pi];
          if (!ppSeen[ppurl] && (ppurl.match(/\.(?:jpg|jpeg|png|webp)/i) || ppurl.indexOf('jpegorpng') !== -1)) {
            ppSeen[ppurl] = true;
            data.images.push({ url: ppurl, alt: data.title });
          }
        }
      }
      
      // Also try image URLs from helium subdomain (watermarked listing images)
      var heliumImgRegex = /https?:\/\/helium\.privateproperty\.co\.za[^"'\s]+/gi;
      var heliumImgs = html.match(heliumImgRegex);
      if (heliumImgs && data.images.length === 0) {
        var helSeen = {};
        for (var hi = 0; hi < heliumImgs.length && data.images.length < 8; hi++) {
          var helUrl = heliumImgs[hi];
          if (!helSeen[helUrl] && (helUrl.match(/\.(?:jpg|jpeg|png|webp)/i) || helUrl.indexOf('jpegorpng') !== -1)) {
            helSeen[helUrl] = true;
            data.images.push({ url: helUrl, alt: data.title });
          }
        }
      }
      
      // Better price extraction - find explicit currency patterns near listing data
      if (!data.price || data.price === '' || data.price === 'Price on request') {
        // Look for price in the HTML body directly (often in a price-specific element)
        var priceElements = html.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)<\/span>/gi);
        if (priceElements) {
          for (var pe = 0; pe < priceElements.length; pe++) {
            var priceText = priceElements[pe].replace(/<[^>]+>/g, '').trim();
            var rPrice = priceText.match(/R\s*[\d]+[\s,]*[\d]{3,}/);
            if (rPrice) { data.price = rPrice[0].trim(); break; }
          }
        }
      }
      
      // Try data attributes
      if (!data.price || data.price === '' || data.price === 'Price on request') {
        var dataPriceAttrs = html.match(/data-price="([^"]+)"/i);
        if (dataPriceAttrs) data.price = dataPriceAttrs[1].trim();
      }
    }
  } catch(e) {
    console.error('Scrape error for', url, e.message);
  }
  return data;
}

function generateSlots() {
  var slots = [];
  var times = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
  for (var d = 1; d <= 7; d++) {
    var date = new Date();
    date.setDate(date.getDate() + d);
    var ds = date.toISOString().split('T')[0];
    var n = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n && i < times.length; i++) {
      slots.push({ _id: crypto.randomUUID(), date: ds, time: times[i], isBooked: false });
    }
  }
  return slots;
}

module.exports = router;

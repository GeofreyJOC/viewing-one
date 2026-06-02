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
  var processed = text.replace(/\n/g, '').replace(/\r/g, '');
  processed = processed.replace(/\s+/g, ' ');
  var patterns = [
    /https?:\/\/(?:www\.)?privateproperty\.co\.za(?:\/[a-z0-9-]+){5,}\/[a-zA-Z0-9]+/gi
  ];
  var found = [];
  for (var pi = 0; pi < patterns.length; pi++) {
    var matches = processed.match(patterns[pi]);
    if (matches) {
      for (var mi = 0; mi < matches.length; mi++) {
        var clean = matches[mi].replace(/[>"').,;:\s]+$/, '').replace(/[=]\w*$/, '');
        if (clean.length > 60 && found.indexOf(clean) === -1) {
          found.push(clean);
        }
      }
    }
  }
  return found;
}

async function scrapeUrl(url) {
  var data = { title: "Property listing", price: "", location: "", bedrooms: 0, bathrooms: 0, size: "", propertyType: "house", description: "Imported from " + url, images: [] };
  try {
    // Use built-in https (no node-fetch dependency)
    var html = await new Promise(function(resolve, reject) {
      var u = new URL(url);
      var mod = u.protocol === "https:" ? require("https") : require("http");
      var opts = {
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        timeout: 20000
      };
      var req = mod.get(opts, function(resp) {
        var b = "";
        resp.on("data", function(c) { b += c; });
        resp.on("end", function() { resolve(b); });
      });
      req.on("error", reject);
      req.on("timeout", function() { req.destroy(); reject(new Error("timeout")); });
      req.end();
    });

    // Standard OG tags
    var ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    if (ogTitle) {
      data.title = ogTitle[1]
        .replace(/\|\s*Private Property\s*$/i, "")
        .replace(/\|\s*T\d+\s*\|/g, "-")
        .replace(/\s*\|\s*T\d+\s*$/i, "")
        .replace(/&[a-z]+;/g, " ")
        .replace(/&#\d{2,6};/g, " ")
        .replace(/\s+/g, " ")
        .trim().substring(0, 200);
    }
    if (!ogTitle || data.title.length < 3) {
      var titleTag = html.match(/<title>([^<]+)<\/title>/i);
      if (titleTag) {
        data.title = titleTag[1]
          .replace(/\|\s*Private Property\s*$/i, "")
          .replace(/\|\s*T\d+\s*\|/g, "-")
          .replace(/\s*\|\s*T\d+\s*$/i, "")
          .replace(/&[a-z]+;/g, " ")
          .replace(/&#\d{2,6};/g, " ")
          .replace(/\s+/g, " ")
          .trim().substring(0, 200);
      }
    }

    var ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (ogDesc) data.description = ogDesc[1].trim().substring(0, 500);

    // Price: first try from og:title with HTML entity handling
    if (ogTitle) {
      var ogClean = ogTitle[1].replace(/&[a-z]+;/g, " ").replace(/&#\d{2,6};/g, " ").replace(/\s+/g, " ");
      var ppPrice = ogClean.match(/R\s*[\d][\d\s,.]*/);
      if (ppPrice) data.price = ppPrice[0].trim();
    }
    // Then try look for price in span elements
    if (!data.price || data.price === "Price on request") {
      var priceElems = html.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)<\/span>/gi);
      if (priceElems) {
        for (var pe = 0; pe < priceElems.length; pe++) {
          var pt = priceElems[pe].replace(/<[^>]+>/g, "").trim();
          var rp = pt.match(/R\s*[\d]+[\s,]*[\d]{3,}/);
          if (rp) { data.price = rp[0].trim(); break; }
        }
      }
    }
    // Then try data-price attribute
    if (!data.price || data.price === "Price on request") {
      var dp = html.match(/data-price="([^"]+)"/i);
      if (dp) data.price = dp[1].trim();
    }

    // Beds/baths
    var ppBed = html.match(/(\d+)\s*[Bb]ed/i);
    if (ppBed) data.bedrooms = parseInt(ppBed[1], 10);
    var ppBath = html.match(/(\d+)\s*(?:[Bb]athroom|[Bb]ath)/i);
    if (ppBath) data.bathrooms = parseInt(ppBath[1], 10);

    // Images: extract ALL from HTML (OG + pp.co.za + helium)
    var imageSources = [];
    // OG image
    var ogImg = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (!ogImg) ogImg = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
    if (ogImg && ogImg[1].indexOf("privateproperty-icon") === -1) {
      imageSources.push(ogImg[1].trim());
    }
    // images.pp.co.za URLs
    var ppImgUrls = html.match(/https?:\/\/images\.pp\.co\.za[^"'\s]+/gi);
    if (ppImgUrls) {
      ppImgUrls.forEach(function(imgUrl) {
        if (imageSources.indexOf(imgUrl) === -1) imageSources.push(imgUrl);
      });
    }
    // helium subdomain
    var helUrls = html.match(/https?:\/\/helium\.privateproperty\.co\.za[^"'\s]+/gi);
    if (helUrls) {
      helUrls.forEach(function(imgUrl) {
        if (imageSources.indexOf(imgUrl) === -1) imageSources.push(imgUrl);
      });
    }
    // Build data.images (limit 8, in order)
    for (var ii = 0; ii < imageSources.length && data.images.length < 8; ii++) {
      var imgSrc = imageSources[ii];
      data.images.push({ url: imgSrc, alt: data.title });
    }
  } catch(e) {
    console.error("Scrape error for", url, e.message);
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

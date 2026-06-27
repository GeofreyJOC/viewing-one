// One-time script: download images for ALL existing properties that still reference remote URLs
// Run on VPS: node bin/download-existing-images.js

const fs = require('fs');
const path = require('path');

// Make image downloader available
global.__inMemoryAgents = [];
global.__inMemoryProperties = [];

const imageDownloader = require('../api/src/image-downloader');

async function main() {
  console.log('🔍 Scanning for properties with remote image URLs...\n');

  var props = [];

  // Load from /tmp first
  try {
    var tmpPath = '/tmp/properties.json';
    if (fs.existsSync(tmpPath)) {
      props = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
      console.log('📂 Loaded', props.length, 'properties from /tmp/properties.json');
    }
  } catch(e) {}

  // Try MongoDB
  try {
    var mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/viewing-one');
    var db = mongoose.connection.db;
    var mongoProps = await db.collection('properties').find({}).toArray();
    console.log('📂 Loaded', mongoProps.length, 'properties from MongoDB');

    if (mongoProps.length > 0) {
      // Merge with existing, dedup by _id
      var seen = {};
      mongoProps.forEach(function(p) {
        var id = String(p._id);
        if (!seen[id]) {
          seen[id] = true;
          p._id = id;
          props.push(p);
        }
      });
      props.forEach(function(p) {
        var id = String(p._id);
        if (!seen[id]) {
          seen[id] = true;
          props.push(p);
        }
      });
    }
  } catch(e) {
    console.log('MongoDB not available:', e.message);
  }

  // Filter properties that have remote image URLs
  var remoteUrlProps = props.filter(function(p) {
    return p.images && p.images.length > 0 && 
           p.images[0] && typeof p.images[0] === 'string' &&
           p.images[0].indexOf('://') > 0;
  });

  console.log('\n📸 Found', remoteUrlProps.length, 'properties with remote image URLs to download\n');

  var successCount = 0;
  var failCount = 0;

  for (var i = 0; i < remoteUrlProps.length; i++) {
    var p = remoteUrlProps[i];
    var id = String(p._id);
    var title = (p.title || 'Untitled').substring(0, 40);
    var urlCount = p.images.length;

    try {
      console.log('  [' + (i+1) + '/' + remoteUrlProps.length + '] Downloading', urlCount, 'images for:', title);

      // Clean old downloaded images first
      imageDownloader.cleanupPropertyImages(id);

      var localUrls = await imageDownloader.downloadPropertyImages(p.images, id);

      if (localUrls.length > 0) {
        console.log('    ✅ Downloaded', localUrls.length, 'images successfully');

        // Update in MongoDB
        try {
          var mongoose2 = require('mongoose');
          if (mongoose2.connection && mongoose2.connection.db) {
            await mongoose2.connection.db.collection('properties').updateOne(
              { _id: id },
              { $set: { images: localUrls } }
            );
            console.log('    ✅ MongoDB updated');
          }
        } catch(e) {
          console.log('    ⚠️  MongoDB update failed:', e.message);
        }

        // Update in /tmp cache
        try {
          var tmpPath2 = '/tmp/properties.json';
          if (fs.existsSync(tmpPath2)) {
            var allProps = JSON.parse(fs.readFileSync(tmpPath2, 'utf8')) || [];
            var idx = allProps.findIndex(function(ap) {
              return String(ap._id) === id || ap.id === id;
            });
            if (idx !== -1) {
              allProps[idx].images = localUrls;
              fs.writeFileSync(tmpPath2, JSON.stringify(allProps));
            }
          }
        } catch(e) {}

        successCount++;
      } else {
        console.log('    ❌ Failed to download any images');
        failCount++;
      }
    } catch(e) {
      console.log('    ❌ Error:', e.message);
      failCount++;
    }
  }

  console.log('\n📊 Results:');
  console.log('  ✅ Success:', successCount);
  console.log('  ❌ Failed:', failCount);

  process.exit(0);
}

main().catch(function(e) {
  console.error('Fatal error:', e.message);
  process.exit(1);
});

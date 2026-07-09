// Comprehensive fix: clean titles everywhere and verify
var MongoClient = require('mongodb').MongoClient;
var http = require('http');
var fs = require('fs');

async function main() {
  // 1. Clean MongoDB
  console.log('--- Cleaning MongoDB ---');
  var conn = await MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one');
  var db = conn.db();
  var props = await db.collection('properties').find({}).toArray();
  
  var fixed = 0;
  var titleRegex = /\s*\|\s*T\d+\s*$/i;
  for (var p of props) {
    if (p.title && titleRegex.test(p.title)) {
      var cleanTitle = p.title.replace(titleRegex, '');
      console.log('  Fixing: ' + p.title + ' -> ' + cleanTitle);
      await db.collection('properties').updateOne({ _id: p._id }, { $set: { title: cleanTitle } });
      fixed++;
    }
  }
  console.log('Fixed: ' + fixed);
  
  // 2. Verify MongoDB
  props = await db.collection('properties').find({}).toArray();
  console.log('\n--- MongoDB After Fix ---');
  props.forEach(function(p) { console.log('  ' + p.title); });
  
  // 3. Delete all cache files
  console.log('\n--- Deleting cache files ---');
  var caches = [
    '/tmp/properties.json',
    '/tmp/agents.json',
    '/root/viewing-one/api/.data/properties.json',
    '/root/viewing-one/api/.data/agents.json'
  ];
  caches.forEach(function(f) {
    try { fs.unlinkSync(f); console.log('  Deleted: ' + f); } catch(e) { console.log('  Not found: ' + f); }
  });
  
  // 4. Call the agent API to verify
  console.log('\n--- API Response (cleaned) ---');
  // Wait a moment for the app to settle
  await new Promise(function(r) { setTimeout(r, 2000); });
  
  http.get('http://127.0.0.1:3000/api/agents/hilmar-samuels', function(resp) {
    var d = [];
    resp.on('data', function(c) { d.push(c); });
    resp.on('end', function() {
      try {
        var data = JSON.parse(Buffer.concat(d).toString());
        if (data.properties) {
          data.properties.forEach(function(p) { console.log('  ' + p.title); });
        } else {
          console.log('No properties:', JSON.stringify(data).slice(0, 300));
        }
      } catch(e) {
        console.log('Parse error:', e.message);
        console.log('Raw:', Buffer.concat(d).toString().slice(0, 500));
      }
      conn.close();
      process.exit(0);
    });
  }).on('error', function(e) {
    console.log('HTTP error:', e.message);
    conn.close();
    process.exit(1);
  });
}

main().catch(function(e) {
  console.error(e);
  process.exit(1);
});

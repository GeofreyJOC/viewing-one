// Nuclear fix: stop app, clean MongoDB, delete ALL caches, start app, verify
var { execSync, exec } = require('child_process');
var fs = require('fs');

// 1. Fix MongoDB (app already stopped)
console.log('=== Step 1: Fix MongoDB titles ===');
var result = execSync('node /root/viewing-one/fix-existing-titles.js', { encoding: 'utf8' });
console.log(result);

// 2. Delete ALL cache files
console.log('=== Step 2: Delete ALL cache files ===');
var cacheFiles = [
  '/tmp/properties.json',
  '/tmp/agents.json', 
  '/root/viewing-one/api/.data/properties.json',
  '/root/viewing-one/api/.data/agents.json'
];
cacheFiles.forEach(function(f) {
  try { fs.unlinkSync(f); console.log('  Deleted: ' + f); } 
  catch(e) { console.log('  Not found: ' + f); }
});

// 3. Make sure .data dir has fresh []
console.log('=== Step 3: Ensure .data dir has empty arrays ===');
try { fs.mkdirSync('/root/viewing-one/api/.data', { recursive: true }); } catch(e) {}
fs.writeFileSync('/root/viewing-one/api/.data/properties.json', '[]');
fs.writeFileSync('/root/viewing-one/api/.data/agents.json', '[]');
console.log('  Reset .data/*.json to []');

// 4. Start the app
console.log('=== Step 4: Start app ===');
execSync('pm2 start viewing-one', { encoding: 'utf8' });
console.log('  App started, waiting 6 seconds for MongoDB...');

setTimeout(function() {
  // 5. Check API response
  console.log('\n=== Step 5: Check API response ===');
  var http = require('http');
  
  http.get('http://127.0.0.1:3000/api/agents/hilmar-samuels', function(resp) {
    var d = [];
    resp.on('data', function(c) { d.push(c); });
    resp.on('end', function() {
      var data = JSON.parse(Buffer.concat(d).toString());
      if (data.properties) {
        console.log('Titles from API:');
        data.properties.forEach(function(p) { console.log('  ' + p.title); });
      } else {
        console.log('No properties:', JSON.stringify(data).slice(0, 300));
      }
      
      // 6. Check MongoDB directly
      console.log('\n=== Step 6: Check MongoDB directly ===');
      var MongoClient = require('mongodb').MongoClient;
      MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one').then(function(c) {
        return c.db().collection('properties').find({}).toArray();
      }).then(function(props) {
        console.log('Titles from MongoDB:');
        props.forEach(function(p) { console.log('  ' + p.title); });
        
        // 7. Check cache files
        console.log('\n=== Step 7: Check cache files ===');
        cacheFiles.forEach(function(f) {
          try {
            var content = JSON.parse(fs.readFileSync(f, 'utf8'));
            if (Array.isArray(content) && content.length > 0) {
              console.log('  ' + f + ': ' + content.length + ' items');
              content.forEach(function(p) { console.log('    ' + p.title); });
            } else {
              console.log('  ' + f + ': empty/[]');
            }
          } catch(e) {
            console.log('  ' + f + ': not found');
          }
        });
        
        console.log('\n=== DONE ===');
        process.exit(0);
      });
    });
  }).on('error', function(e) {
    console.log('HTTP error:', e.message);
    process.exit(1);
  });
}, 6000);

// Fix and verify - run with app STOPPED
var { MongoClient } = require('mongodb');
var uri = 'mongodb://127.0.0.1:27017/viewing-one';

MongoClient.connect(uri).then(async function(client) {
  var db = client.db();
  
  // Get ALL and fix dirty titles
  var all = await db.collection('properties').find({}).toArray();
  console.log('Found ' + all.length + ' properties');
  
  all.forEach(function(p) {
    console.log('  ' + p._id.toString().slice(-6) + ' | ' + p.title);
  });
  
  var dirty = all.filter(function(p) {
    return /\|\s*[A-Z]+\d+\s*$/.test(p.title);
  });
  
  console.log('\nDirty titles: ' + dirty.length);
  
  for (var p of dirty) {
    var clean = p.title.replace(/\s*\|\s*[A-Z]+\d+\s*$/, '').trim();
    console.log('  Fixing: ' + p.title + ' -> ' + clean);
    var r = await db.collection('properties').updateOne(
      { _id: p._id },
      { '$set': { title: clean } }
    );
    console.log('  Result: ' + JSON.stringify(r));
  }
  
  // Verify
  var v = await db.collection('properties').find({}).toArray();
  console.log('\nAfter fix:');
  v.forEach(function(p) {
    console.log('  ' + p._id.toString().slice(-6) + ' | ' + p.title);
  });
  
  // Check if there are dirty titles NOW
  var stillDirty = v.filter(function(p) {
    return /\|\s*[A-Z]+\d+\s*$/.test(p.title);
  });
  console.log('\nStill dirty: ' + stillDirty.length);
  
  await client.close();
  process.exit(0);
}).catch(function(e) { console.error(e); process.exit(1); });

var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one');
  var d = c.db();
  var cols = await d.listCollections().toArray();
  console.log('DB collections:', cols.map(function(c) { return c.name; }).join(',') || '(none)');
  for (var i = 0; i < cols.length; i++) {
    var n = cols[i].name;
    console.log('  ' + n + ':', await d.collection(n).countDocuments(), 'docs');
  }
  
  // Also try reading from any other databases
  var admin = c.db().admin();
  var dbs = await admin.listDatabases();
  console.log('\nAll databases:');
  dbs.databases.forEach(function(db) {
    console.log('  ' + db.name + ' (' + (db.sizeOnDisk/1024).toFixed(0) + ' KB)');
  });
  
  await c.close();
})();

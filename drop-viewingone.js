var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/');
  var admin = c.db().admin();
  var dbs = await admin.listDatabases();
  console.log('Before:');
  dbs.databases.forEach(function(d) {
    if (d.name !== 'admin' && d.name !== 'config' && d.name !== 'local') {
      console.log('  ' + d.name + ' (' + (d.sizeOnDisk/1024).toFixed(0) + ' KB)');
    }
  });
  await c.db('viewingone').dropDatabase();
  console.log('viewingone database dropped');
  var dbs2 = await admin.listDatabases();
  console.log('After:');
  dbs2.databases.forEach(function(d) {
    if (d.name !== 'admin' && d.name !== 'config' && d.name !== 'local') {
      console.log('  ' + d.name + ' (' + (d.sizeOnDisk/1024).toFixed(0) + ' KB)');
    }
  });
  await c.close();
})();

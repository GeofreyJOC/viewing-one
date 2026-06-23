var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/');
  var admin = c.db().admin();
  var dbs = await admin.listDatabases();
  dbs.databases.forEach(function(d) {
    if (d.name.match(/viewing/i)) console.log(d.name + ' (' + (d.sizeOnDisk/1024).toFixed(1) + ' KB)');
  });
  await c.close();
})();

var m = require('mongodb');
(async function() {
  // Check viewingone database
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/');
  var admin = c.db().admin();
  var allDbs = await admin.listDatabases();
  
  for (var di = 0; di < allDbs.databases.length; di++) {
    var dbName = allDbs.databases[di].name;
    if (dbName === 'admin' || dbName === 'config' || dbName === 'local') continue;
    
    var db = c.db(dbName);
    var cols = await db.listCollections().toArray();
    console.log('=== ' + dbName + ' ===');
    for (var i = 0; i < cols.length; i++) {
      var colName = cols[i].name;
      var docs = await db.collection(colName).find({}).toArray();
      console.log('  ' + colName + ' (' + docs.length + ' docs)');
      docs.forEach(function(doc, idx) {
        var out = {};
        if (doc.email) out.email = doc.email;
        if (doc.slug) out.slug = doc.slug;
        if (doc.title) out.title = (doc.title + '').slice(0, 40);
        if (doc.agentId) out.agentId = (doc.agentId + '').slice(0, 20);
        if (doc.password) out.hasPass = true;
        if (doc.sourceUrl) out.sourceUrl = (doc.sourceUrl + '').slice(0, 60);
        console.log('    [' + idx + '] ' + JSON.stringify(out));
      });
    }
  }
  
  await c.close();
})();

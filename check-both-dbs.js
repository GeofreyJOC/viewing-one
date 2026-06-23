var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/');
  var dbs = ['viewingone', 'viewing-one'];
  for (var di = 0; di < dbs.length; di++) {
    var dbName = dbs[di];
    var db = c.db(dbName);
    var cols = await db.listCollections().toArray();
    console.log('=== ' + dbName + ' (' + cols.length + ' collections) ===');
    for (var i = 0; i < cols.length; i++) {
      var colName = cols[i].name;
      var docs = await db.collection(colName).find({}).toArray();
      console.log('  ' + colName + ' (' + docs.length + '):');
      docs.forEach(function(doc, idx) {
        var out = {};
        if (doc.email) out.email = doc.email;
        if (doc.slug) out.slug = doc.slug;
        if (doc.title) out.title = (doc.title + '').slice(0, 50);
        if (doc.agentId) out.agentId = (doc.agentId + '').slice(0, 24);
        if (doc.password) out.password = '(hash)';
        if (doc.sourceUrl) out.sourceUrl = (doc.sourceUrl + '').slice(0, 60);
        if (doc._id) out.id = (doc._id + '').slice(0, 20);
        console.log('    [' + idx + '] ' + JSON.stringify(out));
      });
    }
  }
  await c.close();
})();

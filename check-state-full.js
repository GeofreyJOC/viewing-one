var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/');
  var admin = c.db().admin();
  var dbs = await admin.listDatabases();
  console.log('=== ALL DATABASES ===');
  dbs.databases.forEach(function(d) {
    if (d.name === 'admin' || d.name === 'config' || d.name === 'local') return;
    var db = c.db(d.name);
    db.listCollections().toArray().then(function(cols) {
      console.log(d.name + ' (' + cols.length + ' cols)');
      cols.forEach(function(col) {
        db.collection(col.name).find({}).toArray().then(function(docs) {
          console.log('  ' + col.name + ' (' + docs.length + '):');
          docs.forEach(function(doc) {
            var out = {};
            if (doc.email) out.email = doc.email;
            if (doc.slug) out.slug = doc.slug;
            if (doc.title) out.title = (doc.title+'').slice(0,40);
            if (doc.agentId) out.agentId = (doc.agentId+'').slice(0,20);
            console.log('    ' + JSON.stringify(out));
          });
        });
      });
    });
  });
  // Give time for all async queries
  setTimeout(function() { c.close(); process.exit(); }, 2000);
})();

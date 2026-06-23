var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/viewingone');
  var d = c.db();
  var cols = await d.listCollections().toArray();
  console.log('viewingone collections:', cols.map(function(c) { return c.name; }).join(','));
  for (var i = 0; i < cols.length; i++) {
    var n = cols[i].name;
    var docs = await d.collection(n).find({}).toArray();
    console.log('  ' + n + ' (' + docs.length + '):');
    docs.forEach(function(doc) {
      console.log('    ' + JSON.stringify({id: doc._id, title: doc.title, email: doc.email, slug: doc.slug, agentId: doc.agentId}).slice(0, 120));
    });
  }
  await c.close();
})();

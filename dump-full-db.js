var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one');
  var d = c.db();
  var cols = await d.listCollections().toArray();
  console.log('Collections:');
  for (var i = 0; i < cols.length; i++) {
    var count = await d.collection(cols[i].name).countDocuments();
    console.log('  ' + cols[i].name + ' (' + count + ' docs)');
    if (count > 0) {
      var docs = await d.collection(cols[i].name).find({}).limit(5).toArray();
      docs.forEach(function(doc, idx) {
        console.log('    [' + idx + '] ' + JSON.stringify(doc).slice(0, 300));
      });
    }
  }
  await c.close();
})();

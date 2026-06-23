var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one');
  var d = c.db();
  var collections = await d.listCollections().toArray();
  console.log('Collections:', collections.map(function(c) { return c.name; }).join(', '));
  for (var i = 0; i < collections.length; i++) {
    var name = collections[i].name;
    var count = await d.collection(name).countDocuments();
    console.log('  ' + name + ': ' + count + ' docs');
  }
  await c.close();
})();

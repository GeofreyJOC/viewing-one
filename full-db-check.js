var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one');
  var db = c.db();
  var collections = await db.listCollections().toArray();
  console.log('Collections:', JSON.stringify(collections.map(function(c){return c.name})));
  if (collections.length > 0) {
    for (var i = 0; i < collections.length; i++) {
      var name = collections[i].name;
      var docs = await db.collection(name).find({}).toArray();
      console.log(name, '(' + docs.length + '):', JSON.stringify(docs.map(function(d){return d.email||d.title||d._id})));
    }
  }
  var all = await db.collection('agents').find({}).toArray();
  console.log('All agents:', all.length);
  all.forEach(function(a) {
    console.log('  Name:', a.name, 'Email:', a.email, 'Slug:', a.slug, 'HasPass:', !!a.password);
  });
  var props = await db.collection('properties').find({}).toArray();
  console.log('All properties:', props.length);
  props.forEach(function(p) {
    console.log('  ID:', p._id, 'Title:', p.title, 'Agent:', p.agentId);
  });
  await c.close();
})();

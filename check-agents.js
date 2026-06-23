var m = require('mongodb');
( async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one');
  var agents = await c.db().collection('agents').find().toArray();
  console.log('Agents found:', agents.length);
  agents.forEach(function(a) { console.log('  ' + a.email + ' | ' + a.slug + ' | ' + (a.name||'')); });
  await c.close();
})();

var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one');
  var d = c.db();
  var agents = await d.collection('agents').find({}).toArray();
  console.log('Agents:', agents.length);
  agents.forEach(function(a) { console.log('  email:', a.email, 'slug:', a.slug); });
  var props = await d.collection('properties').find({}).toArray();
  console.log('Properties:', props.length);
  props.forEach(function(p) { console.log('  title:', p.title, 'agentId:', p.agentId); });
  await c.close();
})();

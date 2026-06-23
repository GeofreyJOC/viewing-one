var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one');
  var d = c.db();
  var r = await d.collection('properties').updateMany(
    { agentEmail: { $exists: false } },
    { $set: { agentEmail: 'hilmar.d.samuels@gmail.com' } }
  );
  console.log('Updated ' + r.modifiedCount + ' properties with agentEmail');
  await c.close();
})();

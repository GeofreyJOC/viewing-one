var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one');
  await c.db().collection('agents').deleteOne({email:'testreg@test.com'});
  console.log('test agent deleted');
  var count = await c.db().collection('agents').countDocuments();
  console.log('agents remaining:', count);
  await c.close();
})();

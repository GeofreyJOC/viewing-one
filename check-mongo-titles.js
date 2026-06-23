var { MongoClient } = require('mongodb');
MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one').then(function(c) {
  return c.db().collection('properties').find({}).toArray();
}).then(function(p) {
  p.forEach(function(x) { console.log(x.title); });
  process.exit(0);
}).catch(function(e) {
  console.error(e);
  process.exit(1);
});

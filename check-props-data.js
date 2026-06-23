require('dotenv').config();
var m = require('mongodb');
m.MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one').then(function(c) {
  return c.db().collection('properties').find().toArray();
}).then(function(ps) {
  ps.forEach(function(p) {
    console.log('=== ' + p.title + ' ===');
    console.log('  sourceUrl: ' + (p.sourceUrl || '').slice(0,80));
    console.log('  price: ' + p.price);
    console.log('  bedrooms: ' + p.bedrooms + '  bathrooms: ' + p.bathrooms);
    console.log('  images count: ' + (p.images || []).length);
    if (p.images && p.images[0]) {
      var img = p.images[0];
      console.log('  first image url: ' + (img.url || '').slice(0,120));
    }
    console.log('');
  });
  process.exit();
}).catch(function(e) { console.error(e); process.exit(1); });

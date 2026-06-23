var m = require('mongodb');
(async function() {
  var c = await m.MongoClient.connect('mongodb://127.0.0.1:27017/viewing-one');
  var d = c.db();
  var props = await d.collection('properties').find({}).toArray();
  props.forEach(function(p) {
    console.log('Property:');
    console.log('  title:', p.title);
    console.log('  agentId:', p.agentId);
    console.log('  agentEmail:', p.agentEmail);
    console.log('  sourceUrl:', (p.sourceUrl || '').slice(0, 80));
    console.log('  viewingSlots:', (p.viewingSlots || []).length, 'slots');
    if (p.viewingSlots && p.viewingSlots.length > 0) {
      p.viewingSlots.forEach(function(s, i) {
        console.log('  slot[' + i + ']:', JSON.stringify(s).slice(0, 150));
      });
    }
    console.log('  bookings:', (p.bookings || []).length);
    if (p.bookings && p.bookings.length > 0) {
      p.bookings.forEach(function(b, i) {
        console.log('  booking[' + i + ']:', JSON.stringify(b).slice(0, 150));
      });
    }
  });
  await c.close();
})();

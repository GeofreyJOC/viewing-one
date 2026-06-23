// Direct test: make a booking via the API to check transporter and email
var http = require('http');
var data = JSON.stringify({
  propertyId: 'cc1441e9-15ef-4b0a-bb1b-e40cd5655fb8',
  slotId: '5ba04fcf-8298-4d29-a51d-456fe3750194',
  visitorName: 'Test Visitor',
  visitorWhatsApp: '+264811234567',
  visitorEmail: 'test@example.com'
});
var req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/bookings',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, function(res) {
  var body = '';
  res.on('data', function(c) { body += c; });
  res.on('end', function() {
    console.log('Status:', res.statusCode);
    console.log('Response:', body.slice(0, 500));
  });
});
req.write(data);
req.end();

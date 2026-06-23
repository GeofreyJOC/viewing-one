// Test the actual /api/scrape-url endpoint with a Private Property URL
var http = require('http');
var data = JSON.stringify({ url: 'https://www.privateproperty.co.za/for-sale/western-cape/cape-town/cape-town-city-bowl/observatory/5-scott-road/T5497557' });

var req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/scrape-url',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
}, function(res) {
  var b = '';
  res.on('data', function(c) { b += c; });
  res.on('end', function() {
    var d = JSON.parse(b);
    console.log('Success:', d.success);
    console.log('Title:', JSON.stringify(d.data && d.data.title));
    console.log('Price:', JSON.stringify(d.data && d.data.price));
    console.log('Images:', d.data && d.data.images ? d.data.images.length : 0);
    process.exit(0);
  });
});
req.on('error', function(e) { console.error(e); process.exit(1); });
req.write(data);
req.end();

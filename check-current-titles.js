var http = require('http');
http.get('http://127.0.0.1:3000/api/agents/hilmar-samuels', function(res) {
  var b = '';
  res.on('data', function(c) { b += c; });
  res.on('end', function() {
    var d = JSON.parse(b);
    d.properties.forEach(function(p, i) {
      console.log('Property ' + (i+1) + ': ' + p.title);
    });
    console.log('\nTotal: ' + d.properties.length + ' properties');
    process.exit(0);
  });
}).on('error', function(e) { console.error(e); process.exit(1); });

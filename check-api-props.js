var http = require('http');
http.get('http://127.0.0.1:3000/api/agents/hilmar-samuels', function(r) {
  var b = '';
  r.on('data', function(c) { b += c; });
  r.on('end', function() {
    var d = JSON.parse(b);
    d.properties.forEach(function(p, idx) {
      var imgs = p.images || [];
      var url = imgs[0] ? (imgs[0].url || '(empty)') : '(none)';
      console.log('#' + (idx+1) + ' ' + p.title.slice(0,45) + ' | ' + imgs.length + ' img | badge: ' + p.propertyType + ' | img0: ' + String(url).slice(0,70));
    });
    process.exit(0);
  });
}).on('error', function(e) { console.error(e); process.exit(1); });

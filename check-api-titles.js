var https = require('https');
var opts = {
  hostname: '167.233.46.202',
  path: '/api/agents/hilmar-samuels',
  headers: { 'Host': 'viewing.one' }
};
https.get(opts, function(r) {
  var d = [];
  r.on('data', function(c) { d.push(c); });
  r.on('end', function() {
    var data = JSON.parse(Buffer.concat(d).toString());
    if (data.properties) {
      data.properties.forEach(function(p) {
        console.log(p.title);
      });
    } else {
      console.log(JSON.stringify(data).slice(0, 200));
    }
    process.exit(0);
  });
}).on('error', function(e) {
  console.error(e.message);
  process.exit(1);
});

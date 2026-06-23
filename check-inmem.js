// Add a temporary debug endpoint to server.js to check in-memory state
// and clear the cache
var http = require('http');

http.get('http://127.0.0.1:3000/api/debug-inmem', function(r) {
  var b = '';
  r.on('data', function(c) { b += c; });
  r.on('end', function() {
    console.log(b);
    process.exit(0);
  });
}).on('error', function(e) { console.error(e); process.exit(1); });

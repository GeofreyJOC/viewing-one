// Login as my test agent, then fetch properties
var http = require('http');

var payload = JSON.stringify({
  email: 'testreg@test.com',
  password: 'testing123'
});

var req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, function(res) {
  var body = '';
  res.on('data', function(c) { body += c; });
  res.on('end', function() {
    try {
      var data = JSON.parse(body);
      console.log('Login result:', JSON.stringify(data, null, 2));
      
      if (data.token) {
        var req2 = http.request({
          hostname: '127.0.0.1',
          port: 3000,
          path: '/api/properties',
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + data.token }
        }, function(res2) {
          var body2 = '';
          res2.on('data', function(c) { body2 += c; });
          res2.on('end', function() {
            console.log('Properties:', body2);
          });
        });
        req2.end();
      }
    } catch(e) {
      console.log('Error:', e.message, 'body:', body);
    }
  });
});
req.write(payload);
req.end();

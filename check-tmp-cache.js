// Check /tmp/properties.json cache titles
var f = require('fs').readFileSync('/tmp/properties.json','utf8');
JSON.parse(f).forEach(function(p) { console.log(p.title); });

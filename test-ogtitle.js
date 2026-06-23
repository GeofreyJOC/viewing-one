// Test scraping a real Private Property listing to see title format
var http = require('http');

// First get the source URLs from the agent page
http.get('http://127.0.0.1:3000/api/agents/hilmar-samuels', function(res) {
  var b = '';
  res.on('data', function(c) { b += c; });
  res.on('end', function() {
    var d = JSON.parse(b);
    var sources = d.properties.filter(function(p) { return p.sourceUrl; }).map(function(p) { return p.sourceUrl; });
    console.log('Source URLs found:', sources.length);
    sources.forEach(function(s, i) {
      console.log('  ' + (i+1) + ': ' + s);
    });
    
    // Scrape the first one
    if (sources.length > 0) {
      scrapeUrl(sources[0]).then(function(html) {
        var ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
        if (ogTitle) {
          var raw = ogTitle[1];
          console.log('\nRaw og:title:', JSON.stringify(raw));
          
          var clean = raw
            .replace(/\|\s*Private Property\s*$/i, "")
            .replace(/\|\s*T\d+\s*\|/g, "-")
            .replace(/\s*\|\s*T\d+\s*$/i, "")
            .replace(/&[a-z]+;/g, " ")
            .replace(/&#\d{2,6};/g, " ")
            .replace(/\s+/g, " ")
            .replace(/^R\s*[\d][\d\s,.]*\s*\|\s*/i, "")
            .trim().substring(0, 200);
          console.log('Cleaned:', JSON.stringify(clean));
        }
        
        var titleTag = html.match(/<title>([^<]+)<\/title>/i);
        if (titleTag) {
          console.log('Raw <title>:', JSON.stringify(titleTag[1]));
          var clean2 = titleTag[1]
            .replace(/\|\s*Private Property\s*$/i, "")
            .replace(/\|\s*T\d+\s*\|/g, "-")
            .replace(/\s*\|\s*T\d+\s*$/i, "")
            .replace(/&[a-z]+;/g, " ")
            .replace(/&#\d{2,6};/g, " ")
            .replace(/\s+/g, " ")
            .trim().substring(0, 200);
          console.log('Cleaned:', JSON.stringify(clean2));
        }
        process.exit(0);
      }).catch(function(e) { console.error(e); process.exit(1); });
    } else {
      process.exit(0);
    }
  });
}).on('error', function(e) { console.error(e); process.exit(1); });

function scrapeUrl(url) {
  return new Promise(function(resolve, reject) {
    var u = new URL(url);
    var mod = u.protocol === "https:" ? require("https") : require("http");
    var opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Encoding": "identity"
      },
      timeout: 20000
    };
    var req = mod.get(opts, function(resp) {
      var b = "";
      resp.on("data", function(c) { b += c; });
      resp.on("end", function() { resolve(b); });
    });
    req.on("error", reject);
    req.on("timeout", function() { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

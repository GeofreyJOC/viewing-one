// Shared scrape function for Private Property URLs
// Used by email-inbound.js and the dashboard scrape endpoint

async function scrapeUrl(url) {
  var data = { title: "Property listing", price: "", location: "", bedrooms: 0, bathrooms: 0, size: "", propertyType: "house", description: "Imported from " + url, images: [] };
  try {
    // Use built-in https
    var html = await new Promise(function(resolve, reject) {
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

    // Standard OG tags
    var ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    if (ogTitle) {
      data.title = ogTitle[1]
        .replace(/\|\s*Private Property\s*$/i, "")
        .replace(/\|\s*T\d+\s*\|/g, "-")
        .replace(/\s*\|\s*T\d+\s*$/i, "")
        .replace(/&[a-z]+;/g, " ")
        .replace(/&#\d{2,6};/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^R\s*[\d][\d\s,.]*\s*\|\s*/i, "")
        .trim().substring(0, 200);
    }
    if (!ogTitle || data.title.length < 3) {
      var titleTag = html.match(/<title>([^<]+)<\/title>/i);
      if (titleTag) {
        data.title = titleTag[1]
          .replace(/\|\s*Private Property\s*$/i, "")
          .replace(/\|\s*T\d+\s*\|/g, "-")
          .replace(/\s*\|\s*T\d+\s*$/i, "")
          .replace(/&[a-z]+;/g, " ")
          .replace(/&#\d{2,6};/g, " ")
          .replace(/\s+/g, " ")
          .trim().substring(0, 200);
      }
    }

    var ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (ogDesc) data.description = ogDesc[1].trim().substring(0, 500);

    // Price
    if (ogTitle) {
      var ogClean = ogTitle[1].replace(/&[a-z]+;/g, " ").replace(/&#\d{2,6};/g, " ").replace(/\s+/g, " ");
      var ppPrice = ogClean.match(/R\s*[\d][\d\s,.]*/);
      if (ppPrice) data.price = ppPrice[0].trim();
    }
    if (!data.price || data.price === "Price on request") {
      var priceElems = html.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)<\/span>/gi);
      if (priceElems) {
        for (var pe = 0; pe < priceElems.length; pe++) {
          var pt = priceElems[pe].replace(/<[^>]+>/g, "").trim();
          var rp = pt.match(/R\s*[\d]+[\s,]*[\d]{3,}/);
          if (rp) { data.price = rp[0].trim(); break; }
        }
      }
    }
    if (!data.price || data.price === "Price on request") {
      var dp = html.match(/data-price="([^"]+)"/i);
      if (dp) data.price = dp[1].trim();
    }

    // Beds/baths
    var ppBed = html.match(/(\d+)\s*[Bb]ed/i);
    if (ppBed) data.bedrooms = parseInt(ppBed[1], 10);
    var ppBath = html.match(/(\d+)\s*(?:[Bb]athroom|[Bb]ath)/i);
    if (ppBath) data.bathrooms = parseInt(ppBath[1], 10);

    // Images
    var imageSources = [];
    var ogImg = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (!ogImg) ogImg = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
    if (ogImg && ogImg[1].indexOf("privateproperty-icon") === -1) {
      imageSources.push(ogImg[1].trim());
    }
    var ppImgUrls = html.match(/https?:\/\/images\.pp\.co\.za[^"'\s]+/gi);
    if (ppImgUrls) {
      ppImgUrls.forEach(function(imgUrl) {
        if (imageSources.indexOf(imgUrl) === -1) imageSources.push(imgUrl);
      });
    }
    for (var ii = 0; ii < imageSources.length && data.images.length < 8; ii++) {
      var imgSrc = imageSources[ii];
      data.images.push({ url: imgSrc, alt: data.title });
    }
  } catch(e) {
    console.error("Scrape error for", url, e.message);
  }
  return data;
}

module.exports = { scrapeUrl };

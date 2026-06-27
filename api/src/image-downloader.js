// Image downloader — downloads remote images to local filesystem
// Used by: properties.js, email-inbound.js, scrape pipeline

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Where images are stored (served as static /property-images/)
var IMAGE_DIR = '/root/viewing-one/public/property-images';
var PUBLIC_PATH = '/property-images';

// Try to use VPS directory; fallback to /tmp for dev
try {
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }
} catch(e) {
  IMAGE_DIR = path.join(__dirname, '..', '..', 'public', 'property-images');
  try { fs.mkdirSync(IMAGE_DIR, { recursive: true }); } catch(e2) {}
}

/**
 * Download a single image URL and save to local filesystem
 * Returns the local URL path or null on failure
 */
function downloadImage(url, propertyId, index) {
  return new Promise(function(resolve) {
    var ext = 'jpg';
    var cleanUrl = url.split('?')[0].split('#')[0];
    var match = cleanUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
    if (match) ext = match[1].toLowerCase();

    var propDir = path.join(IMAGE_DIR, String(propertyId));
    try { fs.mkdirSync(propDir, { recursive: true }); } catch(e) {}

    var filename = 'img-' + index + '.' + ext;
    var filepath = path.join(propDir, filename);
    var publicUrl = PUBLIC_PATH + '/' + propertyId + '/' + filename;

    // Check if already downloaded
    if (fs.existsSync(filepath)) {
      return resolve(publicUrl);
    }

    var client = url.startsWith('https') ? https : http;
    var imgReq = client.get(url, { timeout: 15000, rejectUnauthorized: false }, function(resp) {
      // Handle redirects
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        var redirectUrl = resp.headers.location;
        if (redirectUrl.startsWith('/')) {
          var parsed = new URL(url);
          redirectUrl = parsed.protocol + '//' + parsed.host + redirectUrl;
        }
        return downloadImage(redirectUrl, propertyId, index).then(resolve);
      }

      if (resp.statusCode !== 200) {
        return resolve(null);
      }

      var chunks = [];
      resp.on('data', function(chunk) { chunks.push(chunk); });
      resp.on('end', function() {
        var buffer = Buffer.concat(chunks);
        if (buffer.length < 100) {
          // Too small to be a real image
          return resolve(null);
        }
        try {
          fs.writeFileSync(filepath, buffer);
          resolve(publicUrl);
        } catch(e) {
          resolve(null);
        }
      });
    });

    imgReq.on('error', function() {
      resolve(null);
    });
    imgReq.setTimeout(15000, function() {
      imgReq.destroy();
      resolve(null);
    });
  });
}

/**
 * Download all images for a property
 * @param {string[]} imageUrls - remote URLs to download
 * @param {string} propertyId - property ID for directory name
 * @returns {string[]} - local URLs (in same order, null for failed)
 */
async function downloadPropertyImages(imageUrls, propertyId) {
  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
    return [];
  }

  // Limit to first 8 images max
  var urls = imageUrls.slice(0, 8);

  var results = await Promise.all(urls.map(function(url, i) {
    return downloadImage(url, propertyId, i);
  }));

  return results.filter(Boolean);
}

/**
 * Clean up old images for a property (when replacing)
 */
function cleanupPropertyImages(propertyId) {
  var propDir = path.join(IMAGE_DIR, String(propertyId));
  try {
    if (fs.existsSync(propDir)) {
      var files = fs.readdirSync(propDir);
      files.forEach(function(f) {
        try { fs.unlinkSync(path.join(propDir, f)); } catch(e) {}
      });
      try { fs.rmdirSync(propDir); } catch(e) {}
    }
  } catch(e) {}
}

module.exports = {
  downloadPropertyImages: downloadPropertyImages,
  downloadImage: downloadImage,
  cleanupPropertyImages: cleanupPropertyImages,
  IMAGE_DIR: IMAGE_DIR,
  PUBLIC_PATH: PUBLIC_PATH
};

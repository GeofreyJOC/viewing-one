// Image upload endpoint
// POST /api/properties/upload-images
// Accepts property ID + array of image URLs (hosted URLs from images.pp.co.za etc.)

const express = require('express');
const router = express.Router();

router.post('/upload-images', async (req, res) => {
  try {
    const { propertyId, images } = req.body;
    
    if (!propertyId || !images || !Array.isArray(images) || images.length === 0) {
      return res.json({ success: false, message: 'propertyId and images[] required' });
    }
    
    const imageUrls = images.slice(0, 1).map(img => {
      if (typeof img === 'string') {
        if (img.startsWith('data:')) return null;
        return img;
      }
      return img.url || null;
    }).filter(Boolean);
    
    if (imageUrls.length === 0) {
      return res.json({ success: false, message: 'No valid image URLs provided' });
    }
    
    var stored = false;
    
    // Update in-memory first
    if (global.__inMemoryProperties) {
      var propertyIdStr = String(propertyId);
      var idx = -1;
      for (var i = 0; i < global.__inMemoryProperties.length; i++) {
        var p = global.__inMemoryProperties[i];
        var pid = p._id !== undefined ? String(p._id) : p.id || '';
        if (pid === propertyIdStr) { idx = i; break; }
      }
      if (idx !== -1) {
        global.__inMemoryProperties[idx].images = imageUrls;
        stored = true;
        try { require('fs').writeFileSync('/tmp/properties.json', JSON.stringify(inMemoryProperties)); } catch(e){}
      }
    }
    
    // Write to MongoDB with string _id
    try {
      var getMongo = global.getMongoDbPromise || function() { return global.__mongoDbPromise; };
      var mongo = await (global.__mongoDbPromise || (typeof getMongo === 'function' ? getMongo() : null));
      if (mongo) {
        // Try update with _id as string (UUID)
        var result = await mongo.collection('properties').updateOne(
          { _id: propertyId },
          { $set: { images: imageUrls, updatedAt: new Date() } }
        );
        if (result.matchedCount > 0) {
          stored = true;
        } else {
          // Try updateOne with id field instead
          await mongo.collection('properties').updateOne(
            { id: propertyId },
            { $set: { images: imageUrls, updatedAt: new Date() } }
          ).catch(function(){});
        }
      }
    } catch (e) {
      // MongoDB may not be available
    }
    
    // Persist to /tmp
    try {
      if (global.__inMemoryProperties) {
        require('fs').writeFileSync('/tmp/properties.json', JSON.stringify(global.__inMemoryProperties));
      }
    } catch(e) {}
    
    res.json({
      success: stored,
      message: stored ? 'Stored ' + imageUrls.length + ' image URL(s)' : 'Property not found',
      imageCount: imageUrls.length
    });
    
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ success: false, message: 'Server error', detail: error.message });
  }
});

module.exports = router;

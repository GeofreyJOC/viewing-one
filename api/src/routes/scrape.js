// Server-side scraping endpoint for Private Property URLs
// POST /api/scrape-url
// Body: { url: "https://www.privateproperty.co.za/..." }
// Returns: { success: true, data: { title, price, description, bedrooms, bathrooms, images } }

const express = require('express');
const router = express.Router();
const { scrapeUrl } = require('../scrape');

router.post('/scrape-url', async (req, res) => {
  try {
    const url = (req.body.url || '').trim();
    
    if (!url) {
      return res.json({ success: false, message: 'URL is required' });
    }
    
    if (url.indexOf('privateproperty.co.za') === -1) {
      return res.json({ success: false, message: 'Only Private Property URLs are supported' });
    }
    
    console.log('Scraping URL via API:', url);
    const data = await scrapeUrl(url);
    
    res.json({
      success: true,
      data: {
        title: data.title,
        price: data.price,
        description: data.description,
        location: data.location,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        size: data.size,
        propertyType: data.propertyType,
        images: data.images
      },
      message: 'Scraped: ' + data.title
    });
  } catch (e) {
    console.error('Scrape endpoint error:', e.message);
    res.json({ success: false, message: 'Scrape failed: ' + e.message });
  }
});

module.exports = router;

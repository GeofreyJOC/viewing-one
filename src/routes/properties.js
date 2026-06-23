const express = require('express');
const router = express.Router();
const Agent = require('../models/Agent');
const Property = require('../models/Property');
const axios = require('axios');
const cheerio = require('cheerio');

// @route   POST /api/properties/submit
// @desc    Submit a property via email/webhook
// @access  Public (called by email/webhook)
router.post('/submit', async (req, res) => {
  try {
    const { fromEmail, propertyUrl, subject, body } = req.body;

    // Validation
    if (!fromEmail || !propertyUrl) {
      return res.status(400).json({
        success: false,
        message: 'From email and property URL are required'
      });
    }

    // Find agent by email
    const agent = await Agent.findOne({ email: fromEmail.toLowerCase() });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'No agent found with this email. Please register first.',
        registrationUrl: 'viewing.one/register'
      });
    }

    // Check if agent is active
    if (!agent.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not active. Please contact support.'
      });
    }

    // Scrape property details
    let scrapedData;
    try {
      scrapedData = await scrapePropertyDetails(propertyUrl);
    } catch (scrapeError) {
      console.error('Scraping error:', scrapeError);
      scrapedData = {
        title: subject || 'Property from email submission',
        description: body || 'Property details will be added manually.',
        price: 'Price on request',
        location: 'Location to be determined',
        images: []
      };
    }

    // Create property
    const property = new Property({
      agentId: agent._id,
      title: scrapedData.title,
      description: scrapedData.description,
      price: scrapedData.price,
      location: scrapedData.location,
      propertyType: scrapedData.propertyType || 'house',
      bedrooms: scrapedData.bedrooms,
      bathrooms: scrapedData.bathrooms,
      size: scrapedData.size,
      images: scrapedData.images,
      originalUrl: propertyUrl,
      source: scrapedData.source || 'manual',
      submittedByEmail: fromEmail.toLowerCase(),
      status: 'draft'
    });

    // Save property
    await property.save();

    // Update agent's last activity
    agent.updatedAt = new Date();
    await agent.save();

    // Return response
    res.status(201).json({
      success: true,
      message: 'Property submitted successfully',
      property: {
        id: property._id,
        title: property.title,
        price: property.price,
        location: property.location,
        status: property.status,
        agent: {
          name: agent.name,
          companyName: agent.companyName,
          slug: agent.slug
        },
        nextSteps: [
          'Add viewing slots to make property active',
          'Property will appear at: viewing.one/' + agent.slug
        ]
      }
    });

  } catch (error) {
    console.error('Property submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during property submission',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/properties/agent/:agentId
// @desc    Get all properties for an agent
// @access  Private (agent only)
router.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status } = req.query;

    // Build query
    const query = { agentId };
    if (status) {
      query.status = status;
    }

    // Find properties
    const properties = await Property.find(query)
      .sort({ createdAt: -1 })
      .populate('agentId', 'name companyName slug');

    res.json({
      success: true,
      count: properties.length,
      properties: properties.map(prop => ({
        id: prop._id,
        title: prop.title,
        price: prop.price,
        location: prop.location,
        status: prop.status,
        viewingSlots: prop.viewingSlots.length,
        bookedSlots: prop.viewingSlots.filter(s => s.isBooked).length,
        createdAt: prop.createdAt
      }))
    });

  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/properties/:id/status
// @desc    Update property status
// @access  Private (agent only)
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['draft', 'active', 'sold', 'removed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }

    const property = await Property.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('agentId', 'name companyName slug');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.json({
      success: true,
      message: `Property status updated to ${status}`,
      property: {
        id: property._id,
        title: property.title,
        status: property.status,
        agent: {
          name: property.agentId.name,
          companyName: property.agentId.companyName,
          slug: property.agentId.slug
        }
      }
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to scrape property details
async function scrapePropertyDetails(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const scrapedData = {};

    // Determine source
    if (url.includes('property24.com')) {
      scrapedData.source = 'property24';
      
      // Property24 scraping logic
      scrapedData.title = $('h1').first().text().trim() || 'Property for Sale';
      scrapedData.price = $('.p24_price').first().text().trim() || 'Price on request';
      scrapedData.location = $('.p24_location').first().text().trim() || 'Location not specified';
      
      // Extract description
      const description = $('.p24_description').text().trim();
      scrapedData.description = description || 'No description available';
      
      // Extract images
      scrapedData.images = [];
      $('.p24_gallery img').each((i, el) => {
        const src = $(el).attr('src');
        if (src && !src.includes('placeholder')) {
          scrapedData.images.push({ url: src, caption: '' });
        }
      });
      
      // Extract property details
      $('.p24_features li').each((i, el) => {
        const text = $(el).text().toLowerCase();
        if (text.includes('bedroom') || text.includes('bed')) {
          scrapedData.bedrooms = parseInt(text.match(/\d+/)?.[0]) || 0;
        }
        if (text.includes('bathroom') || text.includes('bath')) {
          scrapedData.bathrooms = parseInt(text.match(/\d+/)?.[0]) || 0;
        }
        if (text.includes('m²') || text.includes('sqm')) {
          scrapedData.size = text.match(/\d+\s*(m²|sqm)/i)?.[0] || '';
        }
      });

    } else if (url.includes('privateproperty.co.za')) {
      scrapedData.source = 'privateproperty';
      
      // PrivateProperty scraping logic
      scrapedData.title = $('h1').first().text().trim() || 'Property for Sale';
      scrapedData.price = $('.price').first().text().trim() || 'Price on request';
      scrapedData.location = $('.location').first().text().trim() || 'Location not specified';
      
      // Similar extraction logic for PrivateProperty
      // (You'd need to adjust selectors based on their HTML structure)

    } else {
      scrapedData.source = 'manual';
      scrapedData.title = 'Property from URL submission';
      scrapedData.description = 'Property details will be added manually.';
      scrapedData.price = 'Price on request';
      scrapedData.location = 'Location to be determined';
      scrapedData.images = [];
    }

    return scrapedData;

  } catch (error) {
    console.error('Scraping error:', error.message);
    throw new Error('Failed to scrape property details');
  }
}

module.exports = router;
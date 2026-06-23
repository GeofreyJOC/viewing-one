// Property Model for MongoDB
const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
  // Agent Reference
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true
  },
  
  // Property Details
  title: {
    type: String,
    required: [true, 'Please provide a property title'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: String,
    required: [true, 'Please provide a price'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Please provide a location'],
    trim: true
  },
  propertyType: {
    type: String,
    enum: ['house', 'apartment', 'townhouse', 'farm', 'commercial', 'land'],
    default: 'house'
  },
  bedrooms: {
    type: Number,
    min: 0
  },
  bathrooms: {
    type: Number,
    min: 0
  },
  size: {
    type: String,
    trim: true
  },
  
  // Images
  images: [{
    url: String,
    caption: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Source Information
  originalUrl: {
    type: String,
    required: [true, 'Please provide the original listing URL']
  },
  source: {
    type: String,
    enum: ['property24', 'privateproperty', 'manual'],
    default: 'manual'
  },
  
  // Viewing Slots
  viewingSlots: [{
    date: {
      type: Date,
      required: true
    },
    time: {
      type: String,
      required: true
    },
    isBooked: {
      type: Boolean,
      default: false
    },
    bookedBy: {
      name: String,
      whatsapp: String,
      email: String,
      bookedAt: Date
    }
  }],
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'active', 'sold', 'removed'],
    default: 'draft'
  },
  submittedByEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastViewed: Date
});

// Update updatedAt on save
PropertySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
PropertySchema.index({ agentId: 1, status: 1 });
PropertySchema.index({ submittedByEmail: 1 });
PropertySchema.index({ 'viewingSlots.date': 1 });

module.exports = mongoose.model('Property', PropertySchema);
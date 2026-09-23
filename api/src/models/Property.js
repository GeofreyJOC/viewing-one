const mongoose = require('mongoose');

const viewingSlotSchema = new mongoose.Schema({
  id: { type: String },
  date: { type: String, required: true },
  time: { type: String, required: true },
  source: { type: String, enum: ['seller', 'agent'], default: 'agent' },
  status: { type: String, enum: ['pending', 'published', 'booked'], default: 'published' },
  isBooked: { type: Boolean, default: false },
  bookedBy: { type: String },
  bookedWhatsApp: { type: String },
  bookedEmail: { type: String },
  bookedAt: { type: Date }
}, { _id: false });

const propertyImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  alt: { type: String, default: '' }
});

const propertySchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
  agentEmail: { type: String },
  
  // Property details
  title: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: String, required: true },
  location: { type: String, required: true },
  
  // Property features
  bedrooms: { type: Number },
  bathrooms: { type: Number },
  size: { type: String },
  propertyType: { type: String, enum: ['house', 'apartment', 'townhouse', 'land', 'commercial', 'other'] },
  
  // Media
  images: [propertyImageSchema],
  
  // Source
  source: { type: String, enum: ['manual', 'email', 'property24', 'privateproperty', 'other'], default: 'manual' },
  sourceUrl: { type: String },
  
  // Viewing slots
  viewingSlots: [viewingSlotSchema],

  // Seller availability link + settings
  sellerToken: { type: String, default: '' },
  availability: {
    windowStart: { type: String, default: '08:00' },
    windowEnd: { type: String, default: '20:00' },
    slotMinutes: { type: Number, default: 60 }
  },
  notifySeller: { type: Boolean, default: false },
  sellerName: { type: String, default: '' },
  sellerEmail: { type: String, default: '' },
  // Status
  status: { type: String, enum: ['draft', 'active', 'sold', 'rented', 'removed'], default: 'draft' },
  statusChangedAt: { type: Date },
  statusPrice: { type: String }, // snapshot of price at time of sold/rented mark
  outcome: { type: String },     // 'sold' | 'rented' — market data for viewing.one
  
  // Stats
  viewCount: { type: Number, default: 0 },
  bookingCount: { type: Number, default: 0 }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

propertySchema.index({ agentId: 1, status: 1 });
propertySchema.index({ slug: 1 });

module.exports = mongoose.models.Property || mongoose.model('Property', propertySchema);
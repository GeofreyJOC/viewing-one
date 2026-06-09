const mongoose = require('mongoose');

const viewingSlotSchema = new mongoose.Schema({
  id: { type: String },
  date: { type: String, required: true },
  time: { type: String, required: true },
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
  
  // Status
  status: { type: String, enum: ['draft', 'active', 'sold', 'removed'], default: 'draft' },
  
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
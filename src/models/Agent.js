// Agent Model for MongoDB
const mongoose = require('mongoose');

const AgentSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Please provide your name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false // Don't return password in queries
  },
  
  // Business Information
  companyName: {
    type: String,
    required: [true, 'Please provide your company name'],
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  
  // Platform Information
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  plan: {
    type: String,
    enum: ['starter', 'professional'],
    default: 'starter'
  },
  
  // Branding
  logo: String,
  primaryColor: {
    type: String,
    default: '#3498db'
  },
  secondaryColor: {
    type: String,
    default: '#2c3e50'
  },
  template: {
    type: String,
    enum: ['modern-corporate', 'minimal-elegant', 'bold-urban', 'warm-rustic'],
    default: 'modern-corporate'
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt on save
AgentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Generate slug from company name
AgentSchema.pre('save', function(next) {
  if (!this.isModified('companyName')) return next();
  
  // Generate slug: "Smith Properties" → "smith-properties"
  this.slug = this.companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove multiple hyphens
    .trim();
    
  next();
});

module.exports = mongoose.model('Agent', AgentSchema);
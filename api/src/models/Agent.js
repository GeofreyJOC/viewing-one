const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  companyName: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  website: { type: String, trim: true },
  plan: { type: String, enum: ['starter', 'pro', 'pro-annual', 'pro-plus', 'pro-plus-annual'], default: 'starter' },
  
  // Password reset
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  
  // White-label branding
  logo: { type: String, default: '' },
  primaryColor: { type: String, default: '#1a73e8' },
  secondaryColor: { type: String, default: '#2c3e50' },
  accentColor: { type: String, default: '#e74c3c' },
  template: { type: String, default: 'modern-corporate' },
  tagline: { type: String, default: '' },
  showPoweredBy: { type: Boolean, default: true },
  
  // Account status
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  trialEndsAt: { type: Date },
  subscriptionId: { type: String },
  
  // Stats
  totalViewings: { type: Number, default: 0 },
  totalProperties: { type: Number, default: 0 }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});

agentSchema.index({ slug: 1 });
agentSchema.index({ email: 1 });

module.exports = mongoose.models.Agent || mongoose.model('Agent', agentSchema);
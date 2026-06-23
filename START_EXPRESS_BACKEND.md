# 🚀 EXPRESS/MONGODB BACKEND DEVELOPMENT

## 🎯 **IMMEDIATE DEVELOPMENT PLAN**

### **Phase 1: Core Backend (Today - Day 1)**
1. **Express.js setup** with proper structure
2. **MongoDB connection** with models
3. **Authentication system** (JWT)
4. **Agent registration API**
5. **Property management API**

### **Phase 2: Business Logic (Day 2)**
1. **Property scraping** (Property24, PrivateProperty)
2. **Email integration** (listings@ & feedback@)
3. **Viewing slot management**
4. **Booking system**

### **Phase 3: Frontend Integration (Day 3)**
1. **React frontend** setup
2. **Agent dashboard**
3. **White-label template engine**
4. **Admin panel**

### **Phase 4: Polish & Testing (Day 4-5)**
1. **PWA setup** (push notifications)
2. **Payment integration** (Yoco/Stripe)
3. **Testing** with mock data
4. **Documentation**

## 📁 **PROJECT STRUCTURE**

```
viewing-one/
├── server.js                 # Main Express server
├── package.json             # Dependencies
├── .env                     # Environment variables
├── .gitignore
│
├── src/
│   ├── models/              # MongoDB schemas
│   │   ├── Agent.js
│   │   ├── Property.js
│   │   ├── Booking.js
│   │   └── Template.js
│   │
│   ├── routes/              # API routes
│   │   ├── auth.js
│   │   ├── agents.js
│   │   ├── properties.js
│   │   ├── bookings.js
│   │   └── admin.js
│   │
│   ├── controllers/         # Business logic
│   │   ├── authController.js
│   │   ├── agentController.js
│   │   ├── propertyController.js
│   │   └── bookingController.js
│   │
│   ├── middleware/          # Auth & validation
│   │   ├── auth.js
│   │   ├── validation.js
│   │   └── errorHandler.js
│   │
│   ├── services/            # External services
│   │   ├── emailService.js
│   │   ├── scrapingService.js
│   │   ├── whatsappService.js
│   │   └── paymentService.js
│   │
│   ├── utils/               # Helper functions
│   │   ├── slugGenerator.js
│   │   ├── colorValidator.js
│   │   └── templateRenderer.js
│   │
│   └── config/              # Configuration
│       ├── database.js
│       ├── cloudinary.js
│       └── twilio.js
│
├── public/                  # Static files
│   ├── index.html
│   ├── admin.html
│   └── assets/
│
└── tests/                  # Test files
    ├── unit/
    └── integration/
```

## 🔧 **TECHNICAL SPECIFICATIONS**

### **Database Models:**

**Agent:**
- name, email, password (hashed)
- slug (viewing.one/[slug])
- companyName, logo, colors
- template, plan (starter/professional)
- isActive, createdAt

**Property:**
- agentId (reference)
- title, description, price
- location, propertyType
- bedrooms, bathrooms
- images[], originalUrl
- viewingSlots[] (with booking info)
- status (draft/active/sold)

**Booking:**
- propertyId, agentId
- visitorName, visitorWhatsApp, visitorEmail
- slotDate, slotTime
- status (confirmed/cancelled/completed)
- createdAt

### **API Endpoints:**

**Public:**
- GET /api/agents/:slug → Agent's public page
- POST /api/bookings → Create booking
- POST /api/notifications → Request notification

**Agent Auth:**
- POST /api/auth/register → Agent registration
- POST /api/auth/login → Agent login
- GET /api/auth/me → Get current agent

**Agent Dashboard:**
- GET /api/agent/properties → List agent's properties
- POST /api/agent/properties → Add property (via URL)
- PUT /api/agent/properties/:id → Update property
- POST /api/agent/properties/:id/slots → Add viewing slots
- GET /api/agent/bookings → List agent's bookings

**Admin:**
- GET /api/admin/agents → List all agents
- GET /api/admin/properties → List all properties
- GET /api/admin/bookings → List all bookings
- PUT /api/admin/agents/:id → Update agent status

## 🚀 **IMMEDIATE DEVELOPMENT STARTING NOW**

### **Step 1: Initialize Express Project**
```bash
npm init -y
npm install express mongoose dotenv bcryptjs jsonwebtoken cors
npm install -D nodemon
```

### **Step 2: Create Basic Server**
```javascript
// server.js
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/agents', require('./src/routes/agents'));
app.use('/api/properties', require('./src/routes/properties'));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Viewing.One backend running on port ${PORT}`);
});
```

### **Step 3: Create Agent Model**
```javascript
// src/models/Agent.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AgentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  companyName: String,
  logo: String,
  primaryColor: { type: String, default: '#3498db' },
  secondaryColor: { type: String, default: '#2c3e50' },
  template: { type: String, default: 'modern-corporate' },
  plan: { type: String, enum: ['starter', 'professional'], default: 'starter' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
AgentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
AgentSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Agent', AgentSchema);
```

## 📅 **DEVELOPMENT TIMELINE**

### **Today (April 22):**
- ✅ 09:00-12:00: Express setup & MongoDB connection
- ✅ 12:00-14:00: Agent authentication system
- ✅ 14:00-17:00: Property management API
- ✅ 17:00-18:00: Basic frontend integration

### **Tomorrow (April 23):**
- 09:00-12:00: Property scraping service
- 12:00-14:00: Email integration (listings@ & feedback@)
- 14:00-17:00: Viewing slot & booking system
- 17:00-18:00: Admin dashboard API

### **Day 3 (April 24):**
- 09:00-12:00: React frontend setup
- 12:00-14:00: Agent dashboard UI
- 14:00-17:00: White-label template engine
- 17:00-18:00: Testing & bug fixes

### **Day 4 (April 25):**
- 09:00-12:00: PWA setup & push notifications
- 12:00-14:00: Payment integration (Yoco)
- 14:00-17:00: WhatsApp integration (Twilio)
- 17:00-18:00: Deployment preparation

## 🎯 **SUCCESS CRITERIA**

### **End of Day 1 (Today):**
- [ ] Express server running with MongoDB
- [ ] Agent registration/login working
- [ ] Property creation API working
- [ ] Basic frontend showing agent page

### **End of Day 2:**
- [ ] Property scraping from Property24
- [ ] Email processing for listings@
- [ ] Viewing slot management
- [ ] Booking system API

### **End of Day 3:**
- [ ] Complete agent dashboard
- [ ] White-label template system
- [ ] Admin panel
- [ ] Public agent pages

### **End of Day 4:**
- [ ] PWA with push notifications
- [ ] Payment integration
- [ ] WhatsApp notifications
- [ ] Ready for alpha testing

## 🔧 **DEPENDENCIES TO INSTALL**

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.0",
    "dotenv": "^16.3.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "axios": "^1.6.0",
    "cheerio": "^1.0.0-rc.12",
    "nodemailer": "^6.9.7",
    "multer": "^1.4.5-lts.1",
    "cloudinary": "^1.41.0",
    "twilio": "^4.19.0",
    "firebase-admin": "^11.11.0",
    "stripe": "^14.16.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

## 🚀 **READY TO START DEVELOPMENT**

**Status:** Starting Express/MongoDB backend development now.

**Expected completion:** Working alpha version in 4 days.

**Next update:** Will provide progress report in 2 hours.

**Your tasks:**
1. Register `viewing.one` domain
2. Set up `listings@` & `feedback@` emails
3. Identify 3 alpha agent names
4. Test current server: http://localhost:3001/admin.html

**Let's build!** 🚀
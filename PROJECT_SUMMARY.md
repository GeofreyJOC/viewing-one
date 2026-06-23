# 🏠 VIEWING.ONE - PROJECT SUMMARY

## 🎯 **CORE CONCEPT**
A white-label real estate viewing scheduling platform where each agent gets `viewing.one/their-name` with their own branding.

## 🚀 **CURRENT STATUS**
**Local development server running:** http://localhost:3000  
**Admin dashboard:** http://localhost:3000/admin.html  
**Ready for domain registration:** `viewing.one`

## 🔗 **URL STRUCTURE**
```
viewing.one/[agent-slug]
Examples:
- viewing.one/john-smith
- viewing.one/remax-sandton  
- viewing.one/premium-realty
```

## 📧 **EMAIL WORKFLOW SYSTEM**

### **Two dedicated email addresses:**
1. **`listings@viewing.one`** → Property submissions
   - **Handled by:** Agent 2 (Listings & Scraping)
   - **Process:** Agents email property links → Auto-scrape → Add to system

2. **`feedback@viewing.one`** → Bug reports & improvements
   - **Handled by:** Agent 1 (Feedback & Fixes)
   - **Process:** Agents email feedback → Prioritize → Implement fixes

## 💰 **PRICING TIERS**

### **Starter:** R200/month
- Basic template (Viewing.One branding)
- `viewing.one/your-name` URL
- 10 properties max
- Email support

### **Professional:** R400/month 🎯 **Most Popular**
- **White-label** (agent's branding)
- Custom logo, colors, templates
- Unlimited properties
- Priority support
- Custom domain option

## 🏗️ **TECHNICAL ARCHITECTURE**

### **Current (Local Development):**
- **Server:** Node.js simple HTTP server
- **Frontend:** HTML/CSS/JavaScript
- **API:** Mock endpoints for testing
- **Status:** Fully functional prototype

### **Next (Production MVP):**
- **Backend:** Express.js + MongoDB
- **Frontend:** React + Tailwind CSS
- **Scraping:** Cheerio for SA property sites
- **WhatsApp:** Twilio Business API
- **Hosting:** Vercel + MongoDB Atlas
- **Email:** Nodemailer + forwarding

## 👥 **TEAM STRUCTURE**

### **Agent 1: Feedback & Fixes**
- Monitors `feedback@viewing.one`
- Implements improvements
- Communicates with agents
- Manages bug fixes

### **Agent 2: Listings & Scraping**
- Monitors `listings@viewing.one`
- Processes property submissions
- Manual scraping when needed
- Quality checks listings

## 🎨 **WHITE-LABEL FEATURES**

### **Customization Options:**
1. **Logo upload** (PNG/JPG)
2. **Color scheme** (primary/secondary)
3. **Template selection** (4+ designs)
4. **Company name** display
5. **Contact info** integration

### **Template Designs:**
1. **Modern Corporate** - Clean, professional
2. **Luxury Real Estate** - Premium feel  
3. **Boutique Agency** - Personal, friendly
4. **Modern Minimal** - Property-focused

## 🏠 **PROPERTY SCRAPING TARGETS**

### **Priority 1 (South Africa):**
1. **Property24** (property24.com)
2. **PrivateProperty** (privateproperty.co.za)
3. **Gumtree** (gumtree.co.za - property section)

### **Scraping Logic:**
- Agent emails link to `listings@`
- System auto-scrapes property details
- Agent reviews & adds viewing slots
- Property goes live on their page

## 📅 **VIEWING BOOKING SYSTEM**

### **Visitor Flow:**
1. Visit `viewing.one/agent-name`
2. Browse agent's properties
3. Select available time slot
4. Enter contact details
5. Receive WhatsApp confirmation
6. Get reminder before viewing

### **Agent Flow:**
1. Add viewing slots per property
2. See all bookings in calendar
3. Receive notifications
4. Manage cancellations/reschedules

## 🚀 **EXECUTION TIMELINE**

### **Today (Already Done):**
- ✅ Project structure created
- ✅ Local server running
- ✅ Admin dashboard built
- ✅ Email workflow defined
- ✅ Pricing tiers established

### **Tomorrow (Domain Day):**
1. **Register** `viewing.one` domain
2. **Set up** email forwarding
3. **Identify** 3 alpha agents
4. **Start** Express/MongoDB backend

### **Week 1 (MVP Development):**
- **Day 1-2:** Full backend with authentication
- **Day 3-4:** Property scraping & white-label
- **Day 5-6:** Booking system & WhatsApp
- **Day 7:** Alpha launch with 3 agents

### **Week 2 (Alpha Testing):**
- Onboard 3 alpha agents
- Test email workflow
- Collect feedback via `feedback@`
- Iterate daily improvements

### **Week 3 (Beta Launch):**
- Add 5 more agents (total 8)
- Implement payment integration
- Refine based on feedback
- Prepare for public launch

## 📊 **SUCCESS METRICS**

### **Alpha (30 Days):**
- 3 alpha agents onboarded
- 20+ properties listed
- 50+ feedback emails processed
- System stable for beta

### **Beta (60 Days):**
- 10 paying agents (R2,000+ MRR)
- 100+ properties listed
- 200+ viewing requests
- 90%+ satisfaction rate

### **Launch (90 Days):**
- 25 paying agents (R5,000+ MRR)
- 250+ properties listed
- 500+ viewing requests
- Expand to 2nd city

## 💡 **KEY DIFFERENTIATORS**

1. **White-label pages** - Agents get THEIR branding
2. **Single domain** - `viewing.one/[name]` (memorable)
3. **Email workflow** - `listings@` & `feedback@` system
4. **SA-focused** - Built for South African market
5. **WhatsApp integration** - Perfect for local usage
6. **Simple pricing** - R200/R400, no hidden fees

## 🎯 **BUSINESS MODEL**

### **Revenue Streams:**
1. **Monthly subscriptions** (primary)
   - Starter: R200/month
   - Professional: R400/month

2. **Future expansion:**
   - Enterprise: R800/month (white-label API)
   - Commission: R50/booking (optional)
   - Agency partnerships

### **Cost Structure:**
- **Domains/email:** ~R1,000/year
- **Hosting:** ~R500/month (scaling)
- **WhatsApp API:** ~R1,000+/month (usage-based)
- **Payment fees:** 2.9% + R2/transaction

## 🚨 **RISKS & MITIGATION**

### **Technical Risks:**
- **Property scraping blocked** → Multiple methods, manual entry fallback
- **WhatsApp API limits** → Follow guidelines, SMS/email backup
- **Scaling issues** → Start with robust architecture, monitor closely

### **Business Risks:**
- **Slow agent adoption** → Free trial, easy onboarding, clear value
- **Payment issues** → Use established SA provider (Yoco), manual invoicing fallback
- **Competition** → First-mover advantage, focus on SA, continuous innovation

## 📁 **PROJECT FILES**

### **Core Files:**
- `simple-server.js` - Local development server
- `server.js` - Future Express.js server
- `package.json` - Dependencies
- `.env.example` - Environment template

### **Public Files:**
- `public/index.html` - Main landing page
- `public/admin.html` - Admin dashboard
- Prototypes in `../real-estate-prototype/`

### **Documentation:**
- `README.md` - Setup instructions
- `PROJECT_SUMMARY.md` - This document
- `EXECUTION_PLAN.md` - Detailed timeline

## 🎯 **IMMEDIATE NEXT ACTIONS**

### **Priority 1 (Today/Tomorrow):**
1. **Register domain:** `viewing.one`
2. **Set up emails:** `listings@` & `feedback@`
3. **Identify alpha agents:** 3 contacts
4. **Assign team roles:** Agent 1 vs Agent 2

### **Priority 2 (This Week):**
1. **Build Express/MongoDB backend**
2. **Implement Property24 scraping**
3. **Create white-label template engine**
4. **Build agent dashboard**
5. **Integrate WhatsApp API**

## 🤝 **TEAM REQUIREMENTS**

### **Immediate (Week 1-2):**
- **1 Developer** (Geofrey) - MVP build
- **1 Marketer** (Hilmar) - Agent acquisition
- **2 Support Agents** - Email monitoring

### **Scale (Month 2-3):**
- Add 1 more developer
- Add customer support
- Consider sales role

## 🌟 **VISION**

**Short-term (6 months):** Leading property viewing platform in South Africa  
**Medium-term (2 years):** Expand to other African markets  
**Long-term (5 years):** Global white-label booking platform for various industries

---

**Status:** 🟢 **READY FOR DOMAIN REGISTRATION**  
**Next:** Register `viewing.one` → Set up emails → Start alpha testing

**Contact:** Hilmar (Business) / Geofrey (Technical)  
**Domain:** viewing.one  
**Emails:** listings@viewing.one, feedback@viewing.one
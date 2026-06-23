# 🏠 Viewing.One

**Real estate viewing scheduling platform** - `viewing.one/[agent-name]`

## 🎯 Vision
Streamline property viewings for estate agents with white-label booking pages.

## 🚀 Features

### For Agents:
- **Branded pages:** `viewing.one/agent-name`
- **White-label:** Custom logo, colors, templates
- **Property submission:** Via email to `listings@viewing.one`
- **Viewing management:** Add/remove slots, track bookings
- **Two plans:** Starter (R200) & Professional (R400)

### For Visitors:
- **Browse properties:** All agent's listings in one place
- **Book viewings:** Select available time slots
- **WhatsApp notifications:** Confirmations & reminders
- **Mobile-friendly:** Works perfectly on phones

## 🏗️ Architecture

### Tech Stack:
- **Backend:** Node.js + Express + MongoDB
- **Frontend:** React (coming soon)
- **Email:** Nodemailer + dedicated addresses
- **Scraping:** Cheerio for property sites
- **Hosting:** Vercel + MongoDB Atlas

### Email Workflow:
1. **`listings@viewing.one`** → Property submissions
2. **`feedback@viewing.one`** → Bug reports & suggestions
3. **`support@viewing.one`** → General inquiries

## 🚦 Development Status

### Phase 1: Foundation (Current)
- [x] Project setup
- [x] Basic API structure
- [x] Agent/Property models
- [ ] Domain registration (`viewing.one`)
- [ ] Email setup

### Phase 2: MVP (Next 7 days)
- [ ] Agent registration flow
- [ ] White-label template engine
- [ ] Property scraping logic
- [ ] Booking system
- [ ] Admin dashboard

### Phase 3: Alpha Launch (Week 2)
- [ ] 3-5 alpha agents
- [ ] Email workflow testing
- [ ] Feedback collection
- [ ] Iterate based on feedback

## 💰 Business Model

### Pricing:
- **Starter:** R200/month
  - Basic template (Viewing.One branding)
  - 10 properties max
  - Standard support

- **Professional:** R400/month
  - White-label (agent's branding)
  - Unlimited properties
  - Priority support
  - Custom colors/logo

### Target Market:
- Estate agents in South Africa
- Initial focus: Johannesburg/Pretoria
- Expand to Cape Town/Durban

## 🎯 Success Metrics (First 90 Days)

### Month 1 (Alpha):
- 3 alpha agents onboarded
- 20+ properties listed
- 50+ feedback emails processed
- System stable for beta

### Month 2 (Beta):
- 10 paying agents (R2,000+ MRR)
- 100+ properties listed
- 200+ viewing requests
- 90%+ satisfaction rate

### Month 3 (Launch):
- 25 paying agents (R5,000+ MRR)
- 250+ properties listed
- 500+ viewing requests
- Expand to 2nd city

## 🔧 Setup & Development

### Prerequisites:
- Node.js 18+
- MongoDB 6+
- Git

### Installation:
```bash
# Clone repository
git clone [repository-url]
cd viewing-one

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your values
nano .env

# Start development server
npm run dev
```

### Environment Variables:
See `.env.example` for required variables.

## 📁 Project Structure

```
viewing-one/
├── server.js          # Main Express server
├── package.json       # Dependencies
├── .env.example       # Environment template
├── README.md          # This file
├── models/            # MongoDB schemas
├── routes/            # API routes
├── controllers/       # Business logic
├── middleware/        # Auth & validation
├── utils/             # Helper functions
└── public/            # Static files
```

## 🤝 Team Structure

### Agent 1: Feedback & Fixes
- Monitors `feedback@viewing.one`
- Implements improvements
- Communicates with agents

### Agent 2: Listings & Scraping
- Monitors `listings@viewing.one`
- Processes property submissions
- Quality checks listings

## 🚀 Getting Started

1. **Register domain:** `viewing.one`
2. **Set up emails:** `listings@` & `feedback@`
3. **Identify 3 alpha agents**
4. **Build MVP features**
5. **Launch alpha testing**
6. **Iterate based on feedback**

## 📞 Contact

- **Domain:** viewing.one
- **Emails:** listings@viewing.one, feedback@viewing.one
- **Business:** Viewing.One (Pty) Ltd

---

**Status:** Development in progress 🚀
# 🚀 VIEWING.ONE - DEPLOYMENT GUIDE

## 🎯 **DEPLOYMENT STEPS**

### **Step 1: DNS Configuration**
**After registering viewing.one on Namecheap:**

1. Log into Namecheap dashboard
2. Go to Domain List → viewing.one → Advanced DNS
3. Add these records:

```txt
# A Records (for Vercel)
@ → 76.76.21.21 (TTL: Automatic)
@ → 76.76.21.98 (TTL: Automatic)

# CNAME Records
www → cname.vercel-dns.com (TTL: Automatic)

# Email Records (if using Cloudflare/Zoho)
MX → mx1.zoho.com (Priority: 10)
MX → mx2.zoho.com (Priority: 20)
```

### **Step 2: Backend Hosting (Vercel)**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd viewing-one
vercel --prod

# Environment variables to set:
# MONGODB_URI=your-mongodb-atlas-connection-string
# JWT_SECRET=your-secret-key
# DOMAIN=viewing.one
```

### **Step 3: Database (MongoDB Atlas - Free Tier)**
1. Go to mongodb.com/atlas
2. Create free cluster (M0 Sandbox - 512MB)
3. Create database user
4. Whitelist IP (0.0.0.0/0 for development)
5. Get connection string
6. Add to Vercel environment variables

### **Step 4: Email Setup**
1. Choose provider (Zoho Mail - free)
2. Configure DNS MX records
3. Create mailboxes: listings@ & feedback@
4. Set up forwarding to personal email

### **Step 5: SSL/HTTPS**
- Vercel provides automatic SSL certificates
- No additional setup needed

## 🚀 **COST BREAKDOWN**

### **Monthly Costs:**
| Service | Cost | Notes |
|---------|------|-------|
| Domain viewing.one | ~$25/year | Already paid |
| MongoDB Atlas | Free | M0 Sandbox |
| Vercel Hobby | Free | 100GB bandwidth |
| Email (Zoho) | Free | Up to 5 users |
| **Total** | **~$2/month** | Minimal |

### **Scaling Costs (When revenue starts):**
| Service | Cost | When |
|---------|------|------|
| Vercel Pro | $20/month | >100 properties |
| MongoDB M2 | $9/month | >500 properties |
| Google Workspace | ~R100/user | >10 agents |
| Twilio WhatsApp | Usage-based | >50 bookings |

## 🎯 **DEPLOYMENT CHECKLIST**

### **Pre-Deployment:**
- [ ] Domain DNS configured
- [ ] MongoDB Atlas cluster created
- [ ] Environment variables ready
- [ ] Email provider selected

### **Deployment:**
- [ ] Backend deployed to Vercel
- [ ] Database connected
- [ ] API endpoints working
- [ ] SSL certificate active

### **Post-Deployment:**
- [ ] Test all API endpoints
- [ ] Test email delivery
- [ ] Test agent registration
- [ ] Test property submission
- [ ] Test booking system
- [ ] Mobile-responsive check

## 🔧 **VERCEL CONFIGURATION**

Create `vercel.json` in project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ],
  "env": {
    "MONGODB_URI": "@mongodb-uri",
    "JWT_SECRET": "@jwt-secret",
    "DOMAIN": "viewing.one"
  }
}
```

## 📊 **MONITORING**

### **After Deployment:**
1. Check Vercel dashboard for logs
2. Monitor MongoDB Atlas for connections
3. Test email delivery daily
4. Set uptime monitoring (uptimerobot.com - free)

## 🚀 **GO LIVE CHECKLIST**

### **Before June 1 Launch:**
- [ ] Domain DNS resolved
- [ ] HTTPS working
- [ ] Email sending/receiving
- [ ] Payment integration ready
- [ ] Agent onboarding guide
- [ ] 30-day trial configured
- [ ] Annual pricing available
- [ ] Support email monitored
- [ ] Backup system in place

---

**Questions?** Ask Geofrey for deployment assistance.
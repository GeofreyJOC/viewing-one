# 📧 EMAIL SETUP GUIDE - viewing.one

## 🎯 **EMAIL ADDRESSES NEEDED:**

1. **listings@viewing.one** - Property submissions from agents
2. **feedback@viewing.one** - Bug reports & improvement suggestions

## 🔧 **SETUP OPTIONS**

### **Option 1: Google Workspace (Recommended)**
**Cost:** ~R100/user/month (free trial available)
**Features:** Professional, reliable, easy forwarding
**Setup:**
1. Go to workspace.google.com
2. Sign up for Business Starter
3. Verify domain ownership (viewing.one)
4. Create users: listings@ and feedback@
5. Set up forwarding to personal Gmail

### **Option 2: Zoho Mail (Free)**
**Cost:** Free for up to 5 users
**Features:** Good for small team, webmail + forwarding
**Setup:**
1. Go to zoho.com/mail
2. Sign up for free plan
3. Verify domain ownership
4. Create mailboxes: listings@ and feedback@
5. Set up forwarding rules

### **Option 3: Cloudflare Email Routing (Free)**
**Cost:** Free
**Features:** Simple forwarding only, no mailbox
**Setup:**
1. Add domain to Cloudflare
2. Go to Email > Routing
3. Create rules: listings@ → your-email
4. Create rules: feedback@ → your-email
5. Set up catch-all for other addresses

### **Option 4: Namecheap Private Email**
**Cost:** ~$10/year per mailbox
**Features:** Included with domain registration
**Setup:**
1. Log into Namecheap dashboard
2. Go to Private Email
3. Create mailboxes
4. Set up forwarding

## 🚀 **RECOMMENDED APPROACH:**

**Phase 1 (Free/Cheap):** Cloudflare Email Routing or Zoho Mail
**Phase 2 (Scale):** Google Workspace when revenue starts

## 📋 **DNS SETTINGS (Add to domain registrar):**

```txt
MX Records:
- @ → mx1.zoho.com (Priority 10)
- @ → mx2.zoho.com (Priority 20)

Or for Google Workspace:
- @ → aspmx.l.google.com (Priority 1)
- @ → alt1.aspmx.l.google.com (Priority 5)
- @ → alt2.aspmx.l.google.com (Priority 5)

TXT Records:
- @ → v=spf1 include:zoho.com ~all
- @ → v=spf1 include:_spf.google.com ~all
```

## 🔧 **AFTER EMAIL SETUP:**

1. **Test sending** to listings@viewing.one
2. **Test sending** to feedback@viewing.one
3. **Set up auto-reply** for listings@ (confirmation)
4. **Set up auto-reply** for feedback@ (thank you)
5. **Create email templates** for common responses

## 📋 **EMAIL PROCESSING WORKFLOW:**

### **listings@viewing.one (Property Submissions):**
1. Agent emails property URL
2. Auto-reply: "Thank you! We're processing your property"
3. System scrapes property details
4. Property added to agent's page (as draft)
5. Notification sent: "Property added! Set viewing times"

### **feedback@viewing.one (Bug Reports):**
1. Agent emails feedback
2. Auto-reply: "Thank you for your feedback!"
3. Team reviews and prioritizes
4. Implementation or response
5. Follow-up: "Your feedback has been addressed"

## 🎯 **QUICK SETUP CHECKLIST:**

- [ ] Domain DNS configured for email
- [ ] MX records added
- [ ] SPF records added
- [ ] Mailboxes created
- [ ] Forwarding rules set up
- [ ] Auto-reply enabled
- [ ] Test emails sent and received
- [ ] Email templates created

## 💡 **PRO TIPS:**

1. **Use labels/folders** to organize incoming emails
2. **Set up filters** to auto-tag emails
3. **Create canned responses** for common replies
4. **Monitor response times** - aim for < 1 hour
5. **Archive processed emails** to keep inbox clean

---

**Questions?** Ask Geofrey for assistance with DNS settings.
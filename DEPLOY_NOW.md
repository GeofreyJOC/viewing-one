# 🚀 **DEPLOY VIEWING.ONE TO VERCEL NOW**

## **QUICK DEPLOYMENT (2 MINUTES)**

### **Option 1: Deploy via Vercel Dashboard (Easiest)**

1. **Go to:** https://vercel.com/new
2. **Click "Import Git Repository"**
3. **Connect GitHub** (if not connected)
4. **Import this repository** (or drag & drop the folder)
5. **Configure:**
   - **Project Name:** `viewing-one`
   - **Framework Preset:** `Other`
   - **Build Command:** (leave empty)
   - **Output Directory:** `public`
6. **Click "Deploy"**

### **Option 2: Deploy via Vercel CLI**

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
cd viewing-one
vercel --prod
```

### **Option 3: Deploy via GitHub (Recommended)**

1. **Create GitHub repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/viewing-one.git
   git push -u origin main
   ```

2. **Connect to Vercel:**
   - Go to https://vercel.com/new
   - Import from GitHub
   - Select `viewing-one` repository
   - Click "Deploy"

## **ENVIRONMENT VARIABLES TO SET**

After deployment, set these in Vercel Dashboard → Project → Settings → Environment Variables:

```
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_secure_jwt_secret_key
DOMAIN=viewing.one
```

## **VERIFY DEPLOYMENT**

Once deployed:

1. **Visit:** https://viewing.one
2. **Test API:** https://viewing.one/api/health
3. **Test Registration:** https://viewing.one/register.html

## **TROUBLESHOOTING**

### **If viewing.one shows 404:**
1. Check DNS propagation: https://dnschecker.org
2. Verify Vercel project is linked to domain
3. Check Vercel project logs

### **If API endpoints don't work:**
1. Check environment variables
2. Verify MongoDB connection
3. Check Vercel function logs

## **NEXT STEPS AFTER DEPLOYMENT**

1. **Set up MongoDB Atlas** (free tier)
2. **Configure email forwarding** for `listings@viewing.one`
3. **Test registration flow** with alpha agents
4. **Set up payment integration** (Yoco/Stripe)

## **SUPPORT**

**If stuck:**
- Vercel Docs: https://vercel.com/docs
- MongoDB Atlas: https://www.mongodb.com/cloud/atlas
- Contact Geofrey for assistance

---

**🎯 Your DNS is already pointing to Vercel! Just deploy the app and viewing.one will be live!**
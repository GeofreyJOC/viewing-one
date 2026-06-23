# 🚀 **ONE-CLICK DEPLOYMENT TO VIEWING.ONE**

## **METHOD 1: DRAG & DROP (2 MINUTES)**

1. **Go to:** https://vercel.com/new
2. **Log in** with: `geofreyjetson@proton.me`
3. **Click "Import Git Repository"**
4. **Click "Drag & Drop"** (bottom of page)
5. **Select ALL files** from the `viewing-one` folder
6. **Drag them** onto the Vercel page
7. **Click "Deploy"**

## **METHOD 2: GITHUB IMPORT (3 MINUTES)**

1. **Create GitHub repository:**
   - Go to: https://github.com/new
   - Name: `viewing-one`
   - Click "Create repository"

2. **Upload files to GitHub:**
   ```bash
   # In the viewing-one folder:
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/viewing-one.git
   git push -u origin main
   ```

3. **Import to Vercel:**
   - Go to: https://vercel.com/new
   - Import from GitHub
   - Select `viewing-one` repository
   - Click "Deploy"

## **METHOD 3: VERCEL CLI (IF LOGGED IN)**

If you're already logged into Vercel CLI:
```bash
cd viewing-one
vercel --prod
```

## **🎯 AFTER DEPLOYMENT**

### **Set Environment Variables:**
1. Go to **Vercel Dashboard** → **Project** → **Settings** → **Environment Variables**
2. Add:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/viewingone
   JWT_SECRET=your-secure-jwt-secret-key
   DOMAIN=viewing.one
   ```

### **Test:**
1. **Visit:** https://viewing.one
2. **API Health:** https://viewing.one/api/health
3. **Registration:** https://viewing.one/register.html

## **⏱️ EXPECTED TIMELINE**

- **0-5 minutes:** App deployed
- **5-30 minutes:** SSL certificate active
- **30-60 minutes:** Full DNS propagation
- **1 hour:** Ready for alpha testing

## **📞 NEED HELP?**

**If stuck during deployment:**
1. **Take screenshot** of what you see
2. **Send it to me** and I'll guide you
3. Or use **Vercel Support Chat** (excellent response time)

## **🎯 SUCCESS CHECKLIST**

- [ ] Vercel project created
- [ ] Domain `viewing.one` connected
- [ ] SSL certificate active (padlock icon)
- [ ] API endpoint working (`/api/health`)
- [ ] Registration page loading (`/register.html`)

---

**🚀 The DNS is already perfect. Just deploy the app and viewing.one goes live!**
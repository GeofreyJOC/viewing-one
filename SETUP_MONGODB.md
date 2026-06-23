# 🎯 **SET UP MONGODB ATLAS (FREE TIER)**

## **STEP 1: Create Account**
1. **Go to:** https://www.mongodb.com/cloud/atlas/register
2. **Sign up** with any email (or use `geofreyjetson@proton.me`)
3. **Verify email** and log in

## **STEP 2: Create Free Cluster**
1. **Click "Create"** (green button)
2. **Select Free M0** cluster
3. **Choose a provider** (AWS) and region (closest to SA: **eu-west-1** - Ireland)
4. **Name your cluster:** `viewing-one`
5. **Click "Create Cluster"** (takes 1-3 minutes)

## **STEP 3: Set Up Database Access**
1. Go to **"Database Access"** (left menu)
2. **Click "Add New Database User"**
3. **Username:** `viewing-one-admin`
4. **Password:** (create a strong password and save it)
5. **Role:** `Atlas Admin`
6. **Click "Add User"**

## **STEP 4: Set Up Network Access**
1. Go to **"Network Access"** (left menu)
2. **Click "Add IP Address"**
3. Click **"Allow Access from Anywhere"** (`0.0.0.0/0`)
4. **Click "Confirm"**

## **STEP 5: Get Connection String**
1. Go to **"Clusters"** → Click **"Connect"**
2. Select **"Connect your application"**
3. Copy the connection string:
```
mongodb+srv://viewing-one-admin:<password>@cluster0.xxxxx.mongodb.net/viewingone?retryWrites=true&w=majority
```
4. **Replace `<password>`** with the password you created

## **STEP 6: Add to Vercel**
1. **Go to:** https://vercel.com/geofry-jetsons-projects/viewing-one/settings/environment-variables
2. **Add environment variable:**
   - **Name:** `MONGODB_URI`
   - **Value:** Your connection string (with password)
3. **Click "Save"**
4. **Redeploy** the app:
   ```
   cd C:\Users\User\.openclaw\workspace\viewing-one
   vercel --prod
   ```

## **🎯 MONGODB ATLAS FREE TIER LIMITS:**
- **512MB storage** (enough for thousands of properties)
- **Shared RAM** (good for development/alpha)
- **100 connections** (more than enough)
- **Automatic backups** (snapshots every 6 hours)

## **📋 WHAT THIS ENABLES:**
- ✅ Persistent agent data
- ✅ Persistent property data
- ✅ Scalability for beta
- ✅ Backup & recovery
- ✅ Fast queries

## **⏱️ TIME:**
- Account creation: 2 minutes
- Cluster creation: 3 minutes
- Configuration: 3 minutes
- **Total: ~10 minutes**

---

**Once MongoDB is set up, all agent registrations and properties will persist!** 🚀
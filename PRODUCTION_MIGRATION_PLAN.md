# Viewing.One — Production Migration Plan

> **Date:** 10 June 2026
> **Goal:** Move from Vercel serverless alpha to a VPS-backed production system that handles 1000+ users reliably
> **Recommended provider:** Hetzner (CX22) — €4.50/month
> **Estimated effort:** 3–5 days of focused work

---

## 1. Why We're Doing This — The Current Architecture

```
User → Vercel (serverless instance, dies after inactivity)
         ├── Memory cache (lost on cold start)
         ├── /tmp/ files (lost on cold start)
         ├── MongoDB Atlas Free Tier (3-9s connection, slow shared resource)
         └── Timeout race: 10s Vercel limit vs 9.5s MongoDB wait
```

**Problems this creates:**
- Every cold start = potential "agent not found" errors
- Data lives in memory that can disappear
- The keep-warm cron is a band-aid, not a solution
- Cannot scale beyond ~20 concurrent users

---

## 2. Target Architecture

```
User → Cloudflare DNS → Hetzner VPS (24/7, never sleeps)
                           ├── Nginx (reverse proxy, SSL)
                           ├── Node.js/Express (always running)
                           ├── MongoDB (local on same VPS or Atlas)
                           └── PM2 (auto-restart on crash)
```

**What this gives us:**
- Zero cold starts
- Database-first queries (always fast, no memory reliance)
- Predictable response times under load
- Room to grow to thousands of users
- €4.50/month, no surprise bills

---

## 3. What Changes vs What Stays

### ✅ Stays the same (no rewrite needed):
| Component | Status |
|-----------|--------|
| All HTML pages (index, dashboard, login, register, agent-template, terms, admin) | ✅ No changes |
| All CSS styles | ✅ No changes |
| All frontend JavaScript (dashboard JS, agent page JS, login/register JS) | ✅ No changes |
| JWT authentication flow | ✅ Same logic, same library |
| bcrypt password handling | ✅ Same logic, same library |
| Property scraping from Private Property | ✅ Same code |
| Email sending (Nodemailer + SMTP) | ✅ Same code |
| Booking flow + time slots + WhatsApp integration | ✅ Same logic |
| Feedback system | ✅ Same code |
| GitHub repository | ✅ Same repo |
| Domain (viewing.one) | ✅ Same DNS, just repoint |

### 🔧 Changes needed:

| Change | Effort | Details |
|--------|--------|---------|
| **api/index.js** → proper server entry point | 1 day | Currently a single file with everything. Split into `server.js` (entry), `app.js` (Express setup), routes (already mostly extracted) |
| **MongoDB connection** → persistent + fast | 0.5 day | Replace the cold-start retry mess with a simple `mongoose.connect()` at startup. No timeouts, no races. |
| **Remove in-memory fallback** | 0.5 day | The `global.__inMemoryAgents` / `__inMemoryProperties` pattern is the root of most bugs. Replace with database-first everywhere. |
| **Remove `/tmp/agents.json` persistence** | 0.25 day | Unnecessary on a real server. |
| **Remove Gist persistence** | 0.25 day | Was a broken fallback anyway. |
| **Add PM2 + ecosystem config** | 0.25 day | Process manager that restarts on crash. |
| **Add Nginx + Let's Encrypt SSL** | 0.25 day | Reverse proxy, static file serving, free SSL certs. |
| **GitHub Actions deploy** | 0.25 day | Auto-deploy on `git push` to `production` branch. |
| **Testing + bug fixing** | 1 day | Smoke test every feature after migration. |

**Total: ~4 days of focused work**

---

## 4. Migration Steps (Detailed)

### Phase 1: Server Setup (Day 1 — 2 hours)

1. **Sign up for Hetzner** (or DigitalOcean)
2. **Provision CX22 VPS** (Ubuntu 24.04 LTS)
3. **Run initial setup:**
   - SSH key access (passwordless)
   - Firewall (UFW): allow 22, 80, 443 only
   - Install Node.js 24.x
   - Install MongoDB 8.x (or configure Atlas URI)
   - Install Nginx + certbot
   - Install PM2 globally
4. **Configure Nginx:**
   - Proxy `api/*` requests to Node.js (port 3000)
   - Serve `/public` static files directly (faster than Node)
   - SSL via Let's Encrypt (auto-renewing)
5. **Configure PM2:**
   - Start Node app
   - Auto-restart on crash
   - Startup on boot

### Phase 2: Code Migration (Day 2–3 — 2 days)

1. **Create `server.js`** — the new entry point:
   ```js
   // server.js — production entry point
   const app = require('./app');
   const PORT = process.env.PORT || 3000;
   app.listen(PORT, () => {
     console.log(`Viewing.One running on port ${PORT}`);
   });
   ```

2. **Rewrite `api/index.js` into `app.js`:**
   - Remove cold-start seeding code (no longer needed)
   - Remove `/tmp/agents.json` persistence
   - Remove Gist persistence reference
   - Replace `dbWithTimeout()` / `Promise.race()` with simple `await mongoose.connect()`
   - Remove `global.__inMemoryAgents` / `global.__inMemoryProperties` setup
   - Keep all route mounts the same
   - Keep all Express middleware the same (CORS, JSON parsing, etc.)
   - Keep the slug handler (`/:slug`) — just simplify the lookup

3. **Refactor routes** — clean up the three files that currently fight across memory and database:

   **`routes/auth.js` — biggest change:**
   - Remove all the fallback chain (in-memory → getMongoDbPromise → shard client → SRV client → /tmp → Gist)
   - Replace with simple: `Agent.findOne({ email })`
   - Remove the `ObjectId` fallback code
   - Keep JWT sign/verify, bcrypt, and all response formats the same

   **`routes/agents.js`:**
   - Replace `getDb()` with `Agent.findOne({ slug })`
   - Remove in-memory property gathering
   - Straight MongoDB query for agent + properties
   - Keep response format identical

   **`routes/properties.js`:**
   - Replace `getDb()` with `Property.find({ agentId })`
   - Remove in-memory property filtering
   - Keep all CRUD logic

4. **Restore `api/src/gist-persistence.js`** — delete or keep as dead file

5. **Update `seed-agents.json`** — keep empty

### Phase 3: Deploy Pipeline (Day 3 afternoon — 2 hours)

1. **Create deploy script** (`deploy.sh` on VPS):
   ```bash
   cd /var/www/viewing-one
   git pull origin main
   npm install
   pm2 restart viewing-one
   ```

2. **GitHub Actions workflow** — trigger deploy on push to `production` branch:
   ```yaml
   name: Deploy to VPS
   on:
     push:
       branches: [production]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - name: Deploy via SSH
           uses: appleboy/ssh-action@v1
           with:
             host: ${{ secrets.VPS_HOST }}
             key: ${{ secrets.VPS_SSH_KEY }}
             script: cd /var/www/viewing-one && git pull && npm install && pm2 restart viewing-one
   ```

3. **Set environment variables** on VPS:
   - `JWT_SECRET`
   - `MONGODB_URI`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`
   - `DOMAIN`

### Phase 4: DNS Cutover (Day 4 — 30 minutes)

1. **Update Cloudflare DNS:**
   - Change `A` record for `viewing.one` from Vercel IP → Hetzner VPS IP
   - Wait for DNS propagation (usually 1–5 minutes with Cloudflare)

2. **Update Cloudflare SSL/TLS:**
   - Set to Full (strict) since Nginx has valid Let's Encrypt certs

3. **Test everything:**
   - Landing page
   - Registration → login → dashboard
   - Agent page
   - Properties + scraping
   - Time slots
   - Bookings
   - Email notifications
   - Feedback

### Phase 5: Verify & Clean Up (Day 4–5 — 1 day)

1. **Full smoke test** — walk through every feature as a new user
2. **Monitor logs** first 24 hours for any issues
3. **Remove keep-warm GitHub Actions workflow** (no longer needed)
4. **Cancel Vercel Pro** if you upgrade — or keep Vercel Hobby as a secondary CDN
5. **Document the infrastructure** — SSH, deploy process, env vars, backup plan

---

## 5. Monthly Cost Breakdown

| Service | Cost | Notes |
|---------|------|-------|
| **Hetzner VPS (CX22)** | **€4.50** | 2 vCPU, 4GB RAM, 40GB SSD |
| **Domain (viewing.one)** | Already paid | — |
| **Namecheap Email (admin@, bookings@)** | Already paid | — |
| **MongoDB (local on VPS)** | **€0** | Runs on same VPS, no extra cost |
| **GitHub** | Free | Public repo, Actions included |
| **Cloudflare** | Free | DNS, CDN, DDoS protection |
| **SSL (Let's Encrypt)** | Free | Auto-renewing |
| **Monitoring (Heartbeat)** | Free | cron-job.org or similar |
| **Total** | **~€4.50/month** | |

**Running MongoDB on the VPS:** A 4GB VPS with Node.js + MongoDB is perfectly fine for 1000+ users. MongoDB uses ~200MB for a small database. Node.js uses ~100MB. You have 3.5GB of headroom.

**Alternative — MongoDB Atlas:** If you prefer managed MongoDB, add **$9/month (M2)** and connect from the VPS. Still cheaper than any other option.

---

## 6. What Could Go Wrong

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| VPS goes down | Low | Site down | PM2 auto-restart; Cloudflare always-on cache |
| MongoDB corruption | Very low | Data loss | Daily backups (cron + `mongodump`) |
| Surge of traffic | Medium | Slow, not down | Scales vertically (upgrade VPS in 5 min) |
| SSL cert expires | Low | Browser warnings | Certbot auto-renewal |
| Disk fills up | Low | App crash | Monitoring alert at 80% disk |
| Bad deploy breaks site | Medium | Down until rollback | Keep `git revert` as rollback plan |

---

## 7. When Should We Do This?

**My recommendation:** Do the migration **after alpha testing** (2–3 weeks), not before. Here's why:

- Alpha testing with 2 testers works fine on current setup (keep-warm active)
- You can gather real feedback while I prep the migration
- We fix bugs found in alpha in ONE place (the VPS codebase)
- After migration, you have a clean, scalable platform ready for beta/launch

**Timeline:**
```
Week 1-2:  Alpha testing (current Vercel setup + keep-warm)
           → Gather feedback, fix bugs found
Week 3:    Migration (3-5 days)
           → Build VPS server, refactor backend, test everything
Week 4+:   Beta/Production with real users
           → Scale VPS as needed, add payment integration
```

---

## 8. Summary

**The migration is not a rewrite.** It's extracting the working pieces from the current spaghetti into a clean, single-process backend running on a €4.50/month VPS. All the frontend code, business logic, and user-facing features stay exactly the same.

The result: no cold starts, no "agent not found," no raced timeouts, no memory cache juggling. Just a Node.js server that boots once and stays up.

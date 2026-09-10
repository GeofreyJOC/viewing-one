// chat-kb.js — Grounding knowledge base for the viewing.one landing-page assistant.
// Keep this file in sync with the live landing page (public/index.html).
// The assistant may ONLY state facts found here; anything else → "I'll get the team to reply".

const KB = `
# viewing.one — product knowledge base

## What it is
viewing.one is a viewing-scheduling platform for real estate / estate agents in South Africa.
It gives each agent a personalised, white-label booking page (viewing.one/your-name) where
buyers and tenants book their own viewing slots in seconds, straight from the agent's property
listings. It removes the WhatsApp back-and-forth, missed calls and double bookings.

## How it works (3 steps)
1. Create your profile — sign up and customise your page at viewing.one/your-name. Add logo,
   contact details and business info in under 2 minutes.
2. Add your listings — forward your listing emails to your unique address, or paste a property URL
   and the details are imported automatically. Each listing gets its own booking calendar.
3. Share & book — put your viewing.one link in every listing you post (any property portal), or
   share it on email, social media or your website. Clients book direct. No app download and no
   login required for visitors.

## Features
- Personalised booking page — white-label page at viewing.one/your-name, your brand only.
- Add listings by email or URL — forward a listing email to listings@viewing.one, or paste a URL.
- Smart slot management — set viewing times per property with a visitor limit per slot; cancel
  bookings or remove slots; past slots hide automatically; if no time suits, visitors can send a
  viewing request instead.
- Instant notifications — you are alerted by email the moment someone books; visitors get automatic
  confirmations and reminders.
- Share anywhere — one link; works on any portal, email, social and website. No app, no visitor login.

## Pricing (all prices in USD, billed via PayPal)
- 30-day free demo on every plan. No credit card required. Cancel anytime.
- Pro Monthly — $10.99 / month, billed monthly via PayPal.
  Includes: personalised booking page, unlimited listings, email & URL listing import,
  booking slot management, email notifications.
- Pro Annual — $109.90 / year (2 months free, saves $21.98 vs monthly).
  Includes everything in Pro Monthly, plus priority email support and your rate locked in.

## Trust / social proof
- Trusted by estate agents across South Africa.
- Testimonial (Sarah Moolman, Property Specialist): "Since switching to Viewing.One, I have more
  time for finding new stock. Clients book viewings directly without the back-and-forth, and
  everything lands in one place. It's become essential to my business."

## Getting started
- Start the free trial / sign up: register.html?plan=pro
- Pricing section on the site: /#pricing
- General enquiries not covered here: point the visitor to the contact page (contact.html).
`;

module.exports = { KB };

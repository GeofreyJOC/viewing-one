// chat-kb.js — Grounding knowledge base for the viewing.one landing-page assistant.
// Keep this file in sync with the live landing page (public/index.html).
// The assistant may ONLY state facts found here; anything else → "I'll get the team to reply".

const KB = `
# viewing.one — product knowledge base

## What it is
viewing.one is a viewing-scheduling platform for real estate / estate agents in South Africa.
It gives each agent a personalised, white-label booking page (viewing.one/your-name) where
buyers and tenants book their own viewing slots in seconds, straight from the agent's property
listings. The whole viewing is automated end to end — from the seller marking their availability,
to the agent publishing the times, to buyers booking themselves with automatic confirmations and
calendar invites. It removes the WhatsApp back-and-forth, missed calls and double bookings.

## How it works (3 steps)
1. Create your profile — sign up and customise your page at viewing.one/your-name. Add logo,
   contact details and business info in under 2 minutes.
2. Add your listings — forward your listing emails to your unique address, or paste a property URL
   and the details are imported automatically. Each listing gets its own booking calendar.
3. Automate & book — put your viewing.one link in every listing you post (any property portal),
   or share it on email, social media or your website. Send sellers a private availability link so
   they mark when they're free; you publish the times that work with one tap; clients book direct.
   No app download and no login required for visitors.

## Features
- Personalised booking page — white-label page at viewing.one/your-name, your brand only.
- Add listings by email or URL — forward a listing email to listings@viewing.one, or paste a URL.
- Smart slot management — set viewing times per property with a visitor limit per slot; cancel
  bookings or remove slots; past slots hide automatically; if no time suits, visitors can send a
  viewing request instead.
- Seller availability links — send the seller a private, one-per-property link (WhatsApp or email);
  no login required. They tap the times they're free and it lands in the agent's dashboard as
  "pending". The agent ticks the ones to offer and publishes with one tap. Seller times already
  published or booked are locked so nothing is pulled out from under a buyer. Toggle seller booking
  emails on or off per property.
- Fully automated, end to end — seller marks availability, agent publishes, buyers book themselves;
  confirmations, calendar invites (.ics / Google / Outlook) and reminders to both agent and seller go
  out automatically. Agents with vacant properties can also add and publish slots directly.
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

// PayPal payment routes
const express = require('express');
const router = express.Router();
const paypal = require('../paypal');

// Get PayPal client ID for frontend
router.get('/config', function(req, res) {
  res.json({
    success: true,
    clientId: paypal.getClientId(),
    sandbox: paypal.isSandbox(),
    plans: {
      pro: { id: process.env.PAYPAL_PRO_PLAN_ID || '', amount: 199, name: 'Pro Monthly' },
      'pro-annual': { id: process.env.PAYPAL_PRO_ANNUAL_PLAN_ID || '', amount: 1990, name: 'Pro Annual' }
    }
  });
});

// Get access token for server-to-server calls
router.get('/token', async function(req, res) {
  try {
    var token = await paypal.getAccessToken();
    res.json({ success: true, token: token });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Create/activate PayPal billing plans (admin use)
router.post('/setup-plans', async function(req, res) {
  try {
    var token = await paypal.getAccessToken();
    
    // Create product
    var product = await paypal.createProduct(token);
    console.log('PayPal product:', product.id);
    
    // Create plans
    var proPlan = await paypal.createPlan(token, product.id, 'pro');
    console.log('PayPal Pro plan:', proPlan.id);
    
    var annualPlan = await paypal.createPlan(token, product.id, 'pro-annual');
    console.log('PayPal Pro Annual plan:', annualPlan.id);
    
    res.json({
      success: true,
      productId: product.id,
      plans: {
        pro: proPlan.id,
        'pro-annual': annualPlan.id
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Create a subscription for a user
router.post('/create-subscription', async function(req, res) {
  try {
    var token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    
    // Verify auth and get user
    var jwt = require('jsonwebtoken');
    var JWT_SECRET = process.env.JWT_SECRET || 'viewingone-jwt-secret-key-2024';
    var decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); } catch(e) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    
    var { planId, planType } = req.body;
    if (!planId || !planType) {
      return res.status(400).json({ success: false, message: 'Plan ID and type required' });
    }
    
    var agents = global.__inMemoryAgents || [];
    var agent = agents.find(function(a) { return a._id.toString() === decoded.id; });
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });
    
    // Get PayPal access token
    var paypalToken = await paypal.getAccessToken();
    
    // Create subscription
    var sub = await paypal.createSubscription(paypalToken, planId, agent.email, agent.name);
    
    // Find approval URL
    var approvalUrl = '';
    if (sub.links) {
      var link = sub.links.find(function(l) { return l.rel === 'approve'; });
      if (link) approvalUrl = link.href;
    }
    
    // Store subscription ID on agent (pending approval)
    var idx = global.__inMemoryAgents.findIndex(function(a) { return a._id.toString() === decoded.id; });
    if (idx !== -1) {
      global.__inMemoryAgents[idx].paypalSubscriptionId = sub.id;
      global.__inMemoryAgents[idx].pendingPlan = planType;
    }
    
    res.json({
      success: true,
      subscriptionId: sub.id,
      approvalUrl: approvalUrl,
      status: sub.status
    });
  } catch (e) {
    console.error('PayPal create subscription error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// PayPal webhook handler (IPN replacement)
router.post('/webhook', async function(req, res) {
  try {
    var event = req.body;
    console.log('PayPal webhook event:', event.event_type);
    
    // Handle subscription events
    if (event.event_type === 'BILLING.SUBSCRIPTION.CREATED' ||
        event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      var resource = event.resource;
      var subId = resource.id;
      
      // Find agent with this subscription
      var agents = global.__inMemoryAgents || [];
      var agent = agents.find(function(a) { return a.paypalSubscriptionId === subId; });
      
      if (agent) {
        var idx = agents.indexOf(agent);
        var plan = agent.pendingPlan || 'pro';
        agents[idx].plan = plan.toUpperCase();
        agents[idx].pendingPlan = undefined;
        agents[idx].subscriptionStatus = 'active';
        agents[idx].subscriptionId = subId;
        
        // Save to persistent storage
        try { require('fs').writeFileSync('/tmp/agents.json', JSON.stringify(agents)); } catch(e) {}
        
        // Also update MongoDB
        try {
          if (typeof global.getMongoDbPromise === 'function') {
            var db = await global.getMongoDbPromise();
            if (db && db.db) {
              await db.collection('agents').updateOne(
                { _id: agent._id },
                { $set: { plan: plan.toUpperCase(), subscriptionStatus: 'active', subscriptionId: subId } }
              );
            }
          }
        } catch(e) { console.error('MongoDB webhook update failed:', e.message); }
        
        console.log('Upgraded agent', agent.email, 'to', plan.toUpperCase());
      }
    }
    
    // Always return 200 to PayPal
    res.sendStatus(200);
  } catch (e) {
    console.error('PayPal webhook error:', e);
    res.sendStatus(200); // Still return 200 to acknowledge receipt
  }
});

// Subscription approval success page info
router.get('/success', function(req, res) {
  res.json({ success: true, message: 'Subscription approved! Your account will be upgraded shortly.' });
});

module.exports = router;

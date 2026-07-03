const express = require('express');
const router = express.Router();
const payfast = require('../payfast');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'viewing-one-dev-secret';

// Helper: get authenticated agent from token
function getAgentFromToken(token) {
  try {
    var decoded = jwt.verify(token, JWT_SECRET);
    var agentId = decoded.agentId || decoded.id || '';
    var agents = global.__inMemoryAgents || [];
    return agents.find(function(a) {
      return a._id === agentId || a.id === agentId || a.email === agentId;
    }) || null;
  } catch(e) {
    return null;
  }
}

// Helper: persist agent data to all storage layers
async function persistAgentUpdate(agent) {
  var agents = global.__inMemoryAgents || [];
  var idx = agents.findIndex(function(a) { return a._id === agent._id || a.email === agent.email; });
  if (idx !== -1) agents[idx] = agent;

  // Write to /tmp/agents.json
  try {
    var fs = require('fs');
    fs.writeFileSync('/tmp/agents.json', JSON.stringify(agents, null, 2));
  } catch(e) {}

  // Write to api/.data/agents.json
  try {
    var fs2 = require('fs');
    var dataFile = require('path').join(__dirname, '..', '..', '.data', 'agents.json');
    fs2.writeFileSync(dataFile, JSON.stringify(agents, null, 2));
  } catch(e) {}

  // Sync to MongoDB
  try {
    var db = awaitMaybe(global.getMongoDbPromise);
    if (db) {
      var MongoClient = require('mongodb').MongoClient;
      var mongoDb = await db;
      if (mongoDb) {
        var email = agent.email || agent._id;
        await mongoDb.collection('agents').updateOne(
          { email: email },
          { $set: { plan: agent.plan, subscriptionStatus: agent.subscriptionStatus, subscriptionId: agent.subscriptionId, payfastToken: agent.payfastToken } }
        );
      }
    }
  } catch(e) {}
}

async function awaitMaybe(fn) {
  try { return typeof fn === 'function' ? fn() : null; } catch(e) { return null; }
}

// POST /api/payments/create-subscription
// Generates PayFast redirect URL for a subscription
router.post('/create-subscription', async (req, res) => {
  try {
    var token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Auth required' });

    var agent = getAgentFromToken(token);
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

    var { plan } = req.body;
    if (!plan || (plan !== 'pro' && plan !== 'pro-annual')) {
      return res.status(400).json({ success: false, message: 'Invalid plan. Choose pro or pro-annual.' });
    }

    var subscription = payfast.buildSubscriptionUrl(agent, plan, req.headers.origin);

    res.json({
      success: true,
      redirectUrl: subscription.url,
      params: subscription.params,
      message: 'Redirect the user to PayFast to complete payment'
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/payfast/notify
// ITN (Instant Transaction Notification) webhook from PayFast
router.post('/notify', async (req, res) => {
  try {
    var pfData = req.body;
    console.log('PayFast ITN received:', JSON.stringify(pfData));

    // Validate the ITN
    var result = await payfast.validateItn(pfData);
    if (!result.valid) {
      console.error('PayFast ITN validation failed:', result.reason || 'invalid');
      return res.status(200).send('INVALID'); // Always return 200 to PayFast
    }

    var data = result.data;
    var paymentStatus = data.payment_status;
    var agentEmail = data.custom_str2 || data.email_address;
    var plan = data.custom_str1 || 'pro';
    var token = data.token;  // Recurring billing token

    // Only process completed payments
    if (paymentStatus === 'COMPLETE') {
      var agents = global.__inMemoryAgents || [];
      var agent = agents.find(function(a) { return a.email === agentEmail; });

      if (agent) {
        agent.plan = plan;
        agent.subscriptionStatus = 'active';
        agent.subscriptionId = data.m_payment_id || data.pf_payment_id;
        agent.payfastToken = token || '';
        agent.planUpdatedAt = new Date().toISOString();

        await persistAgentUpdate(agent);
        console.log('Agent upgraded to ' + plan + ' plan:', agentEmail);
      } else {
        console.error('Agent not found for ITN:', agentEmail);
      }
    } else if (paymentStatus === 'CANCELLED') {
      var agents2 = global.__inMemoryAgents || [];
      var agent2 = agents2.find(function(a) { return a.email === agentEmail; });
      if (agent2) {
        agent2.subscriptionStatus = 'cancelled';
        agent2.plan = 'demo';  // Fall back to demo
        await persistAgentUpdate(agent2);
        console.log('Subscription cancelled for:', agentEmail);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('PayFast ITN error:', error);
    res.status(200).send('OK'); // Always respond 200 to PayFast
  }
});

// GET /api/payments/status
// Check the current subscription status for the logged-in user
router.get('/status', async (req, res) => {
  try {
    var token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Auth required' });

    var agent = getAgentFromToken(token);
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

    res.json({
      success: true,
      plan: agent.plan || 'demo',
      subscriptionStatus: agent.subscriptionStatus || 'none',
      subscriptionId: agent.subscriptionId || null,
      isPro: agent.plan === 'pro' || agent.plan === 'pro-annual'
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /payfast/success - Redirect landing page (served as static)
// GET /payfast/cancel  - Redirect landing page (served as static)

module.exports = router;

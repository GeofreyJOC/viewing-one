// PayFast integration module
// Docs: https://developers.payfast.co.za/docs

const crypto = require('crypto');
const https = require('https');

const SANDBOX_BASE = 'https://sandbox.payfast.co.za';
const LIVE_BASE = 'https://www.payfast.co.za';

function isSandbox() {
  return process.env.PAYFAST_SANDBOX !== 'false' && process.env.PAYFAST_MERCHANT_ID === '10000100';
}

function getBaseUrl() {
  return isSandbox() ? SANDBOX_BASE : LIVE_BASE;
}

/**
 * Generate PayFast signature (MD5 of parameter string)
 */
function generateSignature(params, passPhrase) {
  // Build the parameter string sorted by key
  var keys = Object.keys(params).sort();
  var pfOutput = '';
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    // Skip these fields
    if (k === 'signature' || k === 'passphrase') continue;
    if (params[k] === '' || params[k] === null || params[k] === undefined) continue;
    if (i > 0) pfOutput += '&';
    pfOutput += k + '=' + encodeURIComponent(String(params[k]).trim()).replace(/%20/g, '+');
  }
  if (passPhrase) {
    pfOutput += '&passphrase=' + encodeURIComponent(passPhrase).replace(/%20/g, '+');
  }
  return crypto.createHash('md5').update(pfOutput).digest('hex');
}

/**
 * Build subscription redirect URL for PayFast
 */
function buildSubscriptionUrl(agent, plan, returnHost) {
  var merchantId = process.env.PAYFAST_MERCHANT_ID || '10000100';
  var merchantKey = process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a';
  var passPhrase = process.env.PAYFAST_PASSPHRASE || '';

  // Plan pricing
  var pricing = {
    pro: { amount: 199, name: 'Viewing.One Pro Monthly' },
    'pro-annual': { amount: 1990, name: 'Viewing.One Pro Annual' }
  };

  var selectedPlan = pricing[plan] || pricing.pro;
  var baseUrl = returnHost || process.env.SITE_URL || 'https://viewing.one';

  var params = {
    // Merchant details
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: baseUrl + '/payfast/success',
    cancel_url: baseUrl + '/payfast/cancel',
    notify_url: baseUrl + '/api/payfast/notify',

    // Customer details (from agent profile)
    name_first: (agent.name || 'Agent').split(' ')[0] || 'Agent',
    name_last: (agent.name || '').split(' ').slice(1).join(' ') || 'Agent',
    email_address: agent.email || '',

    // Subscription
    m_payment_id: agent._id || agent.id || agent.email || '',
    amount: '0.00',               // Initial amount (0 for free trial start)
    item_name: selectedPlan.name,
    item_description: plan,

    // Recurring billing
    recurring: 'true',
    billing_date: new Date().toISOString().split('T')[0], // Start today
    recurring_amount: selectedPlan.amount.toFixed(2),
    frequency: plan === 'pro-annual' ? 12 : 1,   // months between cycles
    cycles: '0',                  // 0 = indefinite

    // Custom
    custom_str1: plan,            // Which plan they selected
    custom_str2: agent.email || '',
    custom_str3: agent._id || agent.id || ''
  };

  params.signature = generateSignature(params, passPhrase);

  return {
    url: getBaseUrl() + '/eng/subscription/process',
    params: params
  };
}

/**
 * Build once-off payment URL
 */
function buildOnceOffUrl(agent, plan, returnHost) {
  var merchantId = process.env.PAYFAST_MERCHANT_ID || '10000100';
  var merchantKey = process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a';
  var passPhrase = process.env.PAYFAST_PASSPHRASE || '';

  var pricing = {
    pro: { amount: 199, name: 'Viewing.One Pro' }
  };

  var selectedPlan = pricing[plan] || pricing.pro;
  var baseUrl = returnHost || process.env.SITE_URL || 'https://viewing.one';

  var params = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: baseUrl + '/payfast/success?plan=' + plan,
    cancel_url: baseUrl + '/payfast/cancel',
    notify_url: baseUrl + '/api/payfast/notify',

    name_first: (agent.name || 'Agent').split(' ')[0] || 'Agent',
    name_last: (agent.name || '').split(' ').slice(1).join(' ') || 'Agent',
    email_address: agent.email || '',

    m_payment_id: agent._id || agent.id || agent.email || '',
    amount: selectedPlan.amount.toFixed(2),
    item_name: selectedPlan.name,
    item_description: plan
  };

  params.signature = generateSignature(params, passPhrase);

  return {
    url: getBaseUrl() + '/eng/process',
    params: params
  };
}

/**
 * Validate an ITN (Instant Transaction Notification) from PayFast
 * Returns a promise that resolves to { valid: bool, data: object }
 */
function validateItn(pfData) {
  return new Promise(function(resolve, reject) {
    var merchantId = process.env.PAYFAST_MERCHANT_ID || '10000100';
    var passPhrase = process.env.PAYFAST_PASSPHRASE || '';

    // Build the validation string
    var pfParamString = '';
    var keys = Object.keys(pfData).sort();
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'signature' || k === 'passphrase') continue;
      if (pfData[k] === '' || pfData[k] === null || pfData[k] === undefined) continue;
      if (i > 0) pfParamString += '&';
      pfParamString += k + '=' + encodeURIComponent(String(pfData[k]).trim()).replace(/%20/g, '+');
    }

    // Verify signature
    var ourSig = generateSignature(pfData, passPhrase);
    if (pfData.signature !== ourSig) {
      return resolve({ valid: false, reason: 'signature_mismatch', data: pfData });
    }

    // POST back to PayFast to confirm ITN is genuine
    var verifyData = 'pf_payload=' + encodeURIComponent(pfParamString);
    var verifyHost = isSandbox() ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';

    var options = {
      hostname: verifyHost,
      port: 443,
      path: '/eng/query/validate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(verifyData)
      }
    };

    var req = https.request(options, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        var valid = body.trim() === 'VALID';
        resolve({ valid: valid, data: pfData, verificationResponse: body.trim() });
      });
    });
    req.on('error', function(err) {
      reject(err);
    });
    req.write(verifyData);
    req.end();
  });
}

module.exports = {
  generateSignature: generateSignature,
  buildSubscriptionUrl: buildSubscriptionUrl,
  buildOnceOffUrl: buildOnceOffUrl,
  validateItn: validateItn,
  isSandbox: isSandbox
};

// ONE-TIME: Delete Hilmar's account for fresh registration test
// DELETE THIS FILE after use
const express = require('express');
const router = express.Router();

router.post('/wipe-hilmar', async function(req, res) {
  var key = req.body.secret;
  if (key !== 'wipe-me-clean-2026') {
    return res.status(403).json({ success: false, message: 'Wrong key' });
  }
  
  try {
    var mDb = typeof global.getMongoDbPromise === 'function' ? await global.getMongoDbPromise() : null;
    if (!mDb) { return res.json({ success: false, message: 'No DB connection' }); }
    
    var db = mDb;  // getMongoDbPromise returns the db object directly
    
    var col = db.collection('agents');
    var agents = await col.find({ email: 'hilmar.d.samuels@gmail.com' }).toArray();
    var ids = agents.map(function(a) { return String(a._id); });
    
    if (ids.length > 0) {
      await db.collection('properties').deleteMany({ agentId: { $in: ids } });
      await db.collection('feedback').deleteMany({ agentId: { $in: ids } });
      await col.deleteMany({ email: 'hilmar.d.samuels@gmail.com' });
    }
    
    res.json({ success: true, deleted: ids.length > 0, agentIds: ids });
  } catch(e) {
    res.json({ success: false, message: e.message });
  }
});

module.exports = router;

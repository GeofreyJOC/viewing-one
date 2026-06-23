// Require express app factory but don't start the server
// Actually, let me use the EXACT same connection logic
var http = require('http');
var { MongoClient } = require('mongodb');

async function main() {
  // Use the app's MONGODB_URI
  var uri = 'mongodb://127.0.0.1:27017/viewing-one';
  console.log('URI:', uri);
  
  var client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  var db = client.db();
  console.log('DB name:', db.databaseName);
  
  // Check properties
  var props = await db.collection('properties').find({}).toArray();
  console.log('Properties from app\'s connection:');
  props.forEach(function(p) {
    console.log('  ' + p._id.toString().slice(-6) + ' | ' + p.title);
  });
  
  // Also check the API
  http.get('http://127.0.0.1:3000/api/agents/hilmar-samuels', function(r) {
    var b = '';
    r.on('data', function(c) { b += c; });
    r.on('end', function() {
      var d = JSON.parse(b);
      console.log('\nFrom API:');
      d.properties.forEach(function(p, i) {
        console.log('  ' + p.id.slice(-6) + ' | ' + p.title);
      });
      
      // Compare
      var apiId = d.properties[4].id.slice(-6);
      var mongoId = props[0]._id.toString().slice(-6);
      console.log('\nAPI last prop ID suffix:', apiId);
      console.log('Mongo first prop ID suffix:', mongoId);
      if (apiId === mongoId) {
        console.log('SAME document, DIFFERENT title! API is not reading fresh from MongoDB');
      } else {
        console.log('Different documents');
      }
      
      // Also check in-memory cache in agent handler
      var inMemProps = global.__inMemoryProperties || [];
      console.log('\nIn-memory cache has', inMemProps.length, 'properties');
      inMemProps.forEach(function(p) {
        console.log('  ' + (p._id ? p._id.toString().slice(-6) : '?') + ' | ' + p.title);
      });
      
      process.exit(0);
    });
  }).on('error', function(e) { console.error(e); process.exit(1); });
}

main().catch(function(e) { console.error(e); process.exit(1); });

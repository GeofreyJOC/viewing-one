// Check where persistence.js reads from and what it loaded
var fs = require('fs');
var path = require('path');

// This is the DATA_DIR from persistence.js
var dirname = '/root/viewing-one/api/src/routes';
var DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(dirname, '..', '..', '.data');

console.log('DATA_DIR:', DATA_DIR);
console.log('VERCEL:', process.env.VERCEL);
console.log('cwd:', process.cwd());

// Check if the .data directory exists
console.log('fs.existsSync(DATA_DIR):', fs.existsSync(DATA_DIR));

// Check if properties.json exists
var propsPath = path.join(DATA_DIR, 'properties.json');
console.log('properties.json exists:', fs.existsSync(propsPath));

// Check various possible paths
var possiblePaths = [
  '/root/viewing-one/.data/properties.json',
  '/root/viewing-one/api/src/.data/properties.json',
  '/root/viewing-one/api/.data/properties.json',
  '/tmp/properties.json',
  '/root/viewing-one/api/src/routes/../../.data/properties.json'
];
possiblePaths.forEach(function(p) {
  console.log('  ' + p + ':', fs.existsSync(p));
});

process.exit(0);

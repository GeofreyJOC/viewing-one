#!/usr/bin/env node
// Production server for viewing.one — wraps the Vercel Express app
require('dotenv').config();
const path = require('path');

// Set env for local MongoDB before loading the app
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/viewing-one';
process.env.PORT = process.env.PORT || 3000;
process.env.NODE_ENV = 'production';

// Strip Vercel-specific env overrides that would break local operation
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
delete process.env.VERCEL_URL;
delete process.env.VERCEL_REGION;

const app = require('./api/index');

app.listen(process.env.PORT, '127.0.0.1', () => {
  console.log('Viewing.One production server running on http://127.0.0.1:' + process.env.PORT);
});

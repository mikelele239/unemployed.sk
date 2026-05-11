// Netlify Serverless Function: /api/* catch-all
// Imports the full Express app from server.js (which skips static files & listen in serverless mode)
// and wraps it with serverless-http for Netlify Functions.

const serverless = require('serverless-http');

// Set NETLIFY flag before importing server.js so it exports instead of listening
process.env.NETLIFY = 'true';

const { app } = require('../../server');

module.exports.handler = serverless(app);

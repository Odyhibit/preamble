// VIN lookup HTTP API

const express = require('express');
const { decodeVin } = require('./lib/decode.js');

const app = express();

app.get('/api/vin/:vin', async (req, res) => {
  res.json(await decodeVin(req.params.vin));
});

app.post('/api/vin/batch', handleBatch);

/**
 * Decode up to 50 VINs per request.
 */
async function handleBatch(req, res) {
  res.json(await Promise.all(req.body.vins.slice(0, 50).map(decodeVin)));
}

function startServer(port = 3000) {
  return app.listen(port);
}

module.exports = { app, startServer };

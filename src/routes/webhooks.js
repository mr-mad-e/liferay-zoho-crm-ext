'use strict';

/** routes/webhooks.js — /webhooks */

const router = require('express').Router();
const ctrl   = require('../controllers/webhookController');

// Raw body needed for HMAC verification — must be before express.json parses it
// Since server.js applies express.json globally, we re-parse the signature from
// the already-parsed body (Zoho sends JSON, so this works fine).
router.post('/zoho', ctrl.handleZohoWebhook);

module.exports = router;

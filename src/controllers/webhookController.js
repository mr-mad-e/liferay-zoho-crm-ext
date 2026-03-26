'use strict';

/**
 * controllers/webhookController.js
 *
 * Receives real-time notifications from Zoho CRM via Webhooks.
 * Zoho signs each request with an HMAC-SHA256 signature using the shared
 * secret configured in WEBHOOK_SECRET.
 *
 * Setup in Zoho: Automation → Webhooks → New Webhook
 *   URL: https://<your-host>/webhooks/zoho
 *   Method: POST
 */

const crypto = require('crypto');
const logger  = require('../utils/logger');
const cache   = require('../utils/tokenStore');

/**
 * Verify the Zoho HMAC signature.
 * Zoho sends: X-Zoho-Webhook-Token header (raw body HMAC-SHA256).
 */
function verifySignature(req) {
  const secret    = process.env.WEBHOOK_SECRET;
  if (!secret) return true;  // skip verification if secret not configured

  const signature = req.headers['x-zoho-webhook-token'];
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * POST /webhooks/zoho
 * Handles all Zoho webhook events.
 */
async function handleZohoWebhook(req, res) {
  if (!verifySignature(req)) {
    logger.warn('Webhook: invalid signature — request rejected');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const { module: mod, operation, data } = req.body;
  logger.info(`Webhook: received [${operation}] on [${mod}]`, { recordCount: data?.length });

  // Invalidate affected caches so next fetch returns fresh data
  const key = (mod || '').toLowerCase();
  if (['leads', 'contacts', 'deals'].includes(key)) {
    await cache.cacheDel(`${key}:list:1:50:`);
    if (Array.isArray(data)) {
      for (const record of data) {
        if (record.id) await cache.cacheDel(`${key}:${record.id}`);
      }
    }
    logger.info(`Webhook: invalidated cache for module [${mod}]`);
  }

  // Emit an event or call downstream Liferay APIs here if needed
  // e.g. await liferayService.notifyObject(mod, operation, data);

  res.json({ received: true, module: mod, operation });
}

module.exports = { handleZohoWebhook };

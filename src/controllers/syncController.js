'use strict';

/**
 * controllers/syncController.js
 *
 * Orchestrates bulk synchronisation between Liferay and Zoho CRM.
 * POST /api/sync/push   — send Liferay data → Zoho
 * POST /api/sync/pull   — fetch all Zoho data for a module
 * GET  /api/sync/status — last sync metadata
 */

const zoho   = require('../services/zohoApiService');
const mapper  = require('../utils/fieldMapper');
const cache   = require('../utils/tokenStore');
const logger  = require('../utils/logger');

const ALLOWED_MODULES = ['Leads', 'Contacts', 'Deals'];
const syncStatus = {};   // in-process sync history (use Redis for multi-node)

/**
 * POST /api/sync/push
 * Body: { module: 'Leads'|'Contacts'|'Deals', records: [...] }
 */
async function pushToZoho(req, res, next) {
  try {
    const { module: mod, records } = req.body;

    if (!ALLOWED_MODULES.includes(mod))
      return res.status(400).json({ error: `module must be one of: ${ALLOWED_MODULES.join(', ')}` });

    if (!Array.isArray(records) || records.length === 0)
      return res.status(400).json({ error: 'records must be a non-empty array' });

    const key = mod.toLowerCase();
    const zohoRecords = records.map(mapper[key]?.toZoho || ((r) => r));

    const dupeFields = mod === 'Leads' || mod === 'Contacts' ? ['Email'] : [];
    const result = dupeFields.length
      ? await zoho.upsertRecords(mod, zohoRecords, dupeFields)
      : await zoho.createRecords(mod, zohoRecords);

    const status = { module: mod, pushed: records.length, at: new Date().toISOString() };
    syncStatus[`${mod}:push`] = status;

    logger.info(`Sync: pushed ${records.length} ${mod} record(s) to Zoho`);
    res.json({ status: 'ok', ...status, result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/sync/pull
 * Body: { module: 'Leads'|'Contacts'|'Deals', params: { ... } }
 */
async function pullFromZoho(req, res, next) {
  try {
    const { module: mod, params = {} } = req.body;

    if (!ALLOWED_MODULES.includes(mod))
      return res.status(400).json({ error: `module must be one of: ${ALLOWED_MODULES.join(', ')}` });

    const all = await zoho.getAllRecords(mod, params);
    const key  = mod.toLowerCase();
    const mapped = all.map(mapper[key]?.toLiferay || ((r) => r));

    const status = { module: mod, pulled: all.length, at: new Date().toISOString() };
    syncStatus[`${mod}:pull`] = status;

    // Cache the pulled dataset
    await cache.cacheSet(`sync:pull:${mod}`, mapped, 600);

    logger.info(`Sync: pulled ${all.length} ${mod} record(s) from Zoho`);
    res.json({ status: 'ok', ...status, data: mapped });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/sync/status
 * Returns metadata about the last push/pull per module.
 */
async function getStatus(req, res) {
  res.json({ syncHistory: syncStatus, timestamp: new Date().toISOString() });
}

module.exports = { pushToZoho, pullFromZoho, getStatus };

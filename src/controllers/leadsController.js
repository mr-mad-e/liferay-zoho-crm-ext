'use strict';

/**
 * controllers/leadsController.js
 *
 * Business logic for the /api/leads endpoints.
 * Delegates CRM calls to zohoApiService and applies field mapping.
 */

const zoho  = require('../services/zohoApiService');
const mapper = require('../utils/fieldMapper');
const cache  = require('../utils/tokenStore');
const logger = require('../utils/logger');

const MODULE = 'Leads';
const CACHE_PREFIX = 'leads';
const DUPE_FIELDS  = ['Email'];

// ── GET /api/leads ────────────────────────────────────────────────────────────
async function listLeads(req, res, next) {
  try {
    const { page = 1, per_page = 50, fields, criteria, nocache } = req.query;
    const cacheKey = `${CACHE_PREFIX}:list:${page}:${per_page}:${criteria || ''}`;

    if (!nocache) {
      const cached = await cache.cacheGet(cacheKey);
      if (cached) return res.json({ source: 'cache', ...cached });
    }

    const { data, info } = await zoho.getRecords(MODULE, { page, per_page, fields, criteria });
    const mapped = data.map(mapper.leads.toLiferay);

    const response = { data: mapped, pagination: info };
    await cache.cacheSet(cacheKey, response);

    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/leads/:id ────────────────────────────────────────────────────────
async function getLead(req, res, next) {
  try {
    const { id } = req.params;
    const cacheKey = `${CACHE_PREFIX}:${id}`;

    const cached = await cache.cacheGet(cacheKey);
    if (cached) return res.json({ source: 'cache', data: cached });

    const record = await zoho.getRecordById(MODULE, id);
    if (!record) return res.status(404).json({ error: 'Lead not found' });

    const mapped = mapper.leads.toLiferay(record);
    await cache.cacheSet(cacheKey, mapped, 120);

    res.json({ data: mapped });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/leads ───────────────────────────────────────────────────────────
async function createLead(req, res, next) {
  try {
    const payload = Array.isArray(req.body) ? req.body : [req.body];
    const zohoRecords = payload.map(mapper.leads.toZoho);

    const result = await zoho.upsertRecords(MODULE, zohoRecords, DUPE_FIELDS);

    // Invalidate list cache
    await cache.cacheDel(`${CACHE_PREFIX}:list:1:50:`);

    logger.info(`Leads: created/upserted ${result.length} record(s)`);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/leads/:id ────────────────────────────────────────────────────────
async function updateLead(req, res, next) {
  try {
    const { id } = req.params;
    const zohoRecord = { id, ...mapper.leads.toZoho(req.body) };

    const result = await zoho.updateRecords(MODULE, [zohoRecord]);
    await cache.cacheDel(`${CACHE_PREFIX}:${id}`);

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/leads/:id ─────────────────────────────────────────────────────
async function deleteLead(req, res, next) {
  try {
    const { id } = req.params;
    const result = await zoho.deleteRecords(MODULE, [id]);
    await cache.cacheDel(`${CACHE_PREFIX}:${id}`);

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/leads/search ─────────────────────────────────────────────────────
async function searchLeads(req, res, next) {
  try {
    const records = await zoho.searchRecords(MODULE, req.query);
    res.json({ data: records.map(mapper.leads.toLiferay) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listLeads, getLead, createLead, updateLead, deleteLead, searchLeads };

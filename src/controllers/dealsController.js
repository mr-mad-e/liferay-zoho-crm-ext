'use strict';

/**
 * controllers/dealsController.js
 * Business logic for /api/deals.
 */

const zoho   = require('../services/zohoApiService');
const mapper  = require('../utils/fieldMapper');
const cache   = require('../utils/tokenStore');
const logger  = require('../utils/logger');

const MODULE = 'Deals';
const CACHE_PREFIX = 'deals';

async function listDeals(req, res, next) {
  try {
    const { page = 1, per_page = 50, fields, criteria, nocache } = req.query;
    const cacheKey = `${CACHE_PREFIX}:list:${page}:${per_page}:${criteria || ''}`;

    if (!nocache) {
      const cached = await cache.cacheGet(cacheKey);
      if (cached) return res.json({ source: 'cache', ...cached });
    }

    const { data, info } = await zoho.getRecords(MODULE, { page, per_page, fields, criteria });
    const response = { data: data.map(mapper.deals.toLiferay), pagination: info };
    await cache.cacheSet(cacheKey, response);
    res.json(response);
  } catch (err) {
    next(err);
  }
}

async function getDeal(req, res, next) {
  try {
    const { id } = req.params;
    const cached = await cache.cacheGet(`${CACHE_PREFIX}:${id}`);
    if (cached) return res.json({ source: 'cache', data: cached });

    const record = await zoho.getRecordById(MODULE, id);
    if (!record) return res.status(404).json({ error: 'Deal not found' });

    const mapped = mapper.deals.toLiferay(record);
    await cache.cacheSet(`${CACHE_PREFIX}:${id}`, mapped, 120);
    res.json({ data: mapped });
  } catch (err) {
    next(err);
  }
}

async function createDeal(req, res, next) {
  try {
    const payload = Array.isArray(req.body) ? req.body : [req.body];
    const result  = await zoho.createRecords(MODULE, payload.map(mapper.deals.toZoho));
    await cache.cacheDel(`${CACHE_PREFIX}:list:1:50:`);
    logger.info(`Deals: created ${result.length} record(s)`);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function updateDeal(req, res, next) {
  try {
    const { id } = req.params;
    const result  = await zoho.updateRecords(MODULE, [{ id, ...mapper.deals.toZoho(req.body) }]);
    await cache.cacheDel(`${CACHE_PREFIX}:${id}`);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function deleteDeal(req, res, next) {
  try {
    const { id } = req.params;
    const result  = await zoho.deleteRecords(MODULE, [id]);
    await cache.cacheDel(`${CACHE_PREFIX}:${id}`);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function searchDeals(req, res, next) {
  try {
    const records = await zoho.searchRecords(MODULE, req.query);
    res.json({ data: records.map(mapper.deals.toLiferay) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listDeals, getDeal, createDeal, updateDeal, deleteDeal, searchDeals };

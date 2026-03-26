'use strict';

/**
 * controllers/contactsController.js
 * Business logic for /api/contacts — mirrors leadsController structure.
 */

const zoho   = require('../services/zohoApiService');
const mapper  = require('../utils/fieldMapper');
const cache   = require('../utils/tokenStore');
const logger  = require('../utils/logger');

const MODULE = 'Contacts';
const CACHE_PREFIX = 'contacts';
const DUPE_FIELDS  = ['Email'];

async function listContacts(req, res, next) {
  try {
    const { page = 1, per_page = 50, fields, criteria, nocache } = req.query;
    const cacheKey = `${CACHE_PREFIX}:list:${page}:${per_page}:${criteria || ''}`;

    if (!nocache) {
      const cached = await cache.cacheGet(cacheKey);
      if (cached) return res.json({ source: 'cache', ...cached });
    }

    const { data, info } = await zoho.getRecords(MODULE, { page, per_page, fields, criteria });
    const response = { data: data.map(mapper.contacts.toLiferay), pagination: info };
    await cache.cacheSet(cacheKey, response);

    res.json(response);
  } catch (err) {
    next(err);
  }
}

async function getContact(req, res, next) {
  try {
    const { id } = req.params;
    const cached = await cache.cacheGet(`${CACHE_PREFIX}:${id}`);
    if (cached) return res.json({ source: 'cache', data: cached });

    const record = await zoho.getRecordById(MODULE, id);
    if (!record) return res.status(404).json({ error: 'Contact not found' });

    const mapped = mapper.contacts.toLiferay(record);
    await cache.cacheSet(`${CACHE_PREFIX}:${id}`, mapped, 120);
    res.json({ data: mapped });
  } catch (err) {
    next(err);
  }
}

async function createContact(req, res, next) {
  try {
    const payload  = Array.isArray(req.body) ? req.body : [req.body];
    const result   = await zoho.upsertRecords(MODULE, payload.map(mapper.contacts.toZoho), DUPE_FIELDS);
    await cache.cacheDel(`${CACHE_PREFIX}:list:1:50:`);
    logger.info(`Contacts: created/upserted ${result.length} record(s)`);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function updateContact(req, res, next) {
  try {
    const { id } = req.params;
    const result  = await zoho.updateRecords(MODULE, [{ id, ...mapper.contacts.toZoho(req.body) }]);
    await cache.cacheDel(`${CACHE_PREFIX}:${id}`);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function deleteContact(req, res, next) {
  try {
    const { id } = req.params;
    const result  = await zoho.deleteRecords(MODULE, [id]);
    await cache.cacheDel(`${CACHE_PREFIX}:${id}`);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function searchContacts(req, res, next) {
  try {
    const records = await zoho.searchRecords(MODULE, req.query);
    res.json({ data: records.map(mapper.contacts.toLiferay) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listContacts, getContact, createContact, updateContact, deleteContact, searchContacts };

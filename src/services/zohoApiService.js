'use strict';

/**
 * services/zohoApiService.js
 *
 * Low-level wrapper around the Zoho CRM v3 REST API.
 * Handles:
 *   • Automatic Bearer token injection
 *   • Retry with exponential back-off (via axios-retry)
 *   • Transparent token refresh on 401
 *   • Pagination helpers
 *   • Structured error normalisation
 */

const axios      = require('axios');
const axiosRetry = require('axios-retry').default;
const logger     = require('../utils/logger');
const authSvc    = require('./zohoAuthService');

const BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.com/crm/v3';

// ── Create a dedicated Axios instance ────────────────────────────────────────
const client = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

// ── Retry on network errors and 5xx (not 4xx) ────────────────────────────────
axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkError(error) ||
    (error.response && error.response.status >= 500),
  onRetry: (count, error) =>
    logger.warn(`ZohoAPI: retry #${count} — ${error.message}`),
});

// ── Request interceptor: inject current access token ─────────────────────────
client.interceptors.request.use(async (config) => {
  const token = await authSvc.getValidAccessToken();
  config.headers.Authorization = `Zoho-oauthtoken ${token}`;
  return config;
});

// ── Response interceptor: handle 401 with a single token refresh ──────────────
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      logger.info('ZohoAPI: 401 — forcing token refresh');
      const token = await authSvc.refreshAccessToken();
      original.headers.Authorization = `Zoho-oauthtoken ${token}`;
      return client(original);
    }
    throw normaliseError(error);
  },
);

// ── Error normalisation ───────────────────────────────────────────────────────
function normaliseError(error) {
  if (error.response) {
    const { status, data } = error.response;
    const msg = data?.message || data?.code || JSON.stringify(data);
    const err = new Error(`ZohoAPI [${status}]: ${msg}`);
    err.statusCode = status;
    err.zohoData   = data;
    return err;
  }
  return error;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CRUD helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a single page of records from a Zoho CRM module.
 *
 * @param {string} module        — e.g. 'Leads', 'Contacts', 'Deals'
 * @param {object} params        — query string params (page, per_page, fields, criteria…)
 * @returns {object}             — { data: [...], info: { page, per_page, count, more_records } }
 */
async function getRecords(module, params = {}) {
  logger.debug(`ZohoAPI: GET /${module}`, { params });
  const res = await client.get(`/${module}`, { params });
  return { data: res.data.data || [], info: res.data.info || {} };
}

/**
 * Fetch ALL records, automatically following pagination.
 *
 * @param {string} module
 * @param {object} params    — any additional filters / field selectors
 * @param {number} maxPages  — safety cap (default 20 × 200 = 4 000 records)
 * @returns {Array}
 */
async function getAllRecords(module, params = {}, maxPages = 20) {
  let page = 1;
  let moreRecords = true;
  const all = [];

  while (moreRecords && page <= maxPages) {
    const { data, info } = await getRecords(module, { ...params, page, per_page: 200 });
    all.push(...data);
    moreRecords = info.more_records === true;
    page++;
  }

  logger.info(`ZohoAPI: fetched ${all.length} records from ${module}`);
  return all;
}

/**
 * Fetch a single record by ID.
 *
 * @param {string} module
 * @param {string} id
 * @returns {object|null}
 */
async function getRecordById(module, id) {
  logger.debug(`ZohoAPI: GET /${module}/${id}`);
  const res = await client.get(`/${module}/${id}`);
  return res.data.data?.[0] || null;
}

/**
 * Search records using COQL-style criteria or email/phone/word.
 *
 * @param {string} module
 * @param {object} searchParams  — { criteria, email, phone, word } (one at a time)
 * @returns {Array}
 */
async function searchRecords(module, searchParams = {}) {
  logger.debug(`ZohoAPI: GET /${module}/search`, { searchParams });
  const res = await client.get(`/${module}/search`, { params: searchParams });
  return res.data.data || [];
}

/**
 * Create one or more records.
 *
 * @param {string} module
 * @param {Array}  records   — array of field objects
 * @returns {Array}          — Zoho response data array
 */
async function createRecords(module, records) {
  logger.debug(`ZohoAPI: POST /${module}`, { count: records.length });
  const res = await client.post(`/${module}`, { data: records });
  return res.data.data || [];
}

/**
 * Update one or more existing records (by id).
 *
 * @param {string} module
 * @param {Array}  records   — must include 'id' on each object
 * @returns {Array}
 */
async function updateRecords(module, records) {
  logger.debug(`ZohoAPI: PUT /${module}`, { count: records.length });
  const res = await client.put(`/${module}`, { data: records });
  return res.data.data || [];
}

/**
 * Upsert records (create if not found, update if duplicate key matches).
 *
 * @param {string} module
 * @param {Array}  records
 * @param {Array}  duplicateCheckFields  — e.g. ['Email']
 * @returns {Array}
 */
async function upsertRecords(module, records, duplicateCheckFields = []) {
  logger.debug(`ZohoAPI: POST /${module}/upsert`);
  const payload = { data: records };
  if (duplicateCheckFields.length) payload.duplicate_check_fields = duplicateCheckFields;
  const res = await client.post(`/${module}/upsert`, payload);
  return res.data.data || [];
}

/**
 * Delete records by ID.
 *
 * @param {string} module
 * @param {Array}  ids
 * @returns {Array}
 */
async function deleteRecords(module, ids) {
  logger.debug(`ZohoAPI: DELETE /${module}`, { ids });
  const res = await client.delete(`/${module}`, { params: { ids: ids.join(',') } });
  return res.data.data || [];
}

module.exports = {
  getRecords,
  getAllRecords,
  getRecordById,
  searchRecords,
  createRecords,
  updateRecords,
  upsertRecords,
  deleteRecords,
};

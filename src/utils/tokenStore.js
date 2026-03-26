'use strict';

/**
 * utils/tokenStore.js
 *
 * Persists Zoho OAuth tokens in Redis with an in-process fallback for
 * environments where Redis is not available.
 *
 * Separation of concerns: only this module touches token storage.
 * zohoAuthService.js uses this module to read/write tokens.
 */

const logger = require('./logger');

// ── In-process fallback ───────────────────────────────────────────────────────
const memStore = {};

// ── Optional Redis client ─────────────────────────────────────────────────────
let redis = null;
let useRedis = false;

if (process.env.REDIS_URL) {
  try {
    const IORedis = require('ioredis');
    redis = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    redis.on('connect', () => {
      useRedis = true;
      logger.info('TokenStore: Redis connected');
    });
    redis.on('error', (err) => {
      logger.warn(`TokenStore: Redis error — falling back to memory. ${err.message}`);
      useRedis = false;
    });
    redis.connect().catch(() => {}); // lazy — errors handled above
  } catch {
    logger.warn('TokenStore: ioredis not reachable — using in-process store');
  }
}

const TOKEN_KEY   = 'zoho:access_token';
const TOKEN_TTL   = parseInt(process.env.REDIS_TOKEN_TTL) || 3500; // seconds
const CACHE_TTL   = parseInt(process.env.REDIS_CACHE_TTL) || 300;

// ── Token helpers ─────────────────────────────────────────────────────────────

async function setAccessToken(token, expiresIn = TOKEN_TTL) {
  if (useRedis) {
    await redis.setex(TOKEN_KEY, expiresIn, token);
  } else {
    memStore[TOKEN_KEY] = { value: token, expires: Date.now() + expiresIn * 1000 };
  }
}

async function getAccessToken() {
  if (useRedis) {
    return redis.get(TOKEN_KEY);
  }
  const entry = memStore[TOKEN_KEY];
  if (!entry || Date.now() > entry.expires) return null;
  return entry.value;
}

// ── Generic cache helpers (for CRM responses) ─────────────────────────────────

async function cacheSet(key, value, ttl = CACHE_TTL) {
  const json = JSON.stringify(value);
  if (useRedis) {
    await redis.setex(`cache:${key}`, ttl, json);
  } else {
    memStore[`cache:${key}`] = { value: json, expires: Date.now() + ttl * 1000 };
  }
}

async function cacheGet(key) {
  let raw;
  if (useRedis) {
    raw = await redis.get(`cache:${key}`);
  } else {
    const entry = memStore[`cache:${key}`];
    raw = (entry && Date.now() < entry.expires) ? entry.value : null;
  }
  return raw ? JSON.parse(raw) : null;
}

async function cacheDel(key) {
  if (useRedis) {
    await redis.del(`cache:${key}`);
  } else {
    delete memStore[`cache:${key}`];
  }
}

module.exports = { setAccessToken, getAccessToken, cacheSet, cacheGet, cacheDel };

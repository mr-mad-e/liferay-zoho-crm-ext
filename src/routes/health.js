'use strict';

/**
 * routes/health.js — /health
 * Kubernetes / Liferay liveness + readiness probes.
 */

const router  = require('express').Router();
const store   = require('../utils/tokenStore');
const logger  = require('../utils/logger');

router.get('/', async (req, res) => {
  const checks = { server: 'ok', token: 'unknown', cache: 'unknown' };

  try {
    const token = await store.getAccessToken();
    checks.token = token ? 'ok' : 'missing (needs OAuth)';
  } catch {
    checks.token = 'error';
  }

  try {
    await store.cacheSet('healthcheck', '1', 5);
    const val = await store.cacheGet('healthcheck');
    checks.cache = val === '1' ? 'ok' : 'error';
  } catch {
    checks.cache = 'error';
  }

  const healthy = checks.server === 'ok';
  logger.debug('Health check', checks);
  res.status(healthy ? 200 : 503).json({
    status:  healthy ? 'healthy' : 'degraded',
    checks,
    version: process.env.npm_package_version || '1.0.0',
    uptime:  process.uptime(),
  });
});

module.exports = router;

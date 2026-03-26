'use strict';

/**
 * middleware/auth.js
 *
 * Validates requests to protected /api/* routes.
 * Accepts either:
 *   • X-API-Key header (Liferay → Extension server-to-server calls)
 *   • Authorization: Bearer <liferay_jwt>  (future: validate against Liferay JWKS)
 *
 * In production, replace the simple API-key check with a proper JWT verification
 * against Liferay's OpenID Connect / JWKS endpoint.
 */

const logger = require('../utils/logger');

module.exports = function authMiddleware(req, res, next) {
  // ── Option A: Internal API key ────────────────────────────────────────────
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    if (apiKey === process.env.INTERNAL_API_KEY) {
      req.authMethod = 'api-key';
      return next();
    }
    logger.warn(`Auth: invalid API key from ${req.ip}`);
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // ── Option B: Bearer token (Liferay OAuth2 JWT) ───────────────────────────
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // TODO: verify `token` against Liferay's JWKS endpoint
    // For now we accept any non-empty bearer token in development
    if (token && process.env.NODE_ENV !== 'production') {
      req.authMethod = 'bearer';
      return next();
    }
    logger.warn(`Auth: bearer token validation not implemented in production`);
    return res.status(401).json({ error: 'Bearer token validation required' });
  }

  logger.warn(`Auth: unauthenticated request to ${req.path} from ${req.ip}`);
  return res.status(401).json({ error: 'Authentication required (X-API-Key or Bearer token)' });
};

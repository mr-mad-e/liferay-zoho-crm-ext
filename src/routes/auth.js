'use strict';

/**
 * routes/auth.js
 * OAuth 2.0 flow endpoints — mounted at /auth/zoho
 */

const router   = require('express').Router();
const authSvc  = require('../services/zohoAuthService');
const logger   = require('../utils/logger');

// Step 1: Redirect admin to Zoho consent screen
router.get('/connect', (req, res) => {
  const url = authSvc.getAuthorizationUrl();
  logger.info('Auth: redirecting to Zoho authorization URL');
  res.redirect(url);
});

// Step 2: Zoho redirects back here with ?code=...
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    logger.error(`Auth: Zoho returned error — ${error}`);
    return res.status(400).json({ error, description: req.query.error_description });
  }

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const tokens = await authSvc.exchangeCodeForTokens(code);
    logger.info('Auth: tokens obtained successfully');
    res.json({
      message:    'Zoho CRM connected successfully',
      expires_in: tokens.expires_in,
      scope:      tokens.scope,
    });
  } catch (err) {
    logger.error(`Auth: token exchange failed — ${err.message}`);
    res.status(500).json({ error: 'Token exchange failed', detail: err.message });
  }
});

// Manually trigger a token refresh (admin utility)
router.post('/refresh', async (req, res) => {
  try {
    await authSvc.refreshAccessToken();
    res.json({ message: 'Access token refreshed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

'use strict';

/**
 * services/zohoAuthService.js
 *
 * Handles all OAuth 2.0 interactions with Zoho Accounts:
 *   • Generating the authorization URL (first-time setup)
 *   • Exchanging an authorization code for tokens
 *   • Refreshing the access token via the refresh token
 *   • Returning a valid (auto-refreshed) access token to callers
 */

const axios  = require('axios');
const logger = require('../utils/logger');
const store  = require('../utils/tokenStore');

const ZOHO_ACCOUNTS = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';

/**
 * Build the URL the user must visit to grant the extension CRM access.
 * Call this once during initial setup.
 *
 * @returns {string} Authorization URL
 */
function getAuthorizationUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.ZOHO_CLIENT_ID,
    scope:         process.env.ZOHO_SCOPE || 'ZohoCRM.modules.ALL',
    redirect_uri:  process.env.ZOHO_REDIRECT_URI,
    access_type:   'offline',  // required to receive a refresh token
  });
  return `${ZOHO_ACCOUNTS}/oauth/v2/auth?${params.toString()}`;
}

/**
 * Exchange an authorization code (from the callback) for access + refresh tokens.
 * Persists the refresh token for future restarts.
 *
 * @param {string} code  — code received from Zoho's redirect
 * @returns {object}     — { access_token, refresh_token, expires_in }
 */
async function exchangeCodeForTokens(code) {
  const response = await axios.post(`${ZOHO_ACCOUNTS}/oauth/v2/token`, null, {
    params: {
      grant_type:    'authorization_code',
      client_id:     process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      redirect_uri:  process.env.ZOHO_REDIRECT_URI,
      code,
    },
  });

  const { access_token, refresh_token, expires_in } = response.data;
  await store.setAccessToken(access_token, expires_in - 60);

  // Persist refresh token — in production write this to a secrets manager
  if (refresh_token) {
    process.env.ZOHO_REFRESH_TOKEN = refresh_token;
    logger.info('ZohoAuth: refresh token obtained and stored in process env');
  }

  return response.data;
}

/**
 * Use the stored refresh token to obtain a fresh access token.
 * Called automatically when the cached token is missing or expired.
 *
 * @returns {string} New access token
 */
async function refreshAccessToken() {
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('ZohoAuth: no refresh token configured — run the OAuth flow first');
  }

  logger.info('ZohoAuth: refreshing access token');

  const response = await axios.post(`${ZOHO_ACCOUNTS}/oauth/v2/token`, null, {
    params: {
      grant_type:    'refresh_token',
      client_id:     process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      refresh_token: refreshToken,
    },
  });

  const { access_token, expires_in } = response.data;
  if (!access_token) throw new Error('ZohoAuth: refresh response missing access_token');

  await store.setAccessToken(access_token, (expires_in || 3600) - 60);
  logger.info('ZohoAuth: access token refreshed successfully');

  return access_token;
}

/**
 * Return a valid access token, refreshing automatically when needed.
 * This is the primary function consumed by zohoApiService.js.
 *
 * @returns {Promise<string>} Valid access token
 */
async function getValidAccessToken() {
  const cached = await store.getAccessToken();
  if (cached) return cached;
  return refreshAccessToken();
}

module.exports = {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getValidAccessToken,
};

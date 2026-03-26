'use strict';

/**
 * tests/zohoAuthService.test.js
 * Unit tests for the OAuth 2.0 authentication service.
 */

jest.mock('axios');
jest.mock('../src/utils/tokenStore');

const axios   = require('axios');
const store   = require('../src/utils/tokenStore');
const authSvc = require('../src/services/zohoAuthService');

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ZOHO_CLIENT_ID     = 'test-client-id';
  process.env.ZOHO_CLIENT_SECRET = 'test-secret';
  process.env.ZOHO_REDIRECT_URI  = 'http://localhost:3000/auth/zoho/callback';
  process.env.ZOHO_REFRESH_TOKEN = 'test-refresh-token';
  process.env.ZOHO_ACCOUNTS_URL  = 'https://accounts.zoho.com';
});

describe('getAuthorizationUrl', () => {
  it('should return a URL containing required OAuth params', () => {
    const url = authSvc.getAuthorizationUrl();
    expect(url).toContain('response_type=code');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('access_type=offline');
  });
});

describe('refreshAccessToken', () => {
  it('should call Zoho token endpoint and store the new token', async () => {
    axios.post.mockResolvedValue({
      data: { access_token: 'new-token-xyz', expires_in: 3600 },
    });
    store.setAccessToken.mockResolvedValue();

    const token = await authSvc.refreshAccessToken();

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(store.setAccessToken).toHaveBeenCalledWith('new-token-xyz', 3540);
    expect(token).toBe('new-token-xyz');
  });

  it('should throw if no refresh token is configured', async () => {
    delete process.env.ZOHO_REFRESH_TOKEN;
    await expect(authSvc.refreshAccessToken()).rejects.toThrow('no refresh token');
  });
});

describe('getValidAccessToken', () => {
  it('should return cached token without calling Zoho', async () => {
    store.getAccessToken.mockResolvedValue('cached-token');
    const token = await authSvc.getValidAccessToken();
    expect(token).toBe('cached-token');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('should refresh when cache is empty', async () => {
    store.getAccessToken.mockResolvedValue(null);
    axios.post.mockResolvedValue({
      data: { access_token: 'refreshed-token', expires_in: 3600 },
    });
    store.setAccessToken.mockResolvedValue();

    const token = await authSvc.getValidAccessToken();
    expect(token).toBe('refreshed-token');
  });
});

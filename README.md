# Liferay ↔ Zoho CRM Client Extension — Setup & Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Local Development Setup](#local-development-setup)
4. [Zoho CRM OAuth 2.0 Configuration](#zoho-crm-oauth-20-configuration)
5. [Liferay DXP Configuration](#liferay-dxp-configuration)
6. [Docker Deployment](#docker-deployment)
7. [Liferay Client Extension Deployment](#liferay-client-extension-deployment)
8. [API Reference](#api-reference)
9. [Field Mapping Reference](#field-mapping-reference)
10. [Webhook Setup](#webhook-setup)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool           | Version   | Notes                              |
|----------------|-----------|------------------------------------|
| Node.js        | ≥ 18.x    | LTS recommended                    |
| npm            | ≥ 9.x     | Bundled with Node                  |
| Docker         | ≥ 24.x    | For containerised deployment       |
| Liferay DXP    | 7.4 U92+  | Client Extension framework support |
| Zoho CRM       | Any tier  | API access required                |
| Redis          | ≥ 7.x     | Optional — enables caching         |

---

## Project Structure

```
liferay-zoho-crm-ext/
├── src/
│   ├── server.js                  # Express entry point
│   ├── controllers/
│   │   ├── leadsController.js
│   │   ├── contactsController.js
│   │   ├── dealsController.js
│   │   ├── syncController.js
│   │   └── webhookController.js
│   ├── services/
│   │   ├── zohoAuthService.js     # OAuth 2.0 token management
│   │   └── zohoApiService.js      # Zoho CRM REST API client
│   ├── routes/
│   │   ├── auth.js
│   │   ├── leads.js
│   │   ├── contacts.js
│   │   ├── deals.js
│   │   ├── sync.js
│   │   ├── webhooks.js
│   │   └── health.js
│   ├── middleware/
│   │   ├── auth.js                # API-key / Bearer token guard
│   │   ├── errorHandler.js
│   │   └── requestId.js
│   └── utils/
│       ├── logger.js              # Winston logger
│       ├── fieldMapper.js         # Liferay ↔ Zoho field mapping
│       └── tokenStore.js          # Redis/in-process token & cache
├── docs/
│   └── openapi.yaml               # OpenAPI 3.0 spec
├── tests/
│   ├── zohoAuthService.test.js
│   ├── fieldMapper.test.js
│   └── api.integration.test.js
├── client-extension.yaml          # Liferay CE descriptor
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Local Development Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/your-org/liferay-zoho-crm-ext.git
cd liferay-zoho-crm-ext
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your Zoho and Liferay credentials
```

### 3. Start Redis (optional but recommended)

```bash
docker run -d -p 6379:6379 --name zoho-redis redis:7-alpine
```

### 4. Run in development mode

```bash
npm run dev
# Server starts on http://localhost:3000
# Swagger UI available at http://localhost:3000/api-docs
```

### 5. Run tests

```bash
npm test
```

---

## Zoho CRM OAuth 2.0 Configuration

### Step 1 — Register a server-based application in Zoho API Console

1. Visit https://api-console.zoho.com
2. Click **Add Client** → **Server-based Applications**
3. Fill in:
   - **Client Name**: Liferay CRM Extension
   - **Homepage URL**: `http://localhost:3000` (or your production URL)
   - **Authorized Redirect URI**: `http://localhost:3000/auth/zoho/callback`
4. Copy **Client ID** and **Client Secret** into your `.env`

### Step 2 — Set required scopes in `.env`

```
ZOHO_SCOPE=ZohoCRM.modules.ALL,ZohoCRM.settings.ALL
```

### Step 3 — Run the initial OAuth flow

```bash
# Open this URL in a browser while logged into Zoho:
curl http://localhost:3000/auth/zoho/connect
# → You will be redirected to the Zoho consent screen.
# → After approval, Zoho redirects to /auth/zoho/callback.
# → The extension stores the refresh token automatically.
```

### Step 4 — Confirm the token works

```bash
curl http://localhost:3000/health
# Expect: { "checks": { "token": "ok" } }
```

> **Production note**: Store `ZOHO_REFRESH_TOKEN` in a secrets manager
> (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault) rather than in `.env`.

---

## Liferay DXP Configuration

### 1. Add the OAuth 2.0 application in Liferay

Navigate to **Control Panel → Security → OAuth 2 Administration** and create a new application:

- **Application Name**: Zoho CRM Extension
- **Client Profile**: Headless Server
- **Allowed Authorization Types**: Client Credentials
- Copy the generated **Client ID** and **Client Secret** into `.env` as `LIFERAY_CLIENT_ID` / `LIFERAY_CLIENT_SECRET`

### 2. Configure Instance Settings (optional UI config)

After deploying the client extension, navigate to:
**Control Panel → Instance Settings → Third Party → Zoho CRM Integration Settings**

You can configure:
- Zoho Client ID
- API Base URL
- Sync interval
- Enable/disable webhooks and Redis cache

### 3. Use from a Liferay Fragment or Widget

```javascript
// Example: fetch leads from within a Liferay frontend component
const response = await fetch('/o/zoho-crm/api/leads?page=1&per_page=10', {
  headers: {
    'X-API-Key': Liferay.ThemeDisplay.getUserId(), // replace with real key management
  },
});
const { data } = await response.json();
```

### 4. Push a Liferay Form submission to Zoho

```javascript
// On form submit in a Liferay Fragment:
await fetch('/o/zoho-crm/api/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': '<key>' },
  body: JSON.stringify({
    firstName: form.firstName,
    lastName:  form.lastName,
    email:     form.email,
    company:   form.company,
  }),
});
```

---

## Docker Deployment

### Single container (no Redis)

```bash
docker build -t liferay-zoho-crm-ext .
docker run -d \
  --name zoho-crm-ext \
  -p 3000:3000 \
  --env-file .env \
  liferay-zoho-crm-ext
```

### With Redis (recommended for production)

```bash
docker-compose up -d
# Services: zoho-crm-ext (port 3000) + redis (port 6379)
```

### Verify deployment

```bash
curl http://localhost:3000/health
docker logs liferay-zoho-crm-ext --tail 50
```

---

## Liferay Client Extension Deployment

### Using Liferay Workspace (Gradle)

```bash
# From your Liferay Workspace root:
./gradlew :client-extensions:liferay-zoho-crm-ext:deploy
```

### Manual LUFFA / ZIP deployment

```bash
# Package the extension:
zip -r liferay-zoho-crm-ext.zip \
  src/ docs/ client-extension.yaml package.json package-lock.json

# Deploy via Liferay DXP UI:
# Control Panel → Apps → App Manager → Upload
```

### Environment variables for DXP

In `client-extension.yaml` the extension reads env vars injected by Liferay's
container runtime. In **Liferay Cloud** or **Kubernetes**, set these as:

```yaml
# Kubernetes secret example
apiVersion: v1
kind: Secret
metadata:
  name: zoho-crm-ext-secrets
type: Opaque
stringData:
  ZOHO_CLIENT_ID:     "your-client-id"
  ZOHO_CLIENT_SECRET: "your-client-secret"
  ZOHO_REFRESH_TOKEN: "your-refresh-token"
  INTERNAL_API_KEY:   "your-internal-api-key"
  WEBHOOK_SECRET:     "your-webhook-secret"
```

---

## API Reference

The interactive Swagger UI is available at:

```
http://localhost:3000/api-docs
```

### Quick reference

| Method | Path                  | Description                        |
|--------|-----------------------|------------------------------------|
| GET    | /health               | Liveness check                     |
| GET    | /auth/zoho/connect    | Start OAuth flow                   |
| GET    | /auth/zoho/callback   | OAuth callback (Zoho redirects here)|
| POST   | /auth/zoho/refresh    | Manually refresh access token      |
| GET    | /api/leads            | List leads (paginated)             |
| GET    | /api/leads/:id        | Get lead by ID                     |
| GET    | /api/leads/search     | Search leads                       |
| POST   | /api/leads            | Create/upsert lead(s)              |
| PUT    | /api/leads/:id        | Update lead                        |
| DELETE | /api/leads/:id        | Delete lead                        |
| GET    | /api/contacts         | List contacts                      |
| GET    | /api/contacts/:id     | Get contact                        |
| POST   | /api/contacts         | Create/upsert contact(s)           |
| PUT    | /api/contacts/:id     | Update contact                     |
| DELETE | /api/contacts/:id     | Delete contact                     |
| GET    | /api/deals            | List deals                         |
| GET    | /api/deals/:id        | Get deal                           |
| POST   | /api/deals            | Create deal(s)                     |
| PUT    | /api/deals/:id        | Update deal                        |
| DELETE | /api/deals/:id        | Delete deal                        |
| POST   | /api/sync/push        | Push Liferay data → Zoho           |
| POST   | /api/sync/pull        | Pull all Zoho data for a module    |
| GET    | /api/sync/status      | Last sync metadata                 |
| POST   | /webhooks/zoho        | Receive Zoho webhook events        |

**Authentication**: all `/api/*` routes require the `X-API-Key` header.

---

## Field Mapping Reference

### Leads

| Liferay Field   | Zoho CRM Field   |
|-----------------|------------------|
| firstName       | First_Name       |
| lastName        | Last_Name        |
| email           | Email            |
| phone           | Phone            |
| company         | Company          |
| title           | Designation      |
| website         | Website          |
| leadSource      | Lead_Source      |
| description     | Description      |
| industry        | Industry         |
| annualRevenue   | Annual_Revenue   |
| city            | City             |
| state           | State            |
| country         | Country          |
| zipCode         | Zip_Code         |

### Contacts

| Liferay Field   | Zoho CRM Field   |
|-----------------|------------------|
| firstName       | First_Name       |
| lastName        | Last_Name        |
| email           | Email            |
| phone           | Phone            |
| mobile          | Mobile           |
| title           | Title            |
| department      | Department       |
| accountName     | Account_Name     |
| mailingCity     | Mailing_City     |
| mailingState    | Mailing_State    |
| mailingCountry  | Mailing_Country  |
| mailingZip      | Mailing_Zip      |

### Deals

| Liferay Field   | Zoho CRM Field   |
|-----------------|------------------|
| dealName        | Deal_Name        |
| accountName     | Account_Name     |
| amount          | Amount           |
| closingDate     | Closing_Date     |
| stage           | Stage            |
| probability     | Probability      |
| leadSource      | Lead_Source      |
| type            | Type             |
| description     | Description      |
| contactName     | Contact_Name     |

To add a new field, edit `src/utils/fieldMapper.js` — no other files need changing.

---

## Webhook Setup

1. In Zoho CRM go to **Setup → Automation → Actions → Webhooks → New Webhook**
2. Set:
   - **URL**: `https://your-public-host/webhooks/zoho`
   - **Method**: POST
   - **Body**: `{"module":"${module}","operation":"${operation}","data":[${data}]}`
3. Generate a secret and set `WEBHOOK_SECRET=<your-secret>` in `.env`
4. Attach the webhook to a Workflow Rule or Action

The extension will:
- Verify the HMAC-SHA256 signature on every request
- Invalidate Redis cache entries for affected records
- Return `{ "received": true }` on success

---

## Troubleshooting

### Token errors on startup

```
ZohoAuth: no refresh token configured
```
Run the OAuth flow: visit `http://localhost:3000/auth/zoho/connect` in a browser.

### 401 from Zoho API

The access token may have expired outside the refresh window. Call:
```bash
curl -X POST http://localhost:3000/auth/zoho/refresh -H "X-API-Key: <key>"
```

### Redis connection failures

The extension falls back to in-process storage automatically. Check `REDIS_URL` in `.env`.

### Rate limit errors (429 from Zoho)

Zoho CRM APIs have per-organisation request limits. Enable Redis caching and
increase `REDIS_CACHE_TTL` to reduce API calls. Consider enabling `per_page=200`
in bulk operations.

### Logs

```bash
# Development console output
npm run dev

# Production container
docker logs liferay-zoho-crm-ext -f

# Log files (in ./logs/)
tail -f logs/combined.log
tail -f logs/error.log
```

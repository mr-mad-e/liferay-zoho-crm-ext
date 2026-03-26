'use strict';

/**
 * server.js — Entry point for the Liferay ↔ Zoho CRM Client Extension.
 *
 * Bootstraps Express, wires middleware, mounts routers, and starts listening.
 */

require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const compression = require('compression');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const swaggerUi  = require('swagger-ui-express');
const YAML       = require('yamljs');
const path       = require('path');

const logger          = require('./utils/logger');
const errorHandler    = require('./middleware/errorHandler');
const requestId       = require('./middleware/requestId');
const authMiddleware  = require('./middleware/auth');

// ── Routers ──────────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/auth');
const leadsRoutes    = require('./routes/leads');
const contactsRoutes = require('./routes/contacts');
const dealsRoutes    = require('./routes/deals');
const syncRoutes     = require('./routes/sync');
const webhookRoutes  = require('./routes/webhooks');
const healthRoutes   = require('./routes/health');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.LIFERAY_BASE_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
}));

// ── General middleware ────────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestId);                                    // attach UUID to every request
app.use(morgan('combined', { stream: logger.stream }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ── Swagger / OpenAPI docs ────────────────────────────────────────────────────
try {
  const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'Liferay ↔ Zoho CRM API',
  }));
} catch {
  logger.warn('OpenAPI spec not found — /api-docs will be unavailable');
}

// ── Public routes (no auth) ───────────────────────────────────────────────────
app.use('/health',      healthRoutes);
app.use('/auth/zoho',   authRoutes);
// Webhooks use their own HMAC validation — not the API-key middleware
app.use('/webhooks',    webhookRoutes);

// ── Protected API routes ──────────────────────────────────────────────────────
app.use('/api', authMiddleware);
app.use('/api/leads',    leadsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/deals',    dealsRoutes);
app.use('/api/sync',     syncRoutes);

// ── 404 fallthrough ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀  Liferay-Zoho CRM extension running on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = app; // exported for Jest supertest

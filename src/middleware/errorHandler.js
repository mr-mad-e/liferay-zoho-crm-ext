'use strict';

/**
 * middleware/errorHandler.js
 *
 * Centralised Express error handler.
 * Normalises Zoho API errors, validation errors, and unexpected exceptions
 * into a consistent JSON envelope.
 */

const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  const requestId = req.requestId || 'unknown';

  // Structured log with stack trace
  logger.error(`[${requestId}] ${err.message}`, { stack: err.stack, path: req.path });

  // Zoho API error (annotated by zohoApiService)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error:     err.message,
      requestId,
      zohoData:  err.zohoData || undefined,
    });
  }

  // express-validator errors (passed as Error with `.errors`)
  if (err.errors) {
    return res.status(422).json({ errors: err.errors, requestId });
  }

  // Default 500
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error:     isDev ? err.message : 'Internal server error',
    requestId,
    ...(isDev && { stack: err.stack }),
  });
};

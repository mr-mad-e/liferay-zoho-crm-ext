'use strict';

/**
 * middleware/requestId.js
 * Attaches a UUID to every request for end-to-end tracing.
 */

const { v4: uuidv4 } = require('uuid');

module.exports = function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || uuidv4();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};

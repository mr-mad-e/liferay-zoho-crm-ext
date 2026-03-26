'use strict';

/**
 * utils/logger.js
 *
 * Centralised Winston logger used across the entire application.
 * Log level is driven by the LOG_LEVEL environment variable.
 */

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, errors } = format;

const logFormat = printf(({ level, message, timestamp, stack, requestId }) => {
  const rid = requestId ? ` [${requestId}]` : '';
  return `${timestamp}${rid} [${level}]: ${stack || message}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat,
  ),
  transports: [
    new transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
    }),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10_485_760,  // 10 MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 10_485_760,
      maxFiles: 5,
    }),
  ],
});

// Morgan-compatible stream
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;

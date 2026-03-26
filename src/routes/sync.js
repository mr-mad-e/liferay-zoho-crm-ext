'use strict';

/** routes/sync.js — /api/sync */

const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const ctrl   = require('../controllers/syncController');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

router.get('/status', ctrl.getStatus);

router.post(
  '/push',
  [
    body('module').isIn(['Leads', 'Contacts', 'Deals']),
    body('records').isArray({ min: 1 }),
  ],
  validate,
  ctrl.pushToZoho,
);

router.post(
  '/pull',
  [body('module').isIn(['Leads', 'Contacts', 'Deals'])],
  validate,
  ctrl.pullFromZoho,
);

module.exports = router;

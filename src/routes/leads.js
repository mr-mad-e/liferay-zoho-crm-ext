'use strict';

/**
 * routes/leads.js — /api/leads
 */

const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const ctrl   = require('../controllers/leadsController');

// Inline validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

const leadBodyRules = [
  body('lastName').notEmpty().withMessage('lastName is required'),
  body('email').optional().isEmail().withMessage('email must be a valid address'),
  body('company').optional().isString(),
];

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('per_page').optional().isInt({ min: 1, max: 200 }),
  ],
  validate,
  ctrl.listLeads,
);

router.get('/search', ctrl.searchLeads);

router.get(
  '/:id',
  [param('id').notEmpty()],
  validate,
  ctrl.getLead,
);

router.post('/', leadBodyRules, validate, ctrl.createLead);

router.put(
  '/:id',
  [param('id').notEmpty(), ...leadBodyRules],
  validate,
  ctrl.updateLead,
);

router.delete(
  '/:id',
  [param('id').notEmpty()],
  validate,
  ctrl.deleteLead,
);

module.exports = router;

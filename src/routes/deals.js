'use strict';

/** routes/deals.js — /api/deals */

const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const ctrl   = require('../controllers/dealsController');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

const dealBodyRules = [
  body('dealName').notEmpty().withMessage('dealName is required'),
  body('stage').notEmpty().withMessage('stage is required'),
  body('closingDate').optional().isISO8601().withMessage('closingDate must be ISO 8601'),
  body('amount').optional().isNumeric(),
];

router.get('/', [query('page').optional().isInt({ min: 1 })], validate, ctrl.listDeals);
router.get('/search', ctrl.searchDeals);
router.get('/:id', [param('id').notEmpty()], validate, ctrl.getDeal);
router.post('/', dealBodyRules, validate, ctrl.createDeal);
router.put('/:id', [param('id').notEmpty(), ...dealBodyRules], validate, ctrl.updateDeal);
router.delete('/:id', [param('id').notEmpty()], validate, ctrl.deleteDeal);

module.exports = router;

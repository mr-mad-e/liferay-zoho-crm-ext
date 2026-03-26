'use strict';

/** routes/contacts.js — /api/contacts */

const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const ctrl   = require('../controllers/contactsController');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

const contactBodyRules = [
  body('lastName').notEmpty().withMessage('lastName is required'),
  body('email').optional().isEmail(),
];

router.get('/', [query('page').optional().isInt({ min: 1 })], validate, ctrl.listContacts);
router.get('/search', ctrl.searchContacts);
router.get('/:id', [param('id').notEmpty()], validate, ctrl.getContact);
router.post('/', contactBodyRules, validate, ctrl.createContact);
router.put('/:id', [param('id').notEmpty(), ...contactBodyRules], validate, ctrl.updateContact);
router.delete('/:id', [param('id').notEmpty()], validate, ctrl.deleteContact);

module.exports = router;

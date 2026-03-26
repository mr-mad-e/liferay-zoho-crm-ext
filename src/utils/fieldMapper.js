'use strict';

/**
 * utils/fieldMapper.js
 *
 * Bidirectional field mapping between Liferay Object fields and Zoho CRM module fields.
 * Extend the maps below to add more fields without touching controller logic.
 */

// ── Leads ─────────────────────────────────────────────────────────────────────
const LEAD_MAP_LR_TO_ZOHO = {
  firstName:   'First_Name',
  lastName:    'Last_Name',
  email:       'Email',
  phone:       'Phone',
  company:     'Company',
  title:       'Designation',
  website:     'Website',
  leadSource:  'Lead_Source',
  description: 'Description',
  industry:    'Industry',
  annualRevenue: 'Annual_Revenue',
  city:        'City',
  state:       'State',
  country:     'Country',
  zipCode:     'Zip_Code',
};

// ── Contacts ──────────────────────────────────────────────────────────────────
const CONTACT_MAP_LR_TO_ZOHO = {
  firstName:   'First_Name',
  lastName:    'Last_Name',
  email:       'Email',
  phone:       'Phone',
  mobile:      'Mobile',
  title:       'Title',
  department:  'Department',
  accountName: 'Account_Name',
  description: 'Description',
  mailingCity:    'Mailing_City',
  mailingState:   'Mailing_State',
  mailingCountry: 'Mailing_Country',
  mailingZip:     'Mailing_Zip',
};

// ── Deals ─────────────────────────────────────────────────────────────────────
const DEAL_MAP_LR_TO_ZOHO = {
  dealName:     'Deal_Name',
  accountName:  'Account_Name',
  amount:       'Amount',
  closingDate:  'Closing_Date',
  stage:        'Stage',
  probability:  'Probability',
  leadSource:   'Lead_Source',
  type:         'Type',
  description:  'Description',
  contactName:  'Contact_Name',
};

/**
 * Invert a map — Zoho field names → Liferay field names.
 */
const invertMap = (map) =>
  Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));

/**
 * Transform a flat object using a field map.
 * Fields not present in the map are dropped.
 *
 * @param {object} data        Source object
 * @param {object} fieldMap    { sourceKey: targetKey }
 * @returns {object}
 */
function transform(data, fieldMap) {
  const result = {};
  for (const [src, tgt] of Object.entries(fieldMap)) {
    if (data[src] !== undefined && data[src] !== null) {
      result[tgt] = data[src];
    }
  }
  return result;
}

// ── Public helpers ────────────────────────────────────────────────────────────

const mapper = {
  leads: {
    toZoho:     (d) => transform(d, LEAD_MAP_LR_TO_ZOHO),
    toLiferay:  (d) => transform(d, invertMap(LEAD_MAP_LR_TO_ZOHO)),
  },
  contacts: {
    toZoho:     (d) => transform(d, CONTACT_MAP_LR_TO_ZOHO),
    toLiferay:  (d) => transform(d, invertMap(CONTACT_MAP_LR_TO_ZOHO)),
  },
  deals: {
    toZoho:     (d) => transform(d, DEAL_MAP_LR_TO_ZOHO),
    toLiferay:  (d) => transform(d, invertMap(DEAL_MAP_LR_TO_ZOHO)),
  },
};

module.exports = mapper;

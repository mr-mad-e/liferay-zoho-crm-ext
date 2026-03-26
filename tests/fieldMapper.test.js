'use strict';

/**
 * tests/fieldMapper.test.js
 * Verifies bidirectional field mapping between Liferay and Zoho CRM.
 */

const mapper = require('../src/utils/fieldMapper');

describe('Leads mapper', () => {
  const liferayLead = {
    firstName:  'Jane',
    lastName:   'Doe',
    email:      'jane@example.com',
    company:    'Acme Corp',
    leadSource: 'Web Site',
  };

  it('should map Liferay lead fields to Zoho field names', () => {
    const zoho = mapper.leads.toZoho(liferayLead);
    expect(zoho.First_Name).toBe('Jane');
    expect(zoho.Last_Name).toBe('Doe');
    expect(zoho.Email).toBe('jane@example.com');
    expect(zoho.Company).toBe('Acme Corp');
    expect(zoho.Lead_Source).toBe('Web Site');
  });

  it('should map Zoho lead fields back to Liferay field names', () => {
    const lr = mapper.leads.toLiferay({
      First_Name:  'Jane',
      Last_Name:   'Doe',
      Email:       'jane@example.com',
      Lead_Source: 'Web Site',
    });
    expect(lr.firstName).toBe('Jane');
    expect(lr.lastName).toBe('Doe');
    expect(lr.email).toBe('jane@example.com');
  });

  it('should omit fields not in the map', () => {
    const zoho = mapper.leads.toZoho({ unknownField: 'value', lastName: 'Smith' });
    expect(zoho.unknownField).toBeUndefined();
    expect(zoho.Last_Name).toBe('Smith');
  });

  it('should omit null/undefined values', () => {
    const zoho = mapper.leads.toZoho({ lastName: 'Smith', email: null });
    expect(zoho.Email).toBeUndefined();
  });
});

describe('Contacts mapper', () => {
  it('should correctly map contact fields', () => {
    const zoho = mapper.contacts.toZoho({ firstName: 'Bob', lastName: 'Builder', mobile: '555-1234' });
    expect(zoho.First_Name).toBe('Bob');
    expect(zoho.Mobile).toBe('555-1234');
  });
});

describe('Deals mapper', () => {
  it('should correctly map deal fields', () => {
    const zoho = mapper.deals.toZoho({ dealName: 'Big Deal', amount: 50000, stage: 'Proposal' });
    expect(zoho.Deal_Name).toBe('Big Deal');
    expect(zoho.Amount).toBe(50000);
    expect(zoho.Stage).toBe('Proposal');
  });
});

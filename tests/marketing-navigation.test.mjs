import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminSelection, adminUrl } from '../src/shared/admin-navigation.mjs';
test('Marketing URLs preserve the old view and select either directory', () => {
  assert.deepEqual(adminSelection('/admin', '?view=marketing'), { tab: 'marketing', marketing: 'current' });
  assert.equal(adminSelection('/admin/marketing/').marketing, 'current');
  assert.equal(adminSelection('/admin/marketing/new-clients').marketing, 'new');
  assert.equal(adminUrl('clients'), '/admin?view=clients');
  assert.equal(adminUrl('marketing', 'new'), '/admin/marketing/new-clients');
  assert.equal(adminSelection('/admin/marketing/referral-program').marketing, 'referrals');
  assert.equal(adminSelection('/admin/marketing/referral-program/').marketing, 'referrals');
  assert.equal(adminUrl('marketing', 'referrals'), '/admin/marketing/referral-program');
});

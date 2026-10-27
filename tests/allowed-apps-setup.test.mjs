import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedAppsSetup } from '../src/features/allowed-apps/setup.ts';

test('first-time setup starts with usage access regardless of guide acknowledgement', () => {
  const status = { restrictedSettingsReviewed: false, usageAccess: false, notificationAccess: false };
  assert.equal(allowedAppsSetup(null).ready, false);
  assert.equal(allowedAppsSetup(status).step, 'usage');
  status.restrictedSettingsReviewed = true;
  assert.equal(allowedAppsSetup(status).step, 'usage');
  assert.equal(allowedAppsSetup(status).ready, false, 'acknowledging the guide does not grant permissions');
  status.usageAccess = true;
  assert.equal(allowedAppsSetup(status).step, 'notifications');
  status.notificationAccess = true;
  assert.equal(allowedAppsSetup(status).ready, true);
});

test('existing grants skip setup, and permission revocation reopens the missing step', () => {
  const status = { restrictedSettingsReviewed: false, usageAccess: true, notificationAccess: true };
  assert.equal(allowedAppsSetup(status).step, 'ready');
  status.notificationAccess = false;
  assert.equal(allowedAppsSetup(status).step, 'notifications');
  status.notificationAccess = true;
  status.usageAccess = false;
  status.restrictedSettingsReviewed = true;
  assert.equal(allowedAppsSetup(status).step, 'usage');
  assert.equal(allowedAppsSetup(status).ready, false);
});

test('notification access alone never unlocks allowed apps', () => {
  assert.equal(allowedAppsSetup({ restrictedSettingsReviewed: false, usageAccess: false, notificationAccess: true }).step, 'usage');
});

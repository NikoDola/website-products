import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { platformDatabasePath } from '../src/admin/server/local.mjs';
import { marketingPath } from '../src/admin/server/marketing-store.mjs';
import { inboxPath } from '../src/shared/home-contact.mjs';

test('root app retains the existing private database, marketing and inquiry paths', () => {
  const env = { NODE_ENV: 'development' };
  assert.equal(platformDatabasePath(env), resolve('admin/.data/platform.sqlite'));
  assert.equal(marketingPath(env), resolve('admin/.data/marketing.json'));
  assert.equal(inboxPath(env), resolve('admin/.data/home-inquiries.sqlite'));
});

test('configured database and marketing paths retain their old admin-relative meaning', () => {
  assert.equal(platformDatabasePath({ PLATFORM_DB_PATH: '.data/custom.sqlite' }), resolve('admin/.data/custom.sqlite'));
  assert.equal(marketingPath({ MARKETING_DATA_PATH: '../backups/custom.json' }), resolve('backups/custom.json'));
  const absolute = resolve('tmp/explicit-storage');
  assert.equal(platformDatabasePath({ PLATFORM_DB_PATH: absolute }), absolute);
  assert.equal(marketingPath({ MARKETING_DATA_PATH: absolute }), absolute);
  assert.equal(inboxPath({ HOME_INQUIRIES_DATA_PATH: absolute }), absolute);
});

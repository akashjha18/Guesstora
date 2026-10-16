import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureSeedData } from '../src/seed.js';

test('seed can be safely re-run without creating duplicate demo data', async () => {
  const calls = [];
  const fakeCafe = { findOne: async () => ({ id: 'cafe-1' }), create: async () => { calls.push('create-cafe'); return { id: 'cafe-1' }; } };
  const fakeMenu = { bulkCreate: async () => calls.push('create-menu') };
  const fakeUser = {
    findOne: async () => ({ id: 'user-1' }),
    create: async () => { calls.push('create-user'); return { id: 'user-1' }; },
  };

  const fakeRules = { count: async () => 3, bulkCreate: async () => calls.push('create-rules') };
  const fakeCustomer = { findOne: async () => ({ id: 'c-1' }), create: async () => calls.push('create-customer') };

  await ensureSeedData({
    Cafe: fakeCafe,
    MenuItem: fakeMenu,
    User: fakeUser,
    ReminderRuleModel: fakeRules,
    Customer: fakeCustomer,
  });

  assert.deepEqual(calls, []);
});

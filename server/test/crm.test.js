import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeCustomerCRM } from '../src/routes.js';

test('serializeCustomerCRM calculates totalSpend, ordersCount, and AOV from paid orders', () => {
  const mockCustomer = {
    id: 'cust-1',
    name: 'Aarav Patel',
    phone: '9876543210',
    email: 'aarav@example.com',
    notes: 'Likes window seating and oat milk cappuccino',
    visits: 5,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    orders: [
      { id: 'o-1', total: 650, paymentStatus: 'paid', createdAt: new Date('2026-01-10T12:00:00Z') },
      { id: 'o-2', total: 350, paymentStatus: 'paid', createdAt: new Date('2026-02-15T14:30:00Z') },
      { id: 'o-3', total: 400, paymentStatus: 'pending', createdAt: new Date('2026-03-01T09:00:00Z') },
    ],
    rewards: [
      {
        id: 'r-1',
        amount: 500,
        claimCode: 'CLM-ABCD2',
        status: 'available',
        expiresAt: new Date(Date.now() + 86400000), // tomorrow
        createdAt: new Date('2026-02-15T14:30:00Z'),
      },
      {
        id: 'r-2',
        amount: 500,
        claimCode: 'CLM-XYZ99',
        status: 'redeemed',
        expiresAt: new Date(Date.now() - 86400000), // yesterday
        redeemedAt: new Date('2026-02-16T10:00:00Z'),
        createdAt: new Date('2026-01-10T12:00:00Z'),
      },
    ],
  };

  const crm = serializeCustomerCRM(mockCustomer, 8);

  assert.equal(crm.id, 'cust-1');
  assert.equal(crm.name, 'Aarav Patel');
  assert.equal(crm.phone, '9876543210');
  assert.equal(crm.email, 'aarav@example.com');
  assert.equal(crm.notes, 'Likes window seating and oat milk cappuccino');
  assert.equal(crm.totalSpend, 1000); // 650 + 350 (pending order excluded)
  assert.equal(crm.ordersCount, 3);
  assert.equal(crm.averageOrderValue, 500); // 1000 / 2 paid orders
  assert.equal(crm.activeRewardsCount, 1); // only r-1 is available
  assert.deepEqual(crm.progress, { visits: 5, required: 8, remaining: 3 });
  assert.equal(crm.rewards.length, 2);
});

test('serializeCustomerCRM handles diner with zero orders gracefully', () => {
  const mockCustomer = {
    id: 'cust-2',
    name: 'New Diner',
    phone: '9123456780',
    visits: 0,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    orders: [],
    rewards: [],
  };

  const crm = serializeCustomerCRM(mockCustomer, 8);

  assert.equal(crm.totalSpend, 0);
  assert.equal(crm.ordersCount, 0);
  assert.equal(crm.averageOrderValue, 0);
  assert.equal(crm.activeRewardsCount, 0);
  assert.deepEqual(crm.progress, { visits: 0, required: 8, remaining: 8 });
});

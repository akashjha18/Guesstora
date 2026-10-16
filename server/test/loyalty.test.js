import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRewardProgress, generateClaimCode, processLoyalty } from '../src/loyalty.js';

test('progress resets after configured visit threshold', () => {
  assert.deepEqual(calculateRewardProgress(8, 8), { visits: 0, required: 8, remaining: 8 });
  assert.deepEqual(calculateRewardProgress(6, 8), { visits: 6, required: 8, remaining: 2 });
});

test('generateClaimCode formats correctly with CLM- prefix', () => {
  const code = generateClaimCode();
  assert.match(code, /^CLM-[2-9A-HJ-NP-Z]{5}$/);
});

test('processLoyalty assigns claimCode and cafeId when reward unlocked', async () => {
  let createdReward = null;
  const mockCustomer = {
    visits: 7,
    save: async () => {},
    createReward: async (data) => {
      createdReward = data;
      return data;
    },
  };
  const mockOrder = {
    status: 'completed',
    paymentStatus: 'paid',
    subtotal: 500,
    loyaltyProcessed: false,
    save: async () => {},
  };
  const mockCafe = {
    id: 'cafe-uuid-123',
    loyaltyEnabled: true,
    loyaltyMinimumSpend: 300,
    loyaltyVisitsRequired: 8,
    loyaltyRewardCap: 500,
    loyaltyValidityDays: 30,
  };

  const reward = await processLoyalty({
    order: mockOrder,
    customer: mockCustomer,
    cafe: mockCafe,
  });

  assert.ok(reward);
  assert.equal(mockCustomer.visits, 8);
  assert.equal(reward.amount, 500);
  assert.equal(reward.cafeId, 'cafe-uuid-123');
  assert.match(reward.claimCode, /^CLM-/);
  assert.equal(reward.status, 'available');
});

test('generateClaimCode generates distinct codes without ambiguous characters (0, O, 1, I)', () => {
  const codes = new Set();
  for (let i = 0; i < 50; i++) {
    const code = generateClaimCode();
    assert.match(code, /^CLM-[2-9A-HJ-NP-Z]{5}$/);
    assert.equal(code.includes('0'), false);
    assert.equal(code.includes('O'), false);
    assert.equal(code.includes('1'), false);
    assert.equal(code.includes('I'), false);
    codes.add(code);
  }
  // With 30^5 (~24.3M) possibilities, 50 samples should all be unique
  assert.equal(codes.size, 50);
});


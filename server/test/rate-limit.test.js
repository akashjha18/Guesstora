import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, validatePublicOrderPayload } from '../src/security.js';

test('rate limiter blocks excessive requests', () => {
  const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000 });

  assert.equal(limiter(), true);
  assert.equal(limiter(), true);
  assert.equal(limiter(), false);
});

test('malformed public order payloads are rejected', () => {
  assert.throws(() => validatePublicOrderPayload({ name: '', phone: '123', items: [] }), /Name, valid mobile and items are required\./);
  assert.throws(() => validatePublicOrderPayload({ name: 'A', phone: '9876543210', items: [{ menuItemId: 'x', quantity: 0 }] }), /At least one valid item is required\./);
});

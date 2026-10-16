import test from 'node:test';
import assert from 'node:assert/strict';
import { requireOwner, sign } from '../src/auth.js';

test('owner tokens are accepted for protected routes', () => {
  const token = sign({ id: 'user-1', cafeId: 'cafe-1', role: 'owner' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let called = false;

  requireOwner(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});

test('customer tokens are rejected from owner routes', () => {
  const token = sign({ id: 'user-2', cafeId: 'cafe-1', role: 'customer' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let called = false;

  requireOwner(req, res, () => {
    called = true;
  });

  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, 'Owner access required.');
});

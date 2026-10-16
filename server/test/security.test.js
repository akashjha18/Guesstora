import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLoginRequest } from '../src/validation.js';

test('malformed login payloads are rejected', () => {
  assert.throws(() => validateLoginRequest({ email: 'not-an-email', password: 'short' }), /Valid email and password are required\./);
  assert.throws(() => validateLoginRequest({ email: '', password: 'Demo@123' }), /Valid email and password are required\./);
});

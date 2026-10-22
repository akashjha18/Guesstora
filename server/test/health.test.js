import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthHandlers } from '../src/health.js';

function responseRecorder() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('liveness endpoint reports the process is running', () => {
  const handlers = createHealthHandlers({ authenticate: async () => {} });
  const response = responseRecorder();
  handlers.live({}, response);
  assert.deepEqual(response.body, { ok: true });
});

test('readiness endpoint checks database connectivity', async () => {
  const handlers = createHealthHandlers({ authenticate: async () => {} });
  const response = responseRecorder();
  await handlers.ready({}, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true, checks: { database: 'ok' } });
});

test('readiness endpoint returns unavailable when database connectivity fails', async () => {
  const handlers = createHealthHandlers({
    authenticate: async () => { throw new Error('database unavailable'); },
  });
  const response = responseRecorder();
  await handlers.ready({}, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { ok: false, checks: { database: 'unavailable' } });
});

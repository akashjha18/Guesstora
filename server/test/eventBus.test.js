import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { EventBus } from '../src/eventBus.js';

function createMockRes() {
  const written = [];
  let headers = {};
  let statusCode = 200;

  return {
    written,
    get headers() { return headers; },
    get statusCode() { return statusCode; },
    writeHead(code, h) {
      statusCode = code;
      headers = { ...headers, ...h };
    },
    flushHeaders() {},
    write(data) {
      written.push(data);
      return true;
    },
    on() {},
  };
}

function createMockReq() {
  const req = new EventEmitter();
  return req;
}

test('EventBus registers client and sends initial connected event', () => {
  const bus = new EventBus();
  const res = createMockRes();
  const req = createMockReq();

  const clientId = bus.subscribe('cafe-123', res, req, { role: 'kitchen' });
  assert.ok(clientId);
  assert.equal(bus.getClientCount('cafe-123'), 1);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'text/event-stream');

  assert.equal(res.written.length, 1);
  assert.ok(res.written[0].startsWith('event: connected\ndata: '));
  const parsed = JSON.parse(res.written[0].split('data: ')[1].trim());
  assert.equal(parsed.status, 'connected');
  assert.equal(parsed.cafeId, 'cafe-123');

  bus.reset();
});

test('EventBus broadcasts events only to clients of matching cafeId', () => {
  const bus = new EventBus();

  const res1 = createMockRes();
  const req1 = createMockReq();
  bus.subscribe('cafe-A', res1, req1);

  const res2 = createMockRes();
  const req2 = createMockReq();
  bus.subscribe('cafe-B', res2, req2);

  const delivered = bus.broadcast('cafe-A', 'order_created', { orderNo: 'PB1001', total: 450 });
  assert.equal(delivered, 1);

  // res1 received the broadcast
  assert.equal(res1.written.length, 2); // 1 connected + 1 broadcast
  assert.ok(res1.written[1].includes('event: order_created'));
  assert.ok(res1.written[1].includes('PB1001'));

  // res2 did NOT receive the broadcast
  assert.equal(res2.written.length, 1); // Only connected event

  bus.reset();
});

test('EventBus cleans up client on req close', () => {
  const bus = new EventBus();
  const res = createMockRes();
  const req = createMockReq();

  bus.subscribe('cafe-1', res, req);
  assert.equal(bus.getClientCount('cafe-1'), 1);

  req.emit('close');
  assert.equal(bus.getClientCount('cafe-1'), 0);

  bus.reset();
});

test('EventBus handles multiple clients in same cafe and tracks count', () => {
  const bus = new EventBus();
  const res1 = createMockRes();
  const req1 = createMockReq();
  const res2 = createMockRes();
  const req2 = createMockReq();

  bus.subscribe('cafe-1', res1, req1);
  bus.subscribe('cafe-1', res2, req2);

  assert.equal(bus.getClientCount('cafe-1'), 2);
  assert.equal(bus.getClientCount(), 2);

  const delivered = bus.broadcast('cafe-1', 'order_updated', { status: 'preparing' });
  assert.equal(delivered, 2);

  bus.reset();
});

test('EventBus pingAll sends keepalive comments to all clients', () => {
  const bus = new EventBus();
  const res = createMockRes();
  const req = createMockReq();

  bus.subscribe('cafe-1', res, req);
  res.written.length = 0; // Clear handshake

  bus.pingAll();
  assert.equal(res.written.length, 1);
  assert.equal(res.written[0], ': keepalive\n\n');

  bus.reset();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePaymentIntent, verifyPaymentTransaction } from '../src/payments.js';

test('generatePaymentIntent generates standard dynamic UPI intent link and QR payload', () => {
  const order = {
    id: 'ord-12345',
    orderNo: 'PB8849201',
    total: 350,
    customerName: 'Samir Rao',
    phone: '9876543210',
  };
  const cafe = { name: 'Gusstora Artisan Roastery' };

  const intent = generatePaymentIntent({ order, gateway: 'upi', cafe });
  assert.equal(intent.gateway, 'upi');
  assert.equal(intent.supported, true);
  assert.equal(intent.amount, 350);
  assert.equal(intent.currency, 'INR');
  assert.ok(intent.upiString.startsWith('upi://pay?'));
  assert.ok(intent.upiString.includes('am=350.00'));
  assert.ok(intent.upiString.includes('PB8849201'));
  assert.ok(intent.qrUrl.includes('create-qr-code'));
});

test('generatePaymentIntent generates Razorpay order payload in paise', () => {
  const order = {
    id: 'ord-5555',
    orderNo: 'PB99101',
    total: 240,
    customerName: 'Aarav Mehta',
    phone: '9123456780',
  };

  const intent = generatePaymentIntent({ order, gateway: 'razorpay' });
  assert.equal(intent.gateway, 'razorpay');
  assert.equal(intent.amount, 24000); // 240 * 100 paise
  assert.equal(intent.displayAmount, 240);
  assert.equal(intent.currency, 'INR');
  assert.ok(intent.razorpayOrderId.startsWith('order_rzp_'));
  assert.equal(intent.prefill.name, 'Aarav Mehta');
});

test('generatePaymentIntent generates Stripe client secret', () => {
  const order = {
    id: 'ord-stripe-99',
    orderNo: 'PB77112',
    total: 180,
  };

  const intent = generatePaymentIntent({ order, gateway: 'stripe' });
  assert.equal(intent.gateway, 'stripe');
  assert.equal(intent.amount, 18000);
  assert.equal(intent.currency, 'inr');
  assert.ok(intent.clientSecret.startsWith('pi_'));
});

test('generatePaymentIntent throws on invalid order', () => {
  assert.throws(() => {
    generatePaymentIntent({ order: null });
  }, /Invalid order payload/);
});

test('verifyPaymentTransaction validates valid and invalid references', () => {
  const validRes = verifyPaymentTransaction({
    gateway: 'upi',
    transactionId: 'UPI-TXN-982341-OKAXIS',
    meta: { payerVpa: 'samir@okhdfcbank' },
  });
  assert.equal(validRes.success, true);
  assert.equal(validRes.transactionId, 'UPI-TXN-982341-OKAXIS');
  assert.equal(validRes.meta.verificationMode, 'verified_core_intent');

  const invalidRes = verifyPaymentTransaction({
    gateway: 'upi',
    transactionId: '12',
  });
  assert.equal(invalidRes.success, false);
  assert.ok(invalidRes.error.includes('too short'));
});

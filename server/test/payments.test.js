import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  generatePaymentIntent,
  getVerifiedPaymentWebhook,
  isDemoPaymentsEnabled,
  verifyPaymentTransaction,
  verifyPaymentWebhook,
} from '../src/payments.js';

const order = {
  id: 'ord-12345',
  orderNo: 'PB8849201',
  total: 350,
  customerName: 'Samir Rao',
  phone: '9876543210',
};

async function withEnv(values, callback) {
  const previous = new Map(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('generatePaymentIntent generates a UPI link only with configured café VPA', async () => {
  await withEnv({ CAFE_UPI_VPA: 'gusstora@okaxis' }, async () => {
    const intent = await generatePaymentIntent({ order, gateway: 'upi', cafe: { name: 'Gusstora Roastery' } });
    assert.equal(intent.gateway, 'upi');
    assert.equal(intent.amount, 350);
    assert.equal(intent.currency, 'INR');
    assert.ok(intent.upiString.startsWith('upi://pay?'));
    assert.ok(intent.upiString.includes('am=350.00'));
    assert.ok(intent.upiString.includes('PB8849201'));
  });
});

test('Razorpay intents use a live provider order instead of a fabricated ID', async () => {
  const originalFetch = globalThis.fetch;
  await withEnv({ RAZORPAY_KEY_ID: 'rzp_live_key', RAZORPAY_KEY_SECRET: 'server-secret' }, async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.razorpay.com/v1/orders');
      assert.equal(options.method, 'POST');
      assert.match(options.headers.Authorization, /^Basic /);
      const request = JSON.parse(options.body);
      assert.equal(request.amount, 35000);
      assert.equal(request.currency, 'INR');
      assert.equal(request.notes.orderId, order.id);
      return Response.json({ id: 'order_provider_123', amount: 35000, currency: 'INR' });
    };
    try {
      const intent = await generatePaymentIntent({ order, gateway: 'razorpay', cafe: { currency: 'INR' } });
      assert.equal(intent.razorpayOrderId, 'order_provider_123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('Stripe intents are created by the authenticated provider API', async () => {
  const originalFetch = globalThis.fetch;
  await withEnv({
    STRIPE_SECRET_KEY: 'sk_live_secret',
    STRIPE_PUBLISHABLE_KEY: 'pk_live_key',
  }, async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.stripe.com/v1/payment_intents');
      assert.equal(options.headers.Authorization, 'Bearer sk_live_secret');
      const request = new URLSearchParams(options.body);
      assert.equal(request.get('amount'), '35000');
      assert.equal(request.get('metadata[orderId]'), order.id);
      return Response.json({
        id: 'pi_provider_123',
        client_secret: 'pi_provider_secret',
        amount: 35000,
        currency: 'inr',
      });
    };
    try {
      const intent = await generatePaymentIntent({ order, gateway: 'stripe', cafe: { currency: 'INR' } });
      assert.equal(intent.paymentIntentId, 'pi_provider_123');
      assert.equal(intent.clientSecret, 'pi_provider_secret');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('online payment gateways fail closed when provider credentials are missing', async () => {
  await withEnv({
    RAZORPAY_KEY_ID: undefined,
    RAZORPAY_KEY_SECRET: undefined,
    STRIPE_SECRET_KEY: undefined,
    STRIPE_PUBLISHABLE_KEY: undefined,
  }, async () => {
    await assert.rejects(generatePaymentIntent({ order, gateway: 'razorpay' }), /RAZORPAY_KEY_ID is required/);
    await assert.rejects(generatePaymentIntent({ order, gateway: 'stripe' }), /STRIPE_SECRET_KEY is required/);
    await assert.rejects(generatePaymentIntent({ order, gateway: 'demo_online' }), /disabled payment gateway/);
  });
});

test('demo payments can only be enabled explicitly outside production', () => {
  assert.equal(isDemoPaymentsEnabled({ NODE_ENV: 'development', DEMO_PAYMENTS_ENABLED: 'true' }), true);
  assert.equal(isDemoPaymentsEnabled({ NODE_ENV: 'production', DEMO_PAYMENTS_ENABLED: 'true' }), false);
  assert.equal(isDemoPaymentsEnabled({ NODE_ENV: 'development', DEMO_PAYMENTS_ENABLED: 'false' }), false);
});

test('payment confirmation rejects unverifiable UPI references', async () => {
  const result = await verifyPaymentTransaction({
    gateway: 'upi',
    transactionId: 'UPI-TXN-982341-OKAXIS',
    order,
  });
  assert.equal(result.success, false);
  assert.match(result.error, /not supported/);
});

test('Razorpay confirmation requires a valid provider signature and captured matching payment', async () => {
  const originalFetch = globalThis.fetch;
  const providerOrderId = 'order_provider_123';
  const paymentId = 'pay_provider_456';
  const keySecret = 'server-secret';
  const signature = crypto.createHmac('sha256', keySecret).update(`${providerOrderId}|${paymentId}`).digest('hex');
  await withEnv({ RAZORPAY_KEY_ID: 'rzp_key', RAZORPAY_KEY_SECRET: keySecret }, async () => {
    globalThis.fetch = async url => {
      assert.equal(url, `https://api.razorpay.com/v1/payments/${paymentId}`);
      return Response.json({
        id: paymentId,
        order_id: providerOrderId,
        status: 'captured',
        amount: 35000,
        currency: 'INR',
      });
    };
    try {
      const result = await verifyPaymentTransaction({
        gateway: 'razorpay',
        transactionId: paymentId,
        meta: { razorpayOrderId: providerOrderId, razorpaySignature: signature },
        order: { ...order, paymentGatewayMeta: { providerOrderId } },
      });
      assert.equal(result.success, true);
      assert.equal(result.transactionId, paymentId);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('Razorpay and Stripe webhook signatures are verified against raw request bodies', () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  const razorpaySecret = 'razorpay-webhook-secret';
  const razorpaySignature = crypto.createHmac('sha256', razorpaySecret).update(body).digest('hex');
  assert.equal(verifyPaymentWebhook({
    provider: 'razorpay',
    rawBody: body,
    signature: razorpaySignature,
    secret: razorpaySecret,
  }), true);
  assert.equal(verifyPaymentWebhook({
    provider: 'razorpay',
    rawBody: body,
    signature: 'bad-signature',
    secret: razorpaySecret,
  }), false);

  const stripeSecret = 'stripe-webhook-secret';
  const timestamp = Math.floor(Date.now() / 1000);
  const stripeSignature = crypto.createHmac('sha256', stripeSecret)
    .update(`${timestamp}.${body.toString()}`)
    .digest('hex');
  assert.equal(verifyPaymentWebhook({
    provider: 'stripe',
    rawBody: body,
    signature: `t=${timestamp},v1=${stripeSignature}`,
    secret: stripeSecret,
  }), true);
  assert.equal(verifyPaymentWebhook({
    provider: 'stripe',
    rawBody: body,
    signature: `t=${timestamp - 600},v1=${stripeSignature}`,
    secret: stripeSecret,
  }), false);
});

test('webhook payment normalization accepts only successful captured events', () => {
  const payment = getVerifiedPaymentWebhook({
    provider: 'razorpay',
    payload: {
      event: 'payment.captured',
      payload: {
        payment: { entity: {
          id: 'pay_123',
          order_id: 'order_provider_123',
          status: 'captured',
          amount: 35000,
          currency: 'INR',
          notes: { orderId: order.id },
        } },
      },
    },
  });
  assert.deepEqual(payment, {
    orderId: order.id,
    transactionId: 'pay_123',
    providerOrderId: 'order_provider_123',
    amountMinor: 35000,
    currency: 'INR',
    event: 'payment.captured',
  });
  assert.equal(getVerifiedPaymentWebhook({
    provider: 'stripe',
    payload: { type: 'payment_intent.processing', data: { object: {} } },
  }), null);
});

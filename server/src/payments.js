import crypto from 'node:crypto';

const RAZORPAY_API = 'https://api.razorpay.com/v1';
const STRIPE_API = 'https://api.stripe.com/v1';

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required to use this payment gateway.`);
  return value;
}

function safeEqualHex(expected, supplied) {
  if (!/^[a-f0-9]+$/i.test(supplied || '') || expected.length !== supplied.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}

async function readProviderResponse(response, provider) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.error?.description || body.error?.message || `HTTP ${response.status}`;
    throw new Error(`${provider} request failed: ${detail}`);
  }
  return body;
}

export async function generatePaymentIntent({ order, gateway = 'upi', cafe = {} }) {
  if (!order || !order.id || !Number.isFinite(Number(order.total)) || Number(order.total) <= 0) {
    throw new Error('Invalid order payload for payment intent');
  }

  const normalizedGateway = String(gateway).toLowerCase();
  const amount = Number(order.total);
  const amountMinor = Math.round(amount * 100);
  const cafeName = cafe.name || 'Gusstora Roastery';

  if (normalizedGateway === 'upi') {
    const upiVpa = cafe.cfdUpiVpa || process.env.CAFE_UPI_VPA;
    if (!upiVpa) throw new Error('UPI is not configured for this café.');
    const upiString = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent(cafeName)}&am=${amount.toFixed(2)}&tr=${encodeURIComponent(order.orderNo || order.id)}&tn=${encodeURIComponent(`Order #${order.orderNo || ''} at ${cafeName}`)}&cu=INR`;
    return {
      gateway: 'upi',
      supported: true,
      orderId: order.id,
      orderNo: order.orderNo,
      amount,
      currency: 'INR',
      upiString,
      vpa: upiVpa,
      payeeName: cafeName,
    };
  }

  if (normalizedGateway === 'razorpay') {
    const keyId = requiredEnv('RAZORPAY_KEY_ID');
    const keySecret = requiredEnv('RAZORPAY_KEY_SECRET');
    const response = await fetch(`${RAZORPAY_API}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency: String(cafe.currency || 'INR').toUpperCase(),
        receipt: String(order.orderNo || order.id).slice(0, 40),
        notes: { orderId: order.id, cafeId: cafe.id || '' },
      }),
    });
    const providerOrder = await readProviderResponse(response, 'Razorpay');
    return {
      gateway: 'razorpay',
      supported: true,
      orderId: order.id,
      orderNo: order.orderNo,
      amount: amountMinor,
      displayAmount: amount,
      currency: providerOrder.currency,
      keyId,
      razorpayOrderId: providerOrder.id,
      name: cafeName,
      description: `Order ${order.orderNo || order.id}`,
      prefill: { name: order.customerName || '', contact: order.phone || '' },
    };
  }

  if (normalizedGateway === 'stripe') {
    const secretKey = requiredEnv('STRIPE_SECRET_KEY');
    const body = new URLSearchParams({
      amount: String(amountMinor),
      currency: String(cafe.currency || 'INR').toLowerCase(),
      'metadata[orderId]': String(order.id),
      'metadata[cafeId]': String(cafe.id || ''),
    });
    const response = await fetch(`${STRIPE_API}/payment_intents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const paymentIntent = await readProviderResponse(response, 'Stripe');
    return {
      gateway: 'stripe',
      supported: true,
      orderId: order.id,
      orderNo: order.orderNo,
      amount: paymentIntent.amount,
      displayAmount: amount,
      currency: paymentIntent.currency,
      publishableKey: requiredEnv('STRIPE_PUBLISHABLE_KEY'),
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    };
  }

  if (normalizedGateway === 'demo_online' && isDemoPaymentsEnabled()) {
    return {
      gateway: 'demo_online',
      supported: true,
      orderId: order.id,
      orderNo: order.orderNo,
      amount,
      currency: String(cafe.currency || 'INR').toUpperCase(),
      instantComplete: true,
    };
  }

  throw new Error(`Unsupported or disabled payment gateway: ${normalizedGateway}`);
}

export function isDemoPaymentsEnabled(env = process.env) {
  return env.NODE_ENV !== 'production' && String(env.DEMO_PAYMENTS_ENABLED).toLowerCase() === 'true';
}

export async function verifyPaymentTransaction({ gateway, transactionId, meta = {}, order, cafe = {} }) {
  const normalizedGateway = String(gateway || '').toLowerCase();
  if (!transactionId || typeof transactionId !== 'string') {
    return { success: false, error: 'Missing or invalid payment transaction reference ID' };
  }

  if (!order) return { success: false, error: 'Order is required for payment verification.' };

  if (normalizedGateway === 'razorpay') {
    const keyId = requiredEnv('RAZORPAY_KEY_ID');
    const keySecret = requiredEnv('RAZORPAY_KEY_SECRET');
    const paymentId = transactionId.trim();
    const providerOrderId = String(meta.razorpayOrderId || meta.orderId || '');
    const signature = String(meta.razorpaySignature || meta.signature || '');
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${providerOrderId}|${paymentId}`)
      .digest('hex');
    if (!order.paymentGatewayMeta?.providerOrderId || providerOrderId !== order.paymentGatewayMeta.providerOrderId ||
        !safeEqualHex(expectedSignature, signature)) {
      return { success: false, error: 'Razorpay payment signature is invalid.' };
    }

    const response = await fetch(`${RAZORPAY_API}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
    });
    const payment = await readProviderResponse(response, 'Razorpay');
    if (payment.status !== 'captured' || payment.order_id !== providerOrderId ||
        Number(payment.amount) !== Math.round(Number(order.total) * 100) ||
        String(payment.currency || '').toUpperCase() !== String(cafe.currency || 'INR').toUpperCase()) {
      return { success: false, error: 'Razorpay payment is not captured for the expected order amount.' };
    }
    return {
      success: true,
      gateway: normalizedGateway,
      transactionId: payment.id,
      meta: { providerOrderId, verificationMode: 'razorpay_api' },
    };
  }

  if (normalizedGateway === 'stripe') {
    const secretKey = requiredEnv('STRIPE_SECRET_KEY');
    const response = await fetch(`${STRIPE_API}/payment_intents/${encodeURIComponent(transactionId.trim())}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const paymentIntent = await readProviderResponse(response, 'Stripe');
    if (paymentIntent.status !== 'succeeded' ||
        paymentIntent.id !== order.paymentGatewayMeta?.providerPaymentIntentId ||
        paymentIntent.metadata?.orderId !== String(order.id) ||
        Number(paymentIntent.amount_received) !== Math.round(Number(order.total) * 100) ||
        String(paymentIntent.currency || '').toUpperCase() !== String(cafe.currency || 'INR').toUpperCase()) {
      return { success: false, error: 'Stripe payment is not successful for the expected order amount.' };
    }
    return {
      success: true,
      gateway: normalizedGateway,
      transactionId: paymentIntent.id,
      meta: { verificationMode: 'stripe_api' },
    };
  }

  if (normalizedGateway === 'demo_online' && isDemoPaymentsEnabled()) {
    return {
      success: true,
      gateway: normalizedGateway,
      transactionId: transactionId.trim(),
      meta: { verificationMode: 'development_demo' },
    };
  }

  return { success: false, error: `Server-side verification is not supported for ${normalizedGateway || 'this gateway'}.` };
}

export function verifyPaymentWebhook({ provider, rawBody, signature, secret, timestamp, now = Date.now() }) {
  if (!Buffer.isBuffer(rawBody) || !rawBody.length || !signature || !secret) return false;
  let signedPayload = rawBody;
  let suppliedSignature = signature;

  if (provider === 'stripe') {
    const fields = Object.fromEntries(String(signature).split(',').map(part => {
      const [key, value] = part.split('=');
      return [key, value];
    }));
    const signedAt = Number(fields.t);
    if (!Number.isFinite(signedAt) || Math.abs(now / 1000 - signedAt) > 300 || !fields.v1) return false;
    signedPayload = Buffer.concat([Buffer.from(`${signedAt}.`), rawBody]);
    suppliedSignature = fields.v1;
  } else if (provider !== 'razorpay') {
    return false;
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return safeEqualHex(expectedSignature, suppliedSignature);
}

export function getVerifiedPaymentWebhook({ provider, payload }) {
  if (provider === 'razorpay') {
    const payment = payload?.payload?.payment?.entity;
    const orderId = payment?.notes?.orderId;
    if (payload?.event !== 'payment.captured' || !payment || !orderId || !payment.id ||
        payment.status !== 'captured' || !Number.isFinite(Number(payment.amount))) return null;
    return {
      orderId: String(orderId),
      transactionId: String(payment.id),
      providerOrderId: String(payment.order_id || ''),
      amountMinor: Number(payment.amount),
      currency: String(payment.currency || '').toUpperCase(),
      event: payload.event,
    };
  }

  if (provider === 'stripe') {
    const payment = payload?.data?.object;
    const orderId = payment?.metadata?.orderId;
    if (payload?.type !== 'payment_intent.succeeded' || !payment || !orderId || !payment.id ||
        payment.status !== 'succeeded' || !Number.isFinite(Number(payment.amount_received))) return null;
    return {
      orderId: String(orderId),
      transactionId: String(payment.id),
      providerOrderId: String(payment.id),
      amountMinor: Number(payment.amount_received),
      currency: String(payment.currency || '').toUpperCase(),
      event: payload.type,
    };
  }

  return null;
}

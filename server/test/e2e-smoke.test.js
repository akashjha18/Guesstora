import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createIsolatedApi } from '../scripts/testSupport.js';

test('fresh install supports cafe registration, owner login, and customer ordering', { timeout: 150000 }, async () => {
  const api = await createIsolatedApi('smoke');
  try {
    const healthResponse = await fetch(`${api.baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), { ok: true });
    const readinessResponse = await fetch(`${api.baseUrl}/health/ready`);
    assert.equal(readinessResponse.status, 200);
    assert.deepEqual(await readinessResponse.json(), { ok: true, checks: { database: 'ok' } });

    const slug = `smoke-${Date.now()}`;
    const ownerEmail = `${slug}@example.test`;
    const ownerPassword = 'DeploymentSmokePass123!';
    const registrationResponse = await fetch(`${api.baseUrl}/auth/register-cafe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cafeName: 'E2E Smoke Cafe',
        slug,
        phone: '9876501234',
        address: 'Smoke Test',
        ownerName: 'Smoke Test Owner',
        ownerEmail,
        ownerPassword,
        seedSampleMenu: true,
      }),
    });
    const registrationBody = await registrationResponse.text();
    assert.equal(registrationResponse.status, 201, registrationBody);
    const registration = JSON.parse(registrationBody);
    assert.equal(registration.cafe.slug, slug);
    assert.equal(registration.user.email, ownerEmail);

    const loginResponse = await fetch(`${api.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    });
    const loginBody = await loginResponse.text();
    assert.equal(loginResponse.status, 200, loginBody);
    const login = JSON.parse(loginBody);
    assert.ok(login.accessToken);
    assert.equal(login.user.email, ownerEmail);

    const cafeResponse = await fetch(`${api.baseUrl}/public/cafes/${slug}`);
    const cafeBody = await cafeResponse.text();
    assert.equal(cafeResponse.status, 200, cafeBody);
    const cafe = JSON.parse(cafeBody);
    assert.ok(cafe.menu.length > 0);
    const menuItem = cafe.menu[0];
    const menuItemId = menuItem.id || menuItem._id;

    const otherCafeSlug = `${slug}-other`;
    const otherCafeResponse = await fetch(`${api.baseUrl}/auth/register-cafe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cafeName: 'Other Smoke Cafe',
        slug: otherCafeSlug,
        ownerName: 'Other Smoke Owner',
        ownerEmail: `owner-${otherCafeSlug}@example.test`,
        ownerPassword,
      }),
    });
    const otherCafeBody = await otherCafeResponse.text();
    assert.equal(otherCafeResponse.status, 201, otherCafeBody);
    const otherCafe = JSON.parse(otherCafeBody);
    const otherMenuItem = otherCafe.cafe.menu[0];
    const crossTenantUpdate = await fetch(
      `${api.baseUrl}/owner/menu/${otherMenuItem.id || otherMenuItem._id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${login.accessToken}`,
        },
        body: JSON.stringify({ price: 1 }),
      }
    );
    assert.equal(crossTenantUpdate.status, 404, 'Staff tokens must not mutate another café menu');

    const orderResponse = await fetch(`${api.baseUrl}/public/cafes/${slug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Smoke Test Customer',
        phone: '9876504321',
        paymentStatus: 'paid',
        items: [{ menuItemId, quantity: 1 }],
      }),
    });
    const orderBody = await orderResponse.text();
    assert.equal(orderResponse.status, 201, orderBody);
    const order = JSON.parse(orderBody);
    assert.ok(order.id);
    assert.equal(order.status, 'placed');
    assert.equal(order.paymentStatus, 'pending', 'Client-supplied payment status must not mark an order paid');
    assert.equal(order.items.length, 1);

    const unsignedWebhook = await fetch(`${api.baseUrl}/webhooks/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'payment.captured' }),
    });
    assert.equal(unsignedWebhook.status, 400);

    const webhookPayload = {
      event: 'payment.captured',
      payload: {
        payment: { entity: {
          id: 'pay_smoke_captured',
          order_id: 'provider_order_smoke',
          status: 'captured',
          amount: Math.round(order.total * 100),
          currency: 'INR',
          notes: { orderId: order.id },
        } },
      },
    };
    const webhookBody = JSON.stringify(webhookPayload);
    const webhookSignature = crypto
      .createHmac('sha256', api.env.RAZORPAY_WEBHOOK_SECRET)
      .update(webhookBody)
      .digest('hex');
    const signedWebhook = await fetch(`${api.baseUrl}/webhooks/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': webhookSignature,
      },
      body: webhookBody,
    });
    assert.equal(signedWebhook.status, 400, 'A signed provider event must not settle an order without a matching provider intent');

    const orderLookup = await fetch(`${api.baseUrl}/public/cafes/${slug}/orders/${order.id}`);
    const paidOrder = await orderLookup.json();
    assert.equal(paidOrder.paymentStatus, 'pending');
  } finally {
    await api.cleanup();
  }
});

test('production-mode staging rehearsal starts without demo data and keeps demo payment disabled', { timeout: 150000 }, async () => {
  const api = await createIsolatedApi('smoke', { production: true });
  try {
    const liveResponse = await fetch(`${api.baseUrl}/health/live`);
    assert.equal(liveResponse.status, 200);
    const readyResponse = await fetch(`${api.baseUrl}/health/ready`);
    assert.equal(readyResponse.status, 200);

    const allowedOriginResponse = await fetch(`${api.baseUrl}/health/live`, {
      headers: { Origin: 'https://staging.example.test' },
    });
    assert.equal(allowedOriginResponse.headers.get('access-control-allow-origin'), 'https://staging.example.test');

    const seededDemoCafe = await fetch(`${api.baseUrl}/public/cafes/demo-cafe`);
    assert.equal(seededDemoCafe.status, 404, 'Production startup must not seed the demo café');

    const slug = `production-smoke-${Date.now()}`;
    const registrationResponse = await fetch(`${api.baseUrl}/auth/register-cafe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cafeName: 'Production Smoke Cafe',
        slug,
        ownerName: 'Production Smoke Owner',
        ownerEmail: `${slug}@example.test`,
        ownerPassword: 'DeploymentSmokePass123!',
        seedSampleMenu: true,
      }),
    });
    const registrationBody = await registrationResponse.text();
    assert.equal(registrationResponse.status, 201, registrationBody);

    const cafeResponse = await fetch(`${api.baseUrl}/public/cafes/${slug}`);
    assert.equal(cafeResponse.status, 200);
    const cafe = await cafeResponse.json();
    assert.ok(cafe.menu.length > 0);

    const orderResponse = await fetch(`${api.baseUrl}/public/cafes/${slug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Smoke Test Customer',
        phone: '9876504321',
        paymentMethod: 'demo_online',
        items: [{ menuItemId: cafe.menu[0].id || cafe.menu[0]._id, quantity: 1 }],
      }),
    });
    const orderBody = await orderResponse.text();
    assert.equal(orderResponse.status, 201, orderBody);
    const order = JSON.parse(orderBody);
    assert.equal(order.paymentStatus, 'pending');
    assert.equal(order.paymentMethod, 'cash');

    const blockedDemoIntent = await fetch(`${api.baseUrl}/public/cafes/${slug}/orders/${order.id}/payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gateway: 'demo_online' }),
    });
    assert.equal(blockedDemoIntent.status, 400);
  } finally {
    await api.cleanup();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { jwtSecret } from '../src/auth.js';
import { Cafe, CafeTable, MenuItem, Order, OrderItem, User } from '../src/models.js';
import routes from '../src/routes.js';

test('Captain password access is cafe-scoped, section-scoped, and limited to floor duties', async t => {
  const suffix = `${process.pid}-${Date.now()}`;
  const cafe = await Cafe.create({
    name: 'Waiter Auth Test Cafe',
    slug: `waiter-auth-${suffix}`,
    brandColor: '#176B50',
    currency: 'INR',
  });
  const otherCafe = await Cafe.create({
    name: 'Other Waiter Auth Cafe',
    slug: `other-waiter-auth-${suffix}`,
    brandColor: '#176B50',
    currency: 'INR',
  });
  const [waiterPassword, inactivePassword, otherPassword, ownerPassword] = await Promise.all([
    bcrypt.hash('waiter-password', 10),
    bcrypt.hash('inactive-password', 10),
    bcrypt.hash('other-password', 10),
    bcrypt.hash('owner-password', 10),
  ]);
  const waiter = await User.create({
    cafeId: cafe.id,
    name: 'Test Waiter',
    email: `waiter-${suffix}@test.invalid`,
    passwordHash: waiterPassword,
    role: 'waiter',
    status: 'active',
    assignedSection: 'Patio',
  });
  const inactiveWaiter = await User.create({
    cafeId: cafe.id,
    name: 'Inactive Waiter',
    email: `inactive-${suffix}@test.invalid`,
    passwordHash: inactivePassword,
    role: 'waiter',
    status: 'inactive',
  });
  const otherCafeWaiter = await User.create({
    cafeId: otherCafe.id,
    name: 'Other Cafe Waiter',
    email: `other-${suffix}@test.invalid`,
    passwordHash: otherPassword,
    role: 'waiter',
    status: 'active',
  });
  const owner = await User.create({
    cafeId: cafe.id,
    name: 'Test Owner',
    email: `owner-${suffix}@test.invalid`,
    passwordHash: ownerPassword,
    role: 'owner',
    status: 'active',
  });
  const manager = await User.create({
    cafeId: cafe.id,
    name: 'Test Manager',
    email: `manager-${suffix}@test.invalid`,
    passwordHash: await bcrypt.hash('manager-password', 10),
    role: 'manager',
    status: 'active',
  });
  const patioTable = await CafeTable.create({
    cafeId: cafe.id,
    tableNumber: `W-${suffix}`,
    name: 'Patio Table',
    section: 'Patio',
    status: 'available',
    isActive: true,
  });
  await CafeTable.create({
    cafeId: cafe.id,
    tableNumber: `I-${suffix}`,
    name: 'Indoor Table',
    section: 'Indoor',
    status: 'available',
    isActive: true,
  });
  const menuItem = await MenuItem.create({
    cafeId: cafe.id,
    name: 'Test Coffee',
    category: 'Coffee',
    price: 125,
    available: true,
  });

  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const ownerToken = jwt.sign(
    { sub: owner.id, id: owner.id, name: owner.name, role: owner.role, cafe: cafe.id },
    jwtSecret,
    { expiresIn: '1h' },
  );
  const managerToken = jwt.sign(
    { sub: manager.id, id: manager.id, name: manager.name, role: manager.role, cafe: cafe.id },
    jwtSecret,
    { expiresIn: '1h' },
  );
  const request = async (path, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return { response, data: await response.json() };
  };

  await t.test('password login accepts active floor staff and rejects invalid, inactive, and cross-cafe accounts', async () => {
    const valid = await request(`/public/cafes/${cafe.slug}/captain/login`, {
      method: 'POST',
      body: { email: waiter.email, password: 'waiter-password' },
    });
    assert.equal(valid.response.status, 200);
    assert.ok(valid.data.token);

    const invalidPassword = await request(`/public/cafes/${cafe.slug}/captain/login`, {
      method: 'POST',
      body: { email: waiter.email, password: 'wrong-password' },
    });
    assert.equal(invalidPassword.response.status, 401);

    const inactive = await request(`/public/cafes/${cafe.slug}/captain/login`, {
      method: 'POST',
      body: { email: inactiveWaiter.email, password: 'inactive-password' },
    });
    assert.equal(inactive.response.status, 401);

    const crossCafe = await request(`/public/cafes/${cafe.slug}/captain/login`, {
      method: 'POST',
      body: { email: otherCafeWaiter.email, password: 'other-password' },
    });
    assert.equal(crossCafe.response.status, 401);

    const malformed = await request(`/public/cafes/${cafe.slug}/captain/login`, {
      method: 'POST',
      body: { email: waiter.email, password: 'short' },
    });
    assert.equal(malformed.response.status, 400);
  });

  await t.test('waiter credentials are rejected by the CRM login endpoint', async () => {
    const crmLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: waiter.email, password: 'waiter-password' },
    });
    assert.equal(crmLogin.response.status, 403);
    assert.equal(crmLogin.data.code, 'WAITER_PORTAL_ONLY');
    assert.equal(crmLogin.data.accessToken, undefined);
  });

  await t.test('waiter can take orders only in their assigned section at menu prices', async () => {
    const login = await request(`/public/cafes/${cafe.slug}/captain/login`, {
      method: 'POST',
      body: { email: waiter.email, password: 'waiter-password' },
    });
    const { response: floorResponse, data: floor } = await request('/captain/floor-plan', {
      token: login.data.token,
    });
    assert.equal(floorResponse.status, 200);
    assert.deepEqual(floor.tables.map(table => table.id), [patioTable.id]);

    const { response, data } = await request(`/captain/tables/${patioTable.id}/order`, {
      method: 'POST',
      token: login.data.token,
      body: {
        items: [{
          menuItemId: menuItem.id,
          name: 'Free Coffee',
          price: 1,
          quantity: 1,
          course: 'beverages',
        }],
      },
    });
    assert.equal(response.status, 201);
    assert.equal(Number(data.order.total), 125);
    assert.equal(data.order.items[0].name, 'Test Coffee');

    const restricted = await request('/captain/tables/merge', {
      method: 'POST',
      token: login.data.token,
      body: {},
    });
    assert.equal(restricted.response.status, 403);

    const ownerAccess = await request('/owner/staff', { token: login.data.token });
    assert.equal(ownerAccess.response.status, 403);
  });

  await t.test('owner can provision a waiter with a password and assigned section', async () => {
    const { response, data } = await request('/owner/staff', {
      method: 'POST',
      token: ownerToken,
      body: {
        name: 'New Waiter',
        email: `new-waiter-${suffix}@test.invalid`,
        password: 'new-waiter-password',
        role: 'waiter',
        assignedSection: 'Patio',
      },
    });
    assert.equal(response.status, 201);
    assert.equal(data.staff.assignedSection, 'Patio');
    assert.equal(Object.hasOwn(data.staff, 'passwordHash'), false);
    const stored = await User.findByPk(data.staff.id);
    assert.ok(await bcrypt.compare('new-waiter-password', stored.passwordHash));

    const managerReset = await request(`/owner/staff/${stored.id}`, {
      method: 'PATCH',
      token: managerToken,
      body: { password: 'manager-reset-password' },
    });
    assert.equal(managerReset.response.status, 403);

    const ownerReset = await request(`/owner/staff/${stored.id}`, {
      method: 'PATCH',
      token: ownerToken,
      body: { password: 'owner-reset-password' },
    });
    assert.equal(ownerReset.response.status, 200);
    const passwordAfterReset = await User.findByPk(stored.id);
    assert.ok(await bcrypt.compare('owner-reset-password', passwordAfterReset.passwordHash));
    assert.equal(Object.hasOwn(ownerReset.data.staff, 'passwordHash'), false);

    const missingPassword = await request('/owner/staff', {
      method: 'POST',
      token: ownerToken,
      body: {
        name: 'Passwordless Waiter',
        email: `passwordless-${suffix}@test.invalid`,
        role: 'waiter',
      },
    });
    assert.equal(missingPassword.response.status, 400);

    const invalidSection = await request('/owner/staff', {
      method: 'POST',
      token: ownerToken,
      body: {
        name: 'Unassigned Waiter',
        email: `invalid-section-${suffix}@test.invalid`,
        password: 'valid-waiter-password',
        role: 'waiter',
        assignedSection: 'Not a real section',
      },
    });
    assert.equal(invalidSection.response.status, 400);
  });
});

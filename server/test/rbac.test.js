import test from 'node:test';
import assert from 'node:assert/strict';
import { requireRole, requireStaff, sign, STAFF_ROLES } from '../src/auth.js';

test('STAFF_ROLES contains all 4 standard roles', () => {
  assert.deepEqual(STAFF_ROLES, ['owner', 'manager', 'cashier', 'kitchen']);
});

test('requireStaff permits all valid staff roles and denies non-staff', () => {
  const roles = ['owner', 'manager', 'cashier', 'kitchen'];
  for (const role of roles) {
    let nextCalled = false;
    const token = sign({ id: `user-${role}`, cafeId: 1, role, name: role, email: `${role}@demo.com` });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {
      status: () => ({ json: () => {} }),
    };
    requireStaff(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true, `Expected requireStaff to allow role ${role}`);
    assert.equal(req.auth.role, role);
  }

  // Deny customer role
  let statusSet = null;
  let responseJson = null;
  const customerToken = sign({ id: 'user-cust', cafeId: 1, role: 'customer' });
  const req = { headers: { authorization: `Bearer ${customerToken}` } };
  const res = {
    status: (code) => {
      statusSet = code;
      return {
        json: (payload) => {
          responseJson = payload;
        },
      };
    },
  };
  requireStaff(req, res, () => {});
  assert.equal(statusSet, 403);
  assert.match(responseJson.message, /Staff or owner access required/i);
});

test('requireRole middleware restricts access based on allowed roles', () => {
  const ownerOnly = requireRole('owner');
  const mgmt = requireRole('owner', 'manager');
  const kitchenAllowed = requireRole('owner', 'manager', 'cashier', 'kitchen');

  // Test Owner Only
  let nextCalled = false;
  ownerOnly({ auth: { role: 'owner', cafe: 1 } }, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  let deniedStatus = null;
  const mockRes = {
    status: (s) => ({
      json: () => { deniedStatus = s; },
    }),
  };
  nextCalled = false;
  ownerOnly({ auth: { role: 'manager', cafe: 1 } }, mockRes, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(deniedStatus, 403);

  // Test Manager Allowed on mgmt
  nextCalled = false;
  mgmt({ auth: { role: 'manager', cafe: 1 } }, mockRes, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  // Test Cashier Denied on mgmt
  nextCalled = false;
  deniedStatus = null;
  mgmt({ auth: { role: 'cashier', cafe: 1 } }, mockRes, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(deniedStatus, 403);

  // Test Kitchen Allowed on kitchen route
  nextCalled = false;
  kitchenAllowed({ auth: { role: 'kitchen', cafe: 1 } }, mockRes, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

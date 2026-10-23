import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeOrder, serializePromoCode, serializeShift } from '../src/routes.js';
import { calculateDiscount, calculateEqualBillSplit, calculateShiftSummary, formatZReportText } from '../src/shifts.js';

test('serializeOrder preserves shiftId, discount details, and splitBills', () => {
  const mockOrder = {
    id: 101,
    orderNo: 'PB1234567',
    shiftId: 5,
    customerId: 12,
    customerName: 'Priya Sharma',
    phone: '9876543210',
    table: 'Table 4',
    subtotal: 500,
    discount: 50,
    discountType: 'percent',
    discountValue: 10,
    discountReason: 'Happy Hour Special',
    discountAuthorizedBy: 'Manager Rahul',
    splitBills: JSON.stringify([
      { id: 's1', splitNumber: 1, label: 'Guest 1', amount: 225, paymentStatus: 'paid' },
      { id: 's2', splitNumber: 2, label: 'Guest 2', amount: 225, paymentStatus: 'pending' },
    ]),
    total: 450,
    paymentMethod: 'split',
    paymentStatus: 'pending',
    status: 'placed',
    notes: 'Extra hot',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      { id: 1, menuItemId: 2, name: 'Cortado', price: 250, quantity: 2, isCompleted: false },
    ],
  };

  const serialized = serializeOrder(mockOrder);
  assert.equal(serialized.shiftId, 5);
  assert.equal(serialized.discountType, 'percent');
  assert.equal(serialized.discountValue, 10);
  assert.equal(serialized.discountReason, 'Happy Hour Special');
  assert.equal(serialized.discountAuthorizedBy, 'Manager Rahul');
  assert.equal(Array.isArray(serialized.splitBills), true);
  assert.equal(serialized.splitBills.length, 2);
  assert.equal(serialized.splitBills[0].paymentStatus, 'paid');
  assert.equal(serialized.splitBills[1].paymentStatus, 'pending');
});

test('serializeShift formats shift fields and handles null closing values cleanly', () => {
  const openShift = {
    id: 1,
    cafeId: 10,
    userId: 2,
    User: { id: 2, name: 'Aarav Cashier', role: 'cashier' },
    openedAt: new Date('2026-10-12T08:00:00Z'),
    closedAt: null,
    openingFloat: 2000,
    closingFloatExpected: null,
    closingFloatCounted: null,
    cashVariance: null,
    totalSales: null,
    paymentBreakdown: null,
    categoryBreakdown: null,
    taxSummary: null,
    status: 'open',
    notes: 'Morning shift float verified',
    createdAt: new Date('2026-10-12T08:00:00Z'),
  };

  const serialized = serializeShift(openShift);
  assert.equal(serialized.id, 1);
  assert.equal(serialized.openingFloat, 2000);
  assert.equal(serialized.status, 'open');
  assert.equal(serialized.user.name, 'Aarav Cashier');
  assert.equal(serialized.closingFloatExpected, null);
  assert.deepEqual(serialized.paymentBreakdown, {});
});

test('serializePromoCode converts types and defaults appropriately', () => {
  const promo = {
    id: 3,
    cafeId: 10,
    code: 'ROAST20',
    discountType: 'percent',
    discountValue: '20.00',
    maxDiscountAmount: '150.00',
    minOrderAmount: '400.00',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    usageLimit: 100,
    usageCount: 14,
    isActive: 1,
    description: '20% off festival special',
    createdAt: new Date(),
  };

  const serialized = serializePromoCode(promo);
  assert.equal(serialized.code, 'ROAST20');
  assert.equal(serialized.discountType, 'percent');
  assert.equal(serialized.discountValue, 20);
  assert.equal(serialized.maxDiscountAmount, 150);
  assert.equal(serialized.minOrderAmount, 400);
  assert.equal(serialized.isActive, true);
  assert.equal(serialized.usageCount, 14);
});

test('full shift lifecycle calculations produce balanced day-end reports', () => {
  const shift = {
    id: 1,
    openedAt: new Date('2026-10-12T09:00:00Z'),
    openingFloat: 1500,
  };

  const orders = [
    {
      id: 101,
      subtotal: 500,
      discount: 0,
      total: 500,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      status: 'completed',
      items: [{ name: 'Flat White', price: 250, quantity: 2, MenuItem: { category: 'Coffee' } }],
    },
    {
      id: 102,
      subtotal: 700,
      discount: 50,
      total: 650,
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      status: 'completed',
      items: [{ name: 'Croissant', price: 350, quantity: 2, MenuItem: { category: 'Pastry' } }],
    },
  ];

  // Expected cash = 1500 + 500 = 2000
  const counted = 2000;
  const summary = calculateShiftSummary(shift, orders, counted);

  assert.equal(summary.totalSales, 1150);
  assert.equal(summary.paymentBreakdown.cash, 500);
  assert.equal(summary.paymentBreakdown.upi, 650);
  assert.equal(summary.expectedCashInDrawer, 2000);
  assert.equal(summary.closingFloatExpected, 2000);
  assert.equal(summary.cashVariance, 0);
  assert.equal(summary.varianceStatus, 'balanced');

  const zReport = formatZReportText(shift, summary, 'GUESTORA Artisan Café');
  assert.match(zReport, /Z-REPORT/);
  assert.match(zReport, /CASH DRAWER RECONCILIATION/);
  assert.match(zReport, /BALANCED/);
  assert.match(zReport, /GST/);
});

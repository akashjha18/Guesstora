import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateShiftSummary,
  calculateDiscount,
  calculateEqualBillSplit,
  formatZReportText,
} from '../src/shifts.js';

test('calculateShiftSummary accurately tallies sales, payment modes, and cash variance', () => {
  const orders = [
    {
      id: 'ord-1',
      total: 500,
      subtotal: 500,
      discount: 0,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      status: 'completed',
      items: [{ category: 'Coffee', price: 250, quantity: 2 }],
    },
    {
      id: 'ord-2',
      total: 350,
      subtotal: 400,
      discount: 50,
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      status: 'completed',
      items: [{ category: 'Bakery', price: 200, quantity: 2 }],
    },
    {
      id: 'ord-3',
      total: 600,
      subtotal: 600,
      discount: 0,
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      status: 'completed',
    },
    {
      id: 'ord-4',
      total: 200,
      subtotal: 200,
      discount: 0,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      status: 'placed',
    },
    {
      id: 'ord-5',
      total: 150,
      subtotal: 150,
      discount: 0,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      status: 'cancelled',
    },
  ];

  // Opening float = 1000, Actual counted cash at close = 1500 (Expected: 1000 + 500 cash = 1500, Variance = 0)
  const summary = calculateShiftSummary(orders, 1000, 1500);

  assert.equal(summary.totalOrders, 5);
  assert.equal(summary.paidOrdersCount, 3);
  assert.equal(summary.cancelledOrdersCount, 1);
  assert.equal(summary.totalSales, 1450); // 500 + 350 + 600
  assert.equal(summary.totalDiscounts, 50);
  assert.equal(summary.paymentBreakdown.cash, 500);
  assert.equal(summary.paymentBreakdown.upi, 350);
  assert.equal(summary.paymentBreakdown.razorpay, 600);
  assert.equal(summary.expectedCashInDrawer, 1500);
  assert.equal(summary.closingFloatCounted, 1500);
  assert.equal(summary.cashVariance, 0);
  assert.equal(summary.varianceStatus, 'balanced');
});

test('calculateShiftSummary detects cash drawer shortage and surplus', () => {
  const orders = [
    {
      total: 800,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      status: 'completed',
    },
  ];

  // Opening float = 500, Cash collected = 800 -> Expected = 1300
  // Scenario 1: Counted = 1250 -> Short by 50
  const shortSummary = calculateShiftSummary(orders, 500, 1250);
  assert.equal(shortSummary.expectedCashInDrawer, 1300);
  assert.equal(shortSummary.cashVariance, -50);
  assert.equal(shortSummary.varianceStatus, 'short');

  // Scenario 2: Counted = 1320 -> Over by 20
  const overSummary = calculateShiftSummary(orders, 500, 1320);
  assert.equal(overSummary.cashVariance, 20);
  assert.equal(overSummary.varianceStatus, 'over');
});

test('calculateDiscount applies percentage discount with maximum cap and threshold checks', () => {
  // 10% off with max cap 100, min order 300
  const promo = {
    discountType: 'percent',
    discountValue: 10,
    minOrderAmount: 300,
    maxDiscountAmount: 100,
  };

  // Subtotal = 250 (below minOrder)
  const below = calculateDiscount(250, promo);
  assert.equal(below.valid, false);
  assert.equal(below.discountAmount, 0);
  assert.equal(below.finalTotal, 250);

  // Subtotal = 500 (10% = 50, within cap)
  const normal = calculateDiscount(500, promo);
  assert.equal(normal.valid, true);
  assert.equal(normal.discountAmount, 50);
  assert.equal(normal.finalTotal, 450);

  // Subtotal = 2000 (10% = 200, capped at 100)
  const capped = calculateDiscount(2000, promo);
  assert.equal(capped.valid, true);
  assert.equal(capped.discountAmount, 100);
  assert.equal(capped.finalTotal, 1900);
});

test('calculateDiscount applies flat discount correctly without exceeding subtotal', () => {
  const flatPromo = {
    discountType: 'flat',
    discountValue: 75,
    minOrderAmount: 200,
  };

  const res = calculateDiscount(350, flatPromo);
  assert.equal(res.valid, true);
  assert.equal(res.discountAmount, 75);
  assert.equal(res.finalTotal, 275);

  // Flat promo larger than subtotal
  const hugeFlat = { discountType: 'flat', discountValue: 500, minOrderAmount: 0 };
  const cappedRes = calculateDiscount(150, hugeFlat);
  assert.equal(cappedRes.discountAmount, 150);
  assert.equal(cappedRes.finalTotal, 0);
});

test('calculateEqualBillSplit distributes amount cleanly and handles odd remainders', () => {
  // 1000 divided by 3 -> 333.34 for first, 333.33 for rest
  const splits = calculateEqualBillSplit(1000, 3);
  assert.equal(splits.length, 3);
  assert.equal(splits[0].amount, 333.34);
  assert.equal(splits[1].amount, 333.33);
  assert.equal(splits[2].amount, 333.33);

  const sum = splits.reduce((acc, s) => acc + s.amount, 0);
  assert.equal(Math.round(sum), 1000);
});

test('formatZReportText generates compliant 80mm monospace string', () => {
  const shift = {
    id: 'test-shift-123456',
    staffName: 'Priya Sharma',
    openedAt: '2026-10-12T08:00:00Z',
    closedAt: '2026-10-12T16:00:00Z',
    summary: {
      paidOrdersCount: 24,
      grossSubtotal: 12400,
      totalDiscounts: 600,
      totalSales: 11800,
      estimatedTax: 561.9,
      openingFloat: 2000,
      closingFloatCounted: 6500,
      expectedCashInDrawer: 6500,
      cashVariance: 0,
      varianceStatus: 'balanced',
      paymentBreakdown: {
        cash: 4500,
        upi: 5000,
        razorpay: 2300,
        stripe: 0,
        demo_online: 0,
      },
    },
  };

  const text = formatZReportText(shift, { name: 'Gusstora Roastery' });
  assert.ok(text.includes('DAY-END AUDIT // Z-REPORT'));
  assert.ok(text.includes('CASHIER     : Priya Sharma'));
  assert.ok(text.includes('NET REALIZED REVENUE'));
  assert.ok(text.includes('Opening Cash Float'));
  assert.ok(text.includes('CASH VARIANCE (BALANCED)'));
});

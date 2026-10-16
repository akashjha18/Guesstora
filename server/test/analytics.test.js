import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePercentageChange,
  escapeCSVField,
  formatCustomersCSV,
  formatOrdersCSV,
  getCafeAnalytics,
  getDateRange,
} from '../src/analyticsEngine.js';

test('getDateRange calculates valid ranges and days', () => {
  const fixedNow = new Date('2026-09-28T12:00:00Z');
  const r7 = getDateRange('7d', fixedNow);
  assert.equal(r7.days, 7);
  assert.equal(r7.currentEnd.getTime() - r7.currentStart.getTime(), 7 * 86400000);
  assert.equal(r7.prevEnd.getTime() - r7.prevStart.getTime(), 7 * 86400000);

  const r30 = getDateRange('30d', fixedNow);
  assert.equal(r30.days, 30);

  const r90 = getDateRange('90d', fixedNow);
  assert.equal(r90.days, 90);
});

test('computePercentageChange calculates delta accurately and handles zero baseline', () => {
  assert.equal(computePercentageChange(120, 100), 20);
  assert.equal(computePercentageChange(80, 100), -20);
  assert.equal(computePercentageChange(150, 0), 100);
  assert.equal(computePercentageChange(0, 0), 0);
  assert.equal(computePercentageChange(115.5, 100), 15.5);
});

test('escapeCSVField wraps values and handles embedded quotes', () => {
  assert.equal(escapeCSVField('Cappuccino, Large'), '"Cappuccino, Large"');
  assert.equal(escapeCSVField('Double "Shot" Espresso'), '"Double ""Shot"" Espresso"');
  assert.equal(escapeCSVField(null), '""');
  assert.equal(escapeCSVField(undefined), '""');
  assert.equal(escapeCSVField(420), '"420"');
});

test('formatOrdersCSV produces valid RFC-compliant CSV headers and rows', () => {
  const mockOrders = [
    {
      id: 'ord-1',
      orderNo: 'ORD-101',
      createdAt: '2026-09-25T14:30:00Z',
      customerName: 'Pooja Verma',
      phone: '9876511111',
      table: 'T-4',
      items: [
        { name: 'Cappuccino', quantity: 2, price: 220 },
        { name: 'Cheesecake', quantity: 1, price: 280 },
      ],
      subtotal: 720,
      discount: 100,
      total: 620,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      status: 'completed',
    },
  ];

  const csv = formatOrdersCSV(mockOrders);
  assert.ok(csv.includes('Order ID,Order No,Date,Time,Customer Name'));
  assert.ok(csv.includes('"ORD-101"'));
  assert.ok(csv.includes('"Pooja Verma"'));
  assert.ok(csv.includes('"Cappuccino (x2), Cheesecake (x1)"'));
  assert.ok(csv.includes('620'));
});

test('formatCustomersCSV produces valid customer CRM export rows', () => {
  const mockCustomers = [
    {
      id: 'cust-1',
      name: 'Vikram Malhotra',
      phone: '9876522222',
      email: 'vikram@example.com',
      visits: 6,
      createdAt: '2026-08-01T10:00:00Z',
      notes: 'Prefers oat milk',
      orders: [
        { total: 450, paymentStatus: 'paid' },
        { total: 550, paymentStatus: 'paid' },
      ],
      rewards: [{ status: 'available' }],
    },
  ];

  const csv = formatCustomersCSV(mockCustomers, 8);
  assert.ok(csv.includes('Customer ID,Customer Name,Phone,Email,Total Visits / Stamps'));
  assert.ok(csv.includes('"Vikram Malhotra"'));
  assert.ok(csv.includes('"9876522222"'));
  assert.ok(csv.includes('1000')); // Total spend
  assert.ok(csv.includes('500')); // AOV
  assert.ok(csv.includes('6 / 8')); // Stamps toward reward
});

test('getCafeAnalytics aggregates revenue, trends, peak hours, and retention', async () => {
  const fixedNow = new Date('2026-09-28T12:00:00Z');

  const mockCafe = {
    id: 'cafe-123',
    name: 'The Daily Grind',
    slug: 'daily-grind',
    currency: 'INR',
    loyaltyVisitsRequired: 8,
    menu: [{ id: 'm1', name: 'Cold Coffee', category: 'Coffee' }],
  };

  const orderDate1 = new Date(fixedNow.getTime() - 24 * 3600 * 1000);
  orderDate1.setHours(10, 0, 0, 0);
  const orderDate2 = new Date(fixedNow.getTime() - 24 * 3600 * 1000);
  orderDate2.setHours(18, 0, 0, 0);

  const mockCurrentOrders = [
    {
      id: 'o-1',
      total: 500,
      subtotal: 500,
      discount: 0,
      paymentStatus: 'paid',
      status: 'completed',
      phone: '9876500001',
      createdAt: orderDate1,
      items: [{ menuItemId: 'm1', name: 'Cold Coffee', quantity: 2, price: 250 }],
      loyaltyProcessed: true,
    },
    {
      id: 'o-2',
      total: 300,
      subtotal: 350,
      discount: 50,
      paymentStatus: 'paid',
      status: 'completed',
      phone: '9876500002',
      createdAt: orderDate2,
      items: [{ menuItemId: 'm2', name: 'Sandwich', quantity: 1, price: 300 }],
      loyaltyProcessed: false,
    },
  ];

  const mockPrevOrders = [
    {
      id: 'o-prev',
      total: 400,
      subtotal: 400,
      paymentStatus: 'paid',
      status: 'completed',
      phone: '9876500001',
      createdAt: new Date('2026-08-25T10:00:00Z'),
    },
  ];

  const mockCustomers = [
    {
      id: 'c1',
      name: 'Diner One',
      phone: '9876500001',
      visits: 3,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      orders: [{ createdAt: new Date('2026-09-27T10:00:00Z'), total: 500, paymentStatus: 'paid' }],
      rewards: [],
    },
    {
      id: 'c2',
      name: 'Diner Two',
      phone: '9876500002',
      visits: 1,
      createdAt: new Date('2026-09-27T18:00:00Z'),
      orders: [{ createdAt: new Date('2026-09-27T18:00:00Z'), total: 300, paymentStatus: 'paid' }],
      rewards: [],
    },
  ];

  const mockRewards = [
    { id: 'r1', status: 'redeemed' },
    { id: 'r2', status: 'available' },
  ];

  const fakeCafeModel = {
    findByPk: async id => (id === mockCafe.id ? mockCafe : null),
  };
  const fakeOrderModel = {
    findAll: async ({ where }) => {
      // Current vs prev period
      if (where.createdAt && where.createdAt[Symbol.for('gte')] && where.createdAt[Symbol.for('lte')]) {
        return mockCurrentOrders;
      }
      return mockPrevOrders;
    },
  };
  const fakeCustomerModel = {
    findAll: async () => mockCustomers,
  };
  const fakeRewardModel = {
    findAll: async () => mockRewards,
  };

  const analytics = await getCafeAnalytics({
    cafeId: 'cafe-123',
    range: '30d',
    CafeModel: fakeCafeModel,
    OrderModel: fakeOrderModel,
    CustomerModel: fakeCustomerModel,
    RewardModel: fakeRewardModel,
    now: fixedNow,
  });

  // Verify KPIs
  assert.equal(analytics.kpi.revenue, 800);
  assert.equal(analytics.kpi.orders, 2);
  assert.equal(analytics.kpi.aov, 400);
  assert.equal(analytics.kpi.customers, 2);
  assert.equal(analytics.kpi.revenueDelta, 100); // 800 vs 400 = +100%

  // Verify Trends
  assert.equal(analytics.trends.length, 30);
  const dayWithOrders = analytics.trends.find(t => t.date === '2026-09-27');
  assert.ok(dayWithOrders);
  assert.equal(dayWithOrders.revenue, 800);
  assert.equal(dayWithOrders.orders, 2);

  // Verify Peak Hours
  assert.equal(analytics.peakHours.length, 24);
  assert.equal(analytics.peakHours[10].orders, 1);
  assert.equal(analytics.peakHours[18].orders, 1);

  // Verify Retention
  assert.equal(analytics.retention.totalCustomers, 2);
  assert.equal(analytics.retention.repeatDiners, 1); // Diner One (visits: 3)
  assert.equal(analytics.retention.newDiners, 1); // Diner Two (visits: 1)
  assert.equal(analytics.retention.repeatRate, 50);

  // Verify Loyalty ROI
  assert.equal(analytics.loyaltyRoi.totalIssuedRewards, 2);
  assert.equal(analytics.loyaltyRoi.totalRedeemedRewards, 1);
  assert.equal(analytics.loyaltyRoi.redemptionRate, 50);
  assert.equal(analytics.loyaltyRoi.totalDiscountsGiven, 50);
  assert.equal(analytics.loyaltyRoi.loyaltyDrivenRevenue, 500);

  // Verify Top Items
  assert.equal(analytics.topItems.length, 2);
  assert.equal(analytics.topItems[0].name, 'Cold Coffee');
  assert.equal(analytics.topItems[0].quantity, 2);
  assert.equal(analytics.topItems[0].revenue, 500);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderTemplate,
  generateWhatsAppUrl,
  checkCooldown,
  scanAudienceForCafe,
  dispatchReminder,
  runBatchReminders,
  serializeReminderRule,
  serializeNotificationLog,
} from '../src/reminderEngine.js';

test('renderTemplate replaces placeholders correctly', () => {
  const template = 'Hey {customerName}! You have {stampsLeft} stamps left at {cafeName}. Claim {claimCode} at {menuUrl}!';
  const data = {
    customerName: 'Aarav',
    stampsLeft: 2,
    cafeName: 'Artisan Brews',
    claimCode: 'REWARD-FREE99',
    menuUrl: 'http://localhost:5173/c/artisan-brews',
  };

  const rendered = renderTemplate(template, data);
  assert.equal(
    rendered,
    'Hey Aarav! You have 2 stamps left at Artisan Brews. Claim REWARD-FREE99 at http://localhost:5173/c/artisan-brews!'
  );
});

test('renderTemplate handles null/undefined template and untouched tags', () => {
  assert.equal(renderTemplate(''), '');
  assert.equal(renderTemplate(null), '');
  assert.equal(renderTemplate('Hello {unknownTag}', {}), 'Hello {unknownTag}');
});

test('generateWhatsAppUrl formats 10-digit phone with 91 prefix and encodes text', () => {
  const url = generateWhatsAppUrl('9876543210', 'Hey Aarav! ☕ Coffee time!');
  assert.ok(url.startsWith('https://wa.me/919876543210?text='));
  assert.ok(url.includes(encodeURIComponent('Hey Aarav! ☕ Coffee time!')));

  // Pre-formatted international numbers
  const intlUrl = generateWhatsAppUrl('+919876543210', 'Hello');
  assert.ok(intlUrl.startsWith('https://wa.me/919876543210?text=Hello'));
});

test('checkCooldown correctly calculates cooldown period and anti-spam gates', () => {
  const now = new Date('2026-09-26T12:00:00Z');

  // Case 1: No previous notifications
  const emptyCheck = checkCooldown([], 7, now);
  assert.equal(emptyCheck.inCooldown, false);
  assert.equal(emptyCheck.daysSinceLastNotice, null);

  // Case 2: Sent 2 days ago, rule has 7-day cooldown -> In cooldown
  const twoDaysAgo = new Date('2026-09-24T12:00:00Z');
  const recentLogs = [{ sentAt: twoDaysAgo }];
  const recentCheck = checkCooldown(recentLogs, 7, now);
  assert.equal(recentCheck.inCooldown, true);
  assert.equal(recentCheck.daysSinceLastNotice, 2);
  assert.ok(recentCheck.cooldownUntil instanceof Date);

  // Case 3: Sent 10 days ago, rule has 7-day cooldown -> Not in cooldown
  const tenDaysAgo = new Date('2026-09-16T12:00:00Z');
  const oldLogs = [{ sentAt: tenDaysAgo }];
  const oldCheck = checkCooldown(oldLogs, 7, now);
  assert.equal(oldCheck.inCooldown, false);
  assert.equal(oldCheck.daysSinceLastNotice, 10);
});

test('scanAudienceForCafe flags inactive diners and near-reward candidates', async () => {
  const now = new Date('2026-09-26T12:00:00Z');

  const mockCafe = {
    id: 'cafe-1',
    name: 'Espresso Lounge',
    slug: 'espresso-lounge',
    loyaltyVisitsRequired: 8,
  };

  const mockRules = [
    {
      id: 'rule-near',
      name: 'Near Reward',
      triggerType: 'near_reward',
      daysThreshold: 5,
      channel: 'whatsapp',
      messageTemplate: 'Hey {customerName}, only {stampsLeft} stamps to go!',
      cooldownDays: 7,
      enabled: true,
    },
    {
      id: 'rule-inactive',
      name: 'Inactive Diner',
      triggerType: 'inactive_days',
      daysThreshold: 14,
      channel: 'whatsapp',
      messageTemplate: 'Hey {customerName}, we miss you at {cafeName}!',
      cooldownDays: 14,
      enabled: true,
    },
  ];

  // Customer A: 7 visits (1 stamp away from 8), last visit 6 days ago -> matches near_reward
  const sixDaysAgo = new Date('2026-09-20T12:00:00Z');
  const custA = {
    id: 'cust-a',
    name: 'Priya Sharma',
    phone: '9876543211',
    email: 'priya@example.com',
    visits: 7,
    createdAt: new Date('2026-01-01'),
    orders: [{ createdAt: sixDaysAgo, paymentStatus: 'paid' }],
    rewards: [],
    notificationLogs: [],
  };

  // Customer B: 2 visits, last visit 20 days ago -> matches inactive_days
  const twentyDaysAgo = new Date('2026-09-06T12:00:00Z');
  const custB = {
    id: 'cust-b',
    name: 'Rohan Verma',
    phone: '9876543212',
    email: 'rohan@example.com',
    visits: 2,
    createdAt: new Date('2026-01-01'),
    orders: [{ createdAt: twentyDaysAgo, paymentStatus: 'paid' }],
    rewards: [],
    notificationLogs: [],
  };

  const result = await scanAudienceForCafe('cafe-1', {
    CafeModel: { findByPk: async () => mockCafe },
    ReminderRuleModel: { findAll: async () => mockRules },
    CustomerModel: { findAll: async () => [custA, custB] },
    now,
  });

  assert.equal(result.candidates.length, 2);
  assert.equal(result.stats.ready, 2);
  assert.equal(result.stats.inCooldown, 0);

  const priya = result.candidates.find(c => c.customerId === 'cust-a');
  assert.ok(priya);
  assert.equal(priya.triggerType, 'near_reward');
  assert.equal(priya.stampsLeft, 1);
  assert.equal(priya.renderedMessage, 'Hey Priya Sharma, only 1 stamps to go!');

  const rohan = result.candidates.find(c => c.customerId === 'cust-b');
  assert.ok(rohan);
  assert.equal(rohan.triggerType, 'inactive_days');
  assert.equal(rohan.renderedMessage, 'Hey Rohan Verma, we miss you at Espresso Lounge!');
});

test('dispatchReminder creates log and blocks on active cooldown unless forced', async () => {
  const now = new Date('2026-09-26T12:00:00Z');
  const twoDaysAgo = new Date('2026-09-24T12:00:00Z');

  const mockCafe = { id: 'cafe-1', name: 'Espresso Lounge', slug: 'espresso-lounge', loyaltyVisitsRequired: 8 };
  const mockCustomer = { id: 'cust-1', name: 'Ananya', phone: '9876543213', visits: 3, cafeId: 'cafe-1' };
  const mockRule = { id: 'rule-1', cooldownDays: 7, messageTemplate: 'Hello {customerName}' };

  const createdLogs = [];

  // Attempt 1: Customer has a log from 2 days ago -> throws 429
  await assert.rejects(
    async () => {
      await dispatchReminder({
        cafeId: 'cafe-1',
        customerId: 'cust-1',
        ruleId: 'rule-1',
        force: false,
        CafeModel: { findByPk: async () => mockCafe },
        CustomerModel: { findOne: async () => mockCustomer },
        ReminderRuleModel: { findOne: async () => mockRule },
        NotificationLogModel: {
          findAll: async () => [{ sentAt: twoDaysAgo }],
          create: async (data) => createdLogs.push(data),
        },
        now,
      });
    },
    (err) => err.status === 429 && err.message.includes('cooldown')
  );

  // Attempt 2: Same customer with force: true -> succeeds and creates log
  const res = await dispatchReminder({
    cafeId: 'cafe-1',
    customerId: 'cust-1',
    ruleId: 'rule-1',
    force: true,
    CafeModel: { findByPk: async () => mockCafe },
    CustomerModel: { findOne: async () => mockCustomer },
    ReminderRuleModel: { findOne: async () => mockRule },
    NotificationLogModel: {
      findAll: async () => [{ sentAt: twoDaysAgo }],
      create: async (data) => {
        const item = { id: 'log-101', ...data };
        createdLogs.push(item);
        return item;
      },
    },
    now,
  });

  assert.equal(res.success, true);
  assert.equal(createdLogs.length, 1);
  assert.equal(createdLogs[0].customerId, 'cust-1');
  assert.equal(createdLogs[0].status, 'sent');
  assert.ok(res.whatsAppUrl.includes('https://wa.me/919876543213'));
});

import { Op } from 'sequelize';
import { Cafe, Customer, Order, Reward, ReminderRule, NotificationLog } from './models.js';

/**
 * Replace placeholders like {customerName}, {cafeName}, {stampsLeft}, {menuUrl}
 */
export function renderTemplate(template, data = {}) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : match;
  });
}

/**
 * Format phone number and return WhatsApp Direct link
 */
export function generateWhatsAppUrl(phone, message) {
  if (!phone) return '';
  let clean = String(phone).replace(/\D/g, '');
  if (clean.length === 10) {
    clean = '91' + clean;
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

/**
 * Check if a customer is within anti-spam cooldown window
 */
export function checkCooldown(logs = [], cooldownDays = 7, now = new Date()) {
  if (!logs || logs.length === 0) return { inCooldown: false, daysSinceLastNotice: null };
  const sorted = [...logs].sort((a, b) => new Date(b.sentAt || b.createdAt) - new Date(a.sentAt || a.createdAt));
  const latest = sorted[0];
  const lastTime = new Date(latest.sentAt || latest.createdAt).getTime();
  const diffMs = now.getTime() - lastTime;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const inCooldown = diffDays < cooldownDays;
  const cooldownUntil = inCooldown ? new Date(lastTime + cooldownDays * 24 * 60 * 60 * 1000) : null;
  return { inCooldown, daysSinceLastNotice: diffDays, cooldownUntil };
}

/**
 * Scan all customers for a cafe against active reminder rules
 */
export async function scanAudienceForCafe(cafeId, {
  CafeModel = Cafe,
  CustomerModel = Customer,
  OrderModel = Order,
  RewardModel = Reward,
  ReminderRuleModel = ReminderRule,
  NotificationLogModel = NotificationLog,
  now = new Date(),
} = {}) {
  let cafe = await CafeModel.findByPk(cafeId);
  if (!cafe && CafeModel.findOne) {
    cafe = await CafeModel.findOne({ where: { slug: cafeId } });
  }
  if (!cafe) throw new Error('Cafe not found');
  const targetCafeId = cafe.id;

  const rules = await ReminderRuleModel.findAll({
    where: { cafeId: targetCafeId, enabled: true },
    order: [['createdAt', 'ASC']],
  });

  if (rules.length === 0) {
    return { rules: [], candidates: [], stats: { totalCandidates: 0, ready: 0, inCooldown: 0 } };
  }

  const customers = await CustomerModel.findAll({
    where: { cafeId: targetCafeId },
    include: [
      { model: OrderModel, as: 'orders', where: { paymentStatus: 'paid' }, required: false },
      { model: RewardModel, as: 'rewards', required: false },
      { model: NotificationLogModel, as: 'notificationLogs', required: false },
    ],
  });

  const visitsRequired = cafe.loyaltyVisitsRequired || 8;
  const clientBaseUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  const menuUrl = `${clientBaseUrl}/c/${cafe.slug}`;

  const candidates = [];

  for (const cust of customers) {
    const visits = cust.visits || 0;
    const currentStamps = visits % visitsRequired;
    const stampsLeft = visitsRequired - currentStamps;

    // Calculate days since last visit / order
    let lastActivityDate = cust.createdAt;
    if (cust.orders && cust.orders.length > 0) {
      const dates = cust.orders.map(o => new Date(o.createdAt).getTime());
      lastActivityDate = new Date(Math.max(...dates));
    }
    const daysInactive = Math.max(0, Math.floor((now.getTime() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)));

    // Active unredeemed rewards
    const activeRewards = (cust.rewards || []).filter(r => r.status === 'claimed' || r.status === 'available');

    // Test each enabled rule
    for (const rule of rules) {
      let matches = false;
      let reason = '';
      let targetReward = null;

      if (rule.triggerType === 'near_reward') {
        // Customer is 1 or 2 visits away from reward, and has been inactive for rule.daysThreshold
        if (stampsLeft <= 2 && daysInactive >= (rule.daysThreshold || 5)) {
          matches = true;
          reason = `Only ${stampsLeft} stamp${stampsLeft > 1 ? 's' : ''} away from free reward, inactive for ${daysInactive} days`;
        }
      } else if (rule.triggerType === 'inactive_days') {
        // Customer hasn't ordered in threshold days
        if (daysInactive >= (rule.daysThreshold || 14)) {
          matches = true;
          reason = `Lapsed diner: No visit in ${daysInactive} days (threshold: ${rule.daysThreshold}d)`;
        }
      } else if (rule.triggerType === 'expiring_reward') {
        // Any active reward with claimCode expiring within daysThreshold
        const expiring = activeRewards.find(r => {
          if (!r.expiresAt) return false;
          const diffDays = Math.ceil((new Date(r.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= (rule.daysThreshold || 3);
        });
        if (expiring) {
          matches = true;
          targetReward = expiring;
          const left = Math.ceil((new Date(expiring.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          reason = `Reward ${expiring.claimCode || ''} expires in ${left} day${left === 1 ? '' : 's'}`;
        }
      } else if (rule.triggerType === 'first_visit') {
        if (visits === 1 && daysInactive >= 1 && daysInactive <= (rule.daysThreshold || 3)) {
          matches = true;
          reason = `Welcome follow-up after 1st visit (${daysInactive} days ago)`;
        }
      }

      if (matches) {
        const cooldown = checkCooldown(cust.notificationLogs, rule.cooldownDays || 7, now);
        const renderedMessage = renderTemplate(rule.messageTemplate, {
          customerName: cust.name || 'Coffee Lover',
          cafeName: cafe.name,
          stampsLeft,
          currentStamps,
          visitsRequired,
          daysInactive,
          claimCode: targetReward?.claimCode || 'FREE-TREAT',
          expiryDate: targetReward?.expiresAt ? new Date(targetReward.expiresAt).toLocaleDateString() : 'soon',
          menuUrl,
        });

        const whatsAppUrl = generateWhatsAppUrl(cust.phone, renderedMessage);

        candidates.push({
          candidateId: `${cust.id}_${rule.id}`,
          customerId: cust.id,
          customerName: cust.name || 'Guest Diner',
          customerPhone: cust.phone,
          customerEmail: cust.email,
          visits,
          stampsLeft,
          daysInactive,
          ruleId: rule.id,
          ruleName: rule.name,
          triggerType: rule.triggerType,
          channel: rule.channel || 'whatsapp',
          reason,
          renderedMessage,
          whatsAppUrl,
          inCooldown: cooldown.inCooldown,
          daysSinceLastNotice: cooldown.daysSinceLastNotice,
          cooldownUntil: cooldown.cooldownUntil,
          status: cooldown.inCooldown ? 'cooldown' : 'ready',
        });
        break; // Match first applicable rule per customer to avoid duplicates in same run
      }
    }
  }

  const readyCount = candidates.filter(c => c.status === 'ready').length;
  const cooldownCount = candidates.filter(c => c.status === 'cooldown').length;

  return {
    rules,
    candidates,
    stats: {
      totalCandidates: candidates.length,
      ready: readyCount,
      inCooldown: cooldownCount,
    },
  };
}

/**
 * Dispatch a single notification to a customer and record the audit log
 */
export async function dispatchReminder({
  cafeId,
  customerId,
  ruleId = null,
  triggerType = 'manual_nudge',
  channel = 'whatsapp',
  message,
  force = false,
  CafeModel = Cafe,
  CustomerModel = Customer,
  ReminderRuleModel = ReminderRule,
  NotificationLogModel = NotificationLog,
  now = new Date(),
} = {}) {
  let cafe = await CafeModel.findByPk(cafeId);
  if (!cafe && CafeModel.findOne) {
    cafe = await CafeModel.findOne({ where: { slug: cafeId } });
  }
  if (!cafe) throw new Error('Cafe not found');
  const targetCafeId = cafe.id;

  const customer = await CustomerModel.findOne({ where: { id: customerId, cafeId: targetCafeId } });
  if (!customer) throw new Error('Customer not found for this cafe');

  // Cooldown validation
  let rule = null;
  if (ruleId) {
    rule = await ReminderRuleModel.findOne({ where: { id: ruleId, cafeId: targetCafeId } });
  }

  const cooldownDays = rule ? (rule.cooldownDays || 7) : 7;
  const recentLogs = await NotificationLogModel.findAll({
    where: { customerId, cafeId: targetCafeId },
    order: [['sentAt', 'DESC']],
    limit: 5,
  });

  const cooldown = checkCooldown(recentLogs, cooldownDays, now);
  if (cooldown.inCooldown && !force) {
    const err = new Error(`Customer is in notification cooldown for ${cooldownDays} days (last sent ${cooldown.daysSinceLastNotice}d ago).`);
    err.status = 429;
    err.cooldownUntil = cooldown.cooldownUntil;
    throw err;
  }

  const clientBaseUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  const menuUrl = `${clientBaseUrl}/c/${cafe.slug}`;
  const visitsRequired = cafe.loyaltyVisitsRequired || 8;
  const currentStamps = (customer.visits || 0) % visitsRequired;
  const stampsLeft = visitsRequired - currentStamps;

  const finalMessage = message || renderTemplate(rule?.messageTemplate || 'Hey {customerName}! We miss you at {cafeName}. Visit us soon: {menuUrl}', {
    customerName: customer.name || 'Friend',
    cafeName: cafe.name,
    stampsLeft,
    currentStamps,
    visitsRequired,
    menuUrl,
  });

  const whatsAppUrl = generateWhatsAppUrl(customer.phone, finalMessage);

  const log = await NotificationLogModel.create({
    cafeId,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    reminderRuleId: rule?.id || null,
    triggerType: triggerType || rule?.triggerType || 'custom',
    channel: channel || rule?.channel || 'whatsapp',
    messageContent: finalMessage,
    status: 'sent',
    metadata: JSON.stringify({ whatsAppUrl, sentAt: now }),
    sentAt: now,
  });

  return {
    success: true,
    message: `Reminder sent to ${customer.name} via ${channel.toUpperCase()}`,
    log: serializeNotificationLog(log),
    whatsAppUrl,
  };
}

/**
 * Execute automated batch scan and dispatch all ready candidates
 */
export async function runBatchReminders({
  cafeId,
  CafeModel = Cafe,
  CustomerModel = Customer,
  OrderModel = Order,
  RewardModel = Reward,
  ReminderRuleModel = ReminderRule,
  NotificationLogModel = NotificationLog,
  now = new Date(),
} = {}) {
  const scan = await scanAudienceForCafe(cafeId, {
    CafeModel,
    CustomerModel,
    OrderModel,
    RewardModel,
    ReminderRuleModel,
    NotificationLogModel,
    now,
  });

  const ready = scan.candidates.filter(c => c.status === 'ready');
  const dispatched = [];
  const errors = [];

  for (const cand of ready) {
    try {
      const res = await dispatchReminder({
        cafeId,
        customerId: cand.customerId,
        ruleId: cand.ruleId,
        triggerType: cand.triggerType,
        channel: cand.channel,
        message: cand.renderedMessage,
        force: false,
        CafeModel,
        CustomerModel,
        ReminderRuleModel,
        NotificationLogModel,
        now,
      });
      dispatched.push(res);
    } catch (err) {
      errors.push({ customerId: cand.customerId, error: err.message });
    }
  }

  return {
    success: true,
    totalScanned: scan.candidates.length,
    sentCount: dispatched.length,
    skippedCooldownCount: scan.stats.inCooldown,
    errors,
  };
}

/**
 * Serializer for logs
 */
export function serializeNotificationLog(log) {
  if (!log) return null;
  let meta = {};
  try {
    meta = log.metadata ? (typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata) : {};
  } catch {
    meta = {};
  }
  return {
    id: log.id,
    customerId: log.customerId,
    customerName: log.customerName,
    customerPhone: log.customerPhone,
    reminderRuleId: log.reminderRuleId,
    triggerType: log.triggerType,
    channel: log.channel,
    status: log.status,
    messageContent: log.messageContent,
    sentAt: log.sentAt,
    whatsAppUrl: meta.whatsAppUrl || generateWhatsAppUrl(log.customerPhone, log.messageContent),
  };
}

export function serializeReminderRule(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    triggerType: r.triggerType,
    daysThreshold: r.daysThreshold,
    channel: r.channel,
    messageTemplate: r.messageTemplate,
    cooldownDays: r.cooldownDays,
    enabled: Boolean(r.enabled),
    cafeId: r.cafeId,
    createdAt: r.createdAt,
  };
}

import { sequelize } from './db.js';

export async function ensureAiRoasterySchema() {
  const qi = sequelize.getQueryInterface();

  async function safeAddColumn(table, column, definition) {
    try {
      const desc = await qi.describeTable(table);
      if (!desc[column]) {
        await qi.addColumn(table, column, definition);
      }
    } catch {
      // Table might not exist yet or column already present
    }
  }

  // 1. AI Menu Engineering Snapshots (BCG Matrix: Stars, Plowhorses, Puzzles, Dogs)
  await qi.createTable('ai_menu_snapshots', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    snapshotDate: { type: 'DATEONLY', allowNull: false },
    totalItemsAnalyzed: { type: 'INT', defaultValue: 0 },
    starsCount: { type: 'INT', defaultValue: 0 },
    plowhorsesCount: { type: 'INT', defaultValue: 0 },
    puzzlesCount: { type: 'INT', defaultValue: 0 },
    dogsCount: { type: 'INT', defaultValue: 0 },
    averageMargin: { type: 'FLOAT', defaultValue: 0 },
    averageVolume: { type: 'FLOAT', defaultValue: 0 },
    totalVolume: { type: 'INT', defaultValue: 0 },
    totalRevenue: { type: 'FLOAT', defaultValue: 0 },
    totalContribution: { type: 'FLOAT', defaultValue: 0 },
    healthScore: { type: 'FLOAT', defaultValue: 80 },
    itemsData: { type: 'LONGTEXT', allowNull: true }, // JSON array of analyzed items
    categoryBreakdown: { type: 'LONGTEXT', allowNull: true }, // JSON
    actionableInsights: { type: 'LONGTEXT', allowNull: true }, // JSON array of recommendations
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }).catch(() => {});

  await safeAddColumn('ai_menu_snapshots', 'totalVolume', { type: sequelize.Sequelize.INTEGER, defaultValue: 0 });
  await safeAddColumn('ai_menu_snapshots', 'totalRevenue', { type: sequelize.Sequelize.FLOAT, defaultValue: 0 });
  await safeAddColumn('ai_menu_snapshots', 'totalContribution', { type: sequelize.Sequelize.FLOAT, defaultValue: 0 });

  // 2. Predictive Prep & Rush Forecasting (Batch & Prep Advisor)
  await qi.createTable('ai_prep_forecasts', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    targetDate: { type: 'DATEONLY', allowNull: false },
    dayOfWeek: { type: 'VARCHAR(20)', defaultValue: 'Monday' },
    expectedTotalOrders: { type: 'INT', defaultValue: 0 },
    expectedRevenue: { type: 'FLOAT', defaultValue: 0 },
    weatherCondition: { type: 'VARCHAR(50)', defaultValue: 'Sunny' },
    isHoliday: { type: 'TINYINT(1)', defaultValue: 0 },
    prepRecommendations: { type: 'LONGTEXT', allowNull: true }, // JSON
    hourlyRushHeatmap: { type: 'LONGTEXT', allowNull: true }, // JSON
    status: {
      type: 'VARCHAR(30)',
      defaultValue: 'draft', // 'draft', 'acknowledged', 'completed'
    },
    actualConsumption: { type: 'LONGTEXT', allowNull: true }, // JSON
    acknowledgedBy: { type: 'VARCHAR(100)', allowNull: true },
    acknowledgedAt: { type: 'DATETIME', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }).catch(() => {});

  // 3. Smart POS & QR Dynamic Affinity Rules (Apriori Market Basket Engine)
  await qi.createTable('ai_affinity_rules', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    primaryMenuItemId: { type: 'CHAR(36)', allowNull: false },
    primaryItemName: { type: 'VARCHAR(255)', allowNull: false },
    pairedMenuItemId: { type: 'CHAR(36)', allowNull: false },
    pairedItemName: { type: 'VARCHAR(255)', allowNull: false },
    coOccurrenceCount: { type: 'INT', defaultValue: 1 },
    support: { type: 'FLOAT', defaultValue: 0.05 },
    confidence: { type: 'FLOAT', defaultValue: 0.5 },
    lift: { type: 'FLOAT', defaultValue: 1.5 },
    pairingDiscount: { type: 'FLOAT', defaultValue: 0 },
    customPitchText: { type: 'VARCHAR(500)', allowNull: true },
    isActive: { type: 'TINYINT(1)', defaultValue: 1 },
    lastMinedAt: { type: 'DATETIME', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }).catch(() => {});

  // 4. AI Autonomous Marketing & Guest Win-Back Campaigns
  await qi.createTable('ai_marketing_campaigns', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    name: { type: 'VARCHAR(255)', allowNull: false },
    campaignType: {
      type: 'VARCHAR(50)',
      defaultValue: 'churn_winback', // 'churn_winback', 'vip_loyalty_booster', 'weekend_regular_nudge', 'new_guest_repeat', 'custom_broadcast'
    },
    targetSegment: {
      type: 'VARCHAR(50)',
      defaultValue: 'at_risk', // 'champions', 'loyal_regulars', 'at_risk', 'hibernating', 'new_explorers', 'all'
    },
    channel: {
      type: 'VARCHAR(30)',
      defaultValue: 'whatsapp', // 'whatsapp', 'sms', 'omnichannel'
    },
    promoCodeId: { type: 'CHAR(36)', allowNull: true },
    promoCode: { type: 'VARCHAR(50)', allowNull: true },
    discountPercent: { type: 'FLOAT', defaultValue: 15 },
    messageTemplate: { type: 'TEXT', allowNull: false },
    targetAudienceCount: { type: 'INT', defaultValue: 0 },
    sentCount: { type: 'INT', defaultValue: 0 },
    deliveredCount: { type: 'INT', defaultValue: 0 },
    readCount: { type: 'INT', defaultValue: 0 },
    redeemedCount: { type: 'INT', defaultValue: 0 },
    attributedRevenue: { type: 'FLOAT', defaultValue: 0 },
    status: {
      type: 'VARCHAR(30)',
      defaultValue: 'draft', // 'draft', 'scheduled', 'sending', 'completed', 'active'
    },
    triggerMode: {
      type: 'VARCHAR(30)',
      defaultValue: 'manual_blast', // 'manual_blast', 'autonomous_autopilot'
    },
    scheduledAt: { type: 'DATETIME', allowNull: true },
    lastExecutedAt: { type: 'DATETIME', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }).catch(() => {});

  // 5. AI Campaign Recipients & Conversion Ledger
  await qi.createTable('ai_campaign_recipients', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    campaignId: { type: 'CHAR(36)', allowNull: false },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    customerId: { type: 'CHAR(36)', allowNull: true },
    customerName: { type: 'VARCHAR(100)', allowNull: false },
    phone: { type: 'VARCHAR(50)', allowNull: false },
    rfmSegment: { type: 'VARCHAR(50)', defaultValue: 'at_risk' },
    customizedMessage: { type: 'TEXT', allowNull: true },
    deliveryStatus: {
      type: 'VARCHAR(30)',
      defaultValue: 'queued', // 'queued', 'sent', 'delivered', 'failed'
    },
    sentAt: { type: 'DATETIME', allowNull: true },
    redeemed: { type: 'TINYINT(1)', defaultValue: 0 },
    redeemedOrderId: { type: 'CHAR(36)', allowNull: true },
    redeemedAt: { type: 'DATETIME', allowNull: true },
    orderAmount: { type: 'FLOAT', defaultValue: 0 },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }).catch(() => {});
}

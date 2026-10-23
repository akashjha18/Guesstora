import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  AiAffinityRule,
  AiCampaignRecipient,
  AiMarketingCampaign,
  AiMenuSnapshot,
  AiPrepForecast,
  Cafe,
  Customer,
  InventoryItem,
  MenuItem,
  Order,
  OrderItem,
  PromoCode,
  RecipeItem,
} from '../src/models.js';
import {
  analyzeMenuEngineering,
  computeRfmSegments,
  createWinbackCampaign,
  generatePrepForecast,
  getDynamicUpsellSuggestions,
  launchCampaignBroadcast,
  mineAffinityRules,
  simulatePriceAdjustments,
  trackCampaignRedemption,
} from '../src/aiRoasteryEngine.js';
import { ensureAiRoasterySchema } from '../src/schemaAiRoastery.js';

describe('Phase 12: Beyond Petpooja - AI Roastery OS & Intelligent Automation', () => {
  let testCafe;
  let flatWhiteItem;
  let coldBrewItem;
  let almondCroissantItem;
  let houseBlendBagItem;

  before(async () => {
    await ensureAiRoasterySchema();

    testCafe = await Cafe.create({
      name: 'GUESTORA Specialty Roastery Lab',
      slug: `gusstora-roastery-lab-${Date.now()}`,
      phone: '9811223344',
      address: 'Indiranagar 100ft Road, Bengaluru',
    });

    // Create test menu items
    flatWhiteItem = await MenuItem.create({
      cafeId: testCafe.id,
      name: 'Artisan Flat White',
      category: 'Specialty Coffee',
      price: 240,
      available: true,
    });

    coldBrewItem = await MenuItem.create({
      cafeId: testCafe.id,
      name: 'Nitro Cascara Cold Brew',
      category: 'Specialty Coffee',
      price: 290,
      available: true,
    });

    almondCroissantItem = await MenuItem.create({
      cafeId: testCafe.id,
      name: 'Double-Baked Almond Croissant',
      category: 'Bakery',
      price: 210,
      available: true,
    });

    houseBlendBagItem = await MenuItem.create({
      cafeId: testCafe.id,
      name: 'Monsoon Malabar Whole Beans 250g',
      category: 'Retail Beans',
      price: 580,
      available: true,
    });

    // Create some completed orders to generate historical sales and co-occurrences
    const o1 = await Order.create({
      cafeId: testCafe.id,
      orderNo: `ORD-${Date.now()}-1`,
      customerName: 'Kavya Rao',
      phone: '9876500001',
      subtotal: 450,
      total: 450,
      status: 'completed',
    });
    await OrderItem.create({
      orderId: o1.id,
      menuItemId: flatWhiteItem.id,
      name: flatWhiteItem.name,
      price: flatWhiteItem.price,
      quantity: 1,
    });
    await OrderItem.create({
      orderId: o1.id,
      menuItemId: almondCroissantItem.id,
      name: almondCroissantItem.name,
      price: almondCroissantItem.price,
      quantity: 1,
    });

    const o2 = await Order.create({
      cafeId: testCafe.id,
      orderNo: `ORD-${Date.now()}-2`,
      customerName: 'Kavya Rao',
      phone: '9876500001',
      subtotal: 500,
      total: 500,
      status: 'completed',
    });
    await OrderItem.create({
      orderId: o2.id,
      menuItemId: flatWhiteItem.id,
      name: flatWhiteItem.name,
      price: flatWhiteItem.price,
      quantity: 1,
    });
    await OrderItem.create({
      orderId: o2.id,
      menuItemId: almondCroissantItem.id,
      name: almondCroissantItem.name,
      price: almondCroissantItem.price,
      quantity: 1,
    });

    const o3 = await Order.create({
      cafeId: testCafe.id,
      orderNo: `ORD-${Date.now()}-3`,
      customerName: 'Rohan Mehta',
      phone: '9876500002',
      subtotal: 290,
      total: 290,
      status: 'completed',
    });
    await OrderItem.create({
      orderId: o3.id,
      menuItemId: coldBrewItem.id,
      name: coldBrewItem.name,
      price: coldBrewItem.price,
      quantity: 1,
    });

    // Create test customer records for RFM
    await Customer.create({
      cafeId: testCafe.id,
      name: 'Kavya Rao',
      phone: '9876500001',
      visits: 5,
    });

    await Customer.create({
      cafeId: testCafe.id,
      name: 'Rohan Mehta',
      phone: '9876500002',
      visits: 2,
    });

    await Customer.create({
      cafeId: testCafe.id,
      name: 'Sunita Patil',
      phone: '9876500003',
      visits: 8,
    });
  });

  after(async () => {
    // Cleanup created test records
    await AiCampaignRecipient.destroy({ where: { cafeId: testCafe.id } });
    await AiMarketingCampaign.destroy({ where: { cafeId: testCafe.id } });
    await AiAffinityRule.destroy({ where: { cafeId: testCafe.id } });
    await AiPrepForecast.destroy({ where: { cafeId: testCafe.id } });
    await AiMenuSnapshot.destroy({ where: { cafeId: testCafe.id } });
    await OrderItem.destroy({ where: { menuItemId: [flatWhiteItem.id, coldBrewItem.id, almondCroissantItem.id, houseBlendBagItem.id] } });
    await Order.destroy({ where: { cafeId: testCafe.id } });
    await Customer.destroy({ where: { cafeId: testCafe.id } });
    await MenuItem.destroy({ where: { cafeId: testCafe.id } });
    await Cafe.destroy({ where: { id: testCafe.id } });
  });

  // ==========================================================================
  // Pillar 1: AI Menu Engineering & BCG Matrix Analysis
  // ==========================================================================
  describe('1. AI Menu Engineering & BCG Matrix Profitability Engine', () => {
    it('analyzes menu items, computes margins and assigns BCG classifications', async () => {
      const result = await analyzeMenuEngineering({ cafeId: testCafe.id });

      assert.equal(result.totalItemsAnalyzed, 4, 'Should analyze only this cafe’s menu items');
      assert.ok(result.averageMargin > 0, 'Average margin must be positive');
      assert.ok(typeof result.healthScore === 'number', 'Health score must be a number');
      assert.ok(result.healthScore >= 0 && result.healthScore <= 100, 'Health score between 0 and 100');

      // Check item structure
      const flatWhite = result.itemsData.find(i => i.menuItemId === flatWhiteItem.id);
      assert.ok(flatWhite, 'Artisan Flat White should be in analyzed items');
      assert.ok(flatWhite.margin > 0, 'Margin should be calculated');
      assert.ok(flatWhite.volume >= 2, 'Volume should reflect historical orders');
      assert.ok(['star', 'plowhorse', 'puzzle', 'dog'].includes(flatWhite.classification), 'Should have valid BCG quadrant');
      assert.ok(Array.isArray(flatWhite.recommendations), 'Should contain recommendations');
    });

    it('simulates price adjustments and projects revenue and profit delta', () => {
      const sampleItems = [
        { menuItemId: 'item-1', name: 'Latte', price: 200, foodCost: 40, volume: 100 },
        { menuItemId: 'item-2', name: 'Croissant', price: 150, foodCost: 45, volume: 80 },
      ];

      const simulation = simulatePriceAdjustments({
        items: sampleItems,
        adjustments: [
          { menuItemId: 'item-1', newPrice: 220 }, // +₹20 price increase
        ],
      });

      assert.equal(simulation.originalRevenue, 32000);
      assert.ok(simulation.simulatedRevenue > simulation.originalRevenue, 'Revenue should increase');
      assert.ok(simulation.profitDelta > 0, 'Profit delta should be positive');
      assert.equal(simulation.items[0].simulatedPrice, 220);
    });
  });

  // ==========================================================================
  // Pillar 2: Predictive Prep & Rush Forecasting
  // ==========================================================================
  describe('2. Predictive Prep & Rush Hour Forecasting', () => {
    it('generates morning prep quantities for 9 core roastery staples with safety buffer', async () => {
      const forecast = await generatePrepForecast({
        cafeId: testCafe.id,
        targetDate: '2026-10-15',
        weatherCondition: 'Sunny',
        isHoliday: false,
      });

      assert.equal(forecast.targetDate, '2026-10-15');
      assert.ok(forecast.expectedTotalOrders > 0, 'Expected orders should be computed');
      assert.equal(forecast.prepRecommendations.length, 9, 'Should cover all 9 staple prep categories');

      // Verify specific staple entries
      const milk = forecast.prepRecommendations.find(p => p.itemName.includes('Whole Milk'));
      assert.ok(milk, 'Whole Milk should be present');
      assert.ok(milk.suggestedBatchQty > 0, 'Milk batch qty should be positive');
      assert.equal(milk.unit, 'Liters');
      assert.equal(milk.safetyBufferPercent, 12);

      const coldBrew = forecast.prepRecommendations.find(p => p.itemName.includes('Cold Brew'));
      assert.ok(coldBrew, 'Cold Brew should be present');
      assert.ok(coldBrew.confidenceScore > 80, 'Confidence score should be high');
    });

    it('adjusts prep recommendations for weather modifiers', async () => {
      const sunnyForecast = await generatePrepForecast({
        cafeId: testCafe.id,
        weatherCondition: 'High Heat',
      });

      const rainyForecast = await generatePrepForecast({
        cafeId: testCafe.id,
        weatherCondition: 'Rainy',
      });

      const sunnyColdBrew = sunnyForecast.prepRecommendations.find(p => p.itemName.includes('Cold Brew'));
      const rainyColdBrew = rainyForecast.prepRecommendations.find(p => p.itemName.includes('Cold Brew'));

      assert.ok(
        sunnyColdBrew.suggestedBatchQty >= rainyColdBrew.suggestedBatchQty,
        'Cold Brew demand should be higher in hot weather than rainy'
      );
    });

    it('generates 24-hour hourly rush curve with staffing recommendations', async () => {
      const forecast = await generatePrepForecast({ cafeId: testCafe.id });
      assert.equal(forecast.hourlyRushHeatmap.length, 24, 'Should contain 24 hour slots');

      const morningRush = forecast.hourlyRushHeatmap[9]; // 9 AM
      assert.equal(morningRush.hour, 9);
      assert.ok(['peak', 'rush', 'moderate'].includes(morningRush.rushLevel), 'Morning should be a rush or peak hour');
      assert.ok(morningRush.recommendedStaffCount >= 3, 'Rush hour should recommend additional staff');
    });
  });

  // ==========================================================================
  // Pillar 3: Smart POS & QR Dynamic Upsell Suggestions (Affinity Rules)
  // ==========================================================================
  describe('3. Smart POS & QR Dynamic Affinity Basket Engine', () => {
    it('mines association rules with support, confidence, and lift metrics', async () => {
      const rules = await mineAffinityRules({
        cafeId: testCafe.id,
        minSupport: 0.01,
        minConfidence: 0.1,
      });

      assert.ok(Array.isArray(rules), 'Mined rules should be an array');
      if (rules.length > 0) {
        const topRule = rules[0];
        assert.ok(topRule.lift >= 1.0, 'Mined lift should be greater than or equal to 1.0');
        assert.ok(topRule.customPitchText.length > 0, 'Pitch text should be generated');
      }
    });

    it('returns dynamic upsell pairings excluding current cart items', async () => {
      const suggestions = await getDynamicUpsellSuggestions({
        cafeId: testCafe.id,
        currentItemIds: [flatWhiteItem.id],
        limit: 2,
      });

      assert.ok(suggestions.length > 0, 'Should return at least 1 pairing suggestion');
      assert.ok(!suggestions.some(s => s.id === flatWhiteItem.id), 'Should not recommend the item already in cart');
      assert.ok(suggestions[0].comboPrice < suggestions[0].originalPrice, 'Combo price should reflect pairing discount');
      assert.ok(suggestions[0].pitchText.length > 0, 'Pitch text should be present');
    });
  });

  // ==========================================================================
  // Pillar 4: Autonomous Guest Win-Back & Retention Agent (RFM)
  // ==========================================================================
  describe('4. Autonomous Guest Win-Back & Retention Agent (RFM)', () => {
    it('computes RFM segments across customer base accurately', async () => {
      const rfm = await computeRfmSegments({ cafeId: testCafe.id });

      assert.ok(rfm.totalCustomers >= 3, 'Should segment all customers');
      assert.ok(Array.isArray(rfm.segments.champions), 'Champions list should exist');
      assert.ok(Array.isArray(rfm.segments.at_risk), 'At-risk list should exist');
      assert.ok(Array.isArray(rfm.segments.new_explorers), 'New explorers list should exist');

      // Verify customer record payload
      const allDiners = [
        ...rfm.segments.champions,
        ...rfm.segments.loyal_regulars,
        ...rfm.segments.at_risk,
        ...rfm.segments.hibernating,
        ...rfm.segments.new_explorers,
      ];
      assert.ok(allDiners.some(d => d.phone === '9876500001'), 'Kavya Rao should be present');
    });

    it('creates an automated win-back campaign with promo code and recipients', async () => {
      const campaignResult = await createWinbackCampaign({
        cafeId: testCafe.id,
        name: 'VIP Guest Appreciation Campaign',
        campaignType: 'churn_winback',
        targetSegment: 'at_risk',
        discountPercent: 20,
      });

      assert.ok(campaignResult.campaign, 'Campaign model instance should be created');
      assert.ok(campaignResult.promoCode.startsWith('WINBACK20-'), 'Generated code should have prefix and discount');

      // Verify campaign was saved in DB
      const dbCampaign = await AiMarketingCampaign.findByPk(campaignResult.campaign.id);
      assert.ok(dbCampaign, 'Campaign must be found in database');
      assert.equal(dbCampaign.discountPercent, 20);

      // Verify linked PromoCode exists
      const dbPromo = await PromoCode.findOne({ where: { code: campaignResult.promoCode } });
      assert.ok(dbPromo, 'PromoCode record should exist in database');
      assert.equal(dbPromo.discountValue, 20);
    });

    it('launches campaign broadcast and updates delivery statuses', async () => {
      const created = await createWinbackCampaign({
        cafeId: testCafe.id,
        name: 'Weekend Regular Nudge',
        targetSegment: 'new_explorers',
        discountPercent: 15,
      });

      const broadcastResult = await launchCampaignBroadcast({ campaignId: created.campaign.id });
      assert.equal(broadcastResult.status, 'completed');

      const updatedCampaign = await AiMarketingCampaign.findByPk(created.campaign.id);
      assert.equal(updatedCampaign.status, 'completed');
      assert.ok(updatedCampaign.sentCount >= 0);
    });

    it('tracks campaign conversion and attributes revenue upon promo redemption', async () => {
      const created = await createWinbackCampaign({
        cafeId: testCafe.id,
        name: 'Win-Back Conversion Test',
        targetSegment: 'new_explorers',
        discountPercent: 25,
      });

      const trackResult = await trackCampaignRedemption({
        cafeId: testCafe.id,
        promoCode: created.promoCode,
        orderId: 'test-order-999',
        orderAmount: 640,
        phone: '9876500002',
      });

      assert.ok(trackResult, 'Redemption result should be returned');
      assert.equal(trackResult.redeemedCount, 1);
      assert.equal(trackResult.attributedRevenue, 640);

      const dbCampaign = await AiMarketingCampaign.findByPk(created.campaign.id);
      assert.equal(dbCampaign.redeemedCount, 1);
      assert.equal(dbCampaign.attributedRevenue, 640);
    });
  });
});

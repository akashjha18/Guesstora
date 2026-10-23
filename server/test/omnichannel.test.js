import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  Cafe,
  Order,
  OrderItem,
  Customer,
  MenuItem,
  Brand,
  DeliveryChannel,
  WhatsAppConfig,
  NotificationLog,
  InventoryItem,
  RecipeItem
} from '../src/models.js';
import {
  ingestAggregatorOrder,
  dispatchWhatsAppCloudMessage,
  getBrandOverview,
  syncBrandMenuToOutlets
} from '../src/omnichannelEngine.js';
import { ensureOmnichannelSchema } from '../src/schemaOmnichannel.js';

describe('Phase 5: Omnichannel & Enterprise Scale Engine', () => {
  let testCafe;
  let sisterCafe;
  let testBrand;
  let testMenuItem;

  before(async () => {
    // Ensure Phase 5 tables & schema exist
    await ensureOmnichannelSchema();

    // Setup test brand and cafes
    testBrand = await Brand.create({
      name: 'Omni Test Roasters',
      slug: `omni-brand-${Date.now()}`,
      headquarters: 'Bandra West',
    });

    testCafe = await Cafe.create({
      name: 'Omni Outlet 1',
      slug: `omni-outlet-1-${Date.now()}`,
      tables: 10,
      currency: 'INR',
      brandId: testBrand.id,
    });

    sisterCafe = await Cafe.create({
      name: 'Omni Outlet 2',
      slug: `omni-outlet-2-${Date.now()}`,
      tables: 6,
      currency: 'INR',
      brandId: testBrand.id,
    });

    testMenuItem = await MenuItem.create({
      cafeId: testCafe.id,
      name: 'Omni Specialty Flat White',
      price: 240,
      category: 'Coffee',
      available: true,
    });

    // Configure Delivery Channels
    await DeliveryChannel.create({
      cafeId: testCafe.id,
      channel: 'zomato',
      status: 'online',
      commissionRate: 18.0,
      autoAccept: true,
      storeId: 'ZOM-TEST-01',
    });

    await DeliveryChannel.create({
      cafeId: testCafe.id,
      channel: 'swiggy',
      status: 'offline', // purposely offline for negative test
      commissionRate: 20.0,
      autoAccept: true,
      storeId: 'SWG-TEST-01',
    });

    // Configure WhatsApp
    await WhatsAppConfig.create({
      cafeId: testCafe.id,
      status: 'mock',
      autoOrderConfirmation: true,
      autoOrderReady: true,
      autoLoyaltyAlerts: true,
    });
  });

  after(async () => {
    // Cleanup
    try {
      await NotificationLog.destroy({ where: { cafeId: testCafe.id } });
      await OrderItem.destroy({ where: {} });
      await Order.destroy({ where: { cafeId: [testCafe.id, sisterCafe.id] } });
      await MenuItem.destroy({ where: { cafeId: [testCafe.id, sisterCafe.id] } });
      await DeliveryChannel.destroy({ where: { cafeId: [testCafe.id, sisterCafe.id] } });
      await WhatsAppConfig.destroy({ where: { cafeId: testCafe.id } });
      await Cafe.destroy({ where: { id: [testCafe.id, sisterCafe.id] } });
      await Brand.destroy({ where: { id: testBrand.id } });
    } catch (e) {
      // ignore teardown errors
    }
  });

  it('ingestAggregatorOrder successfully ingests Zomato order and calculates commission', async () => {
    const payload = {
      order_id: 'ZOM-9921',
      customer: {
        name: 'Aarav Mehta',
        phone: '9876543210',
      },
      delivery_person: {
        name: 'Ramesh Rider',
        phone: '9123456789',
      },
      items: [
        { name: 'Omni Specialty Flat White', quantity: 2, price: 240 },
      ],
      discount: 40,
    };

    const res = await ingestAggregatorOrder({
      cafeId: testCafe.id,
      channel: 'zomato',
      payload,
    });

    assert.equal(res.success, true);
    assert.equal(res.channel, 'zomato');
    assert.equal(res.order.customerName, 'Aarav Mehta');
    assert.equal(res.order.subtotal, 480);
    assert.equal(res.order.discount, 40);
    assert.equal(res.order.total, 440);
    // 18% of 440 = 79.2
    assert.equal(res.channelCommission, 79.2);
    assert.equal(res.netPayout, 360.8);
    assert.equal(res.rider.name, 'Ramesh Rider');
    assert.equal(res.order.status, 'accepted');
  });

  it('ingestAggregatorOrder blocks incoming order when channel is marked offline', async () => {
    const payload = {
      order_id: 'SWG-8821',
      items: [{ name: 'Omni Specialty Flat White', quantity: 1, price: 240 }],
    };

    await assert.rejects(
      async () => {
        await ingestAggregatorOrder({
          cafeId: testCafe.id,
          channel: 'swiggy',
          payload,
        });
      },
      /channel swiggy is currently marked OFFLINE/i
    );
  });

  it('dispatchWhatsAppCloudMessage renders order_confirmed template and records notification log', async () => {
    const res = await dispatchWhatsAppCloudMessage({
      cafeId: testCafe.id,
      toPhone: '9876543210',
      templateType: 'order_confirmed',
      templateParams: {
        orderNo: 'ZOM-102',
        customerName: 'Aarav',
        itemCount: 2,
        total: 440,
      },
    });

    assert.equal(res.success, true);
    assert.equal(res.mode, 'mock');
    assert.match(res.messageText, /GUESTORA Order Confirmed/);
    assert.match(res.messageText, /#ZOM-102/);
    assert.match(res.messageText, /₹440/);

    const log = await NotificationLog.findOne({
      where: { cafeId: testCafe.id, channel: 'whatsapp_cloud' },
      order: [['createdAt', 'DESC']],
    });
    assert.ok(log);
    assert.equal(log.status, 'sent');
  });

  it('getBrandOverview aggregates cross-outlet performance and metrics', async () => {
    const overview = await getBrandOverview({ brandId: testBrand.id });

    assert.equal(overview.hasBrand, true);
    assert.equal(overview.brand.name, 'Omni Test Roasters');
    assert.equal(overview.metrics.totalOutlets, 2);
    assert.ok(overview.metrics.totalOrders >= 1);
    assert.ok(overview.metrics.totalGrossRevenue >= 440);
    assert.equal(overview.outlets.length, 2);
  });

  it('syncBrandMenuToOutlets replicates master catalogue to sister outlet', async () => {
    const res = await syncBrandMenuToOutlets({
      sourceCafeId: testCafe.id,
      targetCafeIds: [sisterCafe.id],
    });

    assert.equal(res.success, true);
    assert.equal(res.details[0].targetCafeId, sisterCafe.id);
    assert.equal(res.details[0].added, 1);

    const sisterItem = await MenuItem.findOne({
      where: { cafeId: sisterCafe.id, name: 'Omni Specialty Flat White' },
    });
    assert.ok(sisterItem);
    assert.equal(sisterItem.price, 240);
  });
});

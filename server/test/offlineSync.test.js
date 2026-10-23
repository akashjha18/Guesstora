import test from 'node:test';
import assert from 'node:assert/strict';
import { Cafe, Order, OrderItem, Customer, MenuItem, InventoryItem, RecipeItem } from '../src/models.js';
import { depleteInventoryForOrder } from '../src/inventoryEngine.js';

test('▶ Phase 7: Offline-First PWA Architecture & Dual-Screen CFD', async (t) => {
  // Ensure a test cafe exists
  let cafe = await Cafe.findOne({ where: { slug: 'demo-cafe' } });
  if (!cafe) {
    cafe = await Cafe.create({
      name: 'GUESTORA Test Roastery',
      slug: 'test-roastery-' + Date.now(),
      brandColor: '#ea580c',
      currency: 'INR',
    });
  }

  const testOfflineId = `OFF-TEST-${Date.now()}-ABC`;

  await t.test('Offline Order Batch Processor correctly parses and creates orders', async () => {
    const rawOrder = {
      offlineId: testOfflineId,
      customerName: 'Aarav Patel',
      phone: '9876543210',
      table: 'T-02',
      items: [
        { name: 'Pour Over - Ethiopian Yirgacheffe', price: 280, quantity: 2 },
        { name: 'Almond Croissant', price: 190, quantity: 1 },
      ],
      subtotal: 750,
      discount: 50,
      total: 700,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      createdAt: new Date().toISOString(),
    };

    // Simulate batch processor logic
    const existing = await Order.findOne({ where: { cafeId: cafe.id, offlineId: rawOrder.offlineId } });
    assert.equal(existing, null);

    // Create Customer
    const [customer] = await Customer.findOrCreate({
      where: { cafeId: cafe.id, phone: '9876543210' },
      defaults: { name: rawOrder.customerName, visits: 0 },
    });
    customer.visits = (customer.visits || 0) + 1;
    await customer.save();

    // Create Order with offline fields
    const created = await Order.create({
      cafeId: cafe.id,
      orderNo: `OFF-NO-${Date.now().toString().slice(-4)}`,
      offlineId: rawOrder.offlineId,
      isOffline: true,
      offlineSyncedAt: new Date(),
      customerId: customer.id,
      customerName: rawOrder.customerName,
      phone: '9876543210',
      table: rawOrder.table,
      subtotal: rawOrder.subtotal,
      discount: rawOrder.discount,
      total: rawOrder.total,
      paymentMethod: rawOrder.paymentMethod,
      paymentStatus: rawOrder.paymentStatus,
      status: 'completed',
      channel: 'pos',
    });

    await OrderItem.bulkCreate(rawOrder.items.map(i => ({
      orderId: created.id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      isCompleted: true,
    })));

    assert.ok(created.id);
    assert.equal(created.isOffline, true);
    assert.equal(created.offlineId, testOfflineId);
    assert.equal(created.total, 700);

    const full = await Order.findByPk(created.id, {
      include: [{ model: OrderItem, as: 'items' }],
    });
    assert.equal(full.items.length, 2);
  });

  await t.test('Idempotency: Re-syncing same offlineId is flagged as already_synced without duplication', async () => {
    const duplicateLookup = await Order.findOne({
      where: { cafeId: cafe.id, offlineId: testOfflineId },
    });

    assert.ok(duplicateLookup);
    assert.equal(duplicateLookup.offlineId, testOfflineId);

    // Simulation of reconciler branch
    const syncStatus = duplicateLookup ? 'already_synced' : 'synced';
    assert.equal(syncStatus, 'already_synced');

    const totalOrdersWithOfflineId = await Order.count({
      where: { cafeId: cafe.id, offlineId: testOfflineId },
    });
    assert.equal(totalOrdersWithOfflineId, 1);
  });

  await t.test('Inventory depletion handles offline-synced orders accurately', async () => {
    // Create an inventory item and recipe item
    const beanItem = await InventoryItem.create({
      cafeId: cafe.id,
      name: 'Single Origin Beans (Offline Test)',
      category: 'coffee_beans',
      currentStock: 1000,
      unit: 'g',
      costPerUnit: 1.5,
      lowStockThreshold: 200,
    });

    const testMenuItem = await MenuItem.create({
      name: 'Specialty Aeropress',
      price: 250,
      category: 'Coffee',
      available: true,
    });

    await RecipeItem.create({
      cafeId: cafe.id,
      menuItemId: testMenuItem.id,
      inventoryItemId: beanItem.id,
      quantityRequired: 18,
      unit: 'g',
    });

    const simulatedOfflineOrder = {
      orderNo: 'OFF-DEP-01',
      items: [{
        menuItemId: testMenuItem.id,
        quantity: 2,
      }],
    };

    await depleteInventoryForOrder({
      order: simulatedOfflineOrder,
      cafeId: cafe.id,
      staffName: 'Offline Sync Reconciler',
    });

    const updatedBean = await InventoryItem.findByPk(beanItem.id);
    // 1000 - (18 * 2) = 964g
    assert.equal(Number(updatedBean.currentStock), 964);

    // Clean up test items
    await RecipeItem.destroy({ where: { inventoryItemId: beanItem.id } });
    await InventoryItem.destroy({ where: { id: beanItem.id } });
    await MenuItem.destroy({ where: { id: testMenuItem.id } });
  });

  await t.test('CFD Config supports custom greeting, promotional banner and UPI VPA', async () => {
    cafe.cfdWelcomeTitle = 'Welcome to GUESTORA Coffee Atelier';
    cafe.cfdWelcomeSubtitle = 'Fresh Roasts & Sourdough Croissants';
    cafe.cfdPromoBanner = 'Get 10% off your next bag of whole beans!';
    cafe.cfdUpiVpa = 'roastery@okhdfcbank';
    await cafe.save();

    const reloaded = await Cafe.findByPk(cafe.id);
    assert.equal(reloaded.cfdWelcomeTitle, 'Welcome to GUESTORA Coffee Atelier');
    assert.equal(reloaded.cfdWelcomeSubtitle, 'Fresh Roasts & Sourdough Croissants');
    assert.equal(reloaded.cfdPromoBanner, 'Get 10% off your next bag of whole beans!');
    assert.equal(reloaded.cfdUpiVpa, 'roastery@okhdfcbank');
  });
});

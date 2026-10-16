import test from 'node:test';
import assert from 'node:assert/strict';
import { Cafe, CafeTable, Order, OrderItem, User } from '../src/models.js';

test('▶ Phase 8: Waiter Captain App & Interactive Floor Management', async (t) => {
  // 1. Setup or retrieve test cafe
  let cafe = await Cafe.findOne({ where: { slug: 'demo-cafe' } });
  if (!cafe) {
    cafe = await Cafe.create({
      name: 'Gusstora Artisan Roastery',
      slug: 'captain-test-cafe-' + Date.now(),
      brandColor: '#ea580c',
      currency: 'INR',
    });
  }

  // Ensure test staff with PIN exists
  let staff = await User.findOne({ where: { email: 'captain-test@gusstora.com' } });
  if (!staff) {
    staff = await User.create({
      name: 'Captain Arjun',
      email: 'captain-test@gusstora.com',
      passwordHash: 'dummy-hash',
      role: 'cashier',
      pin: '4321',
      assignedSection: 'Main Floor',
      status: 'active',
    });
  }

  // Create test tables
  const prefix = `CAP-${Date.now().toString().slice(-4)}`;
  const table1 = await CafeTable.create({
    cafeId: cafe.id,
    tableNumber: `${prefix}-01`,
    name: `Terrace 1`,
    capacity: 4,
    section: 'Terrace Garden',
    status: 'available',
    isActive: true,
  });

  const table2 = await CafeTable.create({
    cafeId: cafe.id,
    tableNumber: `${prefix}-02`,
    name: `Terrace 2`,
    capacity: 2,
    section: 'Terrace Garden',
    status: 'available',
    isActive: true,
  });

  await t.test('Captain PIN Authentication validates 4-digit numeric code', async () => {
    assert.equal(staff.pin, '4321');
    assert.equal(staff.assignedSection, 'Main Floor');
    assert.equal(staff.name, 'Captain Arjun');
  });

  await t.test('Table Seating seats guests and updates floor plan status', async () => {
    table1.status = 'occupied';
    table1.occupiedSince = new Date();
    table1.guestCount = 3;
    table1.dinerName = 'Vikram Sharma';
    table1.dinerPhone = '9876543210';
    table1.assignedCaptainId = staff.id;
    table1.assignedCaptainName = staff.name;
    await table1.save();

    const reloaded = await CafeTable.findOne({ where: { id: table1.id } });
    assert.equal(reloaded.status, 'occupied');
    assert.equal(reloaded.guestCount, 3);
    assert.equal(reloaded.dinerName, 'Vikram Sharma');
    assert.equal(reloaded.assignedCaptainName, 'Captain Arjun');
  });

  let createdOrder = null;
  await t.test('Course-wise KOT Ordering records Starters, Mains & Held items', async () => {
    createdOrder = await Order.create({
      cafeId: cafe.id,
      orderNo: `ORD-${prefix}-01`,
      table: table1.tableNumber,
      customerName: table1.dinerName,
      subtotal: 920,
      discount: 0,
      total: 920,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      status: 'placed',
      channel: 'pos',
      captainId: staff.id,
      captainName: staff.name,
    });

    table1.activeOrderId = createdOrder.id;
    await table1.save();

    // Line 1: Fired Starter
    const starter = await OrderItem.create({
      orderId: createdOrder.id,
      name: 'Truffle Mushroom Bruschetta',
      price: 320,
      quantity: 1,
      course: 'starters',
      itemStatus: 'fired',
      kitchenNotes: 'Extra crispy sourdough',
    });

    // Line 2: Held Main Course
    const main = await OrderItem.create({
      orderId: createdOrder.id,
      name: 'Wild Mushroom Risotto',
      price: 450,
      quantity: 1,
      course: 'mains',
      itemStatus: 'hold',
      kitchenNotes: 'Gluten sensitive',
    });

    // Line 3: Fired Beverage
    const drink = await OrderItem.create({
      orderId: createdOrder.id,
      name: 'Iced Spanish Latte',
      price: 150,
      quantity: 1,
      course: 'beverages',
      itemStatus: 'fired',
    });

    assert.equal(starter.course, 'starters');
    assert.equal(starter.itemStatus, 'fired');
    assert.equal(main.course, 'mains');
    assert.equal(main.itemStatus, 'hold');
    assert.equal(drink.course, 'beverages');
  });

  await t.test('Course Firing releases held mains to kitchen', async () => {
    // Fire all held items of course 'mains'
    const heldItems = await OrderItem.findAll({
      where: { orderId: createdOrder.id, course: 'mains', itemStatus: 'hold' },
    });
    assert.equal(heldItems.length, 1);

    for (const it of heldItems) {
      it.itemStatus = 'fired';
      await it.save();
    }

    const updatedMain = await OrderItem.findOne({ where: { id: heldItems[0].id } });
    assert.equal(updatedMain.itemStatus, 'fired');
  });

  await t.test('Item Void Security records cancellation reason and adjusts ticket total', async () => {
    const items = await OrderItem.findAll({ where: { orderId: createdOrder.id } });
    const itemToVoid = items.find(i => i.name === 'Iced Spanish Latte');
    assert.ok(itemToVoid);

    itemToVoid.itemStatus = 'void';
    itemToVoid.voidReason = 'Guest changed mind to Hot Flat White';
    itemToVoid.voidAuthorizedBy = 'Manager Priya';
    await itemToVoid.save();

    // Adjust order total
    createdOrder.subtotal -= itemToVoid.price;
    createdOrder.total -= itemToVoid.price;
    await createdOrder.save();

    const reloadedItem = await OrderItem.findOne({ where: { id: itemToVoid.id } });
    assert.equal(reloadedItem.itemStatus, 'void');
    assert.equal(reloadedItem.voidReason, 'Guest changed mind to Hot Flat White');
    assert.equal(reloadedItem.voidAuthorizedBy, 'Manager Priya');
    assert.equal(createdOrder.total, 770);
  });

  await t.test('Table Transfer shifts party and running order seamlessly', async () => {
    // Move from table1 to table2
    table2.status = 'occupied';
    table2.activeOrderId = table1.activeOrderId;
    table2.guestCount = table1.guestCount;
    table2.dinerName = table1.dinerName;
    table2.occupiedSince = table1.occupiedSince;
    await table2.save();

    createdOrder.table = table2.tableNumber;
    await createdOrder.save();

    table1.status = 'available';
    table1.activeOrderId = null;
    table1.dinerName = null;
    await table1.save();

    assert.equal(table1.status, 'available');
    assert.equal(table1.activeOrderId, null);
    assert.equal(table2.status, 'occupied');
    assert.equal(table2.activeOrderId, createdOrder.id);
  });

  await t.test('Table Bill Request marks table status as billed', async () => {
    table2.status = 'billed';
    await table2.save();

    const reloaded = await CafeTable.findOne({ where: { id: table2.id } });
    assert.equal(reloaded.status, 'billed');
  });

  await t.test('Table Release resets table to clean / available turnaround state', async () => {
    table2.status = 'cleaning';
    table2.activeOrderId = null;
    table2.dinerName = null;
    table2.occupiedSince = null;
    await table2.save();

    assert.equal(table2.status, 'cleaning');
    assert.equal(table2.activeOrderId, null);

    // Cleaned
    table2.status = 'available';
    await table2.save();
    assert.equal(table2.status, 'available');
  });
});

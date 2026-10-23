import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateEscPosReceipt,
  generateEscPosKOT,
  splitOrderItemsByStation,
  sendRawToNetworkPrinter,
  pushEDCChargeIntent,
  processEDCCallback,
  processSoundboxNotification,
  ESCPOS,
} from '../src/hardwareEngine.js';
import { Cafe, Order, PrinterConfig, EDCTerminal, HardwareLog } from '../src/models.js';

test('▶ Phase 6: Hardware Peripherals, Thermal ESC/POS & EDC Terminals', async (t) => {
  const sampleOrder = {
    orderNo: 'ORD-TEST-88',
    table: 'T-04',
    type: 'dine-in',
    items: [
      { name: 'Flat White (Oat)', quantity: 2, price: 240, category: 'Coffee', variantName: 'Double' },
      { name: 'Iced Matcha Latte', quantity: 1, price: 280, category: 'Beverages' },
      { name: 'Truffle Mushroom Melt', quantity: 1, price: 380, category: 'Mains' },
      { name: 'Basque Cheesecake', quantity: 1, price: 290, category: 'Dessert' },
    ],
    subtotal: 1430,
    discountValue: 100,
    tax: 66.5,
    total: 1396.5,
    paymentMode: 'card',
    paymentStatus: 'paid',
  };

  const sampleCafe = {
    name: 'GUESTORA Artisan Roastery',
    address: '12 Lavelle Road, Bangalore',
    phone: '+91 98765 43210',
  };

  await t.test('splitOrderItemsByStation divides order between Barista and Kitchen stations', () => {
    const { baristaItems, kitchenItems } = splitOrderItemsByStation(sampleOrder.items);
    assert.equal(baristaItems.length, 2);
    assert.equal(baristaItems[0].name, 'Flat White (Oat)');
    assert.equal(baristaItems[1].name, 'Iced Matcha Latte');

    assert.equal(kitchenItems.length, 2);
    assert.equal(kitchenItems[0].name, 'Truffle Mushroom Melt');
    assert.equal(kitchenItems[1].name, 'Basque Cheesecake');
  });

  await t.test('generateEscPosReceipt generates valid ESC/POS byte buffer with drawer kick pulse', () => {
    const buffer = generateEscPosReceipt(sampleOrder, sampleCafe, { paperWidth: 80, openDrawer: true });
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);

    // Verify it contains drawer kick bytes (ESC p 0 25 250)
    assert.ok(buffer.includes(ESCPOS.DRAWER_KICK));
    // Verify it contains cafe name and order number in text
    const textContent = buffer.toString('utf-8');
    assert.ok(textContent.includes('GUESTORA ARTISAN ROASTERY'));
    assert.ok(textContent.includes('ORD-TEST-88'));
    assert.ok(textContent.includes('₹1396.50'));
  });

  await t.test('generateEscPosKOT formats station header, table number and item checkboxes', () => {
    const { baristaItems } = splitOrderItemsByStation(sampleOrder.items);
    const kotBuffer = generateEscPosKOT(sampleOrder, { station: 'BARISTA', items: baristaItems, paperWidth: 80 });
    assert.ok(Buffer.isBuffer(kotBuffer));

    const textContent = kotBuffer.toString('utf-8');
    assert.ok(textContent.includes('KOT: BARISTA'));
    assert.ok(textContent.includes('TABLE: T-04'));
    assert.ok(textContent.includes('2x Flat White (Oat)'));
  });

  await t.test('sendRawToNetworkPrinter handles simulated print jobs cleanly', async () => {
    const buffer = Buffer.from('TEST PRINT JOB');
    const result = await sendRawToNetworkPrinter({ ipAddress: '127.0.0.1', port: 9100, buffer });
    assert.equal(result.success, true);
    assert.equal(result.simulated, true);
    assert.equal(result.bytesSent, buffer.length);
  });

  await t.test('pushEDCChargeIntent and processEDCCallback handles terminal charge workflow', async () => {
    // Ensure test cafe and terminal exist
    let cafe = await Cafe.findOne();
    if (!cafe) {
      cafe = await Cafe.create({ name: 'Test Cafe', slug: 'test-cafe-p6' });
    }

    let terminal = await EDCTerminal.findOne({ where: { cafeId: cafe.id } });
    if (!terminal) {
      terminal = await EDCTerminal.create({
        cafeId: cafe.id,
        name: 'Pine Labs Test Terminal',
        provider: 'pine_labs',
        terminalId: 'PL-TEST-01',
      });
    }

    const testOrder = await Order.create({
      cafeId: cafe.id,
      orderNo: `TEST-${Date.now()}`,
      total: 550,
      paymentStatus: 'pending',
      paymentMode: 'card',
    });

    const pushResult = await pushEDCChargeIntent({
      cafeId: cafe.id,
      terminalId: terminal.id,
      orderId: testOrder.id,
      amount: 550,
    });

    assert.equal(pushResult.success, true);
    assert.ok(pushResult.transactionRef.startsWith('EDC-'));
    assert.equal(pushResult.status, 'PENDING');

    // Simulate callback
    const settleResult = await processEDCCallback({
      cafeId: cafe.id,
      provider: 'pine_labs',
      transactionRef: pushResult.transactionRef,
      orderId: testOrder.id,
      status: 'APPROVED',
      cardNetwork: 'MASTERCARD',
      last4: '9988',
    });

    assert.equal(settleResult.success, true);
    assert.equal(settleResult.status, 'SETTLED');

    // Verify order was marked paid in db
    await testOrder.reload();
    assert.equal(testOrder.paymentStatus, 'paid');
    assert.ok(testOrder.paymentTransactionId.includes('PINE_LABS'));
  });

  await t.test('processSoundboxNotification logs and broadcasts audio payment chime', async () => {
    const result = await processSoundboxNotification({
      cafeId: 'mock-cafe-id',
      amount: 350,
      orderNo: 'ORD-SOUNDBOX-99',
      utrNo: 'UPI123456789',
    });
    assert.equal(result.success, true);
    assert.equal(result.broadcasted, true);
  });
});

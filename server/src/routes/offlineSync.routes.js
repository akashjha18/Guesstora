import express from 'express';
import { sequelize } from '../db.js';
import { Cafe, Order, OrderItem, Customer, MenuItem, RegisterShift } from '../models.js';
import { requireRole } from '../auth.js';
import { normalizeOrderLineItems } from '../modifiers.js';
import { broadcastEvent } from '../eventBus.js';
import { depleteInventoryForOrder } from '../inventoryEngine.js';

const router = express.Router();

/**
 * POST /owner/orders/offline-sync
 * Batch reconciler for orders generated offline while internet was disconnected.
 * Guarantees idempotency via offlineId and auto-depletes inventory.
 */
router.post('/owner/orders/offline-sync', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const cafe = await Cafe.findByPk(req.auth.cafe, {
      include: [{ model: MenuItem, as: 'menu' }],
    });
    if (!cafe) {
      return res.status(404).json({ message: 'Cafe not found.' });
    }

    const { orders: offlineOrders = [] } = req.body;
    if (!Array.isArray(offlineOrders) || offlineOrders.length === 0) {
      return res.status(400).json({ message: 'No offline orders provided in payload.' });
    }

    const results = [];
    let syncedCount = 0;

    for (const raw of offlineOrders) {
      const offlineId = String(raw.offlineId || raw.id || '').trim();
      if (!offlineId) {
        results.push({ offlineId: 'unknown', status: 'rejected', reason: 'Missing offlineId' });
        continue;
      }

      // 1. Idempotency Check: Don't insert duplicates
      const existing = await Order.findOne({
        where: { cafeId: cafe.id, offlineId },
        include: [{ model: OrderItem, as: 'items' }],
      });

      if (existing) {
        results.push({
          offlineId,
          orderId: existing.id,
          orderNo: existing.orderNo,
          status: 'already_synced',
          message: 'Order was already processed earlier.',
        });
        continue;
      }

      // 2. Validate Diner Phone & Name
      const customerName = String(raw.customerName || raw.name || 'Walk-in Guest').trim();
      const rawPhone = String(raw.phone || '').replace(/\D/g, '');
      const phone = rawPhone.length >= 10 ? rawPhone.slice(-10) : '9999999999';

      // 3. Find or Create Customer
      let customer;
      if (raw.customerId) {
        customer = await Customer.findOne({ where: { id: raw.customerId, cafeId: cafe.id } });
      }
      if (!customer) {
        const [foundCust] = await Customer.findOrCreate({
          where: { cafeId: cafe.id, phone },
          defaults: { name: customerName, visits: 0 },
        });
        customer = foundCust;
      }
      customer.visits = (customer.visits || 0) + 1;
      await customer.save();

      // 4. Normalize Line Items against Cafe Menu
      const rawItems = Array.isArray(raw.items) ? raw.items : [];
      const normalizedItems = normalizeOrderLineItems(rawItems, cafe.menu || [], 50);

      const subtotal = normalizedItems.length > 0
        ? normalizedItems.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0)
        : Number(raw.subtotal) || 0;
      const discount = Number(raw.discount) || 0;
      const total = Math.max(0, subtotal - discount);

      // 5. Active Register Shift Lookup
      const activeShift = await RegisterShift.findOne({
        where: { cafeId: cafe.id, status: 'open' },
        order: [['openedAt', 'DESC']],
      });

      // 6. Transactional Order Creation
      const createdOrder = await sequelize.transaction(async (t) => {
        const orderRecord = await Order.create({
          cafeId: cafe.id,
          orderNo: raw.orderNo || `OFF-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
          offlineId,
          isOffline: true,
          offlineSyncedAt: new Date(),
          customerId: customer.id,
          customerName,
          phone,
          table: raw.table || 'Counter / Takeaway',
          subtotal,
          discount,
          discountType: raw.discountType || null,
          discountValue: Number(raw.discountValue) || 0,
          discountReason: raw.discountReason || 'Offline bill discount',
          total,
          paymentMethod: raw.paymentMethod || 'cash',
          paymentStatus: raw.paymentStatus || 'paid',
          paymentTransactionId: raw.paymentTransactionId || null,
          shiftId: activeShift ? activeShift.id : null,
          status: raw.status || 'completed',
          channel: 'pos',
          createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
        }, { transaction: t });

        if (normalizedItems.length > 0) {
          await OrderItem.bulkCreate(normalizedItems.map(i => ({
            orderId: orderRecord.id,
            menuItemId: i.menuItemId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            selectedVariant: i.selectedVariant || null,
            selectedModifiers: i.selectedModifiers || [],
            notes: i.notes || null,
            isCompleted: true,
          })), { transaction: t });
        } else if (rawItems.length > 0) {
          // Fallback if menu items were updated offline
          await OrderItem.bulkCreate(rawItems.map(i => ({
            orderId: orderRecord.id,
            name: i.name || 'Custom Item',
            price: Number(i.price) || 0,
            quantity: Number(i.quantity) || 1,
            isCompleted: true,
          })), { transaction: t });
        }

        return orderRecord;
      });

      // 7. Auto-Deplete Inventory for Synced Order
      try {
        const fullOrder = await Order.findByPk(createdOrder.id, {
          include: [{ model: OrderItem, as: 'items' }],
        });
        await depleteInventoryForOrder({
          order: fullOrder,
          cafeId: cafe.id,
          staffName: `Offline Sync (${req.auth.role || 'Staff'})`,
        });
      } catch (invErr) {
        console.warn('Inventory depletion notice during offline sync:', invErr.message);
      }

      // 8. Broadcast to live KDS and POS screens
      broadcastEvent(cafe.id, 'order_synced', {
        id: createdOrder.id,
        orderNo: createdOrder.orderNo,
        offlineId,
        total: createdOrder.total,
      });

      syncedCount++;
      results.push({
        offlineId,
        orderId: createdOrder.id,
        orderNo: createdOrder.orderNo,
        status: 'synced',
        total: createdOrder.total,
      });
    }

    return res.json({
      success: true,
      message: `Offline synchronization completed. ${syncedCount} order(s) processed.`,
      syncedCount,
      totalSubmitted: offlineOrders.length,
      results,
    });
  } catch (err) {
    console.error('Error during offline order synchronization:', err);
    return res.status(500).json({ message: 'Failed to synchronize offline orders: ' + err.message });
  }
});

/**
 * GET /public/cafes/:slug/cfd-config
 * Public branding, active promos and UPI configuration for Customer Facing Display.
 */
router.get('/public/cafes/:slug/cfd-config', async (req, res) => {
  try {
    const { slug } = req.params;
    const cafe = await Cafe.findOne({ where: { slug } });
    if (!cafe) {
      return res.status(404).json({ message: 'Cafe not found.' });
    }

    return res.json({
      name: cafe.name,
      slug: cafe.slug,
      logo: cafe.logo,
      bannerImage: cafe.bannerImage,
      brandColor: cafe.brandColor || '#ea580c',
      currency: cafe.currency || 'INR',
      tagline: cafe.tagline || 'Specialty Coffee & Roastery',
      wifiSsid: cafe.wifiSsid,
      wifiPassword: cafe.wifiPassword,
      cfdWelcomeTitle: cafe.cfdWelcomeTitle || 'GUESTORA Specialty Coffee',
      cfdWelcomeSubtitle: cafe.cfdWelcomeSubtitle || 'Handcrafted Roasts & Fresh Bakes',
      cfdPromoBanner: cafe.cfdPromoBanner || 'Ask our Barista about our Seasonal Single-Origin Pour-overs!',
      cfdUpiVpa: cafe.cfdUpiVpa || 'gusstora@okaxis',
      cfdIdleMedia: cafe.cfdIdleMedia || null,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * PUT /owner/cfd-config
 * Allows owner to configure CFD messaging and UPI QR destination
 */
router.put('/owner/cfd-config', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafe = await Cafe.findByPk(req.auth.cafe);
    if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });

    const {
      cfdWelcomeTitle,
      cfdWelcomeSubtitle,
      cfdPromoBanner,
      cfdUpiVpa,
      cfdIdleMedia,
    } = req.body;

    if (cfdWelcomeTitle !== undefined) cafe.cfdWelcomeTitle = String(cfdWelcomeTitle).trim();
    if (cfdWelcomeSubtitle !== undefined) cafe.cfdWelcomeSubtitle = String(cfdWelcomeSubtitle).trim();
    if (cfdPromoBanner !== undefined) cafe.cfdPromoBanner = String(cfdPromoBanner).trim();
    if (cfdUpiVpa !== undefined) cafe.cfdUpiVpa = String(cfdUpiVpa).trim();
    if (cfdIdleMedia !== undefined) cafe.cfdIdleMedia = cfdIdleMedia;

    await cafe.save();

    // Broadcast CFD config update to live displays
    broadcastEvent(cafe.id, 'cfd_config_updated', {
      cfdWelcomeTitle: cafe.cfdWelcomeTitle,
      cfdWelcomeSubtitle: cafe.cfdWelcomeSubtitle,
      cfdPromoBanner: cafe.cfdPromoBanner,
      cfdUpiVpa: cafe.cfdUpiVpa,
    });

    return res.json({
      success: true,
      message: 'Customer Facing Display settings saved.',
      config: {
        cfdWelcomeTitle: cafe.cfdWelcomeTitle,
        cfdWelcomeSubtitle: cafe.cfdWelcomeSubtitle,
        cfdPromoBanner: cafe.cfdPromoBanner,
        cfdUpiVpa: cafe.cfdUpiVpa,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * POST /owner/cfd/broadcast
 * Remote CFD relay: Allows POS cashier to send live cart updates to separate wireless CFD tablets
 */
router.post('/owner/cfd/broadcast', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { eventType, payload } = req.body;

    broadcastEvent(cafeId, 'cfd_event', {
      eventType: eventType || 'CART_UPDATE',
      payload: payload || {},
      timestamp: Date.now(),
    });

    return res.json({ success: true, message: 'CFD event broadcasted.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;

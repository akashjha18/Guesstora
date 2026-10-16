import { Router } from 'express';
import { Op } from 'sequelize';
import { Cafe, CafeTable, Customer, Order, OrderItem, PromoCode } from '../models.js';
import { requireRole } from '../auth.js';
import { createAuditLog, getClientIp, getClientUserAgent } from '../audit.js';
import { calculateDiscount, calculateEqualBillSplit } from '../shifts.js';
import { processLoyalty } from '../loyalty.js';
import { broadcastEvent } from '../eventBus.js';
import { serializeOrder } from './serializers.js';
import { trackCampaignRedemption } from '../aiRoasteryEngine.js';

const router = Router();

// POST /owner/orders/:id/transfer-table - Reassign table and update table occupancy
router.post('/owner/orders/:id/transfer-table', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const { targetTable } = req.body;
    if (!targetTable) {
      return res.status(400).json({ message: 'Target table is required.' });
    }

    const order = await Order.findOne({
      where: { id: req.params.id, cafeId: req.auth.cafe },
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const oldTableNumber = order.table;
    const newTableNumber = String(targetTable).trim();

    order.table = newTableNumber;
    await order.save();

    // Sync CafeTable statuses if they exist in CafeTable
    try {
      if (oldTableNumber && oldTableNumber !== newTableNumber) {
        const remainingOrdersOnOld = await Order.count({
          where: {
            cafeId: req.auth.cafe,
            table: oldTableNumber,
            status: { [Op.notIn]: ['completed', 'cancelled'] },
          }
        });
        if (remainingOrdersOnOld === 0) {
          await CafeTable.update({ status: 'available' }, { where: { cafeId: req.auth.cafe, tableNumber: oldTableNumber } });
        }
      }
      await CafeTable.update({ status: 'occupied' }, { where: { cafeId: req.auth.cafe, tableNumber: newTableNumber } });
    } catch (err) {
      // Non-fatal if table entity doesn't match
    }

    await createAuditLog({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      action: 'ORDER_TABLE_TRANSFERRED',
      details: { orderId: order.id, fromTable: oldTableNumber, toTable: newTableNumber },
      ip: getClientIp(req),
      userAgent: getClientUserAgent(req),
    });

    const serialized = serializeOrder(order);
    broadcastEvent(req.auth.cafe, 'order_updated', serialized);
    broadcastEvent(req.auth.cafe, 'tables_updated', { refreshed: true });

    return res.json({
      success: true,
      message: `Order #${order.orderNo} transferred to ${newTableNumber}`,
      order: serialized,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to transfer table.' });
  }
});

// POST /owner/orders/:id/split - Split an open bill into equal or custom shares
router.post('/owner/orders/:id/split', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const { type = 'equal', count = 2, customSplits } = req.body;
    const order = await Order.findOne({
      where: { id: req.params.id, cafeId: req.auth.cafe },
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    let splitRecords = [];
    if (type === 'equal') {
      const splitCount = Math.max(2, Math.min(20, parseInt(count, 10) || 2));
      const equalSplits = calculateEqualBillSplit(order.total, splitCount);
      splitRecords = equalSplits.map(s => ({
        id: `split_${Date.now()}_${s.splitNumber}`,
        splitNumber: s.splitNumber,
        label: `Guest ${s.splitNumber}`,
        amount: s.amount,
        paymentMethod: null,
        paymentStatus: 'pending',
        paidAt: null,
      }));
    } else if (type === 'custom') {
      if (!Array.isArray(customSplits) || customSplits.length < 2) {
        return res.status(400).json({ message: 'At least 2 split entries required for custom split.' });
      }
      const sum = customSplits.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
      if (Math.abs(sum - order.total) > 0.05) {
        return res.status(400).json({ message: `Sum of custom splits (₹${sum}) must equal order total (₹${order.total}).` });
      }
      splitRecords = customSplits.map((s, idx) => ({
        id: `split_${Date.now()}_${idx + 1}`,
        splitNumber: idx + 1,
        label: s.label || `Guest ${idx + 1}`,
        amount: Number(s.amount) || 0,
        paymentMethod: null,
        paymentStatus: 'pending',
        paidAt: null,
      }));
    }

    order.splitBills = JSON.stringify(splitRecords);
    await order.save();

    await createAuditLog({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      action: 'ORDER_BILL_SPLIT',
      details: { orderId: order.id, splitType: type, count: splitRecords.length },
      ip: getClientIp(req),
      userAgent: getClientUserAgent(req),
    });

    const serialized = serializeOrder(order);
    broadcastEvent(req.auth.cafe, 'order_updated', serialized);

    return res.json({
      success: true,
      message: `Bill split into ${splitRecords.length} shares.`,
      order: serialized,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to split bill.' });
  }
});

// POST /owner/orders/:id/split/:splitId/pay - Settle an individual split bill share
router.post('/owner/orders/:id/split/:splitId/pay', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const { paymentMethod = 'cash', paymentTransactionId } = req.body;
    const order = await Order.findOne({
      where: { id: req.params.id, cafeId: req.auth.cafe },
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const splits = order.splitBills ? (typeof order.splitBills === 'string' ? JSON.parse(order.splitBills) : order.splitBills) : [];
    const targetSplit = splits.find(s => s.id === req.params.splitId);
    if (!targetSplit) {
      return res.status(404).json({ message: 'Split record not found.' });
    }

    targetSplit.paymentStatus = 'paid';
    targetSplit.paymentMethod = paymentMethod;
    targetSplit.paymentTransactionId = paymentTransactionId || null;
    targetSplit.paidAt = new Date().toISOString();

    const allPaid = splits.every(s => s.paymentStatus === 'paid');
    order.splitBills = JSON.stringify(splits);
    if (allPaid) {
      order.paymentStatus = 'paid';
      order.paymentMethod = 'split';
    }
    await order.save();

    if (allPaid && order.status === 'completed') {
      const [customer, cafe] = await Promise.all([Customer.findByPk(order.customerId), Cafe.findByPk(order.cafeId)]);
      await processLoyalty({ order, customer, cafe });
    }

    await createAuditLog({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      action: 'SPLIT_BILL_PAID',
      details: { orderId: order.id, splitId: req.params.splitId, amount: targetSplit.amount, paymentMethod },
      ip: getClientIp(req),
      userAgent: getClientUserAgent(req),
    });

    const serialized = serializeOrder(order);
    broadcastEvent(req.auth.cafe, 'order_updated', serialized);

    return res.json({
      success: true,
      allPaid,
      message: allPaid ? 'All splits have been settled! Order fully paid.' : `Guest share paid successfully.`,
      order: serialized,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to settle split payment.' });
  }
});

// POST /owner/orders/:id/apply-discount - Apply manual or promo discount
router.post('/owner/orders/:id/apply-discount', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const { type, value, reason, promoCode, authorizedBy } = req.body;
    const order = await Order.findOne({
      where: { id: req.params.id, cafeId: req.auth.cafe },
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Cannot apply discount to an already paid order.' });
    }

    let discountAmount = 0;
    let finalType = type;
    let finalValue = Number(value) || 0;
    let finalReason = reason || '';

    if (promoCode) {
      const promo = await PromoCode.findOne({
        where: {
          cafeId: req.auth.cafe,
          code: String(promoCode).toUpperCase().trim(),
          isActive: true,
        }
      });
      if (!promo) {
        return res.status(400).json({ message: 'Invalid or inactive promo code.' });
      }
      const now = new Date();
      if (promo.startDate && new Date(promo.startDate) > now) {
        return res.status(400).json({ message: 'Promo code is not active yet.' });
      }
      if (promo.endDate && new Date(promo.endDate) < now) {
        return res.status(400).json({ message: 'Promo code has expired.' });
      }
      if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
        return res.status(400).json({ message: 'Promo code usage limit has been reached.' });
      }

      const calc = calculateDiscount(
        order.subtotal,
        promo.discountType,
        promo.discountValue,
        promo.maxDiscountAmount,
        promo.minOrderAmount
      );
      if (!calc.valid) {
        return res.status(400).json({ message: calc.reason });
      }

      discountAmount = calc.discountAmount;
      finalType = promo.discountType;
      finalValue = promo.discountValue;
      finalReason = `Promo Code: ${promo.code}`;
      promo.usageCount = (promo.usageCount || 0) + 1;
      await promo.save();
    } else {
      if (!['percent', 'flat'].includes(type)) {
        return res.status(400).json({ message: 'Discount type must be percent or flat.' });
      }
      const calc = calculateDiscount(order.subtotal, type, value, null, 0);
      discountAmount = calc.discountAmount;
      finalReason = reason || 'Staff / Manager POS discount';
    }

    order.discount = discountAmount;
    order.discountType = finalType;
    order.discountValue = finalValue;
    order.discountReason = finalReason;
    order.discountAuthorizedBy = authorizedBy || req.auth.name || 'Staff';
    order.total = Math.max(0, order.subtotal - discountAmount);

    if (order.splitBills) {
      order.splitBills = null;
    }
    await order.save();

    if (promoCode) {
      try {
        await trackCampaignRedemption({
          cafeId: req.auth.cafe,
          promoCode: String(promoCode).toUpperCase().trim(),
          orderId: order.id,
          orderAmount: order.total,
          phone: order.phone,
        });
      } catch (e) {
        console.warn('Campaign redemption tracking error (non-fatal):', e.message);
      }
    }

    await createAuditLog({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      action: 'ORDER_DISCOUNT_APPLIED',
      details: {
        orderId: order.id,
        discountAmount,
        discountType: finalType,
        discountValue: finalValue,
        reason: finalReason,
      },
      ip: getClientIp(req),
      userAgent: getClientUserAgent(req),
    });

    const serialized = serializeOrder(order);
    broadcastEvent(req.auth.cafe, 'order_updated', serialized);

    return res.json({
      success: true,
      message: `Discount of ₹${discountAmount} applied. New total: ₹${order.total}`,
      order: serialized,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to apply discount.' });
  }
});

export default router;

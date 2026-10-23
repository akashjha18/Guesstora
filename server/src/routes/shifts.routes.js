import { Router } from 'express';
import { Op } from 'sequelize';
import { Cafe, MenuItem, Order, OrderItem, RegisterShift, User } from '../models.js';
import { requireRole } from '../auth.js';
import { createAuditLog, getClientIp, getClientUserAgent } from '../audit.js';
import { calculateShiftSummary, formatZReportText } from '../shifts.js';
import { broadcastEvent } from '../eventBus.js';
import { serializeShift } from './serializers.js';

const router = Router();

// GET /owner/shifts/current - Get active open shift and live financial summary
router.get('/owner/shifts/current', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const shift = await RegisterShift.findOne({
      where: { cafeId: req.auth.cafe, status: 'open' },
      include: [{ model: User, attributes: ['id', 'name', 'role'] }],
      order: [['openedAt', 'DESC']],
    });
    if (!shift) {
      return res.json({ shift: null, liveSummary: null });
    }

    const orders = await Order.findAll({
      where: {
        cafeId: req.auth.cafe,
        [Op.or]: [
          { shiftId: shift.id },
          { createdAt: { [Op.gte]: shift.openedAt } }
        ]
      },
      include: [{ model: OrderItem, as: 'items', include: [{ model: MenuItem, attributes: ['category'] }] }]
    });

    const liveSummary = calculateShiftSummary(shift, orders);
    return res.json({
      shift: serializeShift(shift),
      liveSummary,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch current shift.' });
  }
});

// POST /owner/shifts/open - Open a new register shift
router.post('/owner/shifts/open', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const existing = await RegisterShift.findOne({
      where: { cafeId: req.auth.cafe, status: 'open' }
    });
    if (existing) {
      return res.status(400).json({ message: 'A shift is already open. Please close the active shift first.' });
    }

    const openingFloat = Math.max(0, Number(req.body.openingFloat) || 0);
    const notes = String(req.body.notes || '').trim();

    const shift = await RegisterShift.create({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      openedAt: new Date(),
      openingFloat,
      status: 'open',
      notes,
    });

    const fullShift = await RegisterShift.findByPk(shift.id, {
      include: [{ model: User, attributes: ['id', 'name', 'role'] }]
    });

    await createAuditLog({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      action: 'SHIFT_OPENED',
      details: { shiftId: shift.id, openingFloat },
      ip: getClientIp(req),
      userAgent: getClientUserAgent(req),
    });

    const serialized = serializeShift(fullShift);
    broadcastEvent(req.auth.cafe, 'shift_opened', serialized);
    return res.status(201).json(serialized);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to open shift.' });
  }
});

// POST /owner/shifts/close - Close shift, calculate variance and Z-report
router.post('/owner/shifts/close', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const shift = await RegisterShift.findOne({
      where: { cafeId: req.auth.cafe, status: 'open' },
      include: [{ model: User, attributes: ['id', 'name', 'role'] }],
      order: [['openedAt', 'DESC']],
    });
    if (!shift) {
      return res.status(400).json({ message: 'No active shift found to close.' });
    }

    const closingFloatCounted = Math.max(0, Number(req.body.closingFloatCounted) || 0);
    const closingNotes = String(req.body.notes || '').trim();

    const orders = await Order.findAll({
      where: {
        cafeId: req.auth.cafe,
        [Op.or]: [
          { shiftId: shift.id },
          { createdAt: { [Op.gte]: shift.openedAt } }
        ]
      },
      include: [{ model: OrderItem, as: 'items', include: [{ model: MenuItem, attributes: ['category'] }] }]
    });

    const summary = calculateShiftSummary(shift, orders, closingFloatCounted);
    const cafe = await Cafe.findByPk(req.auth.cafe);

    shift.closedAt = new Date();
    shift.closingFloatCounted = closingFloatCounted;
    shift.closingFloatExpected = summary.closingFloatExpected;
    shift.cashVariance = summary.cashVariance;
    shift.totalSales = summary.totalSales;
    shift.paymentBreakdown = JSON.stringify(summary.paymentBreakdown);
    shift.categoryBreakdown = JSON.stringify(summary.categoryBreakdown);
    shift.taxSummary = JSON.stringify(summary.taxSummary);
    shift.status = 'closed';
    if (closingNotes) {
      shift.notes = shift.notes ? `${shift.notes} | Close notes: ${closingNotes}` : closingNotes;
    }
    await shift.save();

    // Ensure all orders in this shift window have shiftId populated
    await Order.update(
      { shiftId: shift.id },
      {
        where: {
          cafeId: req.auth.cafe,
          createdAt: { [Op.gte]: shift.openedAt, [Op.lte]: shift.closedAt },
          shiftId: null,
        }
      }
    );

    const zReportText = formatZReportText(shift, summary, cafe?.name || 'GUESTORA Artisan Café');

    await createAuditLog({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      action: 'SHIFT_CLOSED',
      details: {
        shiftId: shift.id,
        closingFloatCounted,
        closingFloatExpected: summary.closingFloatExpected,
        cashVariance: summary.cashVariance,
        totalSales: summary.totalSales,
      },
      ip: getClientIp(req),
      userAgent: getClientUserAgent(req),
    });

    const serialized = serializeShift(shift);
    broadcastEvent(req.auth.cafe, 'shift_closed', { shift: serialized, summary });

    return res.json({
      shift: serialized,
      summary,
      zReportText,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to close shift.' });
  }
});

// GET /owner/shifts - List past shifts
router.get('/owner/shifts', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const shifts = await RegisterShift.findAll({
      where: { cafeId: req.auth.cafe },
      include: [{ model: User, attributes: ['id', 'name', 'role'] }],
      order: [['openedAt', 'DESC']],
      limit: 50,
    });
    return res.json(shifts.map(serializeShift));
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to list shifts.' });
  }
});

// GET /owner/shifts/:id - Get specific shift details
router.get('/owner/shifts/:id', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const shift = await RegisterShift.findOne({
      where: { id: req.params.id, cafeId: req.auth.cafe },
      include: [{ model: User, attributes: ['id', 'name', 'role'] }],
    });
    if (!shift) return res.status(404).json({ message: 'Shift not found.' });

    const orders = await Order.findAll({
      where: { cafeId: req.auth.cafe, shiftId: shift.id },
      include: [{ model: OrderItem, as: 'items', include: [{ model: MenuItem, attributes: ['category'] }] }]
    });

    const summary = calculateShiftSummary(shift, orders, shift.closingFloatCounted);
    const cafe = await Cafe.findByPk(req.auth.cafe);
    const zReportText = formatZReportText(shift, summary, cafe?.name || 'GUESTORA Artisan Café');

    return res.json({
      shift: serializeShift(shift),
      summary,
      zReportText,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch shift.' });
  }
});

// GET /owner/shifts/:id/z-report - Get printable 80mm Z-Report text for a shift
router.get('/owner/shifts/:id/z-report', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const shift = await RegisterShift.findOne({
      where: { id: req.params.id, cafeId: req.auth.cafe },
      include: [{ model: User, attributes: ['id', 'name', 'role'] }],
    });
    if (!shift) return res.status(404).json({ message: 'Shift not found.' });

    const orders = await Order.findAll({
      where: { cafeId: req.auth.cafe, shiftId: shift.id },
      include: [{ model: OrderItem, as: 'items', include: [{ model: MenuItem, attributes: ['category'] }] }]
    });

    const summary = calculateShiftSummary(shift, orders, shift.closingFloatCounted);
    const cafe = await Cafe.findByPk(req.auth.cafe);
    const zReportText = formatZReportText(shift, summary, cafe?.name || 'GUESTORA Artisan Café');

    return res.json({
      shift: serializeShift(shift),
      summary,
      zReportText,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to generate Z-report.' });
  }
});

export default router;

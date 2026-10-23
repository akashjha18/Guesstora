import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { Cafe, CafeTable, MenuItem, Order, OrderItem, User } from '../models.js';
import { jwtSecret } from '../auth.js';
import { createAuditLog } from '../audit.js';
import { broadcastEvent } from '../eventBus.js';
import { serializeOrder } from './serializers.js';

const router = Router();

const CAPTAIN_ALLOWED_ROLES = ['owner', 'manager', 'cashier', 'kitchen', 'captain', 'waiter'];
const FLOOR_ROLES = ['owner', 'manager', 'cashier', 'captain', 'waiter'];
const CAPTAIN_MANAGER_ROLES = ['owner', 'manager', 'cashier'];

// Middleware: Require Captain, Waiter, or Staff authorization
export async function requireCaptainOrStaff(req, res, next) {
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (req.query?.token ? String(req.query.token).trim() : '');

  if (!token) {
    return res.status(401).json({ message: 'Captain sign-in required.' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findOne({
      where: { id: decoded.sub || decoded.id, cafeId: decoded.cafe, status: 'active' },
    });
    if (!user || !CAPTAIN_ALLOWED_ROLES.includes(user.role)) {
      return res.status(403).json({ message: 'Floor captain or staff access required.' });
    }

    req.auth = {
      ...decoded,
      id: user.id,
      sub: user.id,
      name: user.name || 'Floor Captain',
      role: user.role,
      cafe: user.cafeId,
      assignedSection: user.assignedSection || 'All',
    };
    return next();
  } catch (err) {
    if (err.name?.startsWith('Sequelize')) {
      return next(err);
    }
    return res.status(401).json({
      message: err.name === 'TokenExpiredError' ? 'Session expired. Please sign in again.' : 'Invalid captain session.',
      code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    });
  }
}

function requireCaptainManager(req, res, next) {
  if (!CAPTAIN_MANAGER_ROLES.includes(req.auth.role)) {
    return res.status(403).json({ message: 'Manager or cashier authorization is required for this action.' });
  }
  return next();
}

function tableSectionScope(req) {
  const section = req.auth.role === 'waiter' ? req.auth.assignedSection : null;
  return section && section !== 'All' ? { section } : {};
}

function generateOrderNumber(tableNumber) {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `T${tableNumber || 'X'}-${randomSuffix}`;
}

// ============================================================================
// 1. PUBLIC / AUTH ENDPOINTS
// ============================================================================

// POST /api/public/cafes/:slug/captain/login - Password sign-in for floor staff
router.post('/public/cafes/:slug/captain/login', async (req, res) => {
  try {
    const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
    if (!cafe) {
      return res.status(404).json({ message: 'Cafe not found.' });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
      return res.status(400).json({ message: 'Enter a valid email and password.' });
    }

    const staffUser = await User.findOne({
      where: {
        email,
        cafeId: cafe.id,
        status: 'active',
        role: { [Op.in]: FLOOR_ROLES },
      },
    });
    if (!staffUser || !(await bcrypt.compare(password, staffUser.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign({
      sub: staffUser.id,
      id: staffUser.id,
      name: staffUser.name || 'Floor Captain',
      email: staffUser.email,
      role: staffUser.role,
      cafe: cafe.id,
      assignedSection: staffUser.assignedSection || 'All',
    }, jwtSecret, { expiresIn: '12h' });

    return res.json({
      token,
      user: {
        id: staffUser.id,
        name: staffUser.name || 'Floor Captain',
        email: staffUser.email,
        role: staffUser.role,
        assignedSection: staffUser.assignedSection || 'All',
      },
      cafe: {
        id: cafe.id,
        name: cafe.name,
        slug: cafe.slug,
        currency: cafe.currency || 'INR',
      },
    });
  } catch (err) {
    console.error('Captain login error:', err);
    return res.status(500).json({ message: 'Failed to sign in to Captain.' });
  }
});

// ============================================================================
// 2. FLOOR PLAN & REAL-TIME TABLE GRID
// ============================================================================

// GET /api/captain/floor-plan - Visual table layout with live order status & occupancy
router.get('/captain/floor-plan', requireCaptainOrStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;

    const tables = await CafeTable.findAll({
      where: { cafeId, isActive: true, ...tableSectionScope(req) },
      order: [['tableNumber', 'ASC']],
    });

    // Extract active order IDs to batch query
    const activeOrderIds = tables.map(t => t.activeOrderId).filter(Boolean);
    const activeOrders = activeOrderIds.length > 0
      ? await Order.findAll({
          where: { id: { [Op.in]: activeOrderIds }, cafeId },
          include: [{ model: OrderItem, as: 'items' }],
        })
      : [];

    const now = Date.now();
    const tableCards = tables.map(t => {
      const activeOrder = activeOrders.find(o => o.id === t.activeOrderId);
      let elapsedMinutes = 0;
      if (t.occupiedSince) {
        elapsedMinutes = Math.max(0, Math.round((now - new Date(t.occupiedSince).getTime()) / 60000));
      } else if (activeOrder?.createdAt) {
        elapsedMinutes = Math.max(0, Math.round((now - new Date(activeOrder.createdAt).getTime()) / 60000));
      }

      let itemCount = 0;
      let runningTotal = 0;
      let heldCount = 0;
      let firedCount = 0;
      const coursesSet = new Set();
      const courseBreakdown = {};

      if (activeOrder?.items) {
        for (const item of activeOrder.items) {
          if (item.itemStatus !== 'void') {
            itemCount += item.quantity || 1;
            runningTotal += (item.price || 0) * (item.quantity || 1);
            const courseName = item.course || 'mains';
            coursesSet.add(courseName);

            if (!courseBreakdown[courseName]) {
              courseBreakdown[courseName] = { count: 0, hold: 0, fired: 0, served: 0 };
            }
            courseBreakdown[courseName].count += item.quantity || 1;
            if (item.itemStatus === 'hold') {
              heldCount += item.quantity || 1;
              courseBreakdown[courseName].hold += item.quantity || 1;
            } else if (item.itemStatus === 'fired') {
              firedCount += item.quantity || 1;
              courseBreakdown[courseName].fired += item.quantity || 1;
            } else if (item.itemStatus === 'served') {
              courseBreakdown[courseName].served += item.quantity || 1;
            }
          }
        }
      }

      return {
        id: t.id,
        tableNumber: t.tableNumber,
        name: t.name || `Table ${t.tableNumber}`,
        capacity: t.capacity || 4,
        section: t.section || 'Main Floor',
        status: t.status || 'available', // 'available' | 'occupied' | 'billed' | 'reserved' | 'cleaning'
        guestCount: t.guestCount || 2,
        dinerName: t.dinerName || null,
        dinerPhone: t.dinerPhone || null,
        assignedCaptainName: t.assignedCaptainName || null,
        mergedIntoTableId: t.mergedIntoTableId || null,
        activeOrderId: t.activeOrderId || null,
        elapsedMinutes,
        orderSummary: activeOrder ? {
          orderId: activeOrder.id,
          orderNo: activeOrder.orderNo,
          itemCount,
          runningTotal: activeOrder.total || runningTotal,
          heldCount,
          firedCount,
          activeCourses: Array.from(coursesSet),
          courseBreakdown,
        } : null,
      };
    });

    const sections = Array.from(new Set(tables.map(t => t.section || 'Main Floor')));
    const stats = {
      total: tables.length,
      available: tables.filter(t => t.status === 'available').length,
      occupied: tables.filter(t => t.status === 'occupied').length,
      billed: tables.filter(t => t.status === 'billed').length,
      reserved: tables.filter(t => t.status === 'reserved').length,
      cleaning: tables.filter(t => t.status === 'cleaning').length,
    };

    return res.json({ tables: tableCards, sections, stats });
  } catch (err) {
    console.error('Error fetching floor plan:', err);
    return res.status(500).json({ message: 'Failed to load floor plan.' });
  }
});

// ============================================================================
// 3. TABLE SEATING & WALK-IN
// ============================================================================

// POST /api/captain/tables/:id/seat - Seat a party at a table
router.post('/captain/tables/:id/seat', requireCaptainOrStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { id } = req.params;
    const { guestCount, dinerName, dinerPhone } = req.body;

    const table = await CafeTable.findOne({ where: { id, cafeId, ...tableSectionScope(req) } });
    if (!table) return res.status(404).json({ message: 'Table not found.' });

    table.status = 'occupied';
    table.occupiedSince = new Date();
    table.guestCount = Math.max(1, Number(guestCount) || 2);
    table.dinerName = dinerName ? String(dinerName).trim() : null;
    table.dinerPhone = dinerPhone ? String(dinerPhone).trim() : null;
    table.assignedCaptainId = req.auth.id || null;
    table.assignedCaptainName = req.auth.name || 'Floor Captain';
    await table.save();

    broadcastEvent(cafeId, 'table_updated', {
      tableId: table.id,
      tableNumber: table.tableNumber,
      status: table.status,
      guestCount: table.guestCount,
      dinerName: table.dinerName,
    });

    return res.json({ success: true, message: `Table ${table.tableNumber} is now seated.`, table });
  } catch (err) {
    console.error('Error seating table:', err);
    return res.status(500).json({ message: 'Failed to seat table.' });
  }
});

// ============================================================================
// 4. TABLE-SIDE ORDERING & COURSE-WISE KOT MANAGEMENT
// ============================================================================

// GET /api/captain/tables/:id/order - Fetch running table order
router.get('/captain/tables/:id/order', requireCaptainOrStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const table = await CafeTable.findOne({
      where: { id: req.params.id, cafeId, ...tableSectionScope(req) },
    });
    if (!table) return res.status(404).json({ message: 'Table not found.' });

    if (!table.activeOrderId) {
      return res.json({ hasActiveOrder: false, order: null });
    }

    const order = await Order.findOne({
      where: { id: table.activeOrderId, cafeId },
      include: [{ model: OrderItem, as: 'items' }],
    });

    if (!order) {
      table.activeOrderId = null;
      await table.save();
      return res.json({ hasActiveOrder: false, order: null });
    }

    return res.json({ hasActiveOrder: true, order: serializeOrder(order) });
  } catch (err) {
    console.error('Error fetching table order:', err);
    return res.status(500).json({ message: 'Failed to retrieve order.' });
  }
});

// POST /api/captain/tables/:id/order - Create or append items with course tagging
router.post('/captain/tables/:id/order', requireCaptainOrStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { id } = req.params;
    const { items, dinerName, dinerPhone, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Please select at least one item to fire.' });
    }

    const requestedMenuItemIds = [...new Set(items.map(item => String(item.menuItemId || '')))];
    if (requestedMenuItemIds.some(id => !id)) {
      return res.status(400).json({ message: 'Every order item must reference an active menu item.' });
    }
    const menuItems = await MenuItem.findAll({
      where: {
        id: { [Op.in]: requestedMenuItemIds },
        cafeId,
        available: true,
      },
    });
    if (menuItems.length !== requestedMenuItemIds.length) {
      return res.status(400).json({ message: 'One or more selected menu items are unavailable.' });
    }
    const menuItemById = new Map(menuItems.map(item => [item.id, item]));

    const table = await CafeTable.findOne({ where: { id, cafeId, ...tableSectionScope(req) } });
    if (!table) return res.status(404).json({ message: 'Table not found.' });

    let order = null;
    if (table.activeOrderId) {
      order = await Order.findOne({
        where: { id: table.activeOrderId, cafeId },
        include: [{ model: OrderItem, as: 'items' }],
      });
    }

    const now = new Date();
    if (!order) {
      // Create new running order for table
      const orderNo = generateOrderNumber(table.tableNumber);
      order = await Order.create({
        cafeId,
        orderNo,
        table: table.tableNumber,
        customerName: dinerName || table.dinerName || `Table ${table.tableNumber}`,
        phone: dinerPhone || table.dinerPhone || null,
        subtotal: 0,
        discount: 0,
        total: 0,
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        status: 'placed',
        channel: 'pos',
        captainId: req.auth.id || null,
        captainName: req.auth.name || 'Floor Captain',
        notes: notes || '',
      });

      table.activeOrderId = order.id;
      table.status = 'occupied';
      if (!table.occupiedSince) table.occupiedSince = now;
      if (dinerName) table.dinerName = dinerName;
      if (dinerPhone) table.dinerPhone = dinerPhone;
      await table.save();
    }

    // Insert new line items
    let additionalTotal = 0;
    const newItemsCreated = [];

    for (const raw of items) {
      const menuItem = menuItemById.get(String(raw.menuItemId));
      const price = Number(menuItem.price) || 0;
      const quantity = Math.max(1, Number(raw.quantity) || 1);
      const itemCourse = ['starters', 'mains', 'desserts', 'beverages'].includes(raw.course)
        ? raw.course
        : 'mains';
      const itemStatus = raw.itemStatus === 'hold' ? 'hold' : 'fired';

      const lineItem = await OrderItem.create({
        orderId: order.id,
        menuItemId: menuItem.id,
        name: menuItem.name,
        price,
        quantity,
        isCompleted: false,
        selectedVariant: raw.selectedVariant || null,
        selectedModifiers: raw.selectedModifiers || [],
        notes: raw.notes || '',
        course: itemCourse,
        itemStatus,
        kitchenNotes: raw.kitchenNotes || '',
      });

      additionalTotal += price * quantity;
      newItemsCreated.push(lineItem);
    }

    // Recalculate order totals
    order.subtotal = (Number(order.subtotal) || 0) + additionalTotal;
    order.total = Math.max(0, (Number(order.total) || 0) + additionalTotal - (Number(order.discount) || 0));
    await order.save();

    // Reload with all items
    const reloadedOrder = await Order.findOne({
      where: { id: order.id },
      include: [{ model: OrderItem, as: 'items' }],
    });

    const serialized = serializeOrder(reloadedOrder);

    // Broadcast real-time SSE updates
    broadcastEvent(cafeId, 'order_created', serialized);
    broadcastEvent(cafeId, 'table_updated', {
      tableId: table.id,
      tableNumber: table.tableNumber,
      status: table.status,
      activeOrderId: order.id,
      runningTotal: order.total,
    });
    broadcastEvent(cafeId, 'kot_fired', {
      orderId: order.id,
      orderNo: order.orderNo,
      tableNumber: table.tableNumber,
      captainName: req.auth.name,
      newItems: newItemsCreated.map(i => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        course: i.course,
        itemStatus: i.itemStatus,
        kitchenNotes: i.kitchenNotes,
      })),
    });

    return res.status(201).json({
      success: true,
      message: `KOT fired to kitchen for Table ${table.tableNumber}.`,
      order: serialized,
    });
  } catch (err) {
    console.error('Error placing table order:', err);
    return res.status(500).json({ message: 'Failed to fire table order.' });
  }
});

// POST /api/captain/orders/:orderId/fire-course - Fire held course to kitchen/barista
router.post('/captain/orders/:orderId/fire-course', requireCaptainOrStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { orderId } = req.params;
    const { course } = req.body; // 'starters' | 'mains' | 'desserts' | 'all'

    const order = await Order.findOne({
      where: { id: orderId, cafeId },
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (req.auth.role === 'waiter') {
      const table = await CafeTable.findOne({
        where: { cafeId, tableNumber: order.table, ...tableSectionScope(req) },
      });
      if (!table) return res.status(404).json({ message: 'Order not found.' });
    }

    const filterCourse = course && course !== 'all' ? course : null;
    let firedCount = 0;

    for (const item of order.items || []) {
      if (item.itemStatus === 'hold' && (!filterCourse || item.course === filterCourse)) {
        item.itemStatus = 'fired';
        await item.save();
        firedCount++;
      }
    }

    const reloaded = await Order.findOne({
      where: { id: orderId },
      include: [{ model: OrderItem, as: 'items' }],
    });

    broadcastEvent(cafeId, 'kot_fired', {
      orderId: order.id,
      orderNo: order.orderNo,
      tableNumber: order.table,
      captainName: req.auth.name,
      firedCourse: course,
      firedCount,
    });

    return res.json({
      success: true,
      message: `Course '${course || 'all'}' (${firedCount} items) fired to kitchen!`,
      order: serializeOrder(reloaded),
    });
  } catch (err) {
    console.error('Error firing course:', err);
    return res.status(500).json({ message: 'Failed to fire course.' });
  }
});

// POST /api/captain/orders/:orderId/items/:itemId/void - Cancel/void item with reason code
router.post('/captain/orders/:orderId/items/:itemId/void', requireCaptainOrStaff, requireCaptainManager, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Cancellation reason is mandatory.' });
    }

    const item = await OrderItem.findOne({
      where: { id: itemId, orderId },
    });
    if (!item) return res.status(404).json({ message: 'Order item not found.' });

    if (item.itemStatus === 'void') {
      return res.status(400).json({ message: 'Item is already voided.' });
    }

    const order = await Order.findOne({ where: { id: orderId, cafeId } });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const voidPrice = (item.price || 0) * (item.quantity || 1);
    item.itemStatus = 'void';
    item.voidReason = String(reason).trim();
    item.voidAuthorizedBy = req.auth.name || 'Floor Captain';
    await item.save();

    order.subtotal = Math.max(0, (order.subtotal || 0) - voidPrice);
    order.total = Math.max(0, (order.total || 0) - voidPrice);
    await order.save();

    await createAuditLog({
      cafeId,
      userId: req.auth.id,
      userName: req.auth.name || 'Floor Captain',
      userRole: req.auth.role || 'captain',
      action: 'ORDER_ITEM_VOIDED',
      category: 'order',
      details: {
        orderId,
        itemId,
        itemName: item.name,
        voidAmount: voidPrice,
        reason,
        authorizedBy: item.voidAuthorizedBy,
      },
      status: 'warning',
      req,
    });

    const reloaded = await Order.findOne({
      where: { id: orderId },
      include: [{ model: OrderItem, as: 'items' }],
    });

    const serialized = serializeOrder(reloaded);
    broadcastEvent(cafeId, 'order_updated', serialized);

    return res.json({
      success: true,
      message: `${item.name} voided successfully.`,
      order: serialized,
    });
  } catch (err) {
    console.error('Error voiding item:', err);
    return res.status(500).json({ message: 'Failed to void item.' });
  }
});

// ============================================================================
// 5. TABLE MERGE & TRANSFER
// ============================================================================

// POST /api/captain/tables/transfer - Transfer guest party from Table A to Table B
router.post('/captain/tables/transfer', requireCaptainOrStaff, requireCaptainManager, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { sourceTableId, targetTableId, reason } = req.body;

    if (!sourceTableId || !targetTableId) {
      return res.status(400).json({ message: 'Both source and target tables are required.' });
    }

    const source = await CafeTable.findOne({ where: { id: sourceTableId, cafeId } });
    const target = await CafeTable.findOne({ where: { id: targetTableId, cafeId } });

    if (!source || !target) {
      return res.status(404).json({ message: 'Source or target table not found.' });
    }

    if (target.status === 'occupied' && target.id !== source.id) {
      return res.status(400).json({ message: `Target Table ${target.tableNumber} is already occupied.` });
    }

    const activeOrder = source.activeOrderId
      ? await Order.findOne({ where: { id: source.activeOrderId, cafeId } })
      : null;

    if (activeOrder) {
      activeOrder.table = target.tableNumber;
      await activeOrder.save();
    }

    // Move state to target table
    target.status = 'occupied';
    target.activeOrderId = source.activeOrderId;
    target.guestCount = source.guestCount;
    target.dinerName = source.dinerName;
    target.dinerPhone = source.dinerPhone;
    target.occupiedSince = source.occupiedSince || new Date();
    target.assignedCaptainId = source.assignedCaptainId;
    target.assignedCaptainName = source.assignedCaptainName;
    await target.save();

    // Release source table
    source.status = 'available';
    source.activeOrderId = null;
    source.guestCount = 2;
    source.dinerName = null;
    source.dinerPhone = null;
    source.occupiedSince = null;
    await source.save();

    broadcastEvent(cafeId, 'table_updated', {
      sourceTableId: source.id,
      targetTableId: target.id,
      transferred: true,
    });

    return res.json({
      success: true,
      message: `Transferred party from Table ${source.tableNumber} to Table ${target.tableNumber}.`,
    });
  } catch (err) {
    console.error('Error transferring table:', err);
    return res.status(500).json({ message: 'Failed to transfer table.' });
  }
});

// POST /api/captain/tables/merge - Merge secondary table into primary table
router.post('/captain/tables/merge', requireCaptainOrStaff, requireCaptainManager, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { primaryTableId, secondaryTableId, reason } = req.body;

    if (!primaryTableId || !secondaryTableId) {
      return res.status(400).json({ message: 'Both primary and secondary tables are required.' });
    }

    const primary = await CafeTable.findOne({ where: { id: primaryTableId, cafeId } });
    const secondary = await CafeTable.findOne({ where: { id: secondaryTableId, cafeId } });

    if (!primary || !secondary) {
      return res.status(404).json({ message: 'Tables not found.' });
    }

    // If secondary has items, merge them into primary order
    if (secondary.activeOrderId && secondary.activeOrderId !== primary.activeOrderId) {
      const secOrder = await Order.findOne({
        where: { id: secondary.activeOrderId, cafeId },
        include: [{ model: OrderItem, as: 'items' }],
      });

      if (secOrder && primary.activeOrderId) {
        const primOrder = await Order.findOne({ where: { id: primary.activeOrderId, cafeId } });
        if (primOrder) {
          for (const it of secOrder.items || []) {
            it.orderId = primOrder.id;
            await it.save();
          }
          primOrder.subtotal = (primOrder.subtotal || 0) + (secOrder.subtotal || 0);
          primOrder.total = (primOrder.total || 0) + (secOrder.total || 0);
          primOrder.tableMergedWith = secondary.tableNumber;
          await primOrder.save();

          secOrder.status = 'cancelled';
          secOrder.notes = `Merged into Table ${primary.tableNumber} order ${primOrder.orderNo}`;
          await secOrder.save();
        }
      }
    }

    secondary.mergedIntoTableId = primary.id;
    secondary.status = 'occupied';
    secondary.dinerName = `Merged with T-${primary.tableNumber}`;
    await secondary.save();

    primary.guestCount = (primary.guestCount || 2) + (secondary.guestCount || 2);
    await primary.save();

    broadcastEvent(cafeId, 'table_updated', {
      primaryTableId: primary.id,
      secondaryTableId: secondary.id,
      merged: true,
    });

    return res.json({
      success: true,
      message: `Table ${secondary.tableNumber} merged into Table ${primary.tableNumber}.`,
    });
  } catch (err) {
    console.error('Error merging tables:', err);
    return res.status(500).json({ message: 'Failed to merge tables.' });
  }
});

// ============================================================================
// 6. BILL REQUEST & TABLE RELEASE
// ============================================================================

// POST /api/captain/tables/:id/request-bill - Mark table as billed (Awaiting Payment)
router.post('/captain/tables/:id/request-bill', requireCaptainOrStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { id } = req.params;

    const table = await CafeTable.findOne({ where: { id, cafeId, ...tableSectionScope(req) } });
    if (!table) return res.status(404).json({ message: 'Table not found.' });

    table.status = 'billed';
    await table.save();

    let orderTotal = 0;
    if (table.activeOrderId) {
      const order = await Order.findOne({ where: { id: table.activeOrderId, cafeId } });
      orderTotal = order?.total || 0;
    }

    broadcastEvent(cafeId, 'bill_requested', {
      tableId: table.id,
      tableNumber: table.tableNumber,
      orderTotal,
      captainName: req.auth.name,
      requestedAt: new Date(),
    });

    return res.json({
      success: true,
      message: `Bill requested for Table ${table.tableNumber}. Cashier notified.`,
      table,
    });
  } catch (err) {
    console.error('Error requesting bill:', err);
    return res.status(500).json({ message: 'Failed to request bill.' });
  }
});

// POST /api/captain/tables/:id/release - 1-Click Release/Free Table
router.post('/captain/tables/:id/release', requireCaptainOrStaff, requireCaptainManager, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { id } = req.params;
    const { nextStatus } = req.body; // 'available' | 'cleaning'

    const table = await CafeTable.findOne({ where: { id, cafeId } });
    if (!table) return res.status(404).json({ message: 'Table not found.' });

    table.status = nextStatus === 'cleaning' ? 'cleaning' : 'available';
    table.activeOrderId = null;
    table.currentBookingId = null;
    table.mergedIntoTableId = null;
    table.dinerName = null;
    table.dinerPhone = null;
    table.occupiedSince = null;
    table.guestCount = 2;
    await table.save();

    broadcastEvent(cafeId, 'table_updated', {
      tableId: table.id,
      tableNumber: table.tableNumber,
      status: table.status,
      freed: true,
    });

    return res.json({
      success: true,
      message: `Table ${table.tableNumber} is now ${table.status}.`,
      table,
    });
  } catch (err) {
    console.error('Error releasing table:', err);
    return res.status(500).json({ message: 'Failed to release table.' });
  }
});

export default router;

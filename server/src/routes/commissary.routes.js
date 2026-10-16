import { Router } from 'express';
import { Op } from 'sequelize';
import { requireStaff, requireRole } from '../auth.js';
import {
  CommissaryBatch,
  StockIndent,
  StockIndentItem,
  StockTransfer,
  StockWastageLog,
  PurchaseOrder,
  Cafe,
  InventoryItem,
} from '../models.js';
import {
  createProductionBatch,
  startProductionBatch,
  completeProductionBatch,
  createIndentRequest,
  approveIndent,
  dispatchIndentSTN,
  receiveIndentGRN,
  logStockWastage,
  approveStockWastage,
  getWastageSummary,
  checkReorderPointTriggers,
  generateDraftPurchaseOrder,
  updatePurchaseOrderStatus,
  formatPurchaseOrderText,
} from '../commissaryEngine.js';
import {
  serializeCommissaryBatch,
  serializeIndent,
  serializeWastageLog,
  serializePurchaseOrder,
} from './serializers.js';

export const commissaryRouter = Router();

/* ==========================================================================
   1. Production Batching (Roastery Commissary & Central Kitchen)
   ========================================================================== */

// GET /api/owner/commissary/batches
commissaryRouter.get('/owner/commissary/batches', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { status, limit = 50 } = req.query;
    const where = { cafeId };
    if (status) where.status = status;

    const batches = await CommissaryBatch.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Number(limit) || 50,
    });

    res.json(batches.map(serializeCommissaryBatch));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch commissary batches.' });
  }
});

// POST /api/owner/commissary/batches
commissaryRouter.post('/owner/commissary/batches', requireRole('owner', 'manager', 'lead_barista'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const {
      recipeName,
      outputInventoryItemId,
      outputItemName,
      plannedQuantity,
      unit,
      bomIngredients,
      operatorName,
      roasterNotes,
    } = req.body;

    if (!recipeName) {
      return res.status(400).json({ message: 'Recipe name is required.' });
    }

    const batch = await createProductionBatch({
      cafeId,
      recipeName,
      outputInventoryItemId,
      outputItemName,
      plannedQuantity,
      unit,
      bomIngredients,
      operatorName,
      roasterNotes,
    });

    res.status(201).json(serializeCommissaryBatch(batch));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create commissary batch.' });
  }
});

// POST /api/owner/commissary/batches/:id/start
commissaryRouter.post('/owner/commissary/batches/:id/start', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { operatorName } = req.body;
    const batch = await startProductionBatch(req.params.id, cafeId, operatorName);
    res.json(serializeCommissaryBatch(batch));
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to start commissary batch.' });
  }
});

// POST /api/owner/commissary/batches/:id/complete
commissaryRouter.post('/owner/commissary/batches/:id/complete', requireRole('owner', 'manager', 'lead_barista'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const {
      producedQuantity,
      shrinkagePercent,
      roasterNotes,
      operatorName,
      actualBomConsumed,
    } = req.body;

    if (producedQuantity === undefined || producedQuantity === null) {
      return res.status(400).json({ message: 'producedQuantity is required.' });
    }

    const result = await completeProductionBatch(req.params.id, cafeId, {
      producedQuantity,
      shrinkagePercent,
      roasterNotes,
      operatorName,
      actualBomConsumed,
    });

    res.json({
      batch: serializeCommissaryBatch(result.batch),
      rawDeductions: result.rawDeductions,
      outputAdded: result.outputAdded,
    });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to complete production batch.' });
  }
});

/* ==========================================================================
   2. Inter-Store Indents & STN / GRN Lifecycle
   ========================================================================== */

// GET /api/owner/commissary/indents
commissaryRouter.get('/owner/commissary/indents', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { type, status } = req.query;

    let where = {};
    if (type === 'outgoing') {
      where.requestingCafeId = cafeId;
    } else if (type === 'incoming') {
      where.supplyingCafeId = cafeId;
    } else {
      where = {
        [Op.or]: [
          { requestingCafeId: cafeId },
          { supplyingCafeId: cafeId },
        ],
      };
    }
    if (status) where.status = status;

    const indents = await StockIndent.findAll({
      where,
      include: [
        { model: StockIndentItem, as: 'items' },
        { model: StockTransfer, as: 'transfer' },
        { model: Cafe, as: 'requestingCafe', attributes: ['id', 'name'] },
        { model: Cafe, as: 'supplyingCafe', attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json(indents.map(serializeIndent));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch stock indents.' });
  }
});

// GET /api/owner/commissary/indents/:id
commissaryRouter.get('/owner/commissary/indents/:id', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const indent = await StockIndent.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [
          { requestingCafeId: cafeId },
          { supplyingCafeId: cafeId },
        ],
      },
      include: [
        { model: StockIndentItem, as: 'items' },
        { model: StockTransfer, as: 'transfer' },
        { model: Cafe, as: 'requestingCafe', attributes: ['id', 'name'] },
        { model: Cafe, as: 'supplyingCafe', attributes: ['id', 'name'] },
      ],
    });

    if (!indent) return res.status(404).json({ message: 'Stock indent not found.' });
    res.json(serializeIndent(indent));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch stock indent.' });
  }
});

// POST /api/owner/commissary/indents
commissaryRouter.post('/owner/commissary/indents', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const {
      supplyingCafeId,
      priority,
      notes,
      requestedBy,
      items,
    } = req.body;

    if (!supplyingCafeId) {
      return res.status(400).json({ message: 'supplyingCafeId (Commissary or Warehouse outlet) is required.' });
    }
    if (!items || !items.length) {
      return res.status(400).json({ message: 'Indent must have at least one stock line item.' });
    }

    const result = await createIndentRequest({
      requestingCafeId: cafeId,
      supplyingCafeId,
      priority,
      notes,
      requestedBy,
      items,
    });

    res.status(201).json({
      indent: serializeIndent(result.indent),
      items: result.items,
    });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to create indent request.' });
  }
});

// POST /api/owner/commissary/indents/:id/approve
commissaryRouter.post('/owner/commissary/indents/:id/approve', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { approvedBy, itemApprovals } = req.body;

    const indent = await approveIndent(req.params.id, cafeId, {
      approvedBy,
      itemApprovals,
    });

    res.json(serializeIndent(indent));
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to approve indent.' });
  }
});

// POST /api/owner/commissary/indents/:id/dispatch
commissaryRouter.post('/owner/commissary/indents/:id/dispatch', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const {
      dispatchedBy,
      transporterName,
      vehicleNumber,
      driverContact,
      dispatchQuantities,
    } = req.body;

    const result = await dispatchIndentSTN(req.params.id, cafeId, {
      dispatchedBy,
      transporterName,
      vehicleNumber,
      driverContact,
      dispatchQuantities,
    });

    res.json({
      indent: serializeIndent(result.indent),
      transfer: result.transfer,
    });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to dispatch indent STN.' });
  }
});

// POST /api/owner/commissary/indents/:id/receive
commissaryRouter.post('/owner/commissary/indents/:id/receive', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { receivedBy, receivedQuantities } = req.body;

    const result = await receiveIndentGRN(req.params.id, cafeId, {
      receivedBy,
      receivedQuantities,
    });

    res.json({
      indent: serializeIndent(result.indent),
      transfer: result.transfer,
      variances: result.variances,
    });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to receive indent GRN.' });
  }
});

/* ==========================================================================
   3. Spoilage & Wastage Auditing
   ========================================================================== */

// GET /api/owner/commissary/wastage
commissaryRouter.get('/owner/commissary/wastage', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { startDate, endDate } = req.query;

    const summary = await getWastageSummary(cafeId, { startDate, endDate });
    res.json({
      ...summary,
      recentLogs: summary.recentLogs.map(serializeWastageLog),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch wastage summary.' });
  }
});

// POST /api/owner/commissary/wastage
commissaryRouter.post('/owner/commissary/wastage', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const {
      inventoryItemId,
      quantity,
      unit,
      reason,
      notes,
      loggedBy,
      costPerUnit,
    } = req.body;

    if (!inventoryItemId || !quantity) {
      return res.status(400).json({ message: 'inventoryItemId and quantity are required.' });
    }

    const log = await logStockWastage({
      cafeId,
      inventoryItemId,
      quantity,
      unit,
      reason,
      notes,
      loggedBy,
      costPerUnit,
    });

    res.status(201).json(serializeWastageLog(log));
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to log stock wastage.' });
  }
});

// POST /api/owner/commissary/wastage/:id/approve
commissaryRouter.post('/owner/commissary/wastage/:id/approve', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { approvedBy } = req.body;
    const log = await approveStockWastage(req.params.id, cafeId, approvedBy);
    res.json(serializeWastageLog(log));
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to approve wastage log.' });
  }
});

/* ==========================================================================
   4. Automated Reorder Point (ROP) & Purchase Orders
   ========================================================================== */

// GET /api/owner/commissary/rop/alerts
commissaryRouter.get('/owner/commissary/rop/alerts', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const alerts = await checkReorderPointTriggers(cafeId);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to check reorder point alerts.' });
  }
});

// GET /api/owner/commissary/purchase-orders
commissaryRouter.get('/owner/commissary/purchase-orders', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { status } = req.query;
    const where = { cafeId };
    if (status) where.status = status;

    const orders = await PurchaseOrder.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    res.json(orders.map(serializePurchaseOrder));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch purchase orders.' });
  }
});

// POST /api/owner/commissary/purchase-orders
commissaryRouter.post('/owner/commissary/purchase-orders', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const {
      supplierName,
      supplierEmail,
      supplierPhone,
      items,
      notes,
      createdByUser,
      triggerReason,
      expectedDeliveryDate,
    } = req.body;

    if (!supplierName) {
      return res.status(400).json({ message: 'supplierName is required.' });
    }
    if (!items || !items.length) {
      return res.status(400).json({ message: 'Purchase order must have at least one line item.' });
    }

    const po = await generateDraftPurchaseOrder(cafeId, {
      supplierName,
      supplierEmail,
      supplierPhone,
      items,
      notes,
      createdByUser,
      triggerReason,
      expectedDeliveryDate,
    });

    res.status(201).json(serializePurchaseOrder(po));
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to create purchase order.' });
  }
});

// PATCH /api/owner/commissary/purchase-orders/:id/status
commissaryRouter.patch('/owner/commissary/purchase-orders/:id/status', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { status, autoRestock, recordedBy } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'status is required.' });
    }

    const po = await updatePurchaseOrderStatus(req.params.id, cafeId, status, {
      autoRestock,
      recordedBy,
    });

    res.json(serializePurchaseOrder(po));
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to update purchase order status.' });
  }
});

// GET /api/owner/commissary/purchase-orders/:id/print
commissaryRouter.get('/owner/commissary/purchase-orders/:id/print', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const po = await PurchaseOrder.findOne({ where: { id: req.params.id, cafeId } });
    if (!po) return res.status(404).json({ message: 'Purchase order not found.' });

    const cafe = await Cafe.findByPk(cafeId);
    const text = formatPurchaseOrderText(po, cafe || {});

    res.json({
      po: serializePurchaseOrder(po),
      printableText: text,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to format purchase order.' });
  }
});

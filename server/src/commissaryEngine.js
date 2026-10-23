import { Op } from 'sequelize';
import {
  InventoryItem,
  StockLedger,
  CommissaryBatch,
  StockIndent,
  StockIndentItem,
  StockTransfer,
  StockWastageLog,
  PurchaseOrder,
  Cafe,
} from './models.js';
import { normalizeQuantity, calculateStockStatus } from './inventoryEngine.js';
import { broadcastEvent } from './eventBus.js';

export function round2(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

export function round4(num) {
  return Math.round((Number(num) || 0) * 10000) / 10000;
}

/**
 * Calculate roasting or culinary shrinkage percentage and net yield
 */
export function calculateRoastShrinkage(greenWeight, roastedWeight) {
  const green = Number(greenWeight) || 0;
  const roasted = Number(roastedWeight) || 0;

  if (green <= 0 || roasted <= 0 || roasted > green) {
    return { shrinkagePercent: 0, yieldPercent: 100, lossWeight: 0 };
  }

  const lossWeight = round2(green - roasted);
  const shrinkagePercent = round2(((green - roasted) / green) * 100);
  const yieldPercent = round2((roasted / green) * 100);

  return { shrinkagePercent, yieldPercent, lossWeight };
}

export function generateBatchNumber(prefix = 'BATCH') {
  const d = new Date();
  const yymm = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${yymm}-${rand}`;
}

export function generateIndentNumber(prefix = 'IND') {
  const d = new Date();
  const yymm = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${yymm}-${rand}`;
}

export function generateStnNumber(prefix = 'STN') {
  const d = new Date();
  const yymm = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${yymm}-${rand}`;
}

export function generatePoNumber(prefix = 'PO') {
  const d = new Date();
  const yymm = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${yymm}-${rand}`;
}

/* ==========================================================================
   1. Commissary Production Batching
   ========================================================================== */

export async function createProductionBatch({
  cafeId,
  brandId = null,
  recipeName,
  outputInventoryItemId = null,
  outputItemName = '',
  plannedQuantity = 0,
  unit = 'kg',
  bomIngredients = [],
  operatorName = 'Master Roaster',
  roasterNotes = '',
}) {
  let resolvedOutputName = outputItemName;
  let resolvedUnit = unit;

  if (outputInventoryItemId) {
    const outItem = await InventoryItem.findOne({ where: { id: outputInventoryItemId, cafeId } });
    if (outItem) {
      if (!resolvedOutputName) resolvedOutputName = outItem.name;
      if (!unit || unit === 'kg') resolvedUnit = outItem.unit || 'kg';
    }
  }

  // Calculate estimated BOM cost
  let totalCost = 0;
  const processedBOM = (bomIngredients || []).map(ing => {
    const qty = Number(ing.quantityRequired || ing.quantity || 0);
    const cpu = Number(ing.costPerUnit || 0);
    const lineCost = round2(qty * cpu);
    totalCost += lineCost;
    return {
      inventoryItemId: ing.inventoryItemId || null,
      name: ing.name || 'Raw Ingredient',
      quantityRequired: qty,
      quantityConsumed: qty,
      unit: ing.unit || 'kg',
      costPerUnit: cpu,
      totalCost: lineCost,
    };
  });

  const costPerUnit = plannedQuantity > 0 ? round2(totalCost / plannedQuantity) : 0;

  const batch = await CommissaryBatch.create({
    cafeId,
    brandId,
    batchNumber: generateBatchNumber('BATCH'),
    recipeName,
    outputInventoryItemId,
    outputItemName: resolvedOutputName || recipeName,
    plannedQuantity: Number(plannedQuantity) || 0,
    producedQuantity: 0,
    unit: resolvedUnit,
    shrinkagePercent: 0,
    status: 'planned',
    bomIngredients: processedBOM,
    totalCost: round2(totalCost),
    costPerUnit,
    roasterNotes,
    operatorName,
    startedAt: null,
    completedAt: null,
  });

  broadcastEvent(cafeId, 'commissary_batch_created', batch);
  return batch;
}

export async function startProductionBatch(batchId, cafeId, operatorName) {
  const batch = await CommissaryBatch.findOne({ where: { id: batchId, cafeId } });
  if (!batch) throw new Error('Commissary batch not found');
  if (batch.status === 'completed' || batch.status === 'cancelled') {
    throw new Error(`Cannot start batch in ${batch.status} status`);
  }

  batch.status = 'in_progress';
  batch.startedAt = new Date();
  if (operatorName) batch.operatorName = operatorName;
  await batch.save();

  broadcastEvent(cafeId, 'commissary_batch_updated', batch);
  return batch;
}

export async function completeProductionBatch(batchId, cafeId, {
  producedQuantity,
  shrinkagePercent = null,
  roasterNotes = null,
  operatorName = null,
  actualBomConsumed = null,
} = {}) {
  const batch = await CommissaryBatch.findOne({ where: { id: batchId, cafeId } });
  if (!batch) throw new Error('Commissary batch not found');
  if (batch.status === 'completed') throw new Error('Batch has already been completed');

  const prodQty = Number(producedQuantity);
  if (isNaN(prodQty) || prodQty <= 0) {
    throw new Error('Produced quantity must be greater than zero');
  }

  const bom = actualBomConsumed && Array.isArray(actualBomConsumed)
    ? actualBomConsumed
    : (Array.isArray(batch.bomIngredients) ? batch.bomIngredients : JSON.parse(batch.bomIngredients || '[]'));

  // 1. Deduct raw materials from inventory and log StockLedger
  let totalRawCost = 0;
  const rawDeductions = [];

  for (const ing of bom) {
    const consumedQty = Number(ing.quantityConsumed || ing.quantityRequired || 0);
    const cpu = Number(ing.costPerUnit || 0);
    totalRawCost += round2(consumedQty * cpu);

    if (ing.inventoryItemId && consumedQty > 0) {
      const invItem = await InventoryItem.findOne({ where: { id: ing.inventoryItemId, cafeId } });
      if (invItem) {
        const stockBefore = Number(invItem.currentStock) || 0;
        const normalizedDeduct = normalizeQuantity(consumedQty, ing.unit, invItem.unit);
        const stockAfter = Math.max(0, round4(stockBefore - normalizedDeduct));

        invItem.currentStock = stockAfter;
        invItem.status = calculateStockStatus(stockAfter, invItem.lowStockThreshold);
        await invItem.save();

        await StockLedger.create({
          cafeId,
          inventoryItemId: invItem.id,
          changeType: 'manual_adjustment',
          quantityDelta: -normalizedDeduct,
          stockBefore,
          stockAfter,
          referenceId: batch.batchNumber,
          notes: `Commissary batch #${batch.batchNumber} consumed: ${consumedQty} ${ing.unit} for ${batch.recipeName}`,
          recordedBy: operatorName || batch.operatorName || 'Roastery Production',
        });

        rawDeductions.push({
          itemId: invItem.id,
          name: invItem.name,
          deducted: normalizedDeduct,
          unit: invItem.unit,
          stockAfter,
        });
      }
    }
  }

  // 2. Add finished product to inventory (if output item is mapped)
  let outputAdded = null;
  if (batch.outputInventoryItemId) {
    const finishedItem = await InventoryItem.findOne({ where: { id: batch.outputInventoryItemId, cafeId } });
    if (finishedItem) {
      const stockBefore = Number(finishedItem.currentStock) || 0;
      const normalizedAdd = normalizeQuantity(prodQty, batch.unit, finishedItem.unit);
      const stockAfter = round4(stockBefore + normalizedAdd);

      finishedItem.currentStock = stockAfter;
      finishedItem.status = calculateStockStatus(stockAfter, finishedItem.lowStockThreshold);
      finishedItem.isCommissaryProduced = true;

      // Update unit cost based on production yield
      const calculatedUnitCost = round2(totalRawCost / prodQty);
      if (calculatedUnitCost > 0) {
        finishedItem.costPerUnit = calculatedUnitCost;
      }
      await finishedItem.save();

      await StockLedger.create({
        cafeId,
        inventoryItemId: finishedItem.id,
        changeType: 'purchase_restock',
        quantityDelta: normalizedAdd,
        stockBefore,
        stockAfter,
        referenceId: batch.batchNumber,
        notes: `Commissary yield #${batch.batchNumber}: +${prodQty} ${batch.unit} ${batch.recipeName}`,
        recordedBy: operatorName || batch.operatorName || 'Roastery Production',
      });

      outputAdded = {
        itemId: finishedItem.id,
        name: finishedItem.name,
        added: normalizedAdd,
        unit: finishedItem.unit,
        stockAfter,
        unitCost: calculatedUnitCost,
      };
    }
  }

  // 3. Compute shrinkage
  let computedShrinkage = shrinkagePercent;
  if (computedShrinkage === null || computedShrinkage === undefined) {
    if (batch.plannedQuantity > 0 && batch.plannedQuantity >= prodQty) {
      computedShrinkage = round2(((batch.plannedQuantity - prodQty) / batch.plannedQuantity) * 100);
    } else {
      computedShrinkage = 0;
    }
  }

  batch.producedQuantity = prodQty;
  batch.shrinkagePercent = Number(computedShrinkage) || 0;
  batch.totalCost = round2(totalRawCost);
  batch.costPerUnit = prodQty > 0 ? round2(totalRawCost / prodQty) : 0;
  batch.status = 'completed';
  batch.completedAt = new Date();
  if (!batch.startedAt) batch.startedAt = new Date();
  if (roasterNotes) batch.roasterNotes = roasterNotes;
  if (operatorName) batch.operatorName = operatorName;
  await batch.save();

  broadcastEvent(cafeId, 'commissary_batch_completed', batch);

  return {
    batch,
    rawDeductions,
    outputAdded,
  };
}

/* ==========================================================================
   2. Inter-Store Indents & STN / GRN Lifecycle
   ========================================================================== */

export async function createIndentRequest({
  requestingCafeId,
  supplyingCafeId,
  brandId = null,
  priority = 'normal',
  notes = '',
  requestedBy = 'Store Manager',
  items = [],
}) {
  if (!requestingCafeId || !supplyingCafeId) {
    throw new Error('Both requestingCafeId and supplyingCafeId are required');
  }

  const indentNumber = generateIndentNumber('IND');

  const indent = await StockIndent.create({
    brandId,
    requestingCafeId,
    supplyingCafeId,
    indentNumber,
    status: 'submitted',
    priority,
    notes,
    requestedBy,
    submittedAt: new Date(),
  });

  const createdItems = [];
  for (const item of items) {
    const requestedQty = Number(item.requestedQty || item.quantity || 0);
    const line = await StockIndentItem.create({
      indentId: indent.id,
      inventoryItemId: item.inventoryItemId || null,
      destinationInventoryItemId: item.destinationInventoryItemId || null,
      itemName: item.itemName || item.name || 'Stock Item',
      category: item.category || 'Roastery / Kitchen',
      unit: item.unit || 'kg',
      requestedQty,
      approvedQty: requestedQty, // defaults to requested, commissary manager can adjust upon approval
      dispatchedQty: 0,
      receivedQty: 0,
      varianceQty: 0,
      varianceReason: null,
      notes: item.notes || null,
    });
    createdItems.push(line);
  }

  broadcastEvent(supplyingCafeId, 'indent_received', { indent, items: createdItems });
  broadcastEvent(requestingCafeId, 'indent_submitted', { indent, items: createdItems });

  return { indent, items: createdItems };
}

export async function approveIndent(indentId, supplyingCafeId, {
  approvedBy = 'Commissary Manager',
  itemApprovals = [], // [{ id, approvedQty }]
} = {}) {
  const indent = await StockIndent.findOne({
    where: { id: indentId, supplyingCafeId },
    include: [{ model: StockIndentItem, as: 'items' }],
  });
  if (!indent) throw new Error('Stock indent not found');
  if (indent.status !== 'submitted' && indent.status !== 'draft') {
    throw new Error(`Cannot approve indent in ${indent.status} status`);
  }

  // Update item approved quantities if provided
  const approvalMap = new Map();
  itemApprovals.forEach(a => approvalMap.set(a.id, Number(a.approvedQty)));

  for (const item of (indent.items || [])) {
    if (approvalMap.has(item.id)) {
      item.approvedQty = approvalMap.get(item.id);
      await item.save();
    }
  }

  indent.status = 'approved';
  indent.approvedAt = new Date();
  indent.approvedBy = approvedBy;
  await indent.save();

  broadcastEvent(indent.requestingCafeId, 'indent_approved', indent);
  broadcastEvent(supplyingCafeId, 'indent_approved', indent);

  return indent;
}

export async function dispatchIndentSTN(indentId, supplyingCafeId, {
  dispatchedBy = 'Commissary Dispatch Lead',
  transporterName = 'GUESTORA Fleet Logistics',
  vehicleNumber = 'MH-12-GF-4491',
  driverContact = '+91 98200 44123',
  dispatchQuantities = [], // [{ id, dispatchedQty }]
} = {}) {
  const indent = await StockIndent.findOne({
    where: { id: indentId, supplyingCafeId },
    include: [{ model: StockIndentItem, as: 'items' }],
  });
  if (!indent) throw new Error('Stock indent not found');
  if (indent.status !== 'approved') {
    throw new Error(`Indent must be in approved status before dispatch (current: ${indent.status})`);
  }

  const dispatchMap = new Map();
  dispatchQuantities.forEach(d => dispatchMap.set(d.id, Number(d.dispatchedQty)));

  const stnItemsSnapshot = [];

  // Deduct inventory from supplying store (commissary)
  for (const item of (indent.items || [])) {
    const dispatchedQty = dispatchMap.has(item.id)
      ? dispatchMap.get(item.id)
      : Number(item.approvedQty || item.requestedQty || 0);

    item.dispatchedQty = dispatchedQty;
    await item.save();

    stnItemsSnapshot.push({
      itemId: item.id,
      itemName: item.itemName,
      dispatchedQty,
      unit: item.unit,
    });

    if (item.inventoryItemId && dispatchedQty > 0) {
      const invItem = await InventoryItem.findOne({ where: { id: item.inventoryItemId, cafeId: supplyingCafeId } });
      if (invItem) {
        const stockBefore = Number(invItem.currentStock) || 0;
        const normalizedDeduct = normalizeQuantity(dispatchedQty, item.unit, invItem.unit);
        const stockAfter = Math.max(0, round4(stockBefore - normalizedDeduct));

        invItem.currentStock = stockAfter;
        invItem.status = calculateStockStatus(stockAfter, invItem.lowStockThreshold);
        await invItem.save();

        await StockLedger.create({
          cafeId: supplyingCafeId,
          inventoryItemId: invItem.id,
          changeType: 'manual_adjustment',
          quantityDelta: -normalizedDeduct,
          stockBefore,
          stockAfter,
          referenceId: indent.indentNumber,
          notes: `STN Dispatch for Indent #${indent.indentNumber} to outlet`,
          recordedBy: dispatchedBy,
        });
      }
    }
  }

  // Create Stock Transfer Note (STN)
  const stn = await StockTransfer.create({
    indentId: indent.id,
    stnNumber: generateStnNumber('STN'),
    supplyingCafeId,
    requestingCafeId: indent.requestingCafeId,
    transporterName,
    vehicleNumber,
    driverContact,
    status: 'in_transit',
    dispatchTime: new Date(),
    deliveryTime: null,
    stnItems: stnItemsSnapshot,
  });

  indent.status = 'dispatched';
  indent.dispatchedAt = new Date();
  indent.dispatchedBy = dispatchedBy;
  await indent.save();

  broadcastEvent(indent.requestingCafeId, 'indent_dispatched', { indent, transfer: stn });
  broadcastEvent(supplyingCafeId, 'indent_dispatched', { indent, transfer: stn });

  return { indent, transfer: stn };
}

export async function receiveIndentGRN(indentId, requestingCafeId, {
  receivedBy = 'Store Receiving Lead',
  receivedQuantities = [], // [{ id, receivedQty, varianceReason }]
} = {}) {
  const indent = await StockIndent.findOne({
    where: { id: indentId, requestingCafeId },
    include: [
      { model: StockIndentItem, as: 'items' },
      { model: StockTransfer, as: 'transfer' },
    ],
  });
  if (!indent) throw new Error('Stock indent not found');
  if (indent.status !== 'dispatched') {
    throw new Error(`Indent must be in dispatched status before receipt (current: ${indent.status})`);
  }

  const receiptMap = new Map();
  receivedQuantities.forEach(r => {
    receiptMap.set(r.id, {
      receivedQty: Number(r.receivedQty),
      varianceReason: r.varianceReason || null,
    });
  });

  const variances = [];

  // Replenish inventory in requesting store
  for (const item of (indent.items || [])) {
    const receiptData = receiptMap.get(item.id);
    const recQty = receiptData !== undefined && !isNaN(receiptData.receivedQty)
      ? receiptData.receivedQty
      : Number(item.dispatchedQty || item.approvedQty || 0);

    const variance = round2(recQty - Number(item.dispatchedQty || 0));
    item.receivedQty = recQty;
    item.varianceQty = variance;
    if (variance !== 0 && receiptData?.varianceReason) {
      item.varianceReason = receiptData.varianceReason;
    }
    await item.save();

    if (variance !== 0) {
      variances.push({
        itemName: item.itemName,
        dispatched: item.dispatchedQty,
        received: recQty,
        variance,
        reason: item.varianceReason || (variance < 0 ? 'Transit Shortage / Loss' : 'Overage'),
      });
    }

    // Find destination inventory item or match by name
    if (recQty > 0) {
      let destItem = null;
      if (item.destinationInventoryItemId) {
        destItem = await InventoryItem.findOne({ where: { id: item.destinationInventoryItemId, cafeId: requestingCafeId } });
      }
      if (!destItem) {
        destItem = await InventoryItem.findOne({
          where: {
            cafeId: requestingCafeId,
            name: { [Op.like]: item.itemName },
          },
        });
      }

      if (destItem) {
        const stockBefore = Number(destItem.currentStock) || 0;
        const normalizedAdd = normalizeQuantity(recQty, item.unit, destItem.unit);
        const stockAfter = round4(stockBefore + normalizedAdd);

        destItem.currentStock = stockAfter;
        destItem.status = calculateStockStatus(stockAfter, destItem.lowStockThreshold);
        await destItem.save();

        await StockLedger.create({
          cafeId: requestingCafeId,
          inventoryItemId: destItem.id,
          changeType: 'purchase_restock',
          quantityDelta: normalizedAdd,
          stockBefore,
          stockAfter,
          referenceId: indent.indentNumber,
          notes: `GRN Receipt from Commissary #${indent.indentNumber} via STN #${indent.transfer?.stnNumber || ''}`,
          recordedBy: receivedBy,
        });
      }
    }
  }

  // Update STN delivery status
  if (indent.transfer) {
    indent.transfer.status = 'delivered';
    indent.transfer.deliveryTime = new Date();
    await indent.transfer.save();
  }

  indent.status = 'received';
  indent.receivedAt = new Date();
  indent.receivedBy = receivedBy;
  await indent.save();

  broadcastEvent(requestingCafeId, 'indent_received', { indent, variances });
  broadcastEvent(indent.supplyingCafeId, 'indent_completed', { indent, variances });

  return { indent, transfer: indent.transfer, variances };
}

/* ==========================================================================
   3. Spoilage & Wastage Auditing
   ========================================================================== */

export async function logStockWastage({
  cafeId,
  inventoryItemId,
  quantity,
  unit = null,
  reason = 'expired',
  notes = '',
  loggedBy = 'Head Barista',
  costPerUnit = null,
}) {
  const invItem = await InventoryItem.findOne({ where: { id: inventoryItemId, cafeId } });
  if (!invItem) throw new Error('Inventory item not found');

  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) throw new Error('Wastage quantity must be greater than zero');

  const resolvedUnit = unit || invItem.unit;
  const cpu = costPerUnit !== null && !isNaN(Number(costPerUnit))
    ? Number(costPerUnit)
    : Number(invItem.costPerUnit || 0);
  const totalCost = round2(qty * cpu);

  // Deduct from current stock
  const stockBefore = Number(invItem.currentStock) || 0;
  const normalizedDeduct = normalizeQuantity(qty, resolvedUnit, invItem.unit);
  const stockAfter = Math.max(0, round4(stockBefore - normalizedDeduct));

  invItem.currentStock = stockAfter;
  invItem.status = calculateStockStatus(stockAfter, invItem.lowStockThreshold);
  await invItem.save();

  await StockLedger.create({
    cafeId,
    inventoryItemId: invItem.id,
    changeType: 'waste_spoilage',
    quantityDelta: -normalizedDeduct,
    stockBefore,
    stockAfter,
    referenceId: `WASTE-${Date.now().toString().slice(-6)}`,
    notes: `Wastage logged [${reason}]: ${qty} ${resolvedUnit}. ${notes || ''}`,
    recordedBy: loggedBy,
  });

  const log = await StockWastageLog.create({
    cafeId,
    inventoryItemId: invItem.id,
    itemName: invItem.name,
    quantity: qty,
    unit: resolvedUnit,
    costPerUnit: cpu,
    totalCost,
    reason,
    notes,
    loggedBy,
    approvedBy: null,
    status: 'approved',
    loggedAt: new Date(),
  });

  broadcastEvent(cafeId, 'wastage_logged', log);
  return log;
}

export async function approveStockWastage(wastageId, cafeId, approvedBy = 'Operations Manager') {
  const log = await StockWastageLog.findOne({ where: { id: wastageId, cafeId } });
  if (!log) throw new Error('Wastage log not found');
  log.status = 'approved';
  log.approvedBy = approvedBy;
  await log.save();
  return log;
}

export async function getWastageSummary(cafeId, { startDate, endDate } = {}) {
  const where = { cafeId };
  if (startDate || endDate) {
    where.loggedAt = {};
    if (startDate) where.loggedAt[Op.gte] = new Date(startDate);
    if (endDate) where.loggedAt[Op.lte] = new Date(endDate);
  }

  const logs = await StockWastageLog.findAll({
    where,
    order: [['loggedAt', 'DESC']],
  });

  let totalLoss = 0;
  const byReason = {};

  for (const log of logs) {
    totalLoss += Number(log.totalCost || 0);
    const r = log.reason || 'other';
    if (!byReason[r]) {
      byReason[r] = { count: 0, totalCost: 0, quantity: 0, unit: log.unit };
    }
    byReason[r].count += 1;
    byReason[r].totalCost = round2(byReason[r].totalCost + Number(log.totalCost || 0));
    byReason[r].quantity = round2(byReason[r].quantity + Number(log.quantity || 0));
  }

  return {
    totalLoss: round2(totalLoss),
    totalEntries: logs.length,
    byReason,
    recentLogs: logs.slice(0, 50),
  };
}

/* ==========================================================================
   4. Automated Reorder Point (ROP) & Purchase Orders
   ========================================================================== */

export async function checkReorderPointTriggers(cafeId) {
  const items = await InventoryItem.findAll({
    where: {
      cafeId,
      isActive: true,
    },
  });

  const lowStockItems = [];
  const groupedBySupplier = {};

  for (const item of items) {
    const stock = Number(item.currentStock) || 0;
    const threshold = Number(item.lowStockThreshold) || 1.0;
    const reorderQty = Number(item.reorderQuantity) || 5.0;
    const target = Number(item.targetStockLevel) || 10.0;

    if (stock <= threshold) {
      const suggestedOrderQty = Math.max(reorderQty, round2(target - stock));
      const lineCost = round2(suggestedOrderQty * (Number(item.costPerUnit) || 0));

      const entry = {
        inventoryItemId: item.id,
        itemName: item.name,
        category: item.category,
        currentStock: stock,
        unit: item.unit,
        lowStockThreshold: threshold,
        suggestedOrderQty,
        costPerUnit: Number(item.costPerUnit) || 0,
        estimatedTotalCost: lineCost,
        supplier: item.supplier || 'Primary Roastery Supplier',
        supplierEmail: item.supplierEmail || null,
        supplierPhone: item.supplierPhone || null,
        isCommissaryProduced: Boolean(item.isCommissaryProduced),
      };

      lowStockItems.push(entry);

      const suppKey = entry.supplier;
      if (!groupedBySupplier[suppKey]) {
        groupedBySupplier[suppKey] = {
          supplierName: suppKey,
          supplierEmail: entry.supplierEmail,
          supplierPhone: entry.supplierPhone,
          items: [],
          totalEstimatedAmount: 0,
        };
      }
      groupedBySupplier[suppKey].items.push(entry);
      groupedBySupplier[suppKey].totalEstimatedAmount = round2(
        groupedBySupplier[suppKey].totalEstimatedAmount + lineCost
      );
    }
  }

  return {
    triggeredCount: lowStockItems.length,
    lowStockItems,
    groupedBySupplier,
  };
}

export async function generateDraftPurchaseOrder(cafeId, {
  supplierName,
  supplierEmail = '',
  supplierPhone = '',
  items = [],
  notes = '',
  createdByUser = 'Inventory Manager',
  triggerReason = 'rop_auto_alert',
  expectedDeliveryDate = null,
}) {
  let totalAmount = 0;
  const processedItems = items.map(i => {
    const qty = Number(i.orderQty || i.suggestedOrderQty || i.quantity || 0);
    const cpu = Number(i.costPerUnit || i.estimatedUnitCost || 0);
    const lineTotal = round2(qty * cpu);
    totalAmount += lineTotal;
    return {
      inventoryItemId: i.inventoryItemId || null,
      itemName: i.itemName || 'Stock Item',
      unit: i.unit || 'kg',
      currentStock: Number(i.currentStock || 0),
      orderQty: qty,
      costPerUnit: cpu,
      lineTotal,
    };
  });

  const po = await PurchaseOrder.create({
    cafeId,
    poNumber: generatePoNumber('PO'),
    supplierName: supplierName || 'General Provisions Vendor',
    supplierEmail,
    supplierPhone,
    status: 'draft',
    triggerReason,
    items: processedItems,
    totalAmount: round2(totalAmount),
    notes,
    expectedDeliveryDate,
    createdByUser,
    sentAt: null,
    fulfilledAt: null,
  });

  broadcastEvent(cafeId, 'purchase_order_created', po);
  return po;
}

export async function updatePurchaseOrderStatus(poId, cafeId, status, { autoRestock = false, recordedBy = 'Manager' } = {}) {
  const po = await PurchaseOrder.findOne({ where: { id: poId, cafeId } });
  if (!po) throw new Error('Purchase order not found');

  po.status = status;
  if (status === 'sent') {
    po.sentAt = new Date();
  } else if (status === 'fulfilled') {
    po.fulfilledAt = new Date();

    // If autoRestock is requested, increment stock items
    if (autoRestock) {
      const items = Array.isArray(po.items) ? po.items : JSON.parse(po.items || '[]');
      for (const item of items) {
        if (item.inventoryItemId && Number(item.orderQty) > 0) {
          const invItem = await InventoryItem.findOne({ where: { id: item.inventoryItemId, cafeId } });
          if (invItem) {
            const stockBefore = Number(invItem.currentStock) || 0;
            const normalizedAdd = normalizeQuantity(item.orderQty, item.unit, invItem.unit);
            const stockAfter = round4(stockBefore + normalizedAdd);

            invItem.currentStock = stockAfter;
            invItem.status = calculateStockStatus(stockAfter, invItem.lowStockThreshold);
            if (item.costPerUnit > 0) invItem.costPerUnit = Number(item.costPerUnit);
            await invItem.save();

            await StockLedger.create({
              cafeId,
              inventoryItemId: invItem.id,
              changeType: 'purchase_restock',
              quantityDelta: normalizedAdd,
              stockBefore,
              stockAfter,
              referenceId: po.poNumber,
              notes: `Fulfillment of Purchase Order #${po.poNumber} from ${po.supplierName}`,
              recordedBy,
            });
          }
        }
      }
    }
  }
  await po.save();

  broadcastEvent(cafeId, 'purchase_order_updated', po);
  return po;
}

/**
 * Format Purchase Order for Print / Email / Supplier Dispatch
 */
export function formatPurchaseOrderText(po, cafe = {}) {
  const pad = (str, len) => String(str || '').padEnd(len);
  const padL = (str, len) => String(str || '').padStart(len);
  const items = Array.isArray(po.items) ? po.items : JSON.parse(po.items || '[]');

  let out = '';
  out += '========================================================================\n';
  out += `                      PURCHASE ORDER: ${po.poNumber}\n`;
  out += '========================================================================\n';
  out += `BUYER:      ${cafe.name || 'GUESTORA Roasters'}\n`;
  if (cafe.gstin) out += `GSTIN:      ${cafe.gstin}\n`;
  out += `DATE:       ${new Date(po.createdAt).toLocaleDateString('en-IN')}\n`;
  out += `STATUS:     ${po.status.toUpperCase()}\n`;
  out += '------------------------------------------------------------------------\n';
  out += `SUPPLIER:   ${po.supplierName}\n`;
  if (po.supplierEmail) out += `EMAIL:      ${po.supplierEmail}\n`;
  if (po.supplierPhone) out += `PHONE:      ${po.supplierPhone}\n`;
  if (po.expectedDeliveryDate) out += `DELIVERY:   ${po.expectedDeliveryDate}\n`;
  out += '------------------------------------------------------------------------\n';
  out += `${pad('ITEM', 32)} ${padL('QTY', 10)} ${padL('RATE', 12)} ${padL('AMOUNT', 14)}\n`;
  out += '------------------------------------------------------------------------\n';

  items.forEach((item, idx) => {
    const desc = `${idx + 1}. ${item.itemName} (${item.unit})`;
    const qty = `${item.orderQty} ${item.unit}`;
    const rate = `₹${(Number(item.costPerUnit) || 0).toFixed(2)}`;
    const lineTot = `₹${(Number(item.lineTotal) || 0).toFixed(2)}`;
    out += `${pad(desc, 32)} ${padL(qty, 10)} ${padL(rate, 12)} ${padL(lineTot, 14)}\n`;
  });

  out += '------------------------------------------------------------------------\n';
  out += `${pad('TOTAL PURCHASE VALUE:', 56)} ${padL(`₹${(Number(po.totalAmount) || 0).toFixed(2)}`, 14)}\n`;
  out += '========================================================================\n';
  if (po.notes) {
    out += `NOTES / INSTRUCTIONS:\n${po.notes}\n`;
    out += '========================================================================\n';
  }
  out += `ISSUED BY: ${po.createdByUser || 'Inventory Manager'}\n`;
  return out;
}

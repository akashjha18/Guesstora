import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  Cafe,
  InventoryItem,
  StockLedger,
  CommissaryBatch,
  StockIndent,
  StockIndentItem,
  StockTransfer,
  StockWastageLog,
  PurchaseOrder,
} from '../src/models.js';
import {
  calculateRoastShrinkage,
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
} from '../src/commissaryEngine.js';
import { ensureCommissarySchema } from '../src/schemaCommissary.js';

describe('Phase 10: Central Commissary, Inter-Store Indents & Advanced Inventory', () => {
  let commissaryCafe;
  let outletCafe;
  let greenCoffeeItem;
  let roastedBlendItem;
  let oatMilkItem;

  before(async () => {
    await ensureCommissarySchema();

    commissaryCafe = await Cafe.create({
      name: 'GUESTORA Central Roastery & Commissary',
      slug: `roastery-commissary-${Date.now()}`,
      tables: 0,
      currency: 'INR',
    });

    outletCafe = await Cafe.create({
      name: 'GUESTORA Bandra Flagship Outlet',
      slug: `bandra-outlet-${Date.now()}`,
      tables: 12,
      currency: 'INR',
    });

    // 1. Raw Green Coffee Bean in Commissary (50 kg @ ₹450/kg)
    greenCoffeeItem = await InventoryItem.create({
      cafeId: commissaryCafe.id,
      name: 'Raw Specialty Green Beans - Chikmagalur Estate',
      category: 'Raw Materials',
      currentStock: 50.0,
      unit: 'kg',
      lowStockThreshold: 10.0,
      reorderQuantity: 25.0,
      targetStockLevel: 60.0,
      costPerUnit: 450.0,
      supplier: 'Western Ghats Planters Co.',
      status: 'in_stock',
    });

    // 2. Roasted Finished Good in Commissary (0 kg initial)
    roastedBlendItem = await InventoryItem.create({
      cafeId: commissaryCafe.id,
      name: 'GUESTORA Signature Espresso Roast',
      category: 'Roasted Coffee',
      currentStock: 0.0,
      unit: 'kg',
      lowStockThreshold: 5.0,
      reorderQuantity: 10.0,
      targetStockLevel: 20.0,
      costPerUnit: 0.0,
      isCommissaryProduced: true,
      status: 'out_of_stock',
    });

    // 3. Oat Milk in Outlet (Low stock: 2 L, threshold 5 L)
    oatMilkItem = await InventoryItem.create({
      cafeId: outletCafe.id,
      name: 'Barista Oat Milk',
      category: 'Dairy & Milks',
      currentStock: 2.0,
      unit: 'l',
      lowStockThreshold: 5.0,
      reorderQuantity: 15.0,
      targetStockLevel: 25.0,
      costPerUnit: 180.0,
      supplier: 'OatGood Provisions',
      supplierEmail: 'orders@oatgood.in',
      supplierPhone: '+91 98201 11223',
      status: 'low_stock',
    });
  });

  after(async () => {
    if (commissaryCafe) {
      await CommissaryBatch.destroy({ where: { cafeId: commissaryCafe.id } });
      await StockWastageLog.destroy({ where: { cafeId: commissaryCafe.id } });
      await PurchaseOrder.destroy({ where: { cafeId: commissaryCafe.id } });
      await StockLedger.destroy({ where: { cafeId: commissaryCafe.id } });
      await InventoryItem.destroy({ where: { cafeId: commissaryCafe.id } });
      await Cafe.destroy({ where: { id: commissaryCafe.id } });
    }
    if (outletCafe) {
      await StockIndent.destroy({ where: { requestingCafeId: outletCafe.id } });
      await StockWastageLog.destroy({ where: { cafeId: outletCafe.id } });
      await PurchaseOrder.destroy({ where: { cafeId: outletCafe.id } });
      await StockLedger.destroy({ where: { cafeId: outletCafe.id } });
      await InventoryItem.destroy({ where: { cafeId: outletCafe.id } });
      await Cafe.destroy({ where: { id: outletCafe.id } });
    }
  });

  /* ========================================================================
     1. Roastery Commissary Production Batching & BOM Tests
     ======================================================================== */
  describe('Roastery Commissary Production Batching', () => {
    it('calculates roast shrinkage and net yield accurately', () => {
      // 10 kg green roasted down to 8.4 kg -> 1.6 kg loss = 16% shrinkage, 84% yield
      const result = calculateRoastShrinkage(10.0, 8.4);
      assert.equal(result.lossWeight, 1.6);
      assert.equal(result.shrinkagePercent, 16.0);
      assert.equal(result.yieldPercent, 84.0);
    });

    it('creates a planned production batch with BOM recipe breakdown', async () => {
      const batch = await createProductionBatch({
        cafeId: commissaryCafe.id,
        recipeName: 'Signature Espresso Roast 10kg Batch',
        outputInventoryItemId: roastedBlendItem.id,
        plannedQuantity: 10.0,
        unit: 'kg',
        bomIngredients: [
          {
            inventoryItemId: greenCoffeeItem.id,
            name: greenCoffeeItem.name,
            quantityRequired: 10.0,
            unit: 'kg',
            costPerUnit: greenCoffeeItem.costPerUnit,
          },
        ],
        operatorName: 'Head Roaster Arjun',
        roasterNotes: 'Target Medium-Dark Profile, Drop at 218C',
      });

      assert.ok(batch.id);
      assert.match(batch.batchNumber, /^BATCH-\d{4}-\d{4}$/);
      assert.equal(batch.status, 'planned');
      assert.equal(batch.plannedQuantity, 10.0);
      assert.equal(batch.totalCost, 4500.0); // 10 kg * 450
      assert.equal(batch.costPerUnit, 450.0);
    });

    it('advances production batch to in_progress and completes with yield conversion', async () => {
      const batch = await createProductionBatch({
        cafeId: commissaryCafe.id,
        recipeName: 'Seasonal Single Origin Roast',
        outputInventoryItemId: roastedBlendItem.id,
        plannedQuantity: 10.0,
        unit: 'kg',
        bomIngredients: [
          {
            inventoryItemId: greenCoffeeItem.id,
            name: greenCoffeeItem.name,
            quantityRequired: 10.0,
            unit: 'kg',
            costPerUnit: 450.0,
          },
        ],
        operatorName: 'Roaster Maya',
      });

      // Start batch
      const started = await startProductionBatch(batch.id, commissaryCafe.id, 'Roaster Maya');
      assert.equal(started.status, 'in_progress');
      assert.ok(started.startedAt);

      const greenStockBefore = (await InventoryItem.findByPk(greenCoffeeItem.id)).currentStock;
      const roastedStockBefore = (await InventoryItem.findByPk(roastedBlendItem.id)).currentStock;

      // Complete batch with actual produced yield: 8.35 kg (16.5% shrinkage)
      const completion = await completeProductionBatch(batch.id, commissaryCafe.id, {
        producedQuantity: 8.35,
        shrinkagePercent: 16.5,
        roasterNotes: 'Smooth crack, sweet cocoa finish',
        operatorName: 'Roaster Maya',
      });

      assert.equal(completion.batch.status, 'completed');
      assert.equal(completion.batch.producedQuantity, 8.35);
      assert.equal(completion.batch.shrinkagePercent, 16.5);
      assert.ok(completion.batch.completedAt);

      // Verify raw material green coffee was deducted by 10 kg
      const greenStockAfter = (await InventoryItem.findByPk(greenCoffeeItem.id)).currentStock;
      assert.equal(greenStockAfter, greenStockBefore - 10.0);

      // Verify finished roasted blend was incremented by 8.35 kg
      const roastedStockAfter = (await InventoryItem.findByPk(roastedBlendItem.id)).currentStock;
      assert.equal(roastedStockAfter, roastedStockBefore + 8.35);

      // Verify StockLedger movements were generated
      const ledgerDeduction = await StockLedger.findOne({
        where: {
          cafeId: commissaryCafe.id,
          inventoryItemId: greenCoffeeItem.id,
          referenceId: completion.batch.batchNumber,
        },
      });
      assert.ok(ledgerDeduction);
      assert.equal(ledgerDeduction.quantityDelta, -10.0);

      const ledgerAddition = await StockLedger.findOne({
        where: {
          cafeId: commissaryCafe.id,
          inventoryItemId: roastedBlendItem.id,
          referenceId: completion.batch.batchNumber,
        },
      });
      assert.ok(ledgerAddition);
      assert.equal(ledgerAddition.quantityDelta, 8.35);
    });
  });

  /* ========================================================================
     2. Inter-Store Indents & STN / GRN Lifecycle Tests
     ======================================================================== */
  describe('Inter-Store Indents & STN / GRN Lifecycle', () => {
    let activeIndent;

    it('outlet raises a digital stock indent request to central commissary', async () => {
      const result = await createIndentRequest({
        requestingCafeId: outletCafe.id,
        supplyingCafeId: commissaryCafe.id,
        priority: 'high',
        notes: 'Weekend rush prep - urgent roasted espresso blend required',
        requestedBy: 'Outlet Manager Rhea',
        items: [
          {
            inventoryItemId: roastedBlendItem.id,
            itemName: roastedBlendItem.name,
            category: 'Roasted Coffee',
            unit: 'kg',
            requestedQty: 5.0,
          },
        ],
      });

      activeIndent = result.indent;
      assert.ok(activeIndent.id);
      assert.match(activeIndent.indentNumber, /^IND-\d{4}-\d{4}$/);
      assert.equal(activeIndent.status, 'submitted');
      assert.equal(activeIndent.priority, 'high');
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].requestedQty, 5.0);
    });

    it('commissary reviews and approves indent with approved quantities', async () => {
      const approved = await approveIndent(activeIndent.id, commissaryCafe.id, {
        approvedBy: 'Commissary Lead Vikram',
      });

      assert.equal(approved.status, 'approved');
      assert.equal(approved.approvedBy, 'Commissary Lead Vikram');
      assert.ok(approved.approvedAt);
    });

    it('commissary dispatches STN, records logistics, and deducts commissary inventory', async () => {
      const commissaryStockBefore = (await InventoryItem.findByPk(roastedBlendItem.id)).currentStock;

      const dispatched = await dispatchIndentSTN(activeIndent.id, commissaryCafe.id, {
        dispatchedBy: 'Logistics Supervisor Farhan',
        transporterName: 'Dunzo Cold Van Express',
        vehicleNumber: 'MH-02-EE-8821',
        driverContact: '+91 98111 22334',
        dispatchQuantities: [
          { id: (await StockIndentItem.findOne({ where: { indentId: activeIndent.id } })).id, dispatchedQty: 5.0 },
        ],
      });

      assert.equal(dispatched.indent.status, 'dispatched');
      assert.ok(dispatched.transfer);
      assert.match(dispatched.transfer.stnNumber, /^STN-\d{4}-\d{4}$/);
      assert.equal(dispatched.transfer.status, 'in_transit');
      assert.equal(dispatched.transfer.transporterName, 'Dunzo Cold Van Express');

      // Commissary stock must be deducted by 5.0 kg
      const commissaryStockAfter = (await InventoryItem.findByPk(roastedBlendItem.id)).currentStock;
      assert.equal(commissaryStockAfter, Math.round((commissaryStockBefore - 5.0) * 100) / 100);
    });

    it('receiving outlet verifies GRN, detects variance and replenishes store stock', async () => {
      // First create destination item in outlet if needed
      let outletRoastedItem = await InventoryItem.findOne({
        where: { cafeId: outletCafe.id, name: roastedBlendItem.name },
      });
      if (!outletRoastedItem) {
        outletRoastedItem = await InventoryItem.create({
          cafeId: outletCafe.id,
          name: roastedBlendItem.name,
          category: 'Roasted Coffee',
          currentStock: 1.0,
          unit: 'kg',
          costPerUnit: 538.0,
          status: 'low_stock',
        });
      }

      const outletStockBefore = outletRoastedItem.currentStock;
      const indentItem = await StockIndentItem.findOne({ where: { indentId: activeIndent.id } });

      // Simulate receiving 4.8 kg instead of 5.0 kg (0.2 kg transit spill variance)
      const receipt = await receiveIndentGRN(activeIndent.id, outletCafe.id, {
        receivedBy: 'Outlet Store Incharge Deepak',
        receivedQuantities: [
          {
            id: indentItem.id,
            receivedQty: 4.8,
            varianceReason: 'Bag torn during vehicle transit, 200g loss',
          },
        ],
      });

      assert.equal(receipt.indent.status, 'received');
      assert.equal(receipt.transfer.status, 'delivered');
      assert.equal(receipt.variances.length, 1);
      assert.equal(receipt.variances[0].variance, -0.2);
      assert.equal(receipt.variances[0].reason, 'Bag torn during vehicle transit, 200g loss');

      // Outlet inventory replenished by 4.8 kg
      const outletStockAfter = (await InventoryItem.findByPk(outletRoastedItem.id)).currentStock;
      assert.equal(outletStockAfter, outletStockBefore + 4.8);

      // Verify StockLedger receipt movement
      const grnLedger = await StockLedger.findOne({
        where: {
          cafeId: outletCafe.id,
          inventoryItemId: outletRoastedItem.id,
          referenceId: activeIndent.indentNumber,
        },
      });
      assert.ok(grnLedger);
      assert.equal(grnLedger.quantityDelta, 4.8);
      assert.equal(grnLedger.changeType, 'purchase_restock');
    });
  });

  /* ========================================================================
     3. Spoilage & Wastage Auditing Tests
     ======================================================================== */
  describe('Spoilage & Wastage Auditing', () => {
    it('logs categorized wastage, computes financial loss, and deducts inventory', async () => {
      const stockBefore = (await InventoryItem.findByPk(oatMilkItem.id)).currentStock;

      // Log 1.0 L spill during barista latte art training
      const wastage = await logStockWastage({
        cafeId: outletCafe.id,
        inventoryItemId: oatMilkItem.id,
        quantity: 1.0,
        unit: 'l',
        reason: 'barista_spill',
        notes: 'Latte art pitcher spilled during rush hours',
        loggedBy: 'Barista Karan',
      });

      assert.ok(wastage.id);
      assert.equal(wastage.reason, 'barista_spill');
      assert.equal(wastage.quantity, 1.0);
      assert.equal(wastage.costPerUnit, 180.0);
      assert.equal(wastage.totalCost, 180.0); // 1.0 L * ₹180
      assert.equal(wastage.status, 'approved');

      // Inventory deducted by 1.0 L
      const stockAfter = (await InventoryItem.findByPk(oatMilkItem.id)).currentStock;
      assert.equal(stockAfter, stockBefore - 1.0);

      // StockLedger record created
      const ledger = await StockLedger.findOne({
        where: {
          cafeId: outletCafe.id,
          inventoryItemId: oatMilkItem.id,
          changeType: 'waste_spoilage',
        },
      });
      assert.ok(ledger);
      assert.equal(ledger.quantityDelta, -1.0);
    });

    it('aggregates wastage summary grouped by reason categories', async () => {
      // Log another wastage for espresso calibration
      await logStockWastage({
        cafeId: outletCafe.id,
        inventoryItemId: oatMilkItem.id,
        quantity: 0.5,
        unit: 'l',
        reason: 'machine_calibration',
        notes: 'Dialing in steam wand pressure',
        loggedBy: 'Head Barista Sonia',
      });

      const summary = await getWastageSummary(outletCafe.id);
      assert.ok(summary.totalLoss >= 270.0); // 1.0L (180) + 0.5L (90)
      assert.ok(summary.byReason['barista_spill']);
      assert.ok(summary.byReason['machine_calibration']);
      assert.equal(summary.byReason['barista_spill'].count, 1);
      assert.equal(summary.byReason['machine_calibration'].count, 1);
    });
  });

  /* ========================================================================
     4. Automated Reorder Point (ROP) & Supplier Purchase Orders Tests
     ======================================================================== */
  describe('Automated Reorder Point (ROP) & Purchase Orders', () => {
    let generatedPo;

    it('detects low-stock items breaching ROP and groups by supplier', async () => {
      const alerts = await checkReorderPointTriggers(outletCafe.id);
      assert.ok(alerts.triggeredCount >= 1);

      const oatAlert = alerts.lowStockItems.find(i => i.inventoryItemId === oatMilkItem.id);
      assert.ok(oatAlert);
      assert.equal(oatAlert.supplier, 'OatGood Provisions');
      assert.ok(oatAlert.suggestedOrderQty >= 15.0);

      assert.ok(alerts.groupedBySupplier['OatGood Provisions']);
      assert.equal(alerts.groupedBySupplier['OatGood Provisions'].supplierName, 'OatGood Provisions');
      assert.ok(alerts.groupedBySupplier['OatGood Provisions'].totalEstimatedAmount > 0);
    });

    it('generates a draft purchase order for the supplier', async () => {
      generatedPo = await generateDraftPurchaseOrder(outletCafe.id, {
        supplierName: 'OatGood Provisions',
        supplierEmail: 'orders@oatgood.in',
        supplierPhone: '+91 98201 11223',
        items: [
          {
            inventoryItemId: oatMilkItem.id,
            itemName: oatMilkItem.name,
            currentStock: 0.5,
            orderQty: 20.0,
            unit: 'l',
            costPerUnit: 180.0,
          },
        ],
        notes: 'Deliver before Friday morning trade',
        expectedDeliveryDate: '2026-10-16',
        createdByUser: 'Inventory Manager Priya',
        triggerReason: 'rop_auto_alert',
      });

      assert.ok(generatedPo.id);
      assert.match(generatedPo.poNumber, /^PO-\d{4}-\d{4}$/);
      assert.equal(generatedPo.status, 'draft');
      assert.equal(generatedPo.totalAmount, 3600.0); // 20 * 180
      assert.equal(generatedPo.triggerReason, 'rop_auto_alert');
    });

    it('advances PO status to sent and then fulfilled with auto-restock', async () => {
      // Sent
      const sentPo = await updatePurchaseOrderStatus(generatedPo.id, outletCafe.id, 'sent');
      assert.equal(sentPo.status, 'sent');
      assert.ok(sentPo.sentAt);

      const stockBefore = (await InventoryItem.findByPk(oatMilkItem.id)).currentStock;

      // Fulfilled with autoRestock = true
      const fulfilledPo = await updatePurchaseOrderStatus(generatedPo.id, outletCafe.id, 'fulfilled', {
        autoRestock: true,
        recordedBy: 'Receiving Team',
      });
      assert.equal(fulfilledPo.status, 'fulfilled');
      assert.ok(fulfilledPo.fulfilledAt);

      // Verify stock was replenished by 20.0 L
      const stockAfter = (await InventoryItem.findByPk(oatMilkItem.id)).currentStock;
      assert.equal(stockAfter, stockBefore + 20.0);

      // Verify StockLedger entry
      const ledger = await StockLedger.findOne({
        where: {
          cafeId: outletCafe.id,
          inventoryItemId: oatMilkItem.id,
          referenceId: fulfilledPo.poNumber,
        },
      });
      assert.ok(ledger);
      assert.equal(ledger.quantityDelta, 20.0);
    });

    it('formats clean printable purchase order text for vendor dispatch', () => {
      const text = formatPurchaseOrderText(generatedPo, outletCafe);
      assert.match(text, /PURCHASE ORDER:/);
      assert.match(text, /OatGood Provisions/);
      assert.match(text, /Barista Oat Milk/);
      assert.match(text, /TOTAL PURCHASE VALUE:/);
      assert.match(text, /₹3600\.00/);
    });
  });
});

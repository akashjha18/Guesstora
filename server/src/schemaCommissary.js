import { sequelize } from './db.js';

export async function ensureCommissarySchema() {
  const qi = sequelize.getQueryInterface();

  async function safeAddColumn(table, column, definition) {
    try {
      const desc = await qi.describeTable(table);
      if (!desc[column]) {
        await qi.addColumn(table, column, definition);
      }
    } catch (err) {
      // Column might already exist or table not created yet
    }
  }

  // 1. Extend inventory_items with reorder point and commissary flags
  await safeAddColumn('inventory_items', 'reorderQuantity', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 5.0,
  });
  await safeAddColumn('inventory_items', 'targetStockLevel', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 10.0,
  });
  await safeAddColumn('inventory_items', 'isCommissaryProduced', {
    type: sequelize.Sequelize.BOOLEAN,
    defaultValue: false,
  });
  await safeAddColumn('inventory_items', 'supplierEmail', {
    type: sequelize.Sequelize.STRING(255),
    allowNull: true,
  });
  await safeAddColumn('inventory_items', 'supplierPhone', {
    type: sequelize.Sequelize.STRING(50),
    allowNull: true,
  });

  // Ensure stock_ledgers changeType supports commissary and indent types
  try {
    await qi.sequelize.query("ALTER TABLE stock_ledgers MODIFY COLUMN changeType VARCHAR(60) NOT NULL;").catch(() => {});
  } catch (e) {
    // ignore
  }

  // 2. Commissary Production Batches Table
  await qi.createTable('commissary_batches', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    brandId: { type: 'CHAR(36)', allowNull: true },
    batchNumber: { type: 'VARCHAR(100)', allowNull: false, unique: true },
    recipeName: { type: 'VARCHAR(255)', allowNull: false },
    outputInventoryItemId: { type: 'CHAR(36)', allowNull: true },
    outputItemName: { type: 'VARCHAR(255)', allowNull: false },
    plannedQuantity: { type: 'FLOAT', defaultValue: 0 },
    producedQuantity: { type: 'FLOAT', defaultValue: 0 },
    unit: { type: 'VARCHAR(30)', defaultValue: 'kg' },
    shrinkagePercent: { type: 'FLOAT', defaultValue: 0 },
    status: { type: 'VARCHAR(30)', defaultValue: 'planned' }, // 'planned', 'in_progress', 'completed', 'cancelled'
    bomIngredients: { type: 'JSON', allowNull: true },
    totalCost: { type: 'FLOAT', defaultValue: 0 },
    costPerUnit: { type: 'FLOAT', defaultValue: 0 },
    roasterNotes: { type: 'TEXT', allowNull: true },
    operatorName: { type: 'VARCHAR(100)', defaultValue: 'Master Roaster' },
    startedAt: { type: 'DATETIME', allowNull: true },
    completedAt: { type: 'DATETIME', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }, { logging: false }).catch(() => {});

  // 3. Stock Indents Table (Inter-store replenishment requests)
  await qi.createTable('stock_indents', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    brandId: { type: 'CHAR(36)', allowNull: true },
    requestingCafeId: { type: 'CHAR(36)', allowNull: false },
    supplyingCafeId: { type: 'CHAR(36)', allowNull: false },
    indentNumber: { type: 'VARCHAR(100)', allowNull: false, unique: true },
    status: { type: 'VARCHAR(30)', defaultValue: 'submitted' }, // 'draft', 'submitted', 'approved', 'dispatched', 'received', 'rejected', 'cancelled'
    priority: { type: 'VARCHAR(20)', defaultValue: 'normal' }, // 'normal', 'high', 'urgent'
    notes: { type: 'TEXT', allowNull: true },
    requestedBy: { type: 'VARCHAR(100)', defaultValue: 'Store Manager' },
    approvedBy: { type: 'VARCHAR(100)', allowNull: true },
    dispatchedBy: { type: 'VARCHAR(100)', allowNull: true },
    receivedBy: { type: 'VARCHAR(100)', allowNull: true },
    rejectionReason: { type: 'TEXT', allowNull: true },
    submittedAt: { type: 'DATETIME', allowNull: true },
    approvedAt: { type: 'DATETIME', allowNull: true },
    dispatchedAt: { type: 'DATETIME', allowNull: true },
    receivedAt: { type: 'DATETIME', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }, { logging: false }).catch(() => {});

  // 4. Stock Indent Line Items Table
  await qi.createTable('stock_indent_items', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    indentId: { type: 'CHAR(36)', allowNull: false },
    inventoryItemId: { type: 'CHAR(36)', allowNull: true },
    destinationInventoryItemId: { type: 'CHAR(36)', allowNull: true },
    itemName: { type: 'VARCHAR(255)', allowNull: false },
    category: { type: 'VARCHAR(100)', defaultValue: 'General' },
    unit: { type: 'VARCHAR(30)', defaultValue: 'kg' },
    requestedQty: { type: 'FLOAT', defaultValue: 0 },
    approvedQty: { type: 'FLOAT', defaultValue: 0 },
    dispatchedQty: { type: 'FLOAT', defaultValue: 0 },
    receivedQty: { type: 'FLOAT', defaultValue: 0 },
    varianceQty: { type: 'FLOAT', defaultValue: 0 },
    varianceReason: { type: 'VARCHAR(255)', allowNull: true },
    notes: { type: 'VARCHAR(255)', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }, { logging: false }).catch(() => {});

  // 5. Stock Transfers (STN) Table
  await qi.createTable('stock_transfers', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    indentId: { type: 'CHAR(36)', allowNull: false },
    stnNumber: { type: 'VARCHAR(100)', allowNull: false, unique: true },
    supplyingCafeId: { type: 'CHAR(36)', allowNull: false },
    requestingCafeId: { type: 'CHAR(36)', allowNull: false },
    transporterName: { type: 'VARCHAR(150)', defaultValue: 'Gusstora Fleet Logistics' },
    vehicleNumber: { type: 'VARCHAR(50)', defaultValue: 'MH-12-GF-4491' },
    driverContact: { type: 'VARCHAR(50)', allowNull: true },
    status: { type: 'VARCHAR(30)', defaultValue: 'in_transit' }, // 'in_transit', 'delivered', 'disputed'
    dispatchTime: { type: 'DATETIME', allowNull: false },
    deliveryTime: { type: 'DATETIME', allowNull: true },
    stnItems: { type: 'JSON', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }, { logging: false }).catch(() => {});

  // 6. Stock Wastage & Spoilage Auditing Table
  await qi.createTable('stock_wastage_logs', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    inventoryItemId: { type: 'CHAR(36)', allowNull: false },
    itemName: { type: 'VARCHAR(255)', allowNull: false },
    quantity: { type: 'FLOAT', defaultValue: 0 },
    unit: { type: 'VARCHAR(30)', defaultValue: 'kg' },
    costPerUnit: { type: 'FLOAT', defaultValue: 0 },
    totalCost: { type: 'FLOAT', defaultValue: 0 },
    reason: { type: 'VARCHAR(50)', defaultValue: 'expired' }, // 'expired', 'barista_spill', 'test_roast', 'batch_defect', 'machine_calibration', 'transit_damage', 'customer_complaint'
    notes: { type: 'TEXT', allowNull: true },
    loggedBy: { type: 'VARCHAR(100)', defaultValue: 'Head Barista' },
    approvedBy: { type: 'VARCHAR(100)', allowNull: true },
    status: { type: 'VARCHAR(30)', defaultValue: 'approved' }, // 'pending_review', 'approved', 'rejected'
    loggedAt: { type: 'DATETIME', allowNull: false },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }, { logging: false }).catch(() => {});

  // 7. Supplier Purchase Orders Table (Automated Reorder Point)
  await qi.createTable('purchase_orders', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    poNumber: { type: 'VARCHAR(100)', allowNull: false, unique: true },
    supplierName: { type: 'VARCHAR(255)', allowNull: false },
    supplierEmail: { type: 'VARCHAR(255)', allowNull: true },
    supplierPhone: { type: 'VARCHAR(50)', allowNull: true },
    status: { type: 'VARCHAR(30)', defaultValue: 'draft' }, // 'draft', 'sent', 'partially_received', 'fulfilled', 'cancelled'
    triggerReason: { type: 'VARCHAR(50)', defaultValue: 'manual' }, // 'manual', 'rop_auto_alert', 'emergency_stockout'
    items: { type: 'JSON', allowNull: true },
    totalAmount: { type: 'FLOAT', defaultValue: 0 },
    notes: { type: 'TEXT', allowNull: true },
    expectedDeliveryDate: { type: 'DATE', allowNull: true },
    createdByUser: { type: 'VARCHAR(100)', defaultValue: 'Inventory Manager' },
    sentAt: { type: 'DATETIME', allowNull: true },
    fulfilledAt: { type: 'DATETIME', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }, { logging: false }).catch(() => {});
}

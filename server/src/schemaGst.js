import { sequelize } from './db.js';

export async function ensureGstSchema() {
  const queryInterface = sequelize.getQueryInterface();

  async function safeAddColumn(table, column, definition) {
    try {
      const desc = await queryInterface.describeTable(table);
      if (!desc[column]) {
        await queryInterface.addColumn(table, column, definition);
      }
    } catch (err) {
      // Column might already exist or table not created yet
    }
  }

  // 1. Cafes GST & Tally configuration
  await safeAddColumn('cafes', 'gstin', {
    type: sequelize.Sequelize.STRING(15),
    allowNull: true,
  });
  await safeAddColumn('cafes', 'legalBusinessName', {
    type: sequelize.Sequelize.STRING(255),
    allowNull: true,
  });
  await safeAddColumn('cafes', 'stateCode', {
    type: sequelize.Sequelize.STRING(5),
    defaultValue: '27', // Maharashtra
  });
  await safeAddColumn('cafes', 'stateName', {
    type: sequelize.Sequelize.STRING(50),
    defaultValue: 'Maharashtra',
  });
  await safeAddColumn('cafes', 'gstCompositionScheme', {
    type: sequelize.Sequelize.BOOLEAN,
    defaultValue: false,
  });
  await safeAddColumn('cafes', 'gstEnabled', {
    type: sequelize.Sequelize.BOOLEAN,
    defaultValue: true,
  });
  await safeAddColumn('cafes', 'taxInclusivePricing', {
    type: sequelize.Sequelize.BOOLEAN,
    defaultValue: true,
  });
  await safeAddColumn('cafes', 'defaultGstRate', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 5.0, // 5% standard restaurant tax
  });
  await safeAddColumn('cafes', 'tallyCompany', {
    type: sequelize.Sequelize.STRING(255),
    defaultValue: 'Gusstora Roasters',
  });
  await safeAddColumn('cafes', 'tallySalesLedger', {
    type: sequelize.Sequelize.STRING(255),
    defaultValue: 'Food & Beverage Sales',
  });
  await safeAddColumn('cafes', 'tallyCgstLedger', {
    type: sequelize.Sequelize.STRING(255),
    defaultValue: 'CGST Input/Output 2.5%',
  });
  await safeAddColumn('cafes', 'tallySgstLedger', {
    type: sequelize.Sequelize.STRING(255),
    defaultValue: 'SGST Input/Output 2.5%',
  });
  await safeAddColumn('cafes', 'tallyIgstLedger', {
    type: sequelize.Sequelize.STRING(255),
    defaultValue: 'IGST 5%',
  });
  await safeAddColumn('cafes', 'invoicePrefix', {
    type: sequelize.Sequelize.STRING(20),
    defaultValue: 'GST-2627/',
  });
  await safeAddColumn('cafes', 'nextInvoiceSeq', {
    type: sequelize.Sequelize.INTEGER,
    defaultValue: 1,
  });

  // 2. Menu Items HSN & GST mapping
  await safeAddColumn('menu_items', 'hsnCode', {
    type: sequelize.Sequelize.STRING(20),
    defaultValue: '996331', // Restaurant catering service
  });
  await safeAddColumn('menu_items', 'gstRate', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 5.0,
  });
  await safeAddColumn('menu_items', 'taxExempt', {
    type: sequelize.Sequelize.BOOLEAN,
    defaultValue: false,
  });

  // 3. Orders GST Tax Invoice & E-Invoice fields
  await safeAddColumn('orders', 'invoiceNumber', {
    type: sequelize.Sequelize.STRING(50),
    allowNull: true,
  });
  await safeAddColumn('orders', 'invoiceDate', {
    type: sequelize.Sequelize.DATE,
    allowNull: true,
  });
  await safeAddColumn('orders', 'customerGstin', {
    type: sequelize.Sequelize.STRING(15),
    allowNull: true,
  });
  await safeAddColumn('orders', 'customerLegalName', {
    type: sequelize.Sequelize.STRING(255),
    allowNull: true,
  });
  await safeAddColumn('orders', 'customerStateCode', {
    type: sequelize.Sequelize.STRING(5),
    allowNull: true,
  });
  await safeAddColumn('orders', 'isB2B', {
    type: sequelize.Sequelize.BOOLEAN,
    defaultValue: false,
  });
  await safeAddColumn('orders', 'isInterState', {
    type: sequelize.Sequelize.BOOLEAN,
    defaultValue: false,
  });
  await safeAddColumn('orders', 'taxableAmount', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
  await safeAddColumn('orders', 'cgstAmount', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
  await safeAddColumn('orders', 'sgstAmount', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
  await safeAddColumn('orders', 'igstAmount', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
  await safeAddColumn('orders', 'totalTax', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
  await safeAddColumn('orders', 'hsnSummary', {
    type: sequelize.Sequelize.JSON,
    allowNull: true,
  });
  await safeAddColumn('orders', 'eInvoiceIrn', {
    type: sequelize.Sequelize.STRING(100),
    allowNull: true,
  });
  await safeAddColumn('orders', 'eInvoiceAckNo', {
    type: sequelize.Sequelize.STRING(50),
    allowNull: true,
  });
  await safeAddColumn('orders', 'eInvoiceAckDate', {
    type: sequelize.Sequelize.DATE,
    allowNull: true,
  });
  await safeAddColumn('orders', 'eInvoiceQrCode', {
    type: sequelize.Sequelize.TEXT,
    allowNull: true,
  });

  // 4. Order Items line-level tax calculation
  await safeAddColumn('order_items', 'hsnCode', {
    type: sequelize.Sequelize.STRING(20),
    defaultValue: '996331',
  });
  await safeAddColumn('order_items', 'gstRate', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 5.0,
  });
  await safeAddColumn('order_items', 'taxableAmount', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
  await safeAddColumn('order_items', 'cgstRate', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 2.5,
  });
  await safeAddColumn('order_items', 'cgstAmount', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
  await safeAddColumn('order_items', 'sgstRate', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 2.5,
  });
  await safeAddColumn('order_items', 'sgstAmount', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
  await safeAddColumn('order_items', 'igstRate', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
  await safeAddColumn('order_items', 'igstAmount', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
  await safeAddColumn('order_items', 'totalTax', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
}

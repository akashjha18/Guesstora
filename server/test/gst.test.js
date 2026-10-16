import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  Cafe,
  Order,
  OrderItem,
  MenuItem,
} from '../src/models.js';
import {
  validateGstin,
  getStateCodeFromGstin,
  calculateItemGst,
  calculateOrderTaxBreakdown,
  formatTaxInvoiceNumber,
  generateGstr1Report,
  generateGstr3bSummary,
  generateEInvoicePayload,
  generateTallyVoucherXml,
  formatGstr1B2BCsv,
  round2,
} from '../src/gstEngine.js';
import { ensureGstSchema } from '../src/schemaGst.js';

describe('Phase 9: Indian Tax Compliance, GST Invoicing & Tally ERP Sync', () => {
  let testCafe;
  let testMenuItemFood;
  let testMenuItemRetail;

  before(async () => {
    await ensureGstSchema();

    testCafe = await Cafe.create({
      name: 'GST Roasters Flagship',
      slug: `gst-cafe-${Date.now()}`,
      tables: 8,
      currency: 'INR',
      gstin: '27AABCU9603R1ZM',
      legalBusinessName: 'Gusstora Roasters LLP',
      stateCode: '27',
      stateName: 'Maharashtra',
      gstCompositionScheme: false,
      gstEnabled: true,
      taxInclusivePricing: true,
      defaultGstRate: 5.0,
      tallyCompany: 'Gusstora Roasters',
      tallySalesLedger: 'Food & Beverage Sales',
      tallyCgstLedger: 'CGST Output 2.5%',
      tallySgstLedger: 'SGST Output 2.5%',
      tallyIgstLedger: 'IGST Output 5%',
      invoicePrefix: 'GST-2627/',
      nextInvoiceSeq: 101,
    });

    testMenuItemFood = await MenuItem.create({
      cafeId: testCafe.id,
      name: 'Artisan Pour Over',
      price: 210,
      category: 'Coffee',
      hsnCode: '996331',
      gstRate: 5.0,
      taxExempt: false,
    });

    testMenuItemRetail = await MenuItem.create({
      cafeId: testCafe.id,
      name: 'Roasted Ethiopian Beans 250g',
      price: 525,
      category: 'Retail',
      hsnCode: '21011120',
      gstRate: 5.0,
      taxExempt: false,
    });
  });

  after(async () => {
    if (testCafe) {
      await OrderItem.destroy({ where: {} });
      await Order.destroy({ where: { cafeId: testCafe.id } });
      await MenuItem.destroy({ where: { cafeId: testCafe.id } });
      await testCafe.destroy();
    }
  });

  /* --------------------------------------------------------------------------
     1. GSTIN Validation & State Code Resolution
     -------------------------------------------------------------------------- */
  describe('GSTIN Validation & State Code Resolution', () => {
    it('validates authentic Indian GSTIN formats', () => {
      assert.strictEqual(validateGstin('27AABCU9603R1ZM'), true);
      assert.strictEqual(validateGstin('29ABCDE1234F1Z5'), true);
      assert.strictEqual(validateGstin('07AAAAA0000A1Z5'), true);
      assert.strictEqual(validateGstin('27aabcu9603r1zm'), true); // handles lowercase
    });

    it('rejects invalid GSTINs', () => {
      assert.strictEqual(validateGstin(''), false);
      assert.strictEqual(validateGstin(null), false);
      assert.strictEqual(validateGstin('INVALIDGSTIN123'), false);
      assert.strictEqual(validateGstin('27AABCU9603R1Z'), false); // too short (14 chars)
      assert.strictEqual(validateGstin('27AABCU9603R1ZMM'), false); // too long (16 chars)
    });

    it('extracts state code from GSTIN accurately', () => {
      assert.strictEqual(getStateCodeFromGstin('27AABCU9603R1ZM'), '27'); // Maharashtra
      assert.strictEqual(getStateCodeFromGstin('29ABCDE1234F1Z5'), '29'); // Karnataka
      assert.strictEqual(getStateCodeFromGstin('07AAAAA0000A1Z5'), '07'); // Delhi
      assert.strictEqual(getStateCodeFromGstin('invalid'), null);
    });
  });

  /* --------------------------------------------------------------------------
     2. Tax Calculation Engine (Inclusive, Exclusive, Inter-state)
     -------------------------------------------------------------------------- */
  describe('Tax Calculation Engine', () => {
    it('calculates tax-inclusive 5% GST with exact CGST/SGST 2.5% split', () => {
      // 210 Rs gross inclusive of 5% GST:
      // Taxable = 210 / 1.05 = 200.00
      // Tax = 10.00 -> CGST = 5.00, SGST = 5.00
      const calc = calculateItemGst({
        price: 210,
        quantity: 1,
        gstRate: 5.0,
        isInclusive: true,
        isInterState: false,
        hsnCode: '996331',
      });

      assert.strictEqual(calc.taxableAmount, 200);
      assert.strictEqual(calc.totalTax, 10);
      assert.strictEqual(calc.cgstRate, 2.5);
      assert.strictEqual(calc.cgstAmount, 5);
      assert.strictEqual(calc.sgstRate, 2.5);
      assert.strictEqual(calc.sgstAmount, 5);
      assert.strictEqual(calc.igstAmount, 0);
      assert.strictEqual(calc.grossAmount, 210);
    });

    it('calculates tax-exclusive 5% GST accurately', () => {
      // 200 Rs exclusive of 5% GST:
      // Taxable = 200.00
      // Tax = 10.00 -> CGST = 5.00, SGST = 5.00, Gross = 210.00
      const calc = calculateItemGst({
        price: 200,
        quantity: 1,
        gstRate: 5.0,
        isInclusive: false,
        isInterState: false,
        hsnCode: '996331',
      });

      assert.strictEqual(calc.taxableAmount, 200);
      assert.strictEqual(calc.totalTax, 10);
      assert.strictEqual(calc.cgstAmount, 5);
      assert.strictEqual(calc.sgstAmount, 5);
      assert.strictEqual(calc.grossAmount, 210);
    });

    it('applies IGST instead of CGST/SGST for inter-state orders', () => {
      // Customer from Karnataka (29) ordering from Maharashtra (27)
      const calc = calculateItemGst({
        price: 210,
        quantity: 1,
        gstRate: 5.0,
        isInclusive: true,
        isInterState: true,
        hsnCode: '996331',
      });

      assert.strictEqual(calc.taxableAmount, 200);
      assert.strictEqual(calc.totalTax, 10);
      assert.strictEqual(calc.cgstAmount, 0);
      assert.strictEqual(calc.sgstAmount, 0);
      assert.strictEqual(calc.igstRate, 5.0);
      assert.strictEqual(calc.igstAmount, 10);
    });

    it('handles tax-exempt items with zero tax', () => {
      const calc = calculateItemGst({
        price: 150,
        quantity: 2,
        gstRate: 5.0,
        taxExempt: true,
      });

      assert.strictEqual(calc.taxableAmount, 300);
      assert.strictEqual(calc.totalTax, 0);
      assert.strictEqual(calc.cgstAmount, 0);
      assert.strictEqual(calc.sgstAmount, 0);
    });
  });

  /* --------------------------------------------------------------------------
     3. Order Tax Breakdown & HSN Summary (Table 12)
     -------------------------------------------------------------------------- */
  describe('Order Tax Breakdown & HSN Table 12 Aggregation', () => {
    it('aggregates multi-item orders into clean HSN Table 12 summaries', () => {
      const items = [
        { price: 210, quantity: 2, gstRate: 5.0, hsnCode: '996331' }, // 420 gross -> 400 taxable + 20 tax
        { price: 525, quantity: 1, gstRate: 5.0, hsnCode: '21011120' }, // 525 gross -> 500 taxable + 25 tax
      ];

      const breakdown = calculateOrderTaxBreakdown({
        items,
        cafe: testCafe,
        customerGstin: null,
      });

      assert.strictEqual(breakdown.isB2B, false);
      assert.strictEqual(breakdown.isInterState, false);
      assert.strictEqual(breakdown.taxableAmount, 900);
      assert.strictEqual(breakdown.totalTax, 45);
      assert.strictEqual(breakdown.cgstAmount, 22.5);
      assert.strictEqual(breakdown.sgstAmount, 22.5);
      assert.strictEqual(breakdown.grossTotal, 945);

      // Verify HSN Table 12 has 2 distinct entries
      assert.strictEqual(breakdown.hsnSummary.length, 2);
      const foodHsn = breakdown.hsnSummary.find(h => h.hsnCode === '996331');
      const retailHsn = breakdown.hsnSummary.find(h => h.hsnCode === '21011120');

      assert.ok(foodHsn);
      assert.strictEqual(foodHsn.quantity, 2);
      assert.strictEqual(foodHsn.taxableValue, 400);
      assert.strictEqual(foodHsn.cgstAmount, 10);
      assert.strictEqual(foodHsn.sgstAmount, 10);

      assert.ok(retailHsn);
      assert.strictEqual(retailHsn.quantity, 1);
      assert.strictEqual(retailHsn.taxableValue, 500);
      assert.strictEqual(retailHsn.cgstAmount, 12.5);
      assert.strictEqual(retailHsn.sgstAmount, 12.5);
    });

    it('identifies B2B inter-state corporate clients correctly', () => {
      const items = [{ price: 1050, quantity: 1, gstRate: 5.0, hsnCode: '996331' }];
      const breakdown = calculateOrderTaxBreakdown({
        items,
        cafe: testCafe, // Cafe state 27
        customerGstin: '29ABCDE1234F1Z5', // Customer state 29 (Karnataka)
      });

      assert.strictEqual(breakdown.isB2B, true);
      assert.strictEqual(breakdown.isInterState, true);
      assert.strictEqual(breakdown.customerStateCode, '29');
      assert.strictEqual(breakdown.taxableAmount, 1000);
      assert.strictEqual(breakdown.igstAmount, 50);
      assert.strictEqual(breakdown.cgstAmount, 0);
      assert.strictEqual(breakdown.sgstAmount, 0);
    });
  });

  /* --------------------------------------------------------------------------
     4. Invoice Numbering & GSTR-1 / GSTR-3B Reporting
     -------------------------------------------------------------------------- */
  describe('Tax Invoice Formatting & GSTR Reports', () => {
    it('formats sequential tax invoice numbers with zero-padding', () => {
      assert.strictEqual(formatTaxInvoiceNumber('GST-2627/', 1), 'GST-2627/0001');
      assert.strictEqual(formatTaxInvoiceNumber('GST-2627/', 42), 'GST-2627/0042');
      assert.strictEqual(formatTaxInvoiceNumber('INV/', 1234), 'INV/1234');
    });

    it('generates GSTR-1 report separating B2B (Table 4) and B2C (Table 7)', () => {
      const mockOrders = [
        {
          orderNo: 'PB1001',
          invoiceNumber: 'GST-2627/0001',
          createdAt: new Date(),
          isB2B: true,
          customerGstin: '27AAECU9603R1ZO',
          customerLegalName: 'Infosys Hospitality',
          customerStateCode: '27',
          taxableAmount: 2000,
          cgstAmount: 50,
          sgstAmount: 50,
          igstAmount: 0,
          total: 2100,
          status: 'completed',
        },
        {
          orderNo: 'PB1002',
          invoiceNumber: 'GST-2627/0002',
          createdAt: new Date(),
          isB2B: false,
          customerStateCode: '27',
          taxableAmount: 400,
          cgstAmount: 10,
          sgstAmount: 10,
          igstAmount: 0,
          total: 420,
          status: 'completed',
        },
      ];

      const report = generateGstr1Report({ orders: mockOrders, cafe: testCafe });

      assert.strictEqual(report.table4_b2b.length, 1);
      assert.strictEqual(report.table4_b2b[0].customerGstin, '27AAECU9603R1ZO');
      assert.strictEqual(report.table4_b2b[0].taxableValue, 2000);

      assert.strictEqual(report.table7_b2c_small.length, 1);
      assert.strictEqual(report.table7_b2c_small[0].taxableValue, 400);

      assert.strictEqual(report.table13_documents[0].totalNumber, 2);
      assert.strictEqual(report.summary.totalTaxableValue, 2400);
      assert.strictEqual(report.summary.totalTax, 120);

      // Verify B2B CSV export output
      const csv = formatGstr1B2BCsv(report.table4_b2b);
      assert.ok(csv.includes('27AAECU9603R1ZO'));
      assert.ok(csv.includes('GST-2627/0001'));
    });

    it('generates GSTR-3B monthly tax liability summary', () => {
      const mockOrders = [
        {
          taxableAmount: 1000,
          cgstAmount: 25,
          sgstAmount: 25,
          igstAmount: 0,
          status: 'completed',
        },
        {
          taxableAmount: 500,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 25,
          status: 'completed',
        },
      ];

      const gstr3b = generateGstr3bSummary({ orders: mockOrders, cafe: testCafe });

      assert.strictEqual(gstr3b.table3_1_a.taxableValue, 1500);
      assert.strictEqual(gstr3b.table3_1_a.centralTax, 25);
      assert.strictEqual(gstr3b.table3_1_a.stateTax, 25);
      assert.strictEqual(gstr3b.table3_1_a.integratedTax, 25);
      assert.strictEqual(gstr3b.netPayable.totalTaxPayable, 75);
    });
  });

  /* --------------------------------------------------------------------------
     5. Tally ERP 9 / Tally Prime XML & E-Invoicing
     -------------------------------------------------------------------------- */
  describe('Tally ERP 9 / Tally Prime Sync & E-Invoice Generator', () => {
    it('generates balanced Tally Sales Voucher XML with Debits and Credits', () => {
      const mockOrders = [
        {
          orderNo: 'PB5001',
          invoiceNumber: 'GST-2627/0042',
          createdAt: new Date('2026-10-15'),
          paymentMethod: 'UPI',
          taxableAmount: 1000,
          cgstAmount: 25,
          sgstAmount: 25,
          igstAmount: 0,
          total: 1050,
          status: 'completed',
        },
      ];

      const xml = generateTallyVoucherXml({ orders: mockOrders, cafe: testCafe });

      assert.ok(xml.includes('<ENVELOPE>'));
      assert.ok(xml.includes('<TALLYREQUEST>Import Data</TALLYREQUEST>'));
      assert.ok(xml.includes('<VOUCHER VCHTYPE="Sales" ACTION="Create"'));
      assert.ok(xml.includes('<VOUCHERNUMBER>GST-2627/0042</VOUCHERNUMBER>'));
      // DEBIT ledger entry (-1050)
      assert.ok(xml.includes('<AMOUNT>-1050</AMOUNT>'));
      assert.ok(xml.includes('<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>'));
      // CREDIT Sales ledger entry (1000)
      assert.ok(xml.includes('<AMOUNT>1000</AMOUNT>'));
      // CREDIT CGST and SGST ledgers (25 each)
      assert.ok(xml.includes('<AMOUNT>25</AMOUNT>'));
    });

    it('generates standard GSTN / NIC 1.03 E-Invoice JSON payload', () => {
      const order = {
        orderNo: 'PB5002',
        invoiceNumber: 'GST-2627/0043',
        customerGstin: '27AAECU9603R1ZO',
        customerLegalName: 'Tata Consultancy Services Ltd',
        customerStateCode: '27',
        taxableAmount: 2000,
        cgstAmount: 50,
        sgstAmount: 50,
        igstAmount: 0,
        total: 2100,
        items: [
          {
            name: 'Batch Brew Colombian',
            hsnCode: '996331',
            quantity: 10,
            price: 210,
            taxableAmount: 2000,
            gstRate: 5.0,
            cgstAmount: 50,
            sgstAmount: 50,
            igstAmount: 0,
            grossAmount: 2100,
          },
        ],
      };

      const einvoice = generateEInvoicePayload(order, testCafe);

      assert.strictEqual(einvoice.Version, '1.1');
      assert.strictEqual(einvoice.TranDtls.TaxSch, 'GST');
      assert.strictEqual(einvoice.TranDtls.SupTyp, 'B2B');
      assert.strictEqual(einvoice.DocDtls.No, 'GST-2627/0043');
      assert.strictEqual(einvoice.SellerDtls.Gstin, testCafe.gstin);
      assert.strictEqual(einvoice.BuyerDtls.Gstin, '27AAECU9603R1ZO');
      assert.strictEqual(einvoice.ValDtls.AssVal, 2000);
      assert.strictEqual(einvoice.ValDtls.TotInvVal, 2100);
      assert.strictEqual(einvoice.ItemList.length, 1);
      assert.strictEqual(einvoice.ItemList[0].HsnCd, '996331');
    });
  });
});

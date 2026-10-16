/**
 * Phase 9: Indian Tax Compliance, GST Invoicing & Tally ERP Sync Engine
 * Complete Indian regulatory (GSTN/IRP) and Tally ERP 9 / Tally Prime automation.
 */

// Format numbers to 2 decimal places safely
export const round2 = num => Math.round((Number(num) || 0) * 100) / 100;

// Format dates as YYYY-MM-DD or DD/MM/YYYY for GST / Tally
export function formatGstDate(date = new Date(), format = 'DD/MM/YYYY') {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  if (format === 'YYYYMMDD') return `${year}${month}${day}`;
  if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
  return `${day}/${month}/${year}`;
}

/**
 * Validate Indian GSTIN format: 15 alphanumeric characters
 * Example: 27AABCU9603R1ZM
 * Structure: 2 digits (State Code) + 10 chars (PAN) + 1 digit (Entity) + 'Z' + 1 checksum
 */
export function validateGstin(gstin) {
  if (!gstin || typeof gstin !== 'string') return false;
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(gstin.trim().toUpperCase());
}

/**
 * Extract State Code from GSTIN (first 2 digits)
 */
export function getStateCodeFromGstin(gstin) {
  if (!gstin || typeof gstin !== 'string') return null;
  const clean = gstin.trim().toUpperCase();
  if (clean.length >= 2 && /^\d{2}$/.test(clean.substring(0, 2))) {
    return clean.substring(0, 2);
  }
  return null;
}

/**
 * Calculate GST for a single line item
 */
export function calculateItemGst({
  price = 0,
  quantity = 1,
  gstRate = 5.0,
  isInclusive = true,
  isInterState = false,
  hsnCode = '996331',
  taxExempt = false,
}) {
  const rate = taxExempt ? 0 : Number(gstRate) || 0;
  const gross = round2((Number(price) || 0) * (Number(quantity) || 1));

  let taxableAmount = 0;
  let totalTax = 0;

  if (taxExempt || rate === 0) {
    taxableAmount = gross;
    totalTax = 0;
  } else if (isInclusive) {
    // Inclusive: Taxable = Gross / (1 + Rate / 100)
    taxableAmount = round2(gross / (1 + rate / 100));
    totalTax = round2(gross - taxableAmount);
  } else {
    // Exclusive: Taxable = Gross, Tax = Taxable * Rate / 100
    taxableAmount = gross;
    totalTax = round2(taxableAmount * (rate / 100));
  }

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (rate > 0) {
    if (isInterState) {
      igstRate = rate;
      igstAmount = totalTax;
    } else {
      cgstRate = round2(rate / 2);
      sgstRate = round2(rate / 2);
      cgstAmount = round2(totalTax / 2);
      sgstAmount = round2(totalTax - cgstAmount); // Exact penny balancing
    }
  }

  return {
    hsnCode: hsnCode || '996331',
    gstRate: rate,
    taxableAmount,
    totalTax,
    grossAmount: round2(taxableAmount + totalTax),
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
  };
}

/**
 * Calculate full order GST tax breakdown and HSN Table 12 summary
 */
export function calculateOrderTaxBreakdown({
  items = [],
  cafe = {},
  customerGstin = null,
  customerStateCode = null,
  isInclusiveOverride = null,
}) {
  const cafeStateCode = String(cafe.stateCode || '27').padStart(2, '0');
  let targetCustomerStateCode = customerStateCode ? String(customerStateCode).padStart(2, '0') : null;

  if (customerGstin && !targetCustomerStateCode) {
    targetCustomerStateCode = getStateCodeFromGstin(customerGstin);
  }

  // Inter-state when customer state is specified and different from cafe state
  const isInterState = !!(targetCustomerStateCode && targetCustomerStateCode !== cafeStateCode);
  const isB2B = !!(customerGstin && validateGstin(customerGstin));
  const isInclusive = isInclusiveOverride !== null ? !!isInclusiveOverride : cafe.taxInclusivePricing !== false;

  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalTax = 0;
  let grossTotal = 0;

  const calculatedItems = items.map(item => {
    const itemCalc = calculateItemGst({
      price: item.price,
      quantity: item.quantity || 1,
      gstRate: item.gstRate !== undefined ? item.gstRate : cafe.defaultGstRate || 5.0,
      isInclusive,
      isInterState,
      hsnCode: item.hsnCode || '996331',
      taxExempt: !!item.taxExempt,
    });

    totalTaxable = round2(totalTaxable + itemCalc.taxableAmount);
    totalCgst = round2(totalCgst + itemCalc.cgstAmount);
    totalSgst = round2(totalSgst + itemCalc.sgstAmount);
    totalIgst = round2(totalIgst + itemCalc.igstAmount);
    totalTax = round2(totalTax + itemCalc.totalTax);
    grossTotal = round2(grossTotal + itemCalc.grossAmount);

    return {
      ...item,
      ...itemCalc,
    };
  });

  // Aggregate HSN Table 12 Summary
  const hsnMap = new Map();
  for (const it of calculatedItems) {
    const key = `${it.hsnCode}_${it.gstRate}`;
    if (!hsnMap.has(key)) {
      hsnMap.set(key, {
        hsnCode: it.hsnCode,
        description: it.hsnCode === '21011120' ? 'Roasted Coffee Beans / Retail' : 'Food & Beverage Restaurant Service',
        gstRate: it.gstRate,
        uqc: 'NOS',
        quantity: 0,
        totalValue: 0,
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
      });
    }
    const h = hsnMap.get(key);
    h.quantity += it.quantity || 1;
    h.totalValue = round2(h.totalValue + it.grossAmount);
    h.taxableValue = round2(h.taxableValue + it.taxableAmount);
    h.cgstAmount = round2(h.cgstAmount + it.cgstAmount);
    h.sgstAmount = round2(h.sgstAmount + it.sgstAmount);
    h.igstAmount = round2(h.igstAmount + it.igstAmount);
  }

  const hsnSummary = Array.from(hsnMap.values());

  return {
    isB2B,
    isInterState,
    isInclusive,
    cafeStateCode,
    customerStateCode: targetCustomerStateCode || cafeStateCode,
    customerGstin: isB2B ? customerGstin.trim().toUpperCase() : null,
    taxableAmount: totalTaxable,
    cgstAmount: totalCgst,
    sgstAmount: totalSgst,
    igstAmount: totalIgst,
    totalTax,
    grossTotal,
    hsnSummary,
    items: calculatedItems,
  };
}

/**
 * Format standard sequential Tax Invoice number
 * e.g. prefix 'GST-2627/', seq 1 => 'GST-2627/0001'
 */
export function formatTaxInvoiceNumber(prefix = 'GST-2627/', seq = 1) {
  const numStr = String(seq || 1).padStart(4, '0');
  return `${prefix || 'GST-2627/'}${numStr}`;
}

/**
 * GSTR-1 Summary Report Generator
 * Generates Table 4 (B2B), Table 7 (B2C Small), Table 12 (HSN Summary), Table 13 (Documents Issued)
 */
export function generateGstr1Report({ orders = [], cafe = {} }) {
  const b2bInvoices = [];
  const b2cSmallMap = new Map();
  const hsnMap = new Map();
  let firstInvoice = null;
  let lastInvoice = null;
  let totalDocs = 0;
  let cancelledDocs = 0;

  for (const order of orders) {
    if (order.status === 'cancelled') {
      cancelledDocs++;
      continue;
    }
    totalDocs++;

    const invNo = order.invoiceNumber || order.orderNo;
    if (!firstInvoice) firstInvoice = invNo;
    lastInvoice = invNo;

    const invDate = formatGstDate(order.invoiceDate || order.createdAt);
    const pos = order.customerStateCode || cafe.stateCode || '27';
    const taxableVal = round2(order.taxableAmount || 0);
    const cgstVal = round2(order.cgstAmount || 0);
    const sgstVal = round2(order.sgstAmount || 0);
    const igstVal = round2(order.igstAmount || 0);
    const totalVal = round2(order.total || (taxableVal + cgstVal + sgstVal + igstVal));

    if (order.isB2B && order.customerGstin) {
      // Table 4: B2B Invoices
      b2bInvoices.push({
        customerGstin: order.customerGstin,
        customerLegalName: order.customerLegalName || order.customerName || 'B2B Client',
        invoiceNumber: invNo,
        invoiceDate: invDate,
        invoiceValue: totalVal,
        placeOfSupply: pos,
        reverseCharge: 'N',
        invoiceType: 'Regular',
        taxableValue: taxableVal,
        cgstAmount: cgstVal,
        sgstAmount: sgstVal,
        igstAmount: igstVal,
      });
    } else {
      // Table 7: B2C Small (Aggregated by POS & GST Rate)
      const rate = taxableVal > 0 ? round2(((cgstVal + sgstVal + igstVal) / taxableVal) * 100) : 5.0;
      const b2cKey = `${pos}_${rate}`;
      if (!b2cSmallMap.has(b2cKey)) {
        b2cSmallMap.set(b2cKey, {
          placeOfSupply: pos,
          applicableRate: rate,
          taxableValue: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          cessAmount: 0,
        });
      }
      const b2c = b2cSmallMap.get(b2cKey);
      b2c.taxableValue = round2(b2c.taxableValue + taxableVal);
      b2c.cgstAmount = round2(b2c.cgstAmount + cgstVal);
      b2c.sgstAmount = round2(b2c.sgstAmount + sgstVal);
      b2c.igstAmount = round2(b2c.igstAmount + igstVal);
    }

    // Table 12: HSN Summary aggregation
    const itemsHsn = Array.isArray(order.hsnSummary)
      ? order.hsnSummary
      : [
          {
            hsnCode: '996331',
            description: 'Food & Beverage Restaurant Service',
            uqc: 'NOS',
            quantity: 1,
            totalValue: totalVal,
            taxableValue: taxableVal,
            cgstAmount: cgstVal,
            sgstAmount: sgstVal,
            igstAmount: igstVal,
          },
        ];

    for (const h of itemsHsn) {
      const hsnKey = `${h.hsnCode}_${h.gstRate || 5}`;
      if (!hsnMap.has(hsnKey)) {
        hsnMap.set(hsnKey, {
          hsnCode: h.hsnCode || '996331',
          description: h.description || 'Food & Beverage Service',
          uqc: 'NOS',
          totalQuantity: 0,
          totalValue: 0,
          taxableValue: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
        });
      }
      const existingHsn = hsnMap.get(hsnKey);
      existingHsn.totalQuantity += h.quantity || 1;
      existingHsn.totalValue = round2(existingHsn.totalValue + (h.totalValue || totalVal));
      existingHsn.taxableValue = round2(existingHsn.taxableValue + (h.taxableValue || taxableVal));
      existingHsn.cgstAmount = round2(existingHsn.cgstAmount + (h.cgstAmount || cgstVal));
      existingHsn.sgstAmount = round2(existingHsn.sgstAmount + (h.sgstAmount || sgstVal));
      existingHsn.igstAmount = round2(existingHsn.igstAmount + (h.igstAmount || igstVal));
    }
  }

  // Table 13: Documents Issued
  const table13 = [
    {
      natureOfDocument: 'Invoices for outward supply',
      fromSerial: firstInvoice || 'GST-2627/0001',
      toSerial: lastInvoice || 'GST-2627/0001',
      totalNumber: totalDocs,
      cancelledNumber: cancelledDocs,
      netIssued: Math.max(0, totalDocs - cancelledDocs),
    },
  ];

  return {
    cafe: {
      id: cafe.id,
      name: cafe.name,
      gstin: cafe.gstin || '27AABCU9603R1ZM',
      legalBusinessName: cafe.legalBusinessName || cafe.name,
      stateCode: cafe.stateCode || '27',
    },
    table4_b2b: b2bInvoices,
    table7_b2c_small: Array.from(b2cSmallMap.values()),
    table12_hsn: Array.from(hsnMap.values()),
    table13_documents: table13,
    summary: {
      totalInvoices: totalDocs,
      b2bCount: b2bInvoices.length,
      b2cCount: totalDocs - b2bInvoices.length,
      totalTaxableValue: round2(
        b2bInvoices.reduce((s, i) => s + i.taxableValue, 0) +
          Array.from(b2cSmallMap.values()).reduce((s, i) => s + i.taxableValue, 0)
      ),
      totalTax: round2(
        b2bInvoices.reduce((s, i) => s + i.cgstAmount + i.sgstAmount + i.igstAmount, 0) +
          Array.from(b2cSmallMap.values()).reduce((s, i) => s + i.cgstAmount + i.sgstAmount + i.igstAmount, 0)
      ),
    },
  };
}

/**
 * GSTR-3B Tax Summary Generator
 * Computes outward taxable supplies and net tax liability
 */
export function generateGstr3bSummary({ orders = [], cafe = {} }) {
  let taxableValue = 0;
  let integratedTax = 0;
  let centralTax = 0;
  let stateTax = 0;
  let cess = 0;

  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    taxableValue = round2(taxableValue + (o.taxableAmount || 0));
    integratedTax = round2(integratedTax + (o.igstAmount || 0));
    centralTax = round2(centralTax + (o.cgstAmount || 0));
    stateTax = round2(stateTax + (o.sgstAmount || 0));
  }

  return {
    cafe: {
      id: cafe.id,
      name: cafe.name,
      gstin: cafe.gstin || '27AABCU9603R1ZM',
      legalBusinessName: cafe.legalBusinessName || cafe.name,
      stateCode: cafe.stateCode || '27',
    },
    table3_1_a: {
      description: 'Outward taxable supplies (other than zero rated, nil rated and exempted)',
      taxableValue,
      integratedTax,
      centralTax,
      stateTax,
      cess,
      totalTaxLiability: round2(integratedTax + centralTax + stateTax + cess),
    },
    table3_1_c: {
      description: 'Other outward supplies (Nil rated, exempted)',
      taxableValue: 0,
    },
    netPayable: {
      integratedTax,
      centralTax,
      stateTax,
      totalTaxPayable: round2(integratedTax + centralTax + stateTax),
    },
  };
}

/**
 * B2B E-Invoicing JSON Payload Generator (GSTN / NIC Schema 1.03)
 */
export function generateEInvoicePayload(order, cafe = {}) {
  const docDate = formatGstDate(order.invoiceDate || order.createdAt, 'DD/MM/YYYY');
  const pos = order.customerStateCode || cafe.stateCode || '27';

  const itemList = (order.items || []).map((it, idx) => ({
    SlNo: String(idx + 1),
    PrdDesc: it.name || 'Food / Beverage item',
    IsServc: it.hsnCode?.startsWith('99') ? 'Y' : 'N',
    HsnCd: it.hsnCode || '996331',
    Qty: Number(it.quantity) || 1,
    Unit: 'NOS',
    UnitPrice: round2(it.price || 0),
    TotAmt: round2((it.price || 0) * (it.quantity || 1)),
    Discount: 0,
    AssAmt: round2(it.taxableAmount || it.price || 0),
    GstRt: round2(it.gstRate || 5.0),
    IgstAmt: round2(it.igstAmount || 0),
    CgstAmt: round2(it.cgstAmount || 0),
    SgstAmt: round2(it.sgstAmount || 0),
    CesAmt: 0,
    TotItemVal: round2(it.grossAmount || (it.taxableAmount || 0) + (it.totalTax || 0)),
  }));

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: 'B2B',
      RegRev: 'N',
      EcmGstin: null,
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: 'INV',
      No: order.invoiceNumber || order.orderNo,
      Dt: docDate,
    },
    SellerDtls: {
      Gstin: cafe.gstin || '27AABCU9603R1ZM',
      LglNm: cafe.legalBusinessName || cafe.name || 'Gusstora Roasters LLP',
      TrdNm: cafe.name || 'Gusstora',
      Addr1: cafe.address || 'Bandrakurla Complex',
      Loc: cafe.stateName || 'Mumbai',
      Pin: 400051,
      Stcd: String(cafe.stateCode || '27').padStart(2, '0'),
      Ph: cafe.phone || '9876543210',
    },
    BuyerDtls: {
      Gstin: order.customerGstin || '27AAECU9603R1ZO',
      LglNm: order.customerLegalName || order.customerName || 'Corporate Client',
      TrdNm: order.customerName || 'Corporate Client',
      Pos: String(pos).padStart(2, '0'),
      Addr1: 'Client Headquarters',
      Loc: 'Mumbai',
      Pin: 400001,
      Stcd: String(pos).padStart(2, '0'),
    },
    ItemList: itemList,
    ValDtls: {
      AssVal: round2(order.taxableAmount || 0),
      CgstVal: round2(order.cgstAmount || 0),
      SgstVal: round2(order.sgstAmount || 0),
      IgstVal: round2(order.igstAmount || 0),
      CesVal: 0,
      StCesVal: 0,
      Discount: round2(order.discount || 0),
      OthChrg: 0,
      RndOffAmt: 0,
      TotInvVal: round2(order.total || 0),
    },
  };
}

/**
 * Tally ERP 9 / Tally Prime Sales Voucher XML Generator
 * Produces clean standard Tally import XML with Sales, CGST, SGST, IGST, and Cash/Bank ledgers.
 */
export function generateTallyVoucherXml({ orders = [], cafe = {} }) {
  const companyName = cafe.tallyCompany || 'Gusstora Roasters';
  const salesLedger = cafe.tallySalesLedger || 'Food & Beverage Sales';
  const cgstLedger = cafe.tallyCgstLedger || 'CGST Input/Output 2.5%';
  const sgstLedger = cafe.tallySgstLedger || 'SGST Input/Output 2.5%';
  const igstLedger = cafe.tallyIgstLedger || 'IGST 5%';

  const vouchersXml = orders
    .filter(o => o.status !== 'cancelled')
    .map(order => {
      const tallyDate = formatGstDate(order.invoiceDate || order.createdAt, 'YYYYMMDD');
      const invoiceNo = order.invoiceNumber || order.orderNo;
      const totalAmount = round2(order.total || 0);
      const taxableAmount = round2(order.taxableAmount || 0);
      const cgstAmount = round2(order.cgstAmount || 0);
      const sgstAmount = round2(order.sgstAmount || 0);
      const igstAmount = round2(order.igstAmount || 0);

      const partyLedger = order.isB2B && order.customerLegalName
        ? order.customerLegalName
        : order.paymentMethod?.toLowerCase() === 'cash'
        ? 'Cash'
        : 'Bank - HDFC Current A/C';

      return `      <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
        <DATE>${tallyDate}</DATE>
        <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${invoiceNo}</VOUCHERNUMBER>
        <REFERENCE>${invoiceNo}</REFERENCE>
        <PARTYLEDGERNAME>${partyLedger}</PARTYLEDGERNAME>
        <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
        <ISINVOICE>Yes</ISINVOICE>
        <NARRATION>POS Order #${order.orderNo} | Mode: ${order.paymentMethod || 'UPI'} | Table: ${order.table || 'Walk-in'}${order.customerGstin ? ` | GSTIN: ${order.customerGstin}` : ''}</NARRATION>
        
        <!-- DEBIT: Cash / Bank or Sundry Debtor -->
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${partyLedger}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${totalAmount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>

        <!-- CREDIT: Sales Ledger -->
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${salesLedger}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${taxableAmount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
${
  cgstAmount > 0
    ? `        <!-- CREDIT: CGST Ledger -->
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${cgstLedger}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${cgstAmount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`
    : ''
}
${
  sgstAmount > 0
    ? `        <!-- CREDIT: SGST Ledger -->
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${sgstLedger}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${sgstAmount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`
    : ''
}
${
  igstAmount > 0
    ? `        <!-- CREDIT: IGST Ledger -->
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${igstLedger}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${igstAmount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`
    : ''
}
      </VOUCHER>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
${vouchersXml}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Format GSTR-1 Table 4 (B2B) as CSV
 */
export function formatGstr1B2BCsv(b2bList = []) {
  const headers = [
    'GSTIN/UIN of Recipient',
    'Receiver Name',
    'Invoice Number',
    'Invoice date',
    'Invoice Value',
    'Place Of Supply',
    'Reverse Charge',
    'Applicable % of Tax Rate',
    'Invoice Type',
    'E-Commerce GSTIN',
    'Rate',
    'Taxable Value',
    'Cess Amount',
  ];

  const rows = b2bList.map(b => [
    `"${b.customerGstin}"`,
    `"${(b.customerLegalName || '').replace(/"/g, '""')}"`,
    `"${b.invoiceNumber}"`,
    `"${b.invoiceDate}"`,
    b.invoiceValue,
    `"${b.placeOfSupply}"`,
    `"${b.reverseCharge || 'N'}"`,
    `""`,
    `"${b.invoiceType || 'Regular'}"`,
    `""`,
    round2((((b.cgstAmount || 0) + (b.sgstAmount || 0) + (b.igstAmount || 0)) / (b.taxableValue || 1)) * 100),
    b.taxableValue,
    0,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

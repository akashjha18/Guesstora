import express from 'express';
import { Op } from 'sequelize';
import { Cafe, MenuItem, Order, OrderItem } from '../models.js';
import { requireStaff } from '../auth.js';
import {
  calculateOrderTaxBreakdown,
  calculateItemGst,
  validateGstin,
  getStateCodeFromGstin,
  formatTaxInvoiceNumber,
  generateGstr1Report,
  generateGstr3bSummary,
  generateEInvoicePayload,
  generateTallyVoucherXml,
  formatGstr1B2BCsv,
  round2,
} from '../gstEngine.js';
import { serializeOrder } from './serializers.js';

export const gstRouter = express.Router();

/**
 * 1. GET /owner/gst/config - Fetch active Cafe GST and Tally sync configuration
 */
gstRouter.get('/owner/gst/config', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const cafe = await Cafe.findByPk(cafeId);
    if (!cafe) {
      return res.status(404).json({ message: 'Cafe not found' });
    }

    return res.json({
      id: cafe.id,
      name: cafe.name,
      gstin: cafe.gstin || '',
      legalBusinessName: cafe.legalBusinessName || cafe.name || '',
      stateCode: cafe.stateCode || '27',
      stateName: cafe.stateName || 'Maharashtra',
      gstCompositionScheme: Boolean(cafe.gstCompositionScheme),
      gstEnabled: cafe.gstEnabled !== false,
      taxInclusivePricing: cafe.taxInclusivePricing !== false,
      defaultGstRate: Number(cafe.defaultGstRate) || 5.0,
      tallyCompany: cafe.tallyCompany || cafe.name || 'GUESTORA Roasters',
      tallySalesLedger: cafe.tallySalesLedger || 'Food & Beverage Sales',
      tallyCgstLedger: cafe.tallyCgstLedger || 'CGST Input/Output 2.5%',
      tallySgstLedger: cafe.tallySgstLedger || 'SGST Input/Output 2.5%',
      tallyIgstLedger: cafe.tallyIgstLedger || 'IGST 5%',
      invoicePrefix: cafe.invoicePrefix || 'GST-2627/',
      nextInvoiceSeq: Number(cafe.nextInvoiceSeq) || 1,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch GST configuration', error: err.message });
  }
});

/**
 * 2. PUT /owner/gst/config - Update Cafe GST and Tally sync configuration
 */
gstRouter.put('/owner/gst/config', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const cafe = await Cafe.findByPk(cafeId);
    if (!cafe) {
      return res.status(404).json({ message: 'Cafe not found' });
    }

    const {
      gstin,
      legalBusinessName,
      stateCode,
      stateName,
      gstCompositionScheme,
      gstEnabled,
      taxInclusivePricing,
      defaultGstRate,
      tallyCompany,
      tallySalesLedger,
      tallyCgstLedger,
      tallySgstLedger,
      tallyIgstLedger,
      invoicePrefix,
      nextInvoiceSeq,
    } = req.body;

    const trimmedGstin = gstin ? String(gstin).trim().toUpperCase() : null;
    if (trimmedGstin && !validateGstin(trimmedGstin)) {
      return res.status(400).json({
        message: 'Invalid Indian GSTIN format. Must be 15 alphanumeric characters (e.g., 27AABCU9603R1ZM).',
      });
    }

    // Auto-derive state code from GSTIN if not explicitly provided
    let derivedStateCode = stateCode;
    if (trimmedGstin && !derivedStateCode) {
      derivedStateCode = getStateCodeFromGstin(trimmedGstin);
    }

    await cafe.update({
      gstin: trimmedGstin,
      legalBusinessName: legalBusinessName !== undefined ? legalBusinessName : cafe.legalBusinessName,
      stateCode: derivedStateCode !== undefined ? derivedStateCode : cafe.stateCode,
      stateName: stateName !== undefined ? stateName : cafe.stateName,
      gstCompositionScheme: gstCompositionScheme !== undefined ? Boolean(gstCompositionScheme) : cafe.gstCompositionScheme,
      gstEnabled: gstEnabled !== undefined ? Boolean(gstEnabled) : cafe.gstEnabled,
      taxInclusivePricing: taxInclusivePricing !== undefined ? Boolean(taxInclusivePricing) : cafe.taxInclusivePricing,
      defaultGstRate: defaultGstRate !== undefined ? Number(defaultGstRate) : cafe.defaultGstRate,
      tallyCompany: tallyCompany !== undefined ? tallyCompany : cafe.tallyCompany,
      tallySalesLedger: tallySalesLedger !== undefined ? tallySalesLedger : cafe.tallySalesLedger,
      tallyCgstLedger: tallyCgstLedger !== undefined ? tallyCgstLedger : cafe.tallyCgstLedger,
      tallySgstLedger: tallySgstLedger !== undefined ? tallySgstLedger : cafe.tallySgstLedger,
      tallyIgstLedger: tallyIgstLedger !== undefined ? tallyIgstLedger : cafe.tallyIgstLedger,
      invoicePrefix: invoicePrefix !== undefined ? invoicePrefix : cafe.invoicePrefix,
      nextInvoiceSeq: nextInvoiceSeq !== undefined ? Number(nextInvoiceSeq) : cafe.nextInvoiceSeq,
    });

    return res.json({
      message: 'GST & Tally configuration updated successfully',
      config: {
        id: cafe.id,
        gstin: cafe.gstin,
        legalBusinessName: cafe.legalBusinessName,
        stateCode: cafe.stateCode,
        stateName: cafe.stateName,
        gstCompositionScheme: cafe.gstCompositionScheme,
        gstEnabled: cafe.gstEnabled,
        taxInclusivePricing: cafe.taxInclusivePricing,
        defaultGstRate: cafe.defaultGstRate,
        tallyCompany: cafe.tallyCompany,
        tallySalesLedger: cafe.tallySalesLedger,
        tallyCgstLedger: cafe.tallyCgstLedger,
        tallySgstLedger: cafe.tallySgstLedger,
        tallyIgstLedger: cafe.tallyIgstLedger,
        invoicePrefix: cafe.invoicePrefix,
        nextInvoiceSeq: cafe.nextInvoiceSeq,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update GST config', error: err.message });
  }
});

/**
 * 3. GET /owner/gst/orders - List orders with GST and B2B details
 */
gstRouter.get('/owner/gst/orders', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { startDate, endDate, isB2B, search, page = 1, limit = 50 } = req.query;

    const where = { cafeId };

    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    } else if (startDate) {
      where.createdAt = { [Op.gte]: new Date(startDate) };
    }

    if (isB2B !== undefined) {
      where.isB2B = isB2B === 'true' || isB2B === true;
    }

    if (search) {
      where[Op.or] = [
        { orderNo: { [Op.like]: `%${search}%` } },
        { invoiceNumber: { [Op.like]: `%${search}%` } },
        { customerName: { [Op.like]: `%${search}%` } },
        { customerGstin: { [Op.like]: `%${search}%` } },
        { customerLegalName: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (Number(page) - 1) * Number(limit);
    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [{ model: OrderItem, as: 'items' }],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
    });

    return res.json({
      total: count,
      page: Number(page),
      limit: Number(limit),
      orders: rows.map(serializeOrder),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch GST orders', error: err.message });
  }
});

/**
 * 4. GET /owner/gst/orders/:id/invoice - View comprehensive Tax Invoice details
 */
gstRouter.get('/owner/gst/orders/:id/invoice', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const order = await Order.findOne({
      where: { id: req.params.id, cafeId },
      include: [{ model: OrderItem, as: 'items' }],
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const cafe = await Cafe.findByPk(cafeId);

    // If order has no calculated tax breakdown yet, compute on the fly
    const breakdown = calculateOrderTaxBreakdown({
      items: order.items || [],
      cafe,
      customerGstin: order.customerGstin,
      customerStateCode: order.customerStateCode,
      isInclusiveOverride: cafe.taxInclusivePricing !== false,
    });

    const invoiceNumber = order.invoiceNumber || order.orderNo;
    const invoiceDate = order.invoiceDate || order.createdAt;

    // Generate GST compliant QR Code string payload
    const qrData = `GSTIN:${cafe.gstin || '27AABCU9603R1ZM'}|INV:${invoiceNumber}|DT:${new Date(invoiceDate).toISOString().slice(0, 10)}|VAL:${order.total}|TAX:${order.totalTax || breakdown.totalTax}|POS:${order.customerStateCode || cafe.stateCode || '27'}`;

    return res.json({
      orderId: order.id,
      orderNo: order.orderNo,
      invoiceNumber,
      invoiceDate,
      seller: {
        legalName: cafe.legalBusinessName || cafe.name,
        tradeName: cafe.name,
        gstin: cafe.gstin || '27AABCU9603R1ZM',
        address: cafe.address || 'Bandra Kurla Complex',
        stateCode: cafe.stateCode || '27',
        stateName: cafe.stateName || 'Maharashtra',
        phone: cafe.phone,
      },
      buyer: {
        isB2B: Boolean(order.isB2B),
        customerName: order.customerName,
        customerLegalName: order.customerLegalName || order.customerName,
        customerGstin: order.customerGstin || null,
        placeOfSupply: order.customerStateCode || cafe.stateCode || '27',
        phone: order.phone,
      },
      taxDetails: {
        isInterState: Boolean(order.isInterState || breakdown.isInterState),
        isTaxInclusive: cafe.taxInclusivePricing !== false,
        taxableAmount: Number(order.taxableAmount) || breakdown.taxableAmount,
        cgstAmount: Number(order.cgstAmount) || breakdown.cgstAmount,
        sgstAmount: Number(order.sgstAmount) || breakdown.sgstAmount,
        igstAmount: Number(order.igstAmount) || breakdown.igstAmount,
        totalTax: Number(order.totalTax) || breakdown.totalTax,
        total: Number(order.total),
      },
      hsnSummary: order.hsnSummary ? (typeof order.hsnSummary === 'string' ? JSON.parse(order.hsnSummary) : order.hsnSummary) : breakdown.hsnSummary,
      lineItems: (order.items || []).map(it => ({
        id: it.id,
        name: it.name,
        price: Number(it.price),
        quantity: it.quantity,
        hsnCode: it.hsnCode || '996331',
        gstRate: Number(it.gstRate) || 5.0,
        taxableAmount: Number(it.taxableAmount) || round2((it.price * it.quantity) / 1.05),
        cgstAmount: Number(it.cgstAmount) || 0,
        sgstAmount: Number(it.sgstAmount) || 0,
        igstAmount: Number(it.igstAmount) || 0,
        totalTax: Number(it.totalTax) || 0,
      })),
      eInvoice: {
        irn: order.eInvoiceIrn || null,
        ackNo: order.eInvoiceAckNo || null,
        ackDate: order.eInvoiceAckDate || null,
        qrCode: order.eInvoiceQrCode || qrData,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to generate tax invoice view', error: err.message });
  }
});

/**
 * 5. POST /owner/gst/orders/:id/issue-invoice - Issue official sequential tax invoice number & apply B2B details
 */
gstRouter.post('/owner/gst/orders/:id/issue-invoice', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { customerGstin, customerLegalName, customerStateCode, isInclusive } = req.body;

    const order = await Order.findOne({
      where: { id: req.params.id, cafeId },
      include: [{ model: OrderItem, as: 'items' }],
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const cafe = await Cafe.findByPk(cafeId);

    let cleanGstin = customerGstin ? String(customerGstin).trim().toUpperCase() : null;
    let isB2B = false;
    let targetStateCode = customerStateCode || null;

    if (cleanGstin) {
      if (!validateGstin(cleanGstin)) {
        return res.status(400).json({
          message: 'Invalid B2B customer GSTIN format. Must be 15 alphanumeric characters.',
        });
      }
      isB2B = true;
      if (!targetStateCode) {
        targetStateCode = getStateCodeFromGstin(cleanGstin);
      }
    }

    // Determine sequential invoice number if not already assigned
    let invoiceNumber = order.invoiceNumber;
    if (!invoiceNumber) {
      const currentSeq = Number(cafe.nextInvoiceSeq) || 1;
      invoiceNumber = formatTaxInvoiceNumber(cafe.invoicePrefix || 'GST-2627/', currentSeq);
      await cafe.update({ nextInvoiceSeq: currentSeq + 1 });
    }

    // Calculate full tax breakdown
    const taxBreakdown = calculateOrderTaxBreakdown({
      items: order.items || [],
      cafe,
      customerGstin: cleanGstin,
      customerStateCode: targetStateCode,
      isInclusiveOverride: isInclusive !== undefined ? Boolean(isInclusive) : (cafe.taxInclusivePricing !== false),
    });

    // Update order with official GST fields
    await order.update({
      invoiceNumber,
      invoiceDate: order.invoiceDate || new Date(),
      customerGstin: cleanGstin,
      customerLegalName: customerLegalName || (cleanGstin ? 'B2B Client' : null),
      customerStateCode: targetStateCode || cafe.stateCode || '27',
      isB2B,
      isInterState: taxBreakdown.isInterState,
      taxableAmount: taxBreakdown.taxableAmount,
      cgstAmount: taxBreakdown.cgstAmount,
      sgstAmount: taxBreakdown.sgstAmount,
      igstAmount: taxBreakdown.igstAmount,
      totalTax: taxBreakdown.totalTax,
      hsnSummary: taxBreakdown.hsnSummary,
    });

    // Update individual line items
    for (const calcItem of taxBreakdown.items) {
      if (calcItem.id) {
        await OrderItem.update(
          {
            hsnCode: calcItem.hsnCode,
            gstRate: calcItem.gstRate,
            taxableAmount: calcItem.taxableAmount,
            cgstRate: calcItem.cgstRate,
            cgstAmount: calcItem.cgstAmount,
            sgstRate: calcItem.sgstRate,
            sgstAmount: calcItem.sgstAmount,
            igstRate: calcItem.igstRate,
            igstAmount: calcItem.igstAmount,
            totalTax: calcItem.totalTax,
          },
          { where: { id: calcItem.id } }
        );
      }
    }

    const reloaded = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: 'items' }],
    });

    return res.json({
      message: 'GST Tax Invoice successfully issued',
      invoiceNumber,
      order: serializeOrder(reloaded),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to issue tax invoice', error: err.message });
  }
});

/**
 * 6. GET /owner/gst/reports/gstr1 - Generate GSTR-1 Summary Report (Tables 4, 7, 12, 13)
 */
gstRouter.get('/owner/gst/reports/gstr1', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { startDate, endDate, format } = req.query;

    const cafe = await Cafe.findByPk(cafeId);
    const where = { cafeId };

    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
      where.createdAt = { [Op.gte]: new Date(startDate) };
    }

    const orders = await Order.findAll({
      where,
      include: [{ model: OrderItem, as: 'items' }],
      order: [['createdAt', 'ASC']],
    });

    const gstr1 = generateGstr1Report({ orders, cafe });

    if (format === 'csv') {
      const csv = formatGstr1B2BCsv(gstr1.table4_b2b);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="GSTR1_Table4_B2B.csv"');
      return res.send(csv);
    }

    return res.json(gstr1);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to generate GSTR-1 report', error: err.message });
  }
});

/**
 * 7. GET /owner/gst/reports/gstr3b - Generate GSTR-3B Tax Liability Summary
 */
gstRouter.get('/owner/gst/reports/gstr3b', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { startDate, endDate } = req.query;

    const cafe = await Cafe.findByPk(cafeId);
    const where = { cafeId };

    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
      where.createdAt = { [Op.gte]: new Date(startDate) };
    }

    const orders = await Order.findAll({
      where,
      include: [{ model: OrderItem, as: 'items' }],
      order: [['createdAt', 'ASC']],
    });

    const gstr3b = generateGstr3bSummary({ orders, cafe });
    return res.json(gstr3b);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to generate GSTR-3B summary', error: err.message });
  }
});

/**
 * 8. GET /owner/gst/export/tally - Tally ERP 9 / Tally Prime Sales Voucher XML Export
 */
gstRouter.get('/owner/gst/export/tally', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { startDate, endDate } = req.query;

    const cafe = await Cafe.findByPk(cafeId);
    const where = { cafeId };

    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
      where.createdAt = { [Op.gte]: new Date(startDate) };
    }

    const orders = await Order.findAll({
      where,
      include: [{ model: OrderItem, as: 'items' }],
      order: [['createdAt', 'ASC']],
    });

    const xml = generateTallyVoucherXml({ orders, cafe });

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="tally_sales_vouchers.xml"');
    return res.send(xml);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to generate Tally XML', error: err.message });
  }
});

/**
 * 9. GET /owner/gst/export/einvoice/:id - Export standard GSTN / NIC E-Invoice JSON payload
 */
gstRouter.get('/owner/gst/export/einvoice/:id', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const order = await Order.findOne({
      where: { id: req.params.id, cafeId },
      include: [{ model: OrderItem, as: 'items' }],
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const cafe = await Cafe.findByPk(cafeId);
    const payload = generateEInvoicePayload(order, cafe);

    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to generate E-Invoice payload', error: err.message });
  }
});

/**
 * 10. GET /owner/gst/menu-items - List menu items with HSN codes and GST rates
 */
gstRouter.get('/owner/gst/menu-items', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const items = await MenuItem.findAll({
      where: { cafeId },
      order: [['category', 'ASC'], ['name', 'ASC']],
    });

    return res.json({
      items: items.map(i => ({
        id: i.id,
        name: i.name,
        category: i.category,
        price: Number(i.price) || 0,
        hsnCode: i.hsnCode || '996331',
        gstRate: Number(i.gstRate) !== undefined ? Number(i.gstRate) : 5.0,
        taxExempt: Boolean(i.taxExempt),
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch menu items', error: err.message });
  }
});

/**
 * 11. PUT /owner/gst/menu-items/:id/hsn - Update item HSN code, GST rate & taxExempt
 */
gstRouter.put('/owner/gst/menu-items/:id/hsn', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const item = await MenuItem.findOne({
      where: { id: req.params.id, cafeId },
    });

    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    const { hsnCode, gstRate, taxExempt } = req.body;

    await item.update({
      hsnCode: hsnCode !== undefined ? String(hsnCode).trim() : item.hsnCode,
      gstRate: gstRate !== undefined ? Number(gstRate) : item.gstRate,
      taxExempt: taxExempt !== undefined ? Boolean(taxExempt) : item.taxExempt,
    });

    return res.json({
      message: 'Item GST details updated successfully',
      item: {
        id: item.id,
        name: item.name,
        hsnCode: item.hsnCode,
        gstRate: item.gstRate,
        taxExempt: item.taxExempt,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update item GST', error: err.message });
  }
});

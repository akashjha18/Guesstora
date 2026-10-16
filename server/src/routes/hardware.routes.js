import express from 'express';
import { PrinterConfig, EDCTerminal, HardwareLog, Order, Cafe } from '../models.js';
import {
  dispatchOrderToPrinters,
  generateEscPosReceipt,
  generateEscPosKOT,
  sendRawToNetworkPrinter,
  pushEDCChargeIntent,
  processEDCCallback,
  processSoundboxNotification,
  ESCPOS
} from '../hardwareEngine.js';

export const hardwareRouter = express.Router();

// Role gate helper
const requireOwnerOrManager = (req, res, next) => {
  if (!req.auth || !['owner', 'manager'].includes(req.auth.role)) {
    return res.status(403).json({ message: 'Forbidden. Owner or Manager privileges required.' });
  }
  next();
};

const requireStaff = (req, res, next) => {
  if (!req.auth || !['owner', 'manager', 'cashier', 'kitchen'].includes(req.auth.role)) {
    return res.status(403).json({ message: 'Forbidden. Staff access required.' });
  }
  next();
};

// ==========================================
// 1. THERMAL PRINTERS MANAGEMENT
// ==========================================
hardwareRouter.get('/owner/hardware/printers', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    let printers = await PrinterConfig.findAll({ where: { cafeId } });

    // Seed default standard printers if first time
    if (printers.length === 0) {
      await PrinterConfig.bulkCreate([
        {
          cafeId,
          name: 'Counter Receipt (80mm)',
          role: 'receipt',
          connectionType: 'network',
          ipAddress: '192.168.1.200',
          port: 9100,
          paperWidth: 80,
          autoPrintOnOrder: true,
          autoDrawerKick: true,
          categories: ['*'],
          active: true,
        },
        {
          cafeId,
          name: 'Barista Station KOT',
          role: 'barista_kot',
          connectionType: 'network',
          ipAddress: '192.168.1.201',
          port: 9100,
          paperWidth: 80,
          autoPrintOnOrder: true,
          autoDrawerKick: false,
          categories: ['Coffee', 'Beverages', 'Cold Brew', 'Tea'],
          active: true,
        },
        {
          cafeId,
          name: 'Kitchen Hot Line KOT',
          role: 'kitchen_kot',
          connectionType: 'network',
          ipAddress: '192.168.1.202',
          port: 9100,
          paperWidth: 80,
          autoPrintOnOrder: true,
          autoDrawerKick: false,
          categories: ['Breakfasts', 'Mains', 'Dessert', 'Food', 'Bakery'],
          active: true,
        },
      ]);
      printers = await PrinterConfig.findAll({ where: { cafeId } });
    }

    res.json(printers);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to list printers.' });
  }
});

hardwareRouter.post('/owner/hardware/printers', requireOwnerOrManager, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { name, role, connectionType, ipAddress, port, paperWidth, autoPrintOnOrder, autoDrawerKick, categories, active } = req.body;

    if (!name) return res.status(400).json({ message: 'Printer name is required.' });

    const printer = await PrinterConfig.create({
      cafeId,
      name,
      role: role || 'receipt',
      connectionType: connectionType || 'network',
      ipAddress: ipAddress || '192.168.1.200',
      port: port ? Number(port) : 9100,
      paperWidth: paperWidth === 58 ? 58 : 80,
      autoPrintOnOrder: autoPrintOnOrder !== false,
      autoDrawerKick: Boolean(autoDrawerKick),
      categories: Array.isArray(categories) ? categories : ['*'],
      active: active !== false,
    });

    res.status(201).json(printer);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create printer.' });
  }
});

hardwareRouter.put('/owner/hardware/printers/:id', requireOwnerOrManager, async (req, res) => {
  try {
    const printer = await PrinterConfig.findOne({ where: { id: req.params.id, cafeId: req.auth.cafe } });
    if (!printer) return res.status(404).json({ message: 'Printer not found.' });

    await printer.update(req.body);
    res.json(printer);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update printer.' });
  }
});

hardwareRouter.delete('/owner/hardware/printers/:id', requireOwnerOrManager, async (req, res) => {
  try {
    const printer = await PrinterConfig.findOne({ where: { id: req.params.id, cafeId: req.auth.cafe } });
    if (!printer) return res.status(404).json({ message: 'Printer not found.' });

    await printer.destroy();
    res.json({ message: 'Printer removed successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete printer.' });
  }
});

hardwareRouter.post('/owner/hardware/printers/:id/test', requireStaff, async (req, res) => {
  try {
    const printer = await PrinterConfig.findOne({ where: { id: req.params.id, cafeId: req.auth.cafe } });
    if (!printer) return res.status(404).json({ message: 'Printer not found.' });

    const { action } = req.body; // 'print_test' or 'kick_drawer'

    let buffer;
    if (action === 'kick_drawer') {
      buffer = Buffer.concat([ESCPOS.INIT, ESCPOS.DRAWER_KICK]);
    } else {
      const mockOrder = {
        orderNo: 'TEST-001',
        table: 'BAR-01',
        type: 'dine-in',
        items: [
          { name: 'Pour Over (Ethiopia Yirgacheffe)', quantity: 1, price: 260, variantName: 'Hot V60' },
          { name: 'Almond Croissant', quantity: 1, price: 180 },
        ],
        subtotal: 440,
        tax: 22,
        total: 462,
        paymentMode: 'UPI',
        paymentStatus: 'TEST_OK',
      };
      const cafe = await Cafe.findByPk(req.auth.cafe);
      buffer = generateEscPosReceipt(mockOrder, cafe || {}, {
        paperWidth: printer.paperWidth || 80,
        openDrawer: action === 'kick_drawer' || printer.autoDrawerKick,
      });
    }

    const result = await sendRawToNetworkPrinter({
      ipAddress: printer.ipAddress,
      port: printer.port || 9100,
      buffer,
    });

    await HardwareLog.create({
      cafeId: req.auth.cafe,
      deviceType: 'printer',
      deviceName: printer.name,
      action: action === 'kick_drawer' ? 'DRAWER_KICK_TEST' : 'THERMAL_PRINT_TEST',
      status: result.success ? (result.simulated ? 'simulated' : 'success') : 'failed',
      payload: { printerId: printer.id, action },
      response: result,
      message: result.message || result.error,
    }).catch(() => {});

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Printer test failed.' });
  }
});

// Trigger order KOT print or receipt print
hardwareRouter.post('/owner/hardware/print/order', requireStaff, async (req, res) => {
  try {
    const { orderId, printReceipt, printKOT, openDrawer } = req.body;
    const order = await Order.findOne({
      where: { id: orderId, cafeId: req.auth.cafe },
      include: ['items'],
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const results = await dispatchOrderToPrinters({
      cafeId: req.auth.cafe,
      order,
      printReceipt: Boolean(printReceipt),
      openDrawer: Boolean(openDrawer),
    });

    res.json({ success: true, printJobs: results });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Print order dispatch failed.' });
  }
});

// ==========================================
// 2. EDC CARD TERMINALS (PINE LABS / RAZORPAY / MOSAMBEE)
// ==========================================
hardwareRouter.get('/owner/hardware/edc', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    let terminals = await EDCTerminal.findAll({ where: { cafeId } });

    if (terminals.length === 0) {
      await EDCTerminal.bulkCreate([
        {
          cafeId,
          name: 'Pine Labs Plutus Counter 1',
          provider: 'pine_labs',
          terminalId: 'PL-TID-884210',
          ipAddress: '192.168.1.150',
          active: true,
          lastStatus: 'online',
        },
        {
          cafeId,
          name: 'Razorpay Smart POS Terminal',
          provider: 'razorpay_pos',
          terminalId: 'RZP-POS-9931',
          ipAddress: '192.168.1.155',
          active: true,
          lastStatus: 'online',
        },
        {
          cafeId,
          name: 'Paytm UPI Soundbox 4.0',
          provider: 'paytm_soundbox',
          terminalId: 'PTM-SND-44120',
          ipAddress: '192.168.1.160',
          active: true,
          lastStatus: 'online',
        },
      ]);
      terminals = await EDCTerminal.findAll({ where: { cafeId } });
    }

    res.json(terminals);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to list EDC terminals.' });
  }
});

hardwareRouter.post('/owner/hardware/edc', requireOwnerOrManager, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { name, provider, terminalId, ipAddress, cloudWebhookKey, autoSettleOrder, active } = req.body;

    if (!name) return res.status(400).json({ message: 'Terminal name is required.' });

    const terminal = await EDCTerminal.create({
      cafeId,
      name,
      provider: provider || 'pine_labs',
      terminalId,
      ipAddress: ipAddress || '192.168.1.150',
      cloudWebhookKey,
      autoSettleOrder: autoSettleOrder !== false,
      active: active !== false,
      lastStatus: 'online',
    });

    res.status(201).json(terminal);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to configure EDC terminal.' });
  }
});

hardwareRouter.put('/owner/hardware/edc/:id', requireOwnerOrManager, async (req, res) => {
  try {
    const terminal = await EDCTerminal.findOne({ where: { id: req.params.id, cafeId: req.auth.cafe } });
    if (!terminal) return res.status(404).json({ message: 'EDC Terminal not found.' });

    await terminal.update(req.body);
    res.json(terminal);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update EDC terminal.' });
  }
});

hardwareRouter.post('/owner/hardware/edc/charge', requireStaff, async (req, res) => {
  try {
    const { terminalId, orderId, amount } = req.body;
    if (!terminalId || !amount) {
      return res.status(400).json({ message: 'terminalId and amount are required.' });
    }

    const result = await pushEDCChargeIntent({
      cafeId: req.auth.cafe,
      terminalId,
      orderId,
      amount: Number(amount),
      cashierName: req.auth.name || 'Cashier',
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message || 'EDC charge push failed.' });
  }
});

// Interactive Simulator: Simulate customer tapping credit/debit card on EDC terminal
hardwareRouter.post('/owner/hardware/edc/simulate-tap', requireStaff, async (req, res) => {
  try {
    const { transactionRef, orderId, provider = 'pine_labs', cardNetwork = 'VISA', last4 = '4242' } = req.body;

    const result = await processEDCCallback({
      cafeId: req.auth.cafe,
      provider,
      transactionRef: transactionRef || `EDC-${Date.now().toString().slice(-6)}`,
      orderId,
      status: 'APPROVED',
      cardNetwork,
      last4,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Card tap simulation failed.' });
  }
});

// Public webhook endpoint for real Pine Labs / Razorpay POS terminals
hardwareRouter.post('/webhooks/edc/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { cafeId, transactionRef, orderId, status, cardNetwork, last4 } = req.body;

    const result = await processEDCCallback({
      cafeId,
      provider,
      transactionRef,
      orderId,
      status: status || 'APPROVED',
      cardNetwork: cardNetwork || 'CARD',
      last4: last4 || '0000',
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public webhook endpoint for Paytm / UPI Soundbox notification
hardwareRouter.post('/webhooks/soundbox', async (req, res) => {
  try {
    const { cafeId, amount, orderNo, utrNo } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount is required.' });

    const result = await processSoundboxNotification({
      cafeId: cafeId || 'default',
      amount,
      orderNo: orderNo || 'ORDER',
      utrNo,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. HARDWARE LOGS & DIAGNOSTICS
// ==========================================
hardwareRouter.get('/owner/hardware/logs', requireStaff, async (req, res) => {
  try {
    const logs = await HardwareLog.findAll({
      where: { cafeId: req.auth.cafe },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch hardware logs.' });
  }
});

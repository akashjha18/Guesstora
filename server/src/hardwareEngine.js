import net from 'net';
import { PrinterConfig, EDCTerminal, HardwareLog, Order, Cafe } from './models.js';
import { broadcastEvent } from './eventBus.js';

// ==========================================
// 1. ESC/POS BYTE GENERATOR UTILITIES
// ==========================================
export const ESCPOS = {
  INIT: Buffer.from([0x1b, 0x40]), // ESC @
  ALIGN_LEFT: Buffer.from([0x1b, 0x61, 0x00]), // ESC a 0
  ALIGN_CENTER: Buffer.from([0x1b, 0x61, 0x01]), // ESC a 1
  ALIGN_RIGHT: Buffer.from([0x1b, 0x61, 0x02]), // ESC a 2
  BOLD_ON: Buffer.from([0x1b, 0x45, 0x01]), // ESC E 1
  BOLD_OFF: Buffer.from([0x1b, 0x45, 0x00]), // ESC E 0
  DOUBLE_SIZE: Buffer.from([0x1d, 0x21, 0x11]), // GS ! 17 (Double width & height)
  DOUBLE_HEIGHT: Buffer.from([0x1d, 0x21, 0x01]), // GS ! 1
  NORMAL_SIZE: Buffer.from([0x1d, 0x21, 0x00]), // GS ! 0
  CUT_FEED: Buffer.from([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x42, 0x00]), // 3 feeds + GS V B 0 (cut)
  DRAWER_KICK: Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]), // ESC p 0 25 250 (cash drawer kick pin 2)
};

/**
 * Format two columns with space padding to fit target thermal paper column width.
 * Standard 80mm = 48 columns, 58mm = 32 columns.
 */
export function formatTwoCol(leftText, rightText, width = 48) {
  const left = String(leftText || '');
  const right = String(rightText || '');
  const spaces = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaces) + right + '\n';
}

export function formatDivider(width = 48, char = '-') {
  return char.repeat(width) + '\n';
}

/**
 * Generate binary ESC/POS payload for 80mm or 58mm Customer Receipt.
 */
export function generateEscPosReceipt(order, cafe = {}, options = {}) {
  const width = options.paperWidth === 58 ? 32 : 48;
  const parts = [];

  parts.push(ESCPOS.INIT);
  if (options.openDrawer) {
    parts.push(ESCPOS.DRAWER_KICK);
  }

  // Header
  parts.push(ESCPOS.ALIGN_CENTER);
  parts.push(ESCPOS.DOUBLE_SIZE);
  parts.push(Buffer.from(`${(cafe.name || 'GUSSTORA SPECIALTY COFFEE').toUpperCase()}\n`));
  parts.push(ESCPOS.NORMAL_SIZE);
  if (cafe.address) parts.push(Buffer.from(`${cafe.address}\n`));
  if (cafe.phone) parts.push(Buffer.from(`Tel: ${cafe.phone}\n`));
  parts.push(Buffer.from(formatDivider(width, '=')));

  // Order Details
  parts.push(ESCPOS.ALIGN_LEFT);
  parts.push(Buffer.from(formatTwoCol(`ORDER: ${order.orderNo || 'WALK-IN'}`, `TABLE: ${order.table || 'TAKEAWAY'}`, width)));
  const dateStr = new Date(order.createdAt || Date.now()).toLocaleString('en-IN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  parts.push(Buffer.from(formatTwoCol(`DATE: ${dateStr}`, `TYPE: ${(order.type || 'dine-in').toUpperCase()}`, width)));
  parts.push(Buffer.from(formatDivider(width, '-')));

  // Items Header
  parts.push(ESCPOS.BOLD_ON);
  parts.push(Buffer.from(formatTwoCol('ITEM', 'AMOUNT', width)));
  parts.push(ESCPOS.BOLD_OFF);
  parts.push(Buffer.from(formatDivider(width, '-')));

  // Line items
  const items = order.items || [];
  for (const item of items) {
    const qtyName = `${item.quantity}x ${item.name || 'Coffee'}`;
    const priceStr = `₹${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`;
    parts.push(Buffer.from(formatTwoCol(qtyName, priceStr, width)));

    // Modifiers / variants notes
    if (item.variantName) {
      parts.push(Buffer.from(`   * Size: ${item.variantName}\n`));
    }
    if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
      const modNames = item.modifiers.map(m => m.name || m).join(', ');
      parts.push(Buffer.from(`   * Mod: ${modNames}\n`));
    }
  }

  parts.push(Buffer.from(formatDivider(width, '-')));

  // Totals
  const subtotal = Number(order.subtotal || order.total || 0).toFixed(2);
  parts.push(Buffer.from(formatTwoCol('Subtotal:', `₹${subtotal}`, width)));
  if (order.discountValue && order.discountValue > 0) {
    const disc = Number(order.discountValue).toFixed(2);
    parts.push(Buffer.from(formatTwoCol('Discount Applied:', `-₹${disc}`, width)));
  }
  if (order.tax && order.tax > 0) {
    parts.push(Buffer.from(formatTwoCol('GST / Tax:', `₹${Number(order.tax).toFixed(2)}`, width)));
  }

  parts.push(Buffer.from(formatDivider(width, '=')));
  parts.push(ESCPOS.BOLD_ON);
  parts.push(ESCPOS.DOUBLE_HEIGHT);
  const totalStr = `₹${Number(order.total || 0).toFixed(2)}`;
  parts.push(Buffer.from(formatTwoCol('TOTAL PAYABLE:', totalStr, width)));
  parts.push(ESCPOS.NORMAL_SIZE);
  parts.push(ESCPOS.BOLD_OFF);
  parts.push(Buffer.from(formatDivider(width, '-')));

  // Payment Status
  parts.push(ESCPOS.ALIGN_CENTER);
  parts.push(Buffer.from(`Payment: ${(order.paymentMode || 'CASH').toUpperCase()} [${(order.paymentStatus || 'PAID').toUpperCase()}]\n`));
  if (order.paymentTransactionRef) {
    parts.push(Buffer.from(`Ref: ${order.paymentTransactionRef}\n`));
  }

  // Footer & Loyalty
  parts.push(Buffer.from('\nThank you for dining with us!\n'));
  parts.push(Buffer.from('Scan QR on table for loyalty stamps & rewards.\n'));
  parts.push(ESCPOS.CUT_FEED);

  return Buffer.concat(parts);
}

/**
 * Generate binary ESC/POS payload for Station KOT (Kitchen/Barista ticket).
 */
export function generateEscPosKOT(order, options = {}) {
  const width = options.paperWidth === 58 ? 32 : 48;
  const station = (options.station || 'KITCHEN').toUpperCase();
  const items = options.items || order.items || [];
  const parts = [];

  parts.push(ESCPOS.INIT);
  parts.push(ESCPOS.ALIGN_CENTER);
  parts.push(ESCPOS.BOLD_ON);
  parts.push(ESCPOS.DOUBLE_SIZE);
  parts.push(Buffer.from(`*** KOT: ${station} ***\n`));
  parts.push(ESCPOS.NORMAL_SIZE);
  parts.push(ESCPOS.BOLD_OFF);
  parts.push(Buffer.from(formatDivider(width, '=')));

  parts.push(ESCPOS.ALIGN_LEFT);
  parts.push(ESCPOS.DOUBLE_HEIGHT);
  parts.push(Buffer.from(`TABLE: ${order.table || 'TAKEAWAY'}  |  TOKEN: ${order.orderNo || 'NEW'}\n`));
  parts.push(ESCPOS.NORMAL_SIZE);
  const timeStr = new Date().toLocaleTimeString('en-IN', { hour12: true });
  parts.push(Buffer.from(`Time: ${timeStr}  |  Type: ${(order.type || 'dine-in').toUpperCase()}\n`));
  parts.push(Buffer.from(formatDivider(width, '-')));

  // Ticket Line Items
  parts.push(ESCPOS.BOLD_ON);
  parts.push(Buffer.from(formatTwoCol('QTY  ITEM DESCRIPTION', 'NOTES', width)));
  parts.push(ESCPOS.BOLD_OFF);
  parts.push(Buffer.from(formatDivider(width, '-')));

  for (const item of items) {
    parts.push(ESCPOS.BOLD_ON);
    parts.push(ESCPOS.DOUBLE_HEIGHT);
    parts.push(Buffer.from(`[ ] ${item.quantity}x ${item.name}\n`));
    parts.push(ESCPOS.NORMAL_SIZE);
    parts.push(ESCPOS.BOLD_OFF);

    if (item.variantName) {
      parts.push(Buffer.from(`    -> Size: ${item.variantName}\n`));
    }
    if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
      const mods = item.modifiers.map(m => m.name || m).join(', ');
      parts.push(Buffer.from(`    -> Mod: ${mods}\n`));
    }
    if (item.notes) {
      parts.push(Buffer.from(`    -> Special Note: ${item.notes}\n`));
    }
  }

  parts.push(Buffer.from(formatDivider(width, '=')));
  parts.push(ESCPOS.CUT_FEED);

  return Buffer.concat(parts);
}

// ==========================================
// 2. NETWORK TCP PRINTER DISPATCHER
// ==========================================
export async function sendRawToNetworkPrinter({ ipAddress, port = 9100, buffer, timeoutMs = 2000 }) {
  if (!ipAddress || ipAddress === 'mock' || ipAddress === '127.0.0.1' || process.env.NODE_ENV === 'test') {
    // In local dev/test or mock IP, simulate clean delivery
    return {
      success: true,
      simulated: true,
      bytesSent: buffer.length,
      destination: `${ipAddress || '127.0.0.1'}:${port}`,
      message: 'Simulated ESC/POS print job delivered successfully.',
    };
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, ipAddress, () => {
      socket.write(buffer, () => {
        socket.end();
        if (!isResolved) {
          isResolved = true;
          resolve({
            success: true,
            simulated: false,
            bytesSent: buffer.length,
            destination: `${ipAddress}:${port}`,
            message: 'Raw ESC/POS bytes transmitted to network printer.',
          });
        }
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      if (!isResolved) {
        isResolved = true;
        resolve({
          success: false,
          simulated: false,
          error: `Printer socket timed out connecting to ${ipAddress}:${port}`,
        });
      }
    });

    socket.on('error', (err) => {
      socket.destroy();
      if (!isResolved) {
        isResolved = true;
        resolve({
          success: false,
          simulated: false,
          error: err.message,
        });
      }
    });
  });
}

// ==========================================
// 3. MULTI-STATION KOT ROUTING LOGIC
// ==========================================
const BARISTA_CATEGORIES = ['coffee', 'beverages', 'beverage', 'brew', 'tea', 'cold drinks', 'shakes', 'smoothies'];
const KITCHEN_CATEGORIES = ['breakfasts', 'mains', 'dessert', 'desserts', 'food', 'snacks', 'bakery', 'sandwiches', 'pastries'];

export function splitOrderItemsByStation(items = []) {
  const baristaItems = [];
  const kitchenItems = [];

  for (const item of items) {
    const cat = String(item.category || '').toLowerCase().trim();
    if (BARISTA_CATEGORIES.some(c => cat.includes(c))) {
      baristaItems.push(item);
    } else {
      kitchenItems.push(item);
    }
  }

  return { baristaItems, kitchenItems };
}

/**
 * Dispatch an order to all active printers configured for the cafe.
 */
export async function dispatchOrderToPrinters({ cafeId, order, printReceipt = false, openDrawer = false }) {
  const cafe = await Cafe.findByPk(cafeId);
  let printers = await PrinterConfig.findAll({ where: { cafeId, active: true } });

  // Default seed if no printers configured yet
  if (printers.length === 0) {
    printers = [
      {
        id: 'virt-counter',
        name: 'Counter Receipt 80mm',
        role: 'receipt',
        connectionType: 'network',
        ipAddress: '127.0.0.1',
        port: 9100,
        paperWidth: 80,
        autoPrintOnOrder: true,
        autoDrawerKick: true,
      },
      {
        id: 'virt-barista',
        name: 'Barista Station KOT',
        role: 'barista_kot',
        connectionType: 'network',
        ipAddress: '127.0.0.1',
        port: 9100,
        paperWidth: 80,
        autoPrintOnOrder: true,
        autoDrawerKick: false,
      },
      {
        id: 'virt-kitchen',
        name: 'Kitchen Hot Line KOT',
        role: 'kitchen_kot',
        connectionType: 'network',
        ipAddress: '127.0.0.1',
        port: 9100,
        paperWidth: 80,
        autoPrintOnOrder: true,
        autoDrawerKick: false,
      },
    ];
  }

  const results = [];
  const { baristaItems, kitchenItems } = splitOrderItemsByStation(order.items || []);

  for (const printer of printers) {
    let buffer = null;
    let jobType = 'UNKNOWN';

    if (printer.role === 'receipt' && printReceipt) {
      jobType = 'RECEIPT';
      buffer = generateEscPosReceipt(order, cafe || {}, {
        paperWidth: printer.paperWidth || 80,
        openDrawer: openDrawer || Boolean(printer.autoDrawerKick),
      });
    } else if (printer.role === 'barista_kot' && baristaItems.length > 0) {
      jobType = 'KOT_BARISTA';
      buffer = generateEscPosKOT(order, {
        station: 'BARISTA',
        items: baristaItems,
        paperWidth: printer.paperWidth || 80,
      });
    } else if (printer.role === 'kitchen_kot' && kitchenItems.length > 0) {
      jobType = 'KOT_KITCHEN';
      buffer = generateEscPosKOT(order, {
        station: 'KITCHEN',
        items: kitchenItems,
        paperWidth: printer.paperWidth || 80,
      });
    } else if (printer.role === 'all_kot' && (order.items || []).length > 0) {
      jobType = 'KOT_MASTER';
      buffer = generateEscPosKOT(order, {
        station: 'ALL STATIONS',
        items: order.items || [],
        paperWidth: printer.paperWidth || 80,
      });
    }

    if (buffer) {
      const sendResult = await sendRawToNetworkPrinter({
        ipAddress: printer.ipAddress,
        port: printer.port || 9100,
        buffer,
      });

      results.push({
        printerId: printer.id,
        printerName: printer.name,
        jobType,
        ...sendResult,
      });

      // Audit Log
      await HardwareLog.create({
        cafeId,
        deviceType: 'printer',
        deviceName: printer.name,
        action: `PRINT_${jobType}`,
        status: sendResult.success ? (sendResult.simulated ? 'simulated' : 'success') : 'failed',
        payload: { orderNo: order.orderNo, itemCount: order.items?.length, station: printer.role },
        response: sendResult,
        message: sendResult.message || sendResult.error,
      }).catch(() => {});
    }
  }

  return results;
}

// ==========================================
// 4. EDC CARD TERMINAL ENGINE (PINE LABS / RAZORPAY / MOSAMBEE)
// ==========================================
export async function pushEDCChargeIntent({ cafeId, terminalId, orderId, amount, cashierName = 'Cashier' }) {
  const terminal = await EDCTerminal.findOne({ where: { id: terminalId, cafeId } });
  if (!terminal) {
    throw new Error('Designated EDC terminal not found or offline.');
  }

  const transactionRef = `EDC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 899 + 100)}`;
  const payload = {
    terminalId: terminal.terminalId || 'PL-DEMO-001',
    provider: terminal.provider,
    orderId,
    amount: Number(amount).toFixed(2),
    transactionRef,
    currency: 'INR',
    cashier: cashierName,
    status: 'PENDING_CUSTOMER_ACTION',
  };

  // Record audit log
  await HardwareLog.create({
    cafeId,
    deviceType: 'edc',
    deviceName: terminal.name,
    action: 'EDC_PUSH_CHARGE',
    status: 'simulated',
    payload,
    message: `Pushed ₹${amount} charge intent to ${terminal.name} (${terminal.provider}).`,
  }).catch(() => {});

  // Broadcast live SSE to cashier screen
  broadcastEvent(cafeId, 'edc_terminal_event', {
    type: 'charge_pushed',
    terminalId: terminal.id,
    terminalName: terminal.name,
    orderId,
    amount,
    transactionRef,
  });

  return {
    success: true,
    transactionRef,
    terminalName: terminal.name,
    provider: terminal.provider,
    amount,
    status: 'PENDING',
    pollUrl: `/api/hardware/edc/status/${transactionRef}`,
  };
}

export async function processEDCCallback({ cafeId, provider, transactionRef, orderId, status = 'APPROVED', cardNetwork = 'VISA', last4 = '4242' }) {
  const isApproved = String(status).toUpperCase() === 'APPROVED' || String(status).toUpperCase() === 'SUCCESS';

  if (!orderId && transactionRef) {
    // Attempt lookup from hardware log
    const lastLog = await HardwareLog.findOne({
      where: { action: 'EDC_PUSH_CHARGE' },
      order: [['createdAt', 'DESC']],
    });
    if (lastLog?.payload?.orderId) {
      orderId = lastLog.payload.orderId;
    }
  }

  let order = null;
  if (orderId) {
    order = await Order.findByPk(orderId);
  }

  if (order && isApproved) {
    const txnId = `${provider.toUpperCase()}-${transactionRef}-${cardNetwork}-${last4}`;
    await order.update({
      paymentStatus: 'paid',
      paymentMethod: 'card',
      paymentTransactionId: txnId,
    });

    // Broadcast SSE to POS
    broadcastEvent(cafeId || order.cafeId, 'order_updated', {
      id: order.id,
      orderNo: order.orderNo,
      paymentStatus: 'paid',
      paymentMethod: 'card',
      paymentTransactionId: txnId,
    });

    broadcastEvent(cafeId || order.cafeId, 'edc_terminal_event', {
      type: 'charge_approved',
      orderId: order.id,
      transactionRef,
      cardNetwork,
      last4,
    });
  }

  await HardwareLog.create({
    cafeId: cafeId || order?.cafeId || 'system',
    deviceType: 'edc',
    deviceName: `${provider.toUpperCase()} Terminal`,
    action: 'EDC_CALLBACK_SETTLE',
    status: isApproved ? 'success' : 'failed',
    payload: { provider, transactionRef, orderId, cardNetwork, last4 },
    message: isApproved ? `EDC card payment settled for ₹${order?.total || 0}` : 'Card declined by user/terminal.',
  }).catch(() => {});

  return {
    success: isApproved,
    orderId,
    status: isApproved ? 'SETTLED' : 'FAILED',
    transactionRef,
  };
}

// ==========================================
// 5. PAYTM / SOUNDBOX BROADCAST HANDLER
// ==========================================
export async function processSoundboxNotification({ cafeId, amount, orderNo, utrNo = '' }) {
  broadcastEvent(cafeId, 'soundbox_alert', {
    amount: Number(amount),
    orderNo,
    utrNo,
    timestamp: new Date().toISOString(),
    message: `Received ₹${amount} via UPI.`,
  });

  await HardwareLog.create({
    cafeId,
    deviceType: 'soundbox',
    deviceName: 'UPI Soundbox',
    action: 'AUDIO_CHIME_BROADCAST',
    status: 'success',
    payload: { amount, orderNo, utrNo },
    message: `Payment chime broadcasted for ₹${amount}.`,
  }).catch(() => {});

  return { success: true, broadcasted: true };
}

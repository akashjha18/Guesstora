/**
 * shifts.js - Day-End Z-Report, Cash Drawer Shifts & Discount Operations
 *
 * Provides shift lifecycle tracking, cash float reconciliation, End-of-Day (Z-Report)
 * aggregation, and discount calculation for cashier & manager controls.
 */

/**
 * Calculates comprehensive financial summary for a register shift.
 *
 * @param {Array} orders - Orders completed/placed during this shift
 * @param {number} openingFloat - Starting cash float in drawer
 * @param {number} [closingFloatCounted=0] - Actual physical cash counted at close
 * @returns {Object} Comprehensive shift financial summary
 */
export function calculateShiftSummary(arg1 = [], arg2 = 0, arg3 = 0) {
  let orders = [];
  let floatNum = 0;
  let countedNum = 0;

  if (Array.isArray(arg1)) {
    orders = arg1;
    floatNum = Number(arg2) || 0;
    countedNum = Number(arg3) || 0;
  } else if (arg1 && typeof arg1 === 'object') {
    floatNum = Number(arg1.openingFloat) || 0;
    orders = Array.isArray(arg2) ? arg2 : [];
    countedNum = arg3 !== undefined ? (Number(arg3) || 0) : (arg1.closingFloatCounted !== null ? (Number(arg1.closingFloatCounted) || 0) : 0);
  }

  const safeOrders = Array.isArray(orders) ? orders : [];
  let totalSales = 0;
  let grossSubtotal = 0;
  let totalDiscounts = 0;
  let paidOrdersCount = 0;
  let pendingOrdersCount = 0;
  let cancelledOrdersCount = 0;
  let cancelledTotal = 0;

  const paymentBreakdown = {
    cash: 0,
    upi: 0,
    razorpay: 0,
    stripe: 0,
    demo_online: 0,
    other: 0,
  };

  const categorySales = {};

  for (const o of safeOrders) {
    const isCancelled = o.status === 'cancelled';
    const isPaid = o.paymentStatus === 'paid';
    const ordTotal = Number(o.total) || 0;
    const ordSubtotal = Number(o.subtotal) || ordTotal;
    const ordDiscount = Number(o.discount) || 0;

    if (isCancelled) {
      cancelledOrdersCount += 1;
      cancelledTotal += ordTotal;
      continue;
    }

    grossSubtotal += ordSubtotal;
    totalDiscounts += ordDiscount;

    if (isPaid) {
      paidOrdersCount += 1;
      totalSales += ordTotal;

      const method = String(o.paymentMethod || 'cash').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(paymentBreakdown, method)) {
        paymentBreakdown[method] += ordTotal;
      } else {
        paymentBreakdown.other += ordTotal;
      }
    } else {
      pendingOrdersCount += 1;
    }

    // Category breakdown from items if available
    if (Array.isArray(o.items)) {
      for (const it of o.items) {
        const cat = it.category || 'Specialty Coffee';
        const lineTotal = (Number(it.price) || 0) * (Number(it.quantity) || 1);
        categorySales[cat] = (categorySales[cat] || 0) + lineTotal;
      }
    }
  }

  // In India & standard F&B, typical 5% composite GST (2.5% CGST + 2.5% SGST)
  const estimatedTax = Math.round((totalSales * (5 / 105)) * 100) / 100;
  const netSales = Math.max(0, totalSales - estimatedTax);

  const expectedCashInDrawer = floatNum + paymentBreakdown.cash;
  const cashVariance = countedNum - expectedCashInDrawer;

  return {
    totalOrders: safeOrders.length,
    paidOrdersCount,
    pendingOrdersCount,
    cancelledOrdersCount,
    cancelledTotal,
    grossSubtotal,
    totalDiscounts,
    totalSales,
    netSales,
    estimatedTax,
    taxSummary: {
      gstComposite: estimatedTax,
      cgst: Math.round((estimatedTax / 2) * 100) / 100,
      sgst: Math.round((estimatedTax / 2) * 100) / 100,
    },
    openingFloat: floatNum,
    closingFloatCounted: countedNum,
    expectedCashInDrawer,
    closingFloatExpected: expectedCashInDrawer,
    cashVariance,
    varianceStatus: cashVariance === 0 ? 'balanced' : cashVariance > 0 ? 'over' : 'short',
    paymentBreakdown,
    categorySales,
    categoryBreakdown: categorySales,
  };
}

/**
 * Validates and calculates discount on an order subtotal.
 *
 * @param {number} subtotal - Order subtotal before discount
 * @param {Object} promo - { discountType, discountValue, minOrderAmount, maxDiscountAmount }
 * @returns {Object} { valid, discountAmount, finalTotal, message }
 */
export function calculateDiscount(subtotal = 0, promo = {}) {
  const numSubtotal = Math.max(0, Number(subtotal) || 0);
  const type = String(promo.discountType || 'percent').toLowerCase();
  const value = Number(promo.discountValue) || 0;
  const minOrder = Number(promo.minOrderAmount) || 0;
  const maxCap = promo.maxDiscountAmount !== null && promo.maxDiscountAmount !== undefined 
    ? Number(promo.maxDiscountAmount) 
    : Infinity;

  if (numSubtotal < minOrder) {
    return {
      valid: false,
      discountAmount: 0,
      finalTotal: numSubtotal,
      message: `Minimum order amount of ₹${minOrder} required for this discount.`,
    };
  }

  let discountAmount = 0;
  if (type === 'percent') {
    discountAmount = (numSubtotal * value) / 100;
  } else {
    // flat
    discountAmount = value;
  }

  // Apply maximum cap if specified
  if (discountAmount > maxCap) {
    discountAmount = maxCap;
  }

  // Cannot exceed subtotal
  discountAmount = Math.min(discountAmount, numSubtotal);
  discountAmount = Math.round(discountAmount * 100) / 100;
  const finalTotal = Math.max(0, Math.round((numSubtotal - discountAmount) * 100) / 100);

  return {
    valid: true,
    discountAmount,
    finalTotal,
    message: `Applied ${type === 'percent' ? `${value}%` : `₹${value}`} discount.`,
  };
}

/**
 * Splits an order total equally among N guests.
 *
 * @param {number} total - Order total amount
 * @param {number} numSplits - Number of diner splits (e.g. 2 to 10)
 * @returns {Array} Array of split sub-bill objects
 */
export function calculateEqualBillSplit(total = 0, numSplits = 2) {
  const numTotal = Math.max(0, Number(total) || 0);
  const count = Math.max(2, Math.min(20, Math.floor(Number(numSplits) || 2)));
  const baseSplit = Math.floor((numTotal / count) * 100) / 100;
  const remainder = Math.round((numTotal - (baseSplit * count)) * 100) / 100;

  const splits = [];
  for (let i = 0; i < count; i++) {
    // Add remainder cents/paise to the first split
    const amount = i === 0 ? Math.round((baseSplit + remainder) * 100) / 100 : baseSplit;
    splits.push({
      splitId: `split_${i + 1}`,
      splitIndex: i + 1,
      guestLabel: `Guest ${i + 1}`,
      amount,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      transactionId: null,
      paidAt: null,
    });
  }

  return splits;
}

/**
 * Generates an 80mm monospace printable Z-Report string.
 *
 * @param {Object} shift - RegisterShift instance/object
 * @param {Object} cafe - Cafe instance/object
 * @returns {string} Formatted 80mm receipt text
 */
export function formatZReportText(shift = {}, arg2 = {}, arg3 = {}) {
  let summary = {};
  let cafe = {};
  if (arg2 && (arg2.totalSales !== undefined || arg2.paymentBreakdown !== undefined || arg2.grossSubtotal !== undefined)) {
    summary = arg2;
    cafe = typeof arg3 === 'string' ? { name: arg3 } : (arg3 || {});
  } else {
    summary = shift.summary || {};
    cafe = typeof arg2 === 'string' ? { name: arg2 } : (arg2 || {});
  }
  const cafeName = (cafe.name || 'GUESTORA ARTISAN ROASTERY').toUpperCase();
  const shiftId = String(shift.id || '').slice(-6).toUpperCase();
  const staffName = shift.staffName || shift.user?.name || shift.User?.name || 'Cashier';
  const openTime = shift.openedAt ? new Date(shift.openedAt).toLocaleString('en-IN') : '-';
  const closeTime = shift.closedAt ? new Date(shift.closedAt).toLocaleString('en-IN') : 'OPEN';

  const sep = '='.repeat(38);
  const thin = '-'.repeat(38);

  const pb = summary.paymentBreakdown || {};

  return [
    sep,
    centerText(cafeName, 38),
    centerText('DAY-END AUDIT // Z-REPORT', 38),
    sep,
    `SHIFT ID    : SHIFT-${shiftId}`,
    `CASHIER     : ${staffName}`,
    `OPENED      : ${openTime}`,
    `CLOSED      : ${closeTime}`,
    thin,
    centerText('FINANCIAL SUMMARY', 38),
    thin,
    padRow('Total Completed Orders', String(summary.paidOrdersCount || 0)),
    padRow('Gross Subtotal', `INR ${(summary.grossSubtotal || 0).toFixed(2)}`),
    padRow('Total Discounts Applied', `INR ${(summary.totalDiscounts || 0).toFixed(2)}`),
    padRow('Est. GST / Taxes (5%)', `INR ${(summary.estimatedTax || 0).toFixed(2)}`),
    sep,
    padRow('NET REALIZED REVENUE', `INR ${(summary.totalSales || 0).toFixed(2)}`),
    sep,
    centerText('SALES BY PAYMENT MODE', 38),
    thin,
    padRow('Cash at Counter', `INR ${(pb.cash || 0).toFixed(2)}`),
    padRow('Dynamic UPI QR', `INR ${(pb.upi || 0).toFixed(2)}`),
    padRow('Razorpay Gateway', `INR ${(pb.razorpay || 0).toFixed(2)}`),
    padRow('Stripe International', `INR ${(pb.stripe || 0).toFixed(2)}`),
    padRow('Online Demo', `INR ${(pb.demo_online || 0).toFixed(2)}`),
    thin,
    centerText('CASH DRAWER RECONCILIATION', 38),
    thin,
    padRow('Opening Cash Float', `INR ${(summary.openingFloat || 0).toFixed(2)}`),
    padRow('Cash Collected in Shift', `INR ${(pb.cash || 0).toFixed(2)}`),
    padRow('Expected Cash in Drawer', `INR ${(summary.expectedCashInDrawer || 0).toFixed(2)}`),
    padRow('Counted Physical Cash', `INR ${(summary.closingFloatCounted || 0).toFixed(2)}`),
    thin,
    padRow(
      `CASH VARIANCE (${(summary.varianceStatus || 'BALANCED').toUpperCase()})`,
      `INR ${(summary.cashVariance || 0).toFixed(2)}`
    ),
    sep,
    '',
    'Cashier Signature: _________________',
    '',
    'Manager Verified:  _________________',
    '',
    centerText('GUESTORA Operating System', 38),
    sep,
  ].join('\n');
}

function padRow(left, right, width = 38) {
  const padLen = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(padLen) + right;
}

function centerText(text, width = 38) {
  if (text.length >= width) return text.slice(0, width);
  const leftPad = Math.floor((width - text.length) / 2);
  return ' '.repeat(leftPad) + text;
}

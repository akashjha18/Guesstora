import { Op } from 'sequelize';
import { Cafe, Customer, Order, OrderItem, Reward } from './models.js';

export function getDateRange(rangeStr = '30d', now = new Date()) {
  const currentEnd = new Date(now);
  let days = 30;

  if (rangeStr === '7d') days = 7;
  else if (rangeStr === '90d') days = 90;
  else if (rangeStr === 'year' || rangeStr === '365d') days = 365;

  const currentStart = new Date(currentEnd.getTime() - days * 24 * 60 * 60 * 1000);
  const prevEnd = new Date(currentStart);
  const prevStart = new Date(prevEnd.getTime() - days * 24 * 60 * 60 * 1000);

  return { days, currentStart, currentEnd, prevStart, prevEnd };
}

export function computePercentageChange(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) {
    return c > 0 ? 100 : 0;
  }
  const change = ((c - p) / p) * 100;
  return Math.round(change * 10) / 10;
}

export function escapeCSVField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function getCafeAnalytics({
  cafeId,
  range = '30d',
  CafeModel = Cafe,
  OrderModel = Order,
  CustomerModel = Customer,
  RewardModel = Reward,
  now = new Date(),
} = {}) {
  let cafe = await CafeModel.findByPk(cafeId);
  if (!cafe && CafeModel.findOne) {
    cafe = await CafeModel.findOne({ where: { slug: cafeId } });
  }
  if (!cafe) throw new Error('Cafe not found');
  const targetCafeId = cafe.id;

  const { days, currentStart, currentEnd, prevStart, prevEnd } = getDateRange(range, now);

  // 1. Fetch current period paid/completed orders
  const currentOrders = await OrderModel.findAll({
    where: {
      cafeId: targetCafeId,
      createdAt: { [Op.gte]: currentStart, [Op.lte]: currentEnd },
    },
    include: [{ model: OrderItem, as: 'items', required: false }],
    order: [['createdAt', 'ASC']],
  });

  // 2. Fetch previous period orders for comparison
  const prevOrders = await OrderModel.findAll({
    where: {
      cafeId: targetCafeId,
      createdAt: { [Op.gte]: prevStart, [Op.lt]: currentStart },
    },
    attributes: ['id', 'total', 'subtotal', 'paymentStatus', 'status', 'customerId', 'phone'],
  });

  // 3. Fetch all customers for retention and lifetime metrics
  const customers = await CustomerModel.findAll({
    where: { cafeId: targetCafeId },
    include: [
      { model: OrderModel, as: 'orders', where: { paymentStatus: 'paid' }, required: false },
      { model: RewardModel, as: 'rewards', required: false },
    ],
  });

  // 4. Fetch cafe rewards
  const rewards = await RewardModel.findAll({
    where: { cafeId: targetCafeId },
  });

  // Current period computations
  const paidOrders = currentOrders.filter(o => o.paymentStatus === 'paid' || o.status === 'completed');
  const currentRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const currentOrdersCount = paidOrders.length;
  const currentAov = currentOrdersCount ? Math.round(currentRevenue / currentOrdersCount) : 0;

  // Previous period computations
  const prevPaidOrders = prevOrders.filter(o => o.paymentStatus === 'paid' || o.status === 'completed');
  const prevRevenue = prevPaidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const prevOrdersCount = prevPaidOrders.length;
  const prevAov = prevOrdersCount ? Math.round(prevRevenue / prevOrdersCount) : 0;

  // Unique customers in current period
  const currentDinerPhones = new Set();
  paidOrders.forEach(o => {
    if (o.phone) currentDinerPhones.add(o.phone);
  });
  const currentUniqueCustomers = currentDinerPhones.size;

  const prevDinerPhones = new Set();
  prevPaidOrders.forEach(o => {
    if (o.phone) prevDinerPhones.add(o.phone);
  });
  const prevUniqueCustomers = prevDinerPhones.size;

  // Repeat customers in this period (customers with >1 order in period or total >1 visits)
  let repeatCustomersCount = 0;
  paidOrders.forEach(o => {
    const cust = customers.find(c => c.phone === o.phone);
    if (cust && (cust.visits > 1 || (cust.orders && cust.orders.length > 1))) {
      repeatCustomersCount++;
    }
  });
  const repeatRate = currentOrdersCount ? Math.round((repeatCustomersCount / currentOrdersCount) * 100) : 0;

  // 5. Daily Trend Time Series
  const trendsMap = new Map();
  // Pre-populate days
  for (let i = 0; i < days; i++) {
    const d = new Date(currentStart.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    trendsMap.set(dateStr, {
      date: dateStr,
      label,
      revenue: 0,
      orders: 0,
      aov: 0,
    });
  }

  paidOrders.forEach(o => {
    const dStr = new Date(o.createdAt).toISOString().split('T')[0];
    if (trendsMap.has(dStr)) {
      const entry = trendsMap.get(dStr);
      entry.revenue += Number(o.total) || 0;
      entry.orders += 1;
    }
  });

  const trends = Array.from(trendsMap.values()).map(t => ({
    ...t,
    revenue: Math.round(t.revenue),
    aov: t.orders ? Math.round(t.revenue / t.orders) : 0,
  }));

  // 6. Peak Ordering Hours & Busiest Days
  const hoursMap = Array.from({ length: 24 }, (_, h) => {
    const hour12 = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
    return { hour: h, label: hour12, orders: 0, revenue: 0 };
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daysOfWeekMap = dayNames.map((name, idx) => ({ dayIndex: idx, name, orders: 0, revenue: 0 }));

  paidOrders.forEach(o => {
    const d = new Date(o.createdAt);
    const h = d.getHours();
    const dow = d.getDay();

    if (hoursMap[h]) {
      hoursMap[h].orders += 1;
      hoursMap[h].revenue += Number(o.total) || 0;
    }

    if (daysOfWeekMap[dow]) {
      daysOfWeekMap[dow].orders += 1;
      daysOfWeekMap[dow].revenue += Number(o.total) || 0;
    }
  });

  const maxHourlyOrders = Math.max(...hoursMap.map(h => h.orders), 1);
  const peakHours = hoursMap.map(h => ({
    ...h,
    revenue: Math.round(h.revenue),
    isPeak: h.orders > 0 && h.orders >= maxHourlyOrders * 0.8,
  }));

  const busiestDays = daysOfWeekMap.map(d => ({
    ...d,
    revenue: Math.round(d.revenue),
  }));

  // 7. Retention & Customer Visit Frequency
  let oneVisit = 0;
  let twoToThree = 0;
  let fourToSix = 0;
  let sevenPlus = 0;

  let activeRecency = 0; // 0-7 days
  let recentRecency = 0; // 8-14 days
  let atRiskRecency = 0; // 15-30 days
  let lapsedRecency = 0; // 30+ days

  customers.forEach(c => {
    const v = c.visits || 0;
    if (v <= 1) oneVisit++;
    else if (v <= 3) twoToThree++;
    else if (v <= 6) fourToSix++;
    else sevenPlus++;

    // Calculate days since last order
    let lastOrderDate = c.createdAt;
    if (c.orders && c.orders.length > 0) {
      const dates = c.orders.map(o => new Date(o.createdAt).getTime());
      lastOrderDate = new Date(Math.max(...dates));
    }
    const daysInactive = Math.floor((now.getTime() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysInactive <= 7) activeRecency++;
    else if (daysInactive <= 14) recentRecency++;
    else if (daysInactive <= 30) atRiskRecency++;
    else lapsedRecency++;
  });

  const retention = {
    totalCustomers: customers.length,
    newDiners: oneVisit,
    repeatDiners: twoToThree + fourToSix + sevenPlus,
    repeatRate: customers.length ? Math.round(((twoToThree + fourToSix + sevenPlus) / customers.length) * 100) : 0,
    frequencyBuckets: [
      { label: '1 Visit (First-Timer)', count: oneVisit, percentage: customers.length ? Math.round((oneVisit / customers.length) * 100) : 0 },
      { label: '2-3 Visits (Returning)', count: twoToThree, percentage: customers.length ? Math.round((twoToThree / customers.length) * 100) : 0 },
      { label: '4-6 Visits (Regulars)', count: fourToSix, percentage: customers.length ? Math.round((fourToSix / customers.length) * 100) : 0 },
      { label: '7+ Visits (Loyal VIPs)', count: sevenPlus, percentage: customers.length ? Math.round((sevenPlus / customers.length) * 100) : 0 },
    ],
    recencyBuckets: [
      { label: 'Active (0-7d)', count: activeRecency, color: '#10b981' },
      { label: 'Recent (8-14d)', count: recentRecency, color: '#3b82f6' },
      { label: 'At Risk (15-30d)', count: atRiskRecency, color: '#f59e0b' },
      { label: 'Lapsed (30+d)', count: lapsedRecency, color: '#ef4444' },
    ],
  };

  // 8. Loyalty Program ROI
  const totalIssuedRewards = rewards.length;
  const totalRedeemedRewards = rewards.filter(r => r.status === 'redeemed').length;
  const activeUnclaimedRewards = rewards.filter(r => r.status === 'available' || r.status === 'claimed').length;
  const redemptionRate = totalIssuedRewards ? Math.round((totalRedeemedRewards / totalIssuedRewards) * 100) : 0;
  const totalDiscountsGiven = paidOrders.reduce((sum, o) => sum + (Number(o.discount) || 0), 0);

  // Revenue from loyalty visits (orders where loyalty was processed or customer has >1 visit)
  const loyaltyDrivenRevenue = paidOrders
    .filter(o => o.loyaltyProcessed || (customers.find(c => c.phone === o.phone)?.visits > 1))
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const loyaltyRoi = {
    totalIssuedRewards,
    totalRedeemedRewards,
    activeUnclaimedRewards,
    redemptionRate,
    totalDiscountsGiven: Math.round(totalDiscountsGiven),
    loyaltyDrivenRevenue: Math.round(loyaltyDrivenRevenue),
    loyaltyRevenueShare: currentRevenue ? Math.round((loyaltyDrivenRevenue / currentRevenue) * 100) : 0,
  };

  // 9. Top Selling Items & Category Breakdown
  const itemsMap = new Map();
  const categoryMap = new Map();

  currentOrders.forEach(o => {
    (o.items || []).forEach(item => {
      const name = item.name || 'Unnamed Dish';
      const qty = Number(item.quantity) || 1;
      const price = Number(item.price) || 0;
      const itemRev = qty * price;

      if (!itemsMap.has(name)) {
        itemsMap.set(name, {
          name,
          quantity: 0,
          revenue: 0,
          menuItemId: item.menuItemId,
        });
      }
      const it = itemsMap.get(name);
      it.quantity += qty;
      it.revenue += itemRev;
    });
  });

  const topItems = Array.from(itemsMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8)
    .map(i => ({ ...i, revenue: Math.round(i.revenue) }));

  // Category breakdown
  topItems.forEach(i => {
    // If category can be derived from cafe menu items
    const menuItem = (cafe.menu || []).find(m => m.id === i.menuItemId || m.name === i.name);
    const category = menuItem?.category || 'Specialties';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { category, quantity: 0, revenue: 0 });
    }
    const cat = categoryMap.get(category);
    cat.quantity += i.quantity;
    cat.revenue += i.revenue;
  });

  const categoryBreakdown = Array.from(categoryMap.values()).map(c => ({
    ...c,
    share: currentRevenue ? Math.round((c.revenue / currentRevenue) * 100) : 0,
  }));

  return {
    cafe: {
      id: cafe.id,
      name: cafe.name,
      slug: cafe.slug,
      currency: cafe.currency || 'INR',
    },
    range,
    period: {
      currentStart: currentStart.toISOString(),
      currentEnd: currentEnd.toISOString(),
      days,
    },
    kpi: {
      revenue: Math.round(currentRevenue),
      revenueDelta: computePercentageChange(currentRevenue, prevRevenue),
      orders: currentOrdersCount,
      ordersDelta: computePercentageChange(currentOrdersCount, prevOrdersCount),
      aov: currentAov,
      aovDelta: computePercentageChange(currentAov, prevAov),
      customers: currentUniqueCustomers,
      customersDelta: computePercentageChange(currentUniqueCustomers, prevUniqueCustomers),
      repeatRate,
    },
    trends,
    peakHours,
    busiestDays,
    retention,
    loyaltyRoi,
    topItems,
    categoryBreakdown,
  };
}

export function formatOrdersCSV(orders) {
  const headers = [
    'Order ID',
    'Order No',
    'Date',
    'Time',
    'Customer Name',
    'Phone',
    'Table',
    'Items Summary',
    'Item Count',
    'Subtotal (INR)',
    'Discount (INR)',
    'Total (INR)',
    'Payment Method',
    'Payment Status',
    'Order Status',
  ];

  const rows = orders.map(o => {
    const d = new Date(o.createdAt);
    const dateStr = d.toISOString().split('T')[0];
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const itemsList = (o.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ');
    const itemCount = (o.items || []).reduce((acc, i) => acc + (i.quantity || 1), 0);

    return [
      escapeCSVField(o.id),
      escapeCSVField(o.orderNo || 'N/A'),
      escapeCSVField(dateStr),
      escapeCSVField(timeStr),
      escapeCSVField(o.customerName || 'Guest'),
      escapeCSVField(o.phone || ''),
      escapeCSVField(o.table || 'N/A'),
      escapeCSVField(itemsList),
      itemCount,
      o.subtotal || 0,
      o.discount || 0,
      o.total || 0,
      escapeCSVField(o.paymentMethod || 'cash'),
      escapeCSVField(o.paymentStatus || 'pending'),
      escapeCSVField(o.status || 'placed'),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function formatCustomersCSV(customers, loyaltyVisitsRequired = 8) {
  const headers = [
    'Customer ID',
    'Customer Name',
    'Phone',
    'Email',
    'Total Visits / Stamps',
    'Stamps Toward Reward',
    'Total Spend (INR)',
    'Orders Count',
    'Average Order Value (INR)',
    'Active Rewards Count',
    'First Joined Date',
    'Notes',
  ];

  const rows = customers.map(c => {
    const cOrders = c.orders || [];
    const paidOrders = cOrders.filter(o => o.paymentStatus === 'paid');
    const totalSpend = paidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const aov = paidOrders.length ? Math.round(totalSpend / paidOrders.length) : 0;
    const currentStamps = (c.visits || 0) % loyaltyVisitsRequired;
    const activeRewards = (c.rewards || []).filter(r => r.status === 'available' || r.status === 'claimed');

    return [
      escapeCSVField(c.id),
      escapeCSVField(c.name || 'Anonymous'),
      escapeCSVField(c.phone || ''),
      escapeCSVField(c.email || ''),
      c.visits || 0,
      `${currentStamps} / ${loyaltyVisitsRequired}`,
      totalSpend,
      cOrders.length,
      aov,
      activeRewards.length,
      escapeCSVField(new Date(c.createdAt).toISOString().split('T')[0]),
      escapeCSVField(c.notes || ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

import {
  Cafe,
  Order,
  OrderItem,
  Customer,
  MenuItem,
  DeliveryChannel,
  WhatsAppConfig,
  NotificationLog,
  Brand
} from './models.js';
import { eventBus } from './eventBus.js';
import { depleteInventoryForOrder } from './inventoryEngine.js';
import { serializeOrder } from './routes/serializers.js';

/**
 * Normalizes and ingests external third-party delivery orders
 * (Zomato, Swiggy, UrbanPiper) into Gusstora's live order queue.
 */
export async function ingestAggregatorOrder({ cafeId, channel, payload }) {
  if (!cafeId) throw new Error('cafeId is required for aggregator ingestion');
  if (!channel) throw new Error('channel is required (zomato, swiggy, urbanpiper)');

  // 1. Check Delivery Channel status for this café
  let channelConfig = await DeliveryChannel.findOne({ where: { cafeId, channel } });
  if (!channelConfig) {
    channelConfig = await DeliveryChannel.create({
      cafeId,
      channel,
      status: 'online',
      commissionRate: 18.0,
      autoAccept: true,
    });
  }

  if (channelConfig.status === 'offline') {
    throw new Error(`Delivery channel ${channel} is currently marked OFFLINE for this cafe.`);
  }

  // 2. Extract and normalize order details from vendor payload
  const externalOrderId = String(
    payload.order_id || payload.orderId || payload.id || `AGG-${Date.now().toString(36).toUpperCase()}`
  );
  const customerName = payload.customer?.name || payload.customer_name || payload.customerName || `${channel.toUpperCase()} Customer`;
  const rawPhone = payload.customer?.phone || payload.phone || '9999999999';
  const cleanPhone = String(rawPhone).replace(/\D/g, '').slice(-10) || '9999999999';

  const riderName = payload.delivery_person?.name || payload.rider?.name || payload.riderName || 'Assigned Courier';
  const riderPhone = payload.delivery_person?.phone || payload.rider?.phone || payload.riderPhone || '';

  // 3. Find or register customer
  let customer = await Customer.findOne({ where: { cafeId, phone: cleanPhone } });
  if (!customer) {
    customer = await Customer.create({
      cafeId,
      name: customerName,
      phone: cleanPhone,
      visits: 1,
    });
  } else {
    await customer.increment('visits', { by: 1 });
  }

  // 4. Normalize Line Items & match with MenuItems
  const rawItems = payload.items || payload.order_items || [];
  if (!rawItems.length) {
    throw new Error('Aggregator payload must contain at least one order item.');
  }

  // Fetch all menu items for the cafe to match recipes
  const cafeMenuItems = await MenuItem.findAll({ where: { cafeId } });
  const menuMap = new Map();
  cafeMenuItems.forEach(m => menuMap.set(m.name.toLowerCase().trim(), m));

  let subtotal = 0;
  const processedItems = rawItems.map(item => {
    const itemName = item.name || item.item_name || 'Menu Item';
    const quantity = Math.max(1, parseInt(item.quantity || 1, 10));
    const price = parseFloat(item.price || item.unit_price || 0);
    const matchedMenu = menuMap.get(itemName.toLowerCase().trim());

    subtotal += price * quantity;

    return {
      menuItemId: matchedMenu?.id || null,
      name: itemName,
      price,
      quantity,
      selectedVariant: item.variant || null,
      selectedModifiers: item.modifiers || item.addons || [],
      notes: item.notes || item.special_instructions || null,
    };
  });

  const discount = Math.max(0, parseFloat(payload.discount || payload.discount_amount || 0));
  const total = Math.max(0, subtotal - discount);

  // 5. Calculate channel commission
  const commissionRate = channelConfig.commissionRate || 18.0;
  const channelCommission = Number(((total * commissionRate) / 100).toFixed(2));

  // 6. Generate distinctive order number
  const prefix = channel.toUpperCase().slice(0, 3);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNo = `${prefix}-${randomSuffix}`;

  // 7. Create Order in DB
  const initialStatus = channelConfig.autoAccept ? 'accepted' : 'placed';
  const newOrder = await Order.create({
    cafeId,
    orderNo,
    customerId: customer.id,
    customerName,
    phone: cleanPhone,
    table: `${channel.toUpperCase()} Delivery`,
    subtotal,
    discount,
    total,
    paymentMethod: channel,
    paymentStatus: 'paid', // Aggregator orders are pre-paid through Zomato/Swiggy
    status: initialStatus,
    channel,
    externalOrderId,
    riderName,
    riderPhone,
    channelCommission,
  });

  // 8. Create Order Items
  const createdItems = [];
  for (const item of processedItems) {
    const createdItem = await OrderItem.create({
      orderId: newOrder.id,
      ...item,
    });
    createdItems.push(createdItem);
  }

  // 9. Deplete ingredients via inventory engine
  try {
    await depleteInventoryForOrder({
      cafeId,
      orderId: newOrder.id,
      orderItems: createdItems,
      recordedBy: `${channel.toUpperCase()} Aggregator Bot`,
    });
  } catch (invErr) {
    console.warn(`[Aggregator] Inventory depletion warning for order ${orderNo}:`, invErr.message);
  }

  // 10. Broadcast via SSE to live POS and KDS screens
  const fullOrder = await Order.findByPk(newOrder.id, {
    include: [{ model: OrderItem, as: 'items' }],
  });
  const serialized = serializeOrder(fullOrder);

  eventBus.broadcast(cafeId, 'order:new', { order: serialized });
  eventBus.broadcast(cafeId, 'order:update', { order: serialized });

  // 11. Trigger automated WhatsApp notification if active
  try {
    await dispatchWhatsAppCloudMessage({
      cafeId,
      toPhone: cleanPhone,
      templateType: 'order_confirmed',
      templateParams: {
        orderNo,
        customerName,
        itemCount: createdItems.length,
        total,
      },
    });
  } catch (waErr) {
    // Non-blocking notification dispatch
    console.warn('[Aggregator] WhatsApp dispatch skipped:', waErr.message);
  }

  return {
    success: true,
    order: serialized,
    channel,
    channelCommission,
    netPayout: Number((total - channelCommission).toFixed(2)),
    rider: {
      name: riderName,
      phone: riderPhone,
    },
  };
}

/**
 * Dispatches an automated or customized WhatsApp message via Meta Cloud API
 * or deterministic simulator.
 */
export async function dispatchWhatsAppCloudMessage({
  cafeId,
  toPhone,
  templateType = 'custom',
  templateParams = {},
  customText = '',
}) {
  if (!cafeId) throw new Error('cafeId is required for WhatsApp dispatch');
  if (!toPhone) throw new Error('Recipient phone number is required');

  const cleanPhone = String(toPhone).replace(/\D/g, '');
  const recipient = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  // 1. Fetch WhatsApp Cloud configuration for cafe
  let config = await WhatsAppConfig.findOne({ where: { cafeId } });
  if (!config) {
    config = await WhatsAppConfig.create({
      cafeId,
      status: 'mock',
      autoOrderConfirmation: true,
      autoOrderReady: true,
      autoLoyaltyAlerts: true,
      webhookVerifyToken: `gusstora_${Date.now()}`,
    });
  }

  // Check event preference
  if (templateType === 'order_confirmed' && !config.autoOrderConfirmation) {
    return { success: false, reason: 'order_confirmed trigger disabled by cafe config' };
  }
  if (templateType === 'order_ready' && !config.autoOrderReady) {
    return { success: false, reason: 'order_ready trigger disabled by cafe config' };
  }
  if (templateType === 'loyalty_reward' && !config.autoLoyaltyAlerts) {
    return { success: false, reason: 'loyalty_reward trigger disabled by cafe config' };
  }

  // 2. Format message text
  let messageText = '';
  if (templateType === 'order_confirmed') {
    const { orderNo = 'Order', itemCount = 1, total = 0 } = templateParams;
    messageText = `☕ *Gusstora Order Confirmed!*\n\nHi ${templateParams.customerName || 'there'}, your order *#${orderNo}* (${itemCount} items) has been received and sent to the kitchen.\n\n*Total Amount:* ₹${total}\nWe'll notify you as soon as it's freshly brewed!`;
  } else if (templateType === 'order_ready') {
    const { orderNo = 'Order' } = templateParams;
    messageText = `🎉 *Your Order is Ready!*\n\nOrder *#${orderNo}* is freshly brewed and ready at the counter for pickup.\nPlease present your order number to the barista. Enjoy!`;
  } else if (templateType === 'loyalty_reward') {
    const { claimCode = '', amount = 100 } = templateParams;
    messageText = `🎁 *You've Unlocked a Gusstora Reward!*\n\nCongratulations! Show this claim code to your cashier on your next visit:\n\n*CODE: ${claimCode}* (₹${amount} OFF)\n\nValid for 60 days. See you soon!`;
  } else {
    messageText = customText || 'Hello from Gusstora Roastery!';
  }

  // 3. Dispatch to Meta Cloud API or run simulator
  let messageId = `wamid.MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  let status = 'sent';

  if (config.status === 'active' && config.accessToken && config.phoneNumberId) {
    try {
      const metaUrl = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;
      const response = await fetch(metaUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: messageText },
        }),
      });

      const resData = await response.json();
      if (response.ok && resData.messages?.[0]?.id) {
        messageId = resData.messages[0].id;
        status = 'delivered';
      } else {
        console.warn('[WhatsApp Cloud API] Meta API rejected message:', resData);
        status = 'failed';
      }
    } catch (apiErr) {
      console.error('[WhatsApp Cloud API] Meta API connection error:', apiErr.message);
      status = 'failed';
    }
  }

  // 4. Log in NotificationLog table for complete audit trail
  await NotificationLog.create({
    cafeId,
    customerPhone: cleanPhone.slice(-10),
    customerName: templateParams.customerName || 'Customer',
    triggerType: templateType,
    channel: 'whatsapp_cloud',
    status,
    messageContent: messageText,
    metadata: JSON.stringify({
      messageId,
      mode: config.status,
      recipient,
      templateType,
    }),
  });

  return {
    success: status !== 'failed',
    messageId,
    mode: config.status,
    status,
    recipient,
    messageText,
  };
}

/**
 * Computes aggregated brand analytics across all child outlets.
 */
export async function getBrandOverview({ brandId, ownerId }) {
  let brand = null;
  if (brandId) {
    brand = await Brand.findByPk(brandId, {
      include: [{ model: Cafe, as: 'outlets' }],
    });
  } else if (ownerId) {
    brand = await Brand.findOne({
      where: { ownerId },
      include: [{ model: Cafe, as: 'outlets' }],
    });
  }

  if (!brand) {
    return {
      hasBrand: false,
      brand: null,
      outlets: [],
      metrics: {
        totalOutlets: 0,
        totalOrders: 0,
        totalGrossRevenue: 0,
        averageOrderValue: 0,
      },
    };
  }

  const outletIds = (brand.outlets || []).map(o => o.id);

  // Fetch all orders across outlets
  const allOrders = outletIds.length
    ? await Order.findAll({
        where: { cafeId: outletIds, status: ['completed', 'accepted', 'preparing', 'ready', 'placed'] },
        include: [{ model: OrderItem, as: 'items' }],
      })
    : [];

  const totalGrossRevenue = allOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const totalOrders = allOrders.length;
  const averageOrderValue = totalOrders > 0 ? Math.round(totalGrossRevenue / totalOrders) : 0;

  // Outlet-by-outlet breakdown
  const outletBreakdown = (brand.outlets || []).map(outlet => {
    const outletOrders = allOrders.filter(o => o.cafeId === outlet.id);
    const revenue = outletOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    return {
      id: outlet.id,
      name: outlet.name,
      slug: outlet.slug,
      tables: outlet.tables,
      ordersCount: outletOrders.length,
      revenue,
      aov: outletOrders.length > 0 ? Math.round(revenue / outletOrders.length) : 0,
    };
  });

  return {
    hasBrand: true,
    brand: {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      headquarters: brand.headquarters,
      logo: brand.logo,
    },
    outlets: outletBreakdown,
    metrics: {
      totalOutlets: outletIds.length,
      totalOrders,
      totalGrossRevenue: Number(totalGrossRevenue.toFixed(2)),
      averageOrderValue,
    },
  };
}

/**
 * Syncs menu catalogue from a source café to one or more target outlets.
 */
export async function syncBrandMenuToOutlets({ sourceCafeId, targetCafeIds = [] }) {
  if (!sourceCafeId) throw new Error('sourceCafeId is required');
  if (!targetCafeIds.length) throw new Error('At least one target outlet is required');

  const sourceItems = await MenuItem.findAll({ where: { cafeId: sourceCafeId } });
  if (!sourceItems.length) {
    throw new Error('Source café has no menu items to replicate.');
  }

  let totalReplicated = 0;
  const results = [];

  for (const targetId of targetCafeIds) {
    let outletAdded = 0;
    let outletUpdated = 0;

    for (const item of sourceItems) {
      const [existing, created] = await MenuItem.findOrCreate({
        where: { cafeId: targetId, name: item.name },
        defaults: {
          description: item.description,
          category: item.category,
          price: item.price,
          image: item.image,
          veg: item.veg,
          available: item.available,
          variants: item.variants || [],
          modifierGroups: item.modifierGroups || [],
        },
      });

      if (created) {
        outletAdded++;
      } else {
        // Update price and metadata to match master catalogue
        await existing.update({
          description: item.description,
          category: item.category,
          price: item.price,
          veg: item.veg,
          variants: item.variants || [],
          modifierGroups: item.modifierGroups || [],
        });
        outletUpdated++;
      }
      totalReplicated++;
    }

    results.push({
      targetCafeId: targetId,
      added: outletAdded,
      updated: outletUpdated,
    });
  }

  return {
    success: true,
    sourceItemCount: sourceItems.length,
    totalOperations: totalReplicated,
    details: results,
  };
}

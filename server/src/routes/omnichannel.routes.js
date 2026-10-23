import express from 'express';
import {
  Cafe,
  Order,
  OrderItem,
  Brand,
  DeliveryChannel,
  WhatsAppConfig,
  NotificationLog,
  User
} from '../models.js';
import {
  ingestAggregatorOrder,
  dispatchWhatsAppCloudMessage,
  getBrandOverview,
  syncBrandMenuToOutlets
} from '../omnichannelEngine.js';
import {
  serializeBrand,
  serializeDeliveryChannel,
  serializeWhatsAppConfig,
  serializeOrder
} from './serializers.js';
import { signToken } from '../auth.js';

export const omnichannelRouter = express.Router();

// Middleware helper to require owner or manager role
const requireOwnerOrManager = (req, res, next) => {
  if (!req.auth || !['owner', 'manager'].includes(req.auth.role)) {
    return res.status(403).json({ message: 'Forbidden: Requires owner or manager privileges' });
  }
  next();
};

/* ==========================================================================
   1. Third-Party Delivery Channels (Zomato / Swiggy / UrbanPiper)
   ========================================================================== */

/**
 * List all delivery channel configs and statistics for the active cafe
 */
omnichannelRouter.get('/owner/channels', requireOwnerOrManager, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const defaultChannels = ['zomato', 'swiggy', 'urbanpiper'];

    // Ensure all 3 channels exist for this cafe
    for (const ch of defaultChannels) {
      await DeliveryChannel.findOrCreate({
        where: { cafeId, channel: ch },
        defaults: {
          status: 'online',
          commissionRate: ch === 'urbanpiper' ? 12.0 : 18.0,
          autoAccept: true,
          storeId: `${ch.toUpperCase()}-${cafeId.slice(0, 6)}`,
        },
      });
    }

    const channels = await DeliveryChannel.findAll({ where: { cafeId } });

    // Aggregate delivery stats
    const deliveryOrders = await Order.findAll({
      where: {
        cafeId,
        channel: ['zomato', 'swiggy', 'urbanpiper'],
      },
    });

    const stats = {
      totalDeliveryOrders: deliveryOrders.length,
      totalGrossDeliveryRevenue: deliveryOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
      totalCommissionPaid: deliveryOrders.reduce((sum, o) => sum + (Number(o.channelCommission) || 0), 0),
      channelBreakdown: {
        zomato: deliveryOrders.filter(o => o.channel === 'zomato').length,
        swiggy: deliveryOrders.filter(o => o.channel === 'swiggy').length,
        urbanpiper: deliveryOrders.filter(o => o.channel === 'urbanpiper').length,
      },
    };

    res.json({
      channels: channels.map(serializeDeliveryChannel),
      stats,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch delivery channels' });
  }
});

/**
 * Update delivery channel configuration (online toggle, commission, auto-accept)
 */
omnichannelRouter.patch('/owner/channels/:channel', requireOwnerOrManager, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { channel } = req.params;
    const { status, commissionRate, autoAccept, storeId, apiKey } = req.body;

    const [channelDoc] = await DeliveryChannel.findOrCreate({
      where: { cafeId, channel },
      defaults: { status: 'online', commissionRate: 18.0, autoAccept: true },
    });

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (commissionRate !== undefined) updates.commissionRate = parseFloat(commissionRate) || 0;
    if (autoAccept !== undefined) updates.autoAccept = Boolean(autoAccept);
    if (storeId !== undefined) updates.storeId = storeId;
    if (apiKey !== undefined) updates.apiKey = apiKey;

    await channelDoc.update(updates);
    res.json({ channel: serializeDeliveryChannel(channelDoc) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update channel' });
  }
});

/**
 * Webhook ingestion endpoint for Zomato, Swiggy, and UrbanPiper
 */
omnichannelRouter.post('/webhooks/delivery/:channel', async (req, res) => {
  try {
    const { channel } = req.params;
    // Allow cafeId to be provided via header or body or query for testing
    let cafeId = req.headers['x-cafe-id'] || req.query.cafeId || req.body.cafeId;

    if (!cafeId) {
      // If storeId is provided in payload, look up cafe by storeId
      const storeId = req.body.store_id || req.body.storeId;
      if (storeId) {
        const found = await DeliveryChannel.findOne({ where: { storeId } });
        if (found) cafeId = found.cafeId;
      }
    }

    if (!cafeId) {
      // Fallback to first cafe in database if not provided
      const anyCafe = await Cafe.findOne();
      if (anyCafe) cafeId = anyCafe.id;
    }

    if (!cafeId) {
      return res.status(400).json({ message: 'No café identified for incoming delivery webhook' });
    }

    const result = await ingestAggregatorOrder({
      cafeId,
      channel,
      payload: req.body,
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to ingest aggregator order' });
  }
});

/**
 * Fetch recent aggregator delivery orders
 */
omnichannelRouter.get('/owner/channels/orders', requireOwnerOrManager, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const orders = await Order.findAll({
      where: {
        cafeId,
        channel: ['zomato', 'swiggy', 'urbanpiper'],
      },
      include: [{ model: OrderItem, as: 'items' }],
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    res.json({ orders: orders.map(serializeOrder) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch aggregator orders' });
  }
});

/* ==========================================================================
   2. WhatsApp Cloud API (Automated Notifications & Meta Webhooks)
   ========================================================================== */

/**
 * Get WhatsApp Cloud configuration & delivery logs
 */
omnichannelRouter.get('/owner/whatsapp/config', requireOwnerOrManager, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    let [config] = await WhatsAppConfig.findOrCreate({
      where: { cafeId },
      defaults: {
        status: 'mock',
        autoOrderConfirmation: true,
        autoOrderReady: true,
        autoLoyaltyAlerts: true,
        webhookVerifyToken: `gusstora_wa_${cafeId.slice(0, 8)}`,
      },
    });

    const recentLogs = await NotificationLog.findAll({
      where: { cafeId, channel: 'whatsapp_cloud' },
      order: [['createdAt', 'DESC']],
      limit: 30,
    });

    res.json({
      config: serializeWhatsAppConfig(config),
      logs: recentLogs,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch WhatsApp config' });
  }
});

/**
 * Save WhatsApp Cloud API credentials and automated trigger toggles
 */
omnichannelRouter.post('/owner/whatsapp/config', requireOwnerOrManager, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const {
      phoneNumberId,
      wabaId,
      accessToken,
      status,
      autoOrderConfirmation,
      autoOrderReady,
      autoLoyaltyAlerts,
      webhookVerifyToken,
    } = req.body;

    const [config] = await WhatsAppConfig.findOrCreate({
      where: { cafeId },
      defaults: { status: 'mock' },
    });

    const updates = {};
    if (phoneNumberId !== undefined) updates.phoneNumberId = phoneNumberId;
    if (wabaId !== undefined) updates.wabaId = wabaId;
    if (accessToken !== undefined && accessToken.trim()) updates.accessToken = accessToken;
    if (status !== undefined) updates.status = status;
    if (autoOrderConfirmation !== undefined) updates.autoOrderConfirmation = Boolean(autoOrderConfirmation);
    if (autoOrderReady !== undefined) updates.autoOrderReady = Boolean(autoOrderReady);
    if (autoLoyaltyAlerts !== undefined) updates.autoLoyaltyAlerts = Boolean(autoLoyaltyAlerts);
    if (webhookVerifyToken !== undefined) updates.webhookVerifyToken = webhookVerifyToken;

    await config.update(updates);
    res.json({ config: serializeWhatsAppConfig(config) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to save WhatsApp config' });
  }
});

/**
 * Send a test WhatsApp message to verify integration or simulation
 */
omnichannelRouter.post('/owner/whatsapp/test', requireOwnerOrManager, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { toPhone, templateType, customText } = req.body;

    if (!toPhone) return res.status(400).json({ message: 'Recipient phone number is required' });

    const result = await dispatchWhatsAppCloudMessage({
      cafeId,
      toPhone,
      templateType: templateType || 'order_confirmed',
      templateParams: {
        orderNo: 'TEST-101',
        customerName: 'Coffee Connoisseur',
        itemCount: 2,
        total: 450,
        claimCode: 'CLM-TEST77',
        amount: 150,
      },
      customText,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Test message failed' });
  }
});

/**
 * Meta Webhook Challenge Verification (GET)
 */
omnichannelRouter.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * Meta Inbound Webhook Event Callback (POST)
 */
omnichannelRouter.post('/webhooks/whatsapp', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const statuses = value?.statuses;

    if (statuses && statuses[0]) {
      const { id, status } = statuses[0];
      // Update log if matching message ID found
      const log = await NotificationLog.findOne({
        where: { channel: 'whatsapp_cloud' },
        order: [['createdAt', 'DESC']],
      });
      if (log && log.metadata && log.metadata.includes(id)) {
        await log.update({ status });
      }
    }

    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(200);
  }
});

/* ==========================================================================
   3. Multi-Location Chain Hierarchy & Brand Portal
   ========================================================================== */

/**
 * Get Brand Profile and multi-outlet aggregated metrics
 */
omnichannelRouter.get('/owner/brand', requireOwnerOrManager, async (req, res) => {
  try {
    const cafe = await Cafe.findByPk(req.auth.cafe);
    let brandId = cafe?.brandId;

    // If active café doesn't have a brand yet, find or create default brand for owner
    if (!brandId) {
      let [defaultBrand] = await Brand.findOrCreate({
        where: { slug: 'gusstora-roasters-chain' },
        defaults: {
          name: 'GUESTORA Roasters & Co.',
          slug: 'gusstora-roasters-chain',
          headquarters: 'Bandra West, Mumbai',
          ownerId: req.auth.sub,
        },
      });

      if (cafe) {
        await cafe.update({ brandId: defaultBrand.id });
      }
      brandId = defaultBrand.id;
    }

    const overview = await getBrandOverview({ brandId });
    res.json(overview);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch brand overview' });
  }
});

/**
 * Create or update Brand metadata
 */
omnichannelRouter.post('/owner/brand', requireOwnerOrManager, async (req, res) => {
  try {
    const { name, slug, headquarters, logo } = req.body;
    if (!name || !slug) return res.status(400).json({ message: 'Brand name and slug are required' });

    let brand = await Brand.findOne({ where: { slug } });
    if (!brand) {
      brand = await Brand.create({
        name,
        slug,
        headquarters,
        logo,
        ownerId: req.auth.sub,
      });
    } else {
      await brand.update({ name, headquarters, logo });
    }

    // Attach active café to brand
    const cafe = await Cafe.findByPk(req.auth.cafe);
    if (cafe) await cafe.update({ brandId: brand.id });

    const overview = await getBrandOverview({ brandId: brand.id });
    res.json(overview);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to save brand' });
  }
});

/**
 * Provision a new Outlet under the active Brand
 */
omnichannelRouter.post('/owner/brand/outlets', requireOwnerOrManager, async (req, res) => {
  try {
    const { name, slug, address, phone, tables } = req.body;
    if (!name || !slug) return res.status(400).json({ message: 'Outlet name and unique slug are required' });

    const activeCafe = await Cafe.findByPk(req.auth.cafe);
    const brandId = activeCafe?.brandId;
    if (!brandId) return res.status(400).json({ message: 'No active brand found to attach outlet' });

    const newOutlet = await Cafe.create({
      name,
      slug,
      address: address || 'New Location',
      phone: phone || activeCafe.phone,
      tables: parseInt(tables, 10) || 12,
      currency: activeCafe.currency || 'INR',
      brandId,
      brandColor: activeCafe.brandColor || '#ea580c',
    });

    // Auto-replicate master menu to newly created outlet
    try {
      await syncBrandMenuToOutlets({
        sourceCafeId: activeCafe.id,
        targetCafeIds: [newOutlet.id],
      });
    } catch (menuErr) {
      console.warn('Initial menu copy warning:', menuErr.message);
    }

    const overview = await getBrandOverview({ brandId });
    res.status(201).json({
      outlet: newOutlet,
      brandOverview: overview,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create outlet' });
  }
});

/**
 * Push / Replicate master menu items from current café across selected or all outlets
 */
omnichannelRouter.post('/owner/brand/sync-menu', requireOwnerOrManager, async (req, res) => {
  try {
    const sourceCafeId = req.auth.cafe;
    let { targetCafeIds } = req.body;

    if (!targetCafeIds || !targetCafeIds.length) {
      // Replicate across all sister outlets in the brand
      const activeCafe = await Cafe.findByPk(sourceCafeId);
      if (!activeCafe?.brandId) return res.status(400).json({ message: 'Cafe has no associated brand.' });

      const sisterOutlets = await Cafe.findAll({
        where: { brandId: activeCafe.brandId },
      });
      targetCafeIds = sisterOutlets.filter(o => o.id !== sourceCafeId).map(o => o.id);
    }

    if (!targetCafeIds.length) {
      return res.status(400).json({ message: 'No target outlets found to synchronize.' });
    }

    const syncResult = await syncBrandMenuToOutlets({
      sourceCafeId,
      targetCafeIds,
    });

    res.json(syncResult);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Menu sync failed' });
  }
});

/**
 * Switch active café session context for owner/manager without re-login
 */
omnichannelRouter.post('/owner/brand/switch/:cafeId', requireOwnerOrManager, async (req, res) => {
  try {
    const targetCafe = await Cafe.findByPk(req.params.cafeId);
    if (!targetCafe) return res.status(404).json({ message: 'Target café outlet not found' });

    const currentUser = await User.findByPk(req.auth.sub);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    // Generate fresh JWT pointing to new café
    const newToken = signToken({
      sub: currentUser.id,
      email: currentUser.email,
      role: req.auth.role,
      cafe: targetCafe.id,
    });

    res.json({
      token: newToken,
      cafe: {
        id: targetCafe.id,
        name: targetCafe.name,
        slug: targetCafe.slug,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Outlet switch failed' });
  }
});

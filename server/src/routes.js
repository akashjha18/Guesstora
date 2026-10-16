import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { sequelize } from './db.js';
import { AuditLog, Booking, Cafe, CafeTable, Customer, Feedback, MenuItem, NotificationLog, Order, OrderItem, OtpVerification, PromoCode, RefreshToken, RegisterShift, ReminderRule, Reward, User } from './models.js';
import { generateAccessToken, generateRefreshToken, getActiveSessions, requireOwner, requireRole, requireStaff, revokeAllUserTokens, revokeRefreshToken, rotateRefreshToken, sign } from './auth.js';
import { createAuditLog, getClientIp, getClientUserAgent } from './audit.js';
import { calculateRewardProgress, generateClaimCode, processLoyalty } from './loyalty.js';
import { dispatchReminder, generateWhatsAppUrl, renderTemplate, runBatchReminders, scanAudienceForCafe, serializeNotificationLog, serializeReminderRule } from './reminderEngine.js';
import { validateLoginRequest } from './validation.js';
import { validatePublicOrderPayload } from './security.js';
import { formatCustomersCSV, formatOrdersCSV, getCafeAnalytics } from './analyticsEngine.js';
import { broadcastEvent, eventBus, subscribeClient } from './eventBus.js';
import { normalizeOrderLineItems } from './modifiers.js';
import { generatePaymentIntent, verifyPaymentTransaction } from './payments.js';
import { calculateDiscount, calculateEqualBillSplit, calculateShiftSummary, formatZReportText } from './shifts.js';
import shiftsRouter from './routes/shifts.routes.js';
import billOpsRouter from './routes/billOps.routes.js';
import promosRouter from './routes/promos.routes.js';
import inventoryRouter from './routes/inventory.routes.js';
import { omnichannelRouter } from './routes/omnichannel.routes.js';
import { hardwareRouter } from './routes/hardware.routes.js';
import offlineSyncRouter from './routes/offlineSync.routes.js';
import captainRouter from './routes/captain.routes.js';
import { gstRouter } from './routes/gst.routes.js';
import { commissaryRouter } from './routes/commissary.routes.js';
import { staffOpsRouter } from './routes/staffOps.routes.js';
import { aiRoasteryRouter } from './routes/aiRoastery.routes.js';
import { depleteInventoryForOrder, restoreInventoryForOrder } from './inventoryEngine.js';
import { serializeInventoryItem, serializeOrder, serializePromoCode, serializeRecipeItem, serializeShift, serializeStockLedger, serializeBrand, serializeDeliveryChannel, serializeWhatsAppConfig } from './routes/serializers.js';


const router = Router();
const cleanPhone = v => String(v || '').replace(/\D/g, '').slice(-10);

const serializeUser = u => ({
  _id: u.id,
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone || '',
  role: u.role || 'cashier',
  status: u.status || 'active',
  createdAt: u.createdAt,
});

const serializeMenuItem = i => ({
  _id: i.id,
  id: i.id,
  name: i.name,
  description: i.description,
  category: i.category,
  price: Number(i.price) || 0,
  image: i.image,
  available: i.available,
  veg: i.veg,
  variants: Array.isArray(i.variants) ? i.variants : (typeof i.variants === 'string' ? JSON.parse(i.variants || '[]') : []),
  modifierGroups: Array.isArray(i.modifierGroups) ? i.modifierGroups : (typeof i.modifierGroups === 'string' ? JSON.parse(i.modifierGroups || '[]') : []),
});
const serializeReward = r => ({
  _id: r.id,
  id: r.id,
  amount: r.amount,
  claimCode: r.claimCode,
  status: r.status,
  expiresAt: r.expiresAt,
  claimedAt: r.claimedAt,
  redeemedAt: r.redeemedAt,
  redeemedBy: r.redeemedBy || null,
  notes: r.notes,
  createdAt: r.createdAt,
});
const serializeTable = t => ({
  _id: t.id,
  id: t.id,
  tableNumber: t.tableNumber,
  name: t.name || `Table ${t.tableNumber}`,
  capacity: t.capacity || 4,
  section: t.section || 'Main Floor',
  status: t.status || 'available',
  currentBookingId: t.currentBookingId || null,
  currentBooking: t.currentBooking ? (typeof t.currentBooking.toJSON === 'function' ? serializeBooking(t.currentBooking) : t.currentBooking) : null,
  mergedIntoTableId: t.mergedIntoTableId || null,
  activeOrderId: t.activeOrderId || null,
  occupiedSince: t.occupiedSince || null,
  guestCount: t.guestCount || 2,
  dinerName: t.dinerName || null,
  dinerPhone: t.dinerPhone || null,
  assignedCaptainId: t.assignedCaptainId || null,
  assignedCaptainName: t.assignedCaptainName || null,
  isActive: Boolean(t.isActive !== false),
  createdAt: t.createdAt,
});

const serializeBooking = b => ({
  _id: b.id,
  id: b.id,
  name: b.name,
  phone: b.phone,
  guests: b.guests || 2,
  dateTime: b.dateTime,
  durationMinutes: b.durationMinutes || 90,
  tableId: b.tableId || null,
  tableNumber: b.tableNumber || null,
  note: b.note || '',
  status: b.status || 'pending',
  seatedAt: b.seatedAt || null,
  completedAt: b.completedAt || null,
  source: b.source || 'online',
  createdAt: b.createdAt,
  table: b.table ? serializeTable(b.table) : null,
});
const serializeFeedback = f => ({
  _id: f.id,
  id: f.id,
  rating: f.rating,
  sentiment: f.sentiment,
  aspects: Array.isArray(f.aspects) ? f.aspects : (typeof f.aspects === 'string' ? JSON.parse(f.aspects || '[]') : []),
  comment: f.comment || '',
  customerName: f.customerName || 'Valued Guest',
  customerPhone: f.customerPhone || '',
  isPublic: Boolean(f.isPublic),
  status: f.status || 'new',
  resolutionNotes: f.resolutionNotes || '',
  resolvedAt: f.resolvedAt || null,
  resolvedBy: f.resolvedBy || null,
  orderId: f.orderId || null,
  orderNo: f.Order?.orderNo || null,
  orderTotal: f.Order?.total || null,
  customerId: f.customerId || null,
  cafeId: f.cafeId,
  createdAt: f.createdAt,
  updatedAt: f.updatedAt,
});
const serializeCustomerCRM = (c, visitsRequired = 8) => {
  const cOrders = c.orders || [];
  const paidOrders = cOrders.filter(o => o.paymentStatus === 'paid');
  const totalSpend = paidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const sortedOrders = [...cOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const lastVisit = sortedOrders[0]?.createdAt || c.createdAt;
  const avgOrderValue = paidOrders.length ? Math.round(totalSpend / paidOrders.length) : 0;
  const activeRewards = (c.rewards || []).filter(r => (r.status === 'available' || r.status === 'claimed') && (!r.expiresAt || new Date(r.expiresAt) > new Date()));

  return {
    _id: c.id,
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email || '',
    notes: c.notes || '',
    visits: c.visits || 0,
    totalSpend,
    ordersCount: cOrders.length,
    averageOrderValue: avgOrderValue,
    lastVisit,
    progress: calculateRewardProgress(c.visits || 0, visitsRequired),
    rewards: (c.rewards || []).map(serializeReward),
    activeRewardsCount: activeRewards.length,
    createdAt: c.createdAt,
  };
};
const publicCafe = c => ({
  _id: c.id, name: c.name, slug: c.slug, phone: c.phone, address: c.address, currency: c.currency, tables: c.tables,
  googleReviewUrl: c.googleReviewUrl, instagramUrl: c.instagramUrl,
  tagline: c.tagline || '', logo: c.logo || '', bannerImage: c.bannerImage || '', brandColor: c.brandColor || '#ea580c',
  wifiSsid: c.wifiSsid || '', wifiPassword: c.wifiPassword || '',
  cfdWelcomeTitle: c.cfdWelcomeTitle || '', cfdWelcomeSubtitle: c.cfdWelcomeSubtitle || '',
  cfdPromoBanner: c.cfdPromoBanner || '', cfdUpiVpa: c.cfdUpiVpa || '', cfdIdleMedia: c.cfdIdleMedia || '',
  loyalty: { enabled: c.loyaltyEnabled, visitsRequired: c.loyaltyVisitsRequired, minimumSpend: c.loyaltyMinimumSpend, rewardCap: c.loyaltyRewardCap, validityDays: c.loyaltyValidityDays },
  menu: (c.menu || []).filter(i => i.available).map(serializeMenuItem),
});
const ownerCafe = c => ({
  _id: c.id, name: c.name, slug: c.slug, phone: c.phone, address: c.address, currency: c.currency, tables: c.tables,
  googleReviewUrl: c.googleReviewUrl, instagramUrl: c.instagramUrl,
  tagline: c.tagline || '', logo: c.logo || '', bannerImage: c.bannerImage || '', brandColor: c.brandColor || '#ea580c',
  wifiSsid: c.wifiSsid || '', wifiPassword: c.wifiPassword || '',
  cfdWelcomeTitle: c.cfdWelcomeTitle || '', cfdWelcomeSubtitle: c.cfdWelcomeSubtitle || '',
  cfdPromoBanner: c.cfdPromoBanner || '', cfdUpiVpa: c.cfdUpiVpa || '', cfdIdleMedia: c.cfdIdleMedia || '',
  loyalty: { enabled: c.loyaltyEnabled, visitsRequired: c.loyaltyVisitsRequired, minimumSpend: c.loyaltyMinimumSpend, rewardCap: c.loyaltyRewardCap, validityDays: c.loyaltyValidityDays },
  menu: (c.menu || []).map(serializeMenuItem),
});

const serializeAuditLog = log => ({
  id: log.id,
  _id: log.id,
  cafeId: log.cafeId,
  userId: log.userId,
  userName: log.userName || 'System',
  userRole: log.userRole || 'system',
  action: log.action,
  category: log.category,
  details: log.details || {},
  status: log.status || 'success',
  ipAddress: log.ipAddress || '127.0.0.1',
  userAgent: log.userAgent || '',
  createdAt: log.createdAt,
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = validateLoginRequest(req.body);
    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await createAuditLog({
        userName: email || 'Unknown',
        userRole: 'anonymous',
        action: 'AUTH_LOGIN_FAILURE',
        category: 'auth',
        status: 'failure',
        details: { reason: 'Invalid email or password', email },
        req,
      });
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (user.status === 'inactive') {
      await createAuditLog({
        cafeId: user.cafeId,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'AUTH_LOGIN_DEACTIVATED',
        category: 'auth',
        status: 'failure',
        details: { reason: 'Staff account deactivated' },
        req,
      });
      return res.status(403).json({ message: 'Your staff account has been deactivated. Please contact your cafe administrator.' });
    }

    const accessToken = generateAccessToken(user);
    const refresh = await generateRefreshToken(user, {
      ipAddress: getClientIp(req),
      userAgent: getClientUserAgent(req),
    });

    await createAuditLog({
      cafeId: user.cafeId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'AUTH_LOGIN_SUCCESS',
      category: 'auth',
      status: 'success',
      details: { email: user.email, role: user.role },
      req,
    });

    return res.json({
      token: accessToken,
      accessToken,
      refreshToken: refresh.refreshToken,
      expiresAt: refresh.expiresAt,
      user: serializeUser(user),
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Valid email and password are required.' });
  }
});

router.post('/auth/refresh', async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken || req.headers?.['x-refresh-token'];
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required.' });
    }

    const meta = {
      ipAddress: getClientIp(req),
      userAgent: getClientUserAgent(req),
    };

    const result = await rotateRefreshToken(refreshToken, meta);
    if (result.error) {
      if (result.error === 'token_reused') {
        await createAuditLog({
          action: 'AUTH_TOKEN_REUSE_DETECTED',
          category: 'auth',
          status: 'failure',
          details: { warning: 'Compromised token family revoked' },
          req,
        });
        return res.status(401).json({ code: 'TOKEN_REUSED', message: result.message });
      }
      return res.status(401).json({ code: result.error.toUpperCase(), message: result.message });
    }

    await createAuditLog({
      cafeId: result.user.cafeId,
      userId: result.user.id,
      userName: result.user.name,
      userRole: result.user.role,
      action: 'AUTH_TOKEN_ROTATED',
      category: 'auth',
      status: 'success',
      details: { refreshedAt: new Date() },
      req,
    });

    return res.json({
      token: result.accessToken,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      user: serializeUser(result.user),
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(500).json({ message: err.message || 'Token refresh failed.' });
  }
});

router.post('/auth/logout', async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken || req.headers?.['x-refresh-token'];
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    const authHeader = req.headers?.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7).trim(), process.env.JWT_SECRET || 'dev-secret-change-me');
        await createAuditLog({
          cafeId: decoded.cafe,
          userId: decoded.sub,
          userName: decoded.name,
          userRole: decoded.role,
          action: 'AUTH_LOGOUT',
          category: 'auth',
          status: 'success',
          details: { logoutTime: new Date() },
          req,
        });
      } catch {}
    }
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Logout failed.' });
  }
});


router.get('/public/cafes/check-slug/:slug', async (req, res) => {
  try {
    const raw = String(req.params.slug || '').trim().toLowerCase();
    const slug = raw.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!slug || slug.length < 3) {
      return res.json({ available: false, slug, message: 'Slug must be at least 3 characters.' });
    }
    const existing = await Cafe.findOne({ where: { slug } });
    return res.json({
      available: !existing,
      slug,
      message: existing ? 'This café URL is already taken.' : 'Café URL is available!'
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to check slug.' });
  }
});

router.post('/auth/register-cafe', async (req, res) => {
  try {
    const {
      cafeName,
      slug: rawSlug,
      phone,
      address,
      currency = 'INR',
      tables = 12,
      brandColor = '#ea580c',
      tagline = '',
      logo = '',
      bannerImage = '',
      wifiSsid = '',
      wifiPassword = '',
      googleReviewUrl = '',
      instagramUrl = '',
      ownerName,
      ownerEmail,
      ownerPassword,
      seedSampleMenu = true,
    } = req.body || {};

    if (!cafeName || String(cafeName).trim().length < 2) {
      return res.status(400).json({ message: 'Café name must be at least 2 characters.' });
    }

    const slug = String(rawSlug || cafeName).trim().toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!slug || slug.length < 3) {
      return res.status(400).json({ message: 'Valid café URL slug of at least 3 characters is required.' });
    }

    const existingCafe = await Cafe.findOne({ where: { slug } });
    if (existingCafe) {
      return res.status(409).json({ message: `The café URL slug "${slug}" is already taken. Please pick another one.` });
    }

    if (!ownerName || String(ownerName).trim().length < 2) {
      return res.status(400).json({ message: 'Owner name must be at least 2 characters.' });
    }

    const email = String(ownerEmail || '').trim().toLowerCase();
    if (!email || !email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: `An account with email "${email}" already exists. Please log in instead.` });
    }

    const password = String(ownerPassword || '').trim();
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await sequelize.transaction(async (t) => {
      const cafe = await Cafe.create({
        name: String(cafeName).trim(),
        slug,
        phone: String(phone || '').trim(),
        address: String(address || '').trim(),
        currency: String(currency || 'INR').toUpperCase(),
        tables: Math.max(1, Math.min(100, Number(tables) || 12)),
        brandColor: String(brandColor || '#ea580c').trim(),
        tagline: String(tagline || '').trim(),
        logo: String(logo || '').trim(),
        bannerImage: String(bannerImage || '').trim(),
        wifiSsid: String(wifiSsid || '').trim(),
        wifiPassword: String(wifiPassword || '').trim(),
        googleReviewUrl: String(googleReviewUrl || '').trim(),
        instagramUrl: String(instagramUrl || '').trim(),
        loyaltyEnabled: true,
        loyaltyVisitsRequired: 8,
        loyaltyMinimumSpend: currency === 'INR' ? 300 : 5,
        loyaltyRewardCap: currency === 'INR' ? 1000 : 25,
        loyaltyValidityDays: 60,
      }, { transaction: t });

      const ownerUser = await User.create({
        cafeId: cafe.id,
        name: String(ownerName).trim(),
        email,
        phone: String(phone || '').trim(),
        passwordHash,
        role: 'owner',
        status: 'active',
      }, { transaction: t });

      if (seedSampleMenu) {
        const starterItems = [
          { name: 'Signature Espresso', category: 'Coffee', price: currency === 'INR' ? 140 : 3.5, description: 'Rich double-shot extraction with golden hazelnut crema.', veg: true, available: true, image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500&auto=format&fit=crop&q=80', cafeId: cafe.id },
          { name: 'Classic Cappuccino', category: 'Coffee', price: currency === 'INR' ? 190 : 4.5, description: 'Velvety micro-foamed milk poured over our signature espresso blend.', veg: true, available: true, image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&auto=format&fit=crop&q=80', cafeId: cafe.id },
          { name: 'Spanish Vanilla Iced Latte', category: 'Cold Brews', price: currency === 'INR' ? 240 : 5.5, description: 'Cold extracted espresso with condensed milk, Madagascar vanilla, and crushed ice.', veg: true, available: true, image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop&q=80', cafeId: cafe.id },
          { name: 'Artisan Butter Croissant', category: 'Bakery', price: currency === 'INR' ? 160 : 4.0, description: 'Flaky 72-layer European butter pastry baked fresh daily.', veg: true, available: true, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop&q=80', cafeId: cafe.id },
          { name: 'Gourmet Sourdough Club Panini', category: 'Food', price: currency === 'INR' ? 280 : 7.0, description: 'Grilled stoneground sourdough layered with pesto, buffalo mozzarella, and aged cheddar.', veg: true, available: true, image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=80', cafeId: cafe.id },
        ];
        await MenuItem.bulkCreate(starterItems, { transaction: t });
      }

      return { cafe, ownerUser };
    });

    const fullCafe = await Cafe.findByPk(result.cafe.id, {
      include: [{ model: MenuItem, as: 'menu' }],
    });

    const accessToken = generateAccessToken(result.ownerUser);
    const refresh = await generateRefreshToken(result.ownerUser, {
      ipAddress: getClientIp(req),
      userAgent: getClientUserAgent(req),
    });

    await createAuditLog({
      cafeId: result.cafe.id,
      userId: result.ownerUser.id,
      userName: result.ownerUser.name,
      userRole: result.ownerUser.role,
      action: 'AUTH_REGISTER_CAFE',
      category: 'auth',
      status: 'success',
      details: { cafeName: result.cafe.name, slug: result.cafe.slug },
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Welcome to PerkByte! Café "${result.cafe.name}" registered successfully.`,
      token: accessToken,
      accessToken,
      refreshToken: refresh.refreshToken,
      expiresAt: refresh.expiresAt,
      user: serializeUser(result.ownerUser),
      cafe: ownerCafe(fullCafe),
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ message: err.message || 'Failed to register café.' });
  }
});

router.get('/public/cafes/:slug', async (req, res) => {
  const c = await Cafe.findOne({ where: { slug: req.params.slug }, include: [{ model: MenuItem, as: 'menu' }] });
  c ? res.json(publicCafe(c)) : res.status(404).json({ message: 'Cafe not found.' });
});

router.get('/public/cafes/:slug/loyalty/:phone', async (req, res) => {
  const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
  if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });
  const customer = await Customer.findOne({ where: { cafeId: cafe.id, phone: cleanPhone(req.params.phone) }, include: [{ model: Reward, as: 'rewards' }] });
  const visits = customer?.visits || 0;
  const rewards = (customer?.rewards || []).filter(r => (r.status === 'available' || r.status === 'claimed') && (!r.expiresAt || r.expiresAt > new Date()));
  res.json({ ...calculateRewardProgress(visits, cafe.loyaltyVisitsRequired), rewards: rewards.map(serializeReward) });
});

router.post('/public/cafes/:slug/rewards/:id/claim', async (req, res) => {
  const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
  if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });

  const reward = await Reward.findByPk(req.params.id, {
    include: [{ model: Customer }],
  });
  if (!reward) return res.status(404).json({ message: 'Reward voucher not found.' });

  // Ensure reward belongs to this cafe
  if (reward.cafeId && reward.cafeId !== cafe.id) {
    return res.status(403).json({ message: 'Reward does not belong to this cafe.' });
  }

  if (reward.status === 'redeemed') {
    return res.status(400).json({ message: 'This reward voucher has already been redeemed.' });
  }

  if (reward.expiresAt && new Date(reward.expiresAt) < new Date()) {
    reward.status = 'expired';
    await reward.save();
    return res.status(400).json({ message: 'This reward voucher has expired.' });
  }

  // Idempotent: If already claimed, return existing claim code
  if (reward.status === 'claimed' && reward.claimCode) {
    return res.json({
      success: true,
      message: 'Reward is already claimed and ready to present at the counter.',
      reward: serializeReward(reward),
    });
  }

  if (!reward.claimCode) {
    reward.claimCode = generateClaimCode();
  }
  if (!reward.cafeId) {
    reward.cafeId = cafe.id;
  }
  reward.status = 'claimed';
  reward.claimedAt = new Date();
  await reward.save();

  return res.json({
    success: true,
    message: `Voucher claimed successfully! Show code ${reward.claimCode} to cashier.`,
    reward: serializeReward(reward),
  });
});

router.post('/public/auth/request-otp', async (req, res) => {
  const phone = cleanPhone(req.body.phone);
  if (phone.length !== 10) {
    return res.status(400).json({ message: 'Valid 10-digit mobile number required.' });
  }

  // Generate 4-digit OTP (1234 for dev/demo, or random in production)
  const otp = process.env.NODE_ENV === 'production' 
    ? Math.floor(1000 + Math.random() * 9000).toString() 
    : '1234';

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await OtpVerification.create({
    phone,
    otp,
    expiresAt,
    verified: false,
  });

  console.log(`[OTP Engine] Verification code for ${phone}: ${otp}`);

  return res.json({
    success: true,
    message: `Verification code sent to ${phone}`,
    devOtp: otp, // Pre-filled for demo convenience
  });
});

router.post('/public/auth/verify-otp', async (req, res) => {
  const phone = cleanPhone(req.body.phone);
  const otp = String(req.body.otp || '').trim();
  const name = String(req.body.name || '').trim();
  const cafeSlug = req.body.cafeSlug || req.body.slug;

  if (phone.length !== 10 || !otp) {
    return res.status(400).json({ message: 'Valid phone and OTP required.' });
  }

  const record = await OtpVerification.findOne({
    where: { phone, otp, verified: false },
    order: [['createdAt', 'DESC']],
  });

  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Invalid or expired verification code.' });
  }

  record.verified = true;
  await record.save();

  let customer = null;
  let loyaltyProgress = null;
  if (cafeSlug) {
    const cafe = await Cafe.findOne({ where: { slug: cafeSlug } });
    if (cafe) {
      [customer] = await Customer.findOrCreate({
        where: { cafeId: cafe.id, phone },
        defaults: { name: name || 'Valued Guest', visits: 0 },
      });
      if (name && customer.name !== name && (customer.name === 'Valued Guest' || !customer.name)) {
        customer.name = name;
        await customer.save();
      }
      const rewards = await Reward.findAll({
        where: { customerId: customer.id, status: 'available' },
      });
      loyaltyProgress = {
        ...calculateRewardProgress(customer.visits || 0, cafe.loyaltyVisitsRequired),
        rewards: rewards.map(serializeReward),
      };
    }
  }

  return res.json({
    success: true,
    phone,
    name: customer?.name || name || 'Guest',
    customerId: customer?.id,
    customer: customer ? { _id: customer.id, id: customer.id, name: customer.name, phone: customer.phone } : { name: name || 'Guest', phone },
    loyalty: loyaltyProgress,
  });
});

router.get('/public/cafes/:slug/customers/:phone/history', async (req, res) => {
  const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
  if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });

  const phone = cleanPhone(req.params.phone);
  const customer = await Customer.findOne({
    where: { cafeId: cafe.id, phone },
    include: [{ model: Reward, as: 'rewards' }],
  });

  if (!customer) {
    return res.json({
      found: false,
      customer: { phone, name: 'Guest', visits: 0, totalVisits: 0, stamps: 0, totalSpend: 0 },
      rewards: [],
      orders: [],
      loyalty: calculateRewardProgress(0, cafe.loyaltyVisitsRequired),
    });
  }

  const orders = await Order.findAll({
    where: { cafeId: cafe.id, phone },
    order: [['createdAt', 'DESC']],
    include: [{ model: OrderItem, as: 'items' }],
    limit: 25,
  });

  const rewards = customer.rewards || [];
  const totalSpend = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  return res.json({
    found: true,
    customer: {
      id: customer.id,
      _id: customer.id,
      name: customer.name,
      phone: customer.phone,
      visits: customer.visits || 0,
      totalVisits: customer.visits || 0,
      stamps: customer.visits || 0,
      totalSpend,
      createdAt: customer.createdAt,
    },
    loyalty: {
      ...calculateRewardProgress(customer.visits || 0, cafe.loyaltyVisitsRequired),
      rewards: rewards.filter(r => (r.status === 'available' || r.status === 'claimed') && (!r.expiresAt || r.expiresAt > new Date())).map(serializeReward),
    },
    rewards: rewards.map(serializeReward),
    orders: orders.map(serializeOrder),
  });
});

router.post('/public/cafes/:slug/orders', async (req, res) => {
  try {
    const { name, phone, items } = validatePublicOrderPayload(req.body);
    const cafe = await Cafe.findOne({ where: { slug: req.params.slug }, include: [{ model: MenuItem, as: 'menu' }] });
    if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });

    const [customer] = await Customer.findOrCreate({ where: { cafeId: cafe.id, phone }, defaults: { name } });
    if (customer.name !== name) { customer.name = name; await customer.save(); }

    const normalizedItems = normalizeOrderLineItems(items, cafe.menu || [], 20);
    if (!normalizedItems.length) return res.status(400).json({ message: 'No available items selected.' });

    const orderPayload = { ...req.body, name, phone, items: normalizedItems };
    let discount = 0; let rewardId = null;

    const order = await sequelize.transaction(async (t) => {
      if (orderPayload.rewardId) {
        const reward = await Reward.findOne({ where: { id: orderPayload.rewardId, customerId: customer.id }, transaction: t });
        if ((reward?.status === 'available' || reward?.status === 'claimed') && (!reward.expiresAt || reward.expiresAt > new Date())) {
          discount = Math.min(reward.amount, normalizedItems.reduce((s, i) => s + i.price * i.quantity, 0));
          reward.status = 'redeemed';
          reward.redeemedAt = new Date();
          reward.notes = `Online order discount applied`;
          await reward.save({ transaction: t });
          rewardId = reward.id;
        }
      }
      const subtotal = normalizedItems.reduce((s, i) => s + i.price * i.quantity, 0);
      const total = Math.max(0, subtotal - discount);
      const rawMethod = String(orderPayload.paymentMethod || 'cash').toLowerCase();
      const validMethod = ['demo_online', 'upi', 'razorpay', 'stripe', 'cash'].includes(rawMethod) ? rawMethod : 'cash';
      const isPaid = orderPayload.paymentStatus === 'paid' || validMethod === 'demo_online' || (Boolean(orderPayload.paymentTransactionId) && ['upi', 'razorpay', 'stripe'].includes(validMethod));
      const paymentStatus = isPaid ? 'paid' : 'pending';

      const activeShift = await RegisterShift.findOne({
        where: { cafeId: cafe.id, status: 'open' },
        order: [['openedAt', 'DESC']],
        transaction: t,
      });

      const created = await Order.create({
        cafeId: cafe.id, orderNo: `PB${Date.now().toString().slice(-7)}`, customerId: customer.id,
        shiftId: activeShift ? activeShift.id : null,
        customerName: name, phone, table: orderPayload.table || 'Takeaway', subtotal, discount, total,
        rewardId,
        paymentMethod: validMethod,
        paymentStatus,
        paymentTransactionId: orderPayload.paymentTransactionId || null,
        paymentGatewayMeta: orderPayload.paymentGatewayMeta || null,
      }, { transaction: t });
      await OrderItem.bulkCreate(normalizedItems.map(i => ({
        orderId: created.id,
        menuItemId: i.menuItemId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        selectedVariant: i.selectedVariant,
        selectedModifiers: i.selectedModifiers,
        notes: i.notes,
      })), { transaction: t });
      return created;
    });

    // Fetch complete order with line items for real-time broadcast and diner response
    const fullOrder = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: 'items' }],
    });
    const serialized = serializeOrder(fullOrder);

    // Broadcast real-time event to kitchen and staff displays
    broadcastEvent(cafe.id, 'order_created', serialized);

    // Automatically deplete recipe ingredients according to BOM and trigger 86 if needed
    try {
      await depleteInventoryForOrder({ order: fullOrder, cafeId: cafe.id, staffName: 'Public QR Order' });
    } catch (invErr) {
      console.warn('Inventory depletion notice:', invErr.message);
    }

    return res.status(201).json({
      _id: order.id,
      id: order.id,
      orderNo: order.orderNo,
      total: order.total,
      subtotal: order.subtotal,
      discount: order.discount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentTransactionId: order.paymentTransactionId,
      table: order.table,
      customerName: order.customerName,
      createdAt: order.createdAt,
      items: serialized.items,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Invalid order request.' });
  }
});

router.post('/public/cafes/:slug/orders/:id/payment-intent', async (req, res) => {
  try {
    const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
    if (!cafe) return res.status(404).json({ message: 'Cafe roastery not found.' });

    const order = await Order.findOne({
      where: { id: req.params.id, cafeId: cafe.id },
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const gateway = String(req.body.gateway || order.paymentMethod || 'upi').toLowerCase();
    const intent = generatePaymentIntent({ order, gateway, cafe });
    return res.json(intent);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to generate payment intent.' });
  }
});

router.post('/public/cafes/:slug/orders/:id/confirm-payment', async (req, res) => {
  try {
    const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
    if (!cafe) return res.status(404).json({ message: 'Cafe roastery not found.' });

    const order = await Order.findOne({
      where: { id: req.params.id, cafeId: cafe.id },
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const { gateway = 'upi', transactionId, meta = {} } = req.body;
    const verification = verifyPaymentTransaction({ gateway, transactionId, meta });
    if (!verification.success) {
      return res.status(400).json({ message: verification.error || 'Payment verification failed.' });
    }

    order.paymentStatus = 'paid';
    order.paymentMethod = verification.gateway;
    order.paymentTransactionId = verification.transactionId;
    order.paymentGatewayMeta = verification.meta;
    await order.save();

    if (order.status === 'completed') {
      await processLoyalty(order).catch(err => console.warn('Loyalty notice on payment:', err.message));
    }

    const serialized = serializeOrder(order);
    broadcastEvent(cafe.id, 'order_updated', serialized);

    return res.json({
      success: true,
      message: 'Payment verified and confirmed successfully.',
      order: serialized,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Payment confirmation failed.' });
  }
});

router.post('/webhooks/payments', async (req, res) => {
  try {
    const { event, payload } = req.body || {};
    const orderId = payload?.payment?.entity?.notes?.orderId || payload?.orderId || payload?.data?.object?.metadata?.orderId;
    const txnId = payload?.payment?.entity?.id || payload?.id || payload?.data?.object?.id;

    if (orderId) {
      const order = await Order.findByPk(orderId);
      if (order && order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        if (txnId) order.paymentTransactionId = txnId;
        order.paymentGatewayMeta = { webhookEvent: event, receivedAt: new Date().toISOString() };
        await order.save();

        if (order.status === 'completed') {
          await processLoyalty(order).catch(() => {});
        }
        broadcastEvent(order.cafeId, 'order_updated', serializeOrder(order));
      }
    }
    return res.json({ received: true });
  } catch (err) {
    console.warn('Webhook error:', err.message);
    return res.status(200).json({ received: true });
  }
});

router.get('/public/cafes/:slug/tables', async (req, res) => {
  const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
  if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });

  const tables = await CafeTable.findAll({
    where: { cafeId: cafe.id, isActive: true },
    order: [['tableNumber', 'ASC']],
  });

  res.json(tables.map(t => ({
    id: t.id,
    tableNumber: t.tableNumber,
    name: t.name,
    capacity: t.capacity,
    section: t.section,
    status: t.status,
  })));
});

router.post('/public/cafes/:slug/bookings', async (req, res) => {
  const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
  if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });
  const phone = cleanPhone(req.body.phone);
  if (!req.body.name || phone.length !== 10 || !req.body.dateTime) {
    return res.status(400).json({ message: 'Please provide guest name, 10-digit phone number, and reservation date/time.' });
  }

  const guests = Math.max(1, Math.min(30, Number(req.body.guests) || 2));
  let assignedTable = null;

  if (req.body.tableId) {
    assignedTable = await CafeTable.findOne({ where: { id: req.body.tableId, cafeId: cafe.id, isActive: true } });
  }

  const b = await Booking.create({
    cafeId: cafe.id,
    name: String(req.body.name).trim(),
    phone,
    guests,
    dateTime: new Date(req.body.dateTime),
    durationMinutes: Number(req.body.durationMinutes) || 90,
    tableId: assignedTable ? assignedTable.id : null,
    tableNumber: assignedTable ? assignedTable.tableNumber : null,
    note: req.body.note ? String(req.body.note).trim() : null,
    status: 'pending',
    source: 'online',
  });

  const serialized = serializeBooking(b);
  broadcastEvent(cafe.id, 'booking_created', serialized);
  res.status(201).json(serialized);
});

// Real-Time Event Stream for Diners / Public Customers
router.get('/events/cafe/:slug', async (req, res) => {
  const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
  if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });
  subscribeClient(cafe.id, res, req, { role: 'diner', label: `diner_${req.ip}` });
});

// Single Order Status Lookup for Live Tracking Stepper
router.get('/public/cafes/:slug/orders/:idOrOrderNo', async (req, res) => {
  const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
  if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });

  const { idOrOrderNo } = req.params;
  const order = await Order.findOne({
    where: {
      cafeId: cafe.id,
      [Op.or]: [
        { id: idOrOrderNo },
        { orderNo: idOrOrderNo },
      ],
    },
    include: [{ model: OrderItem, as: 'items' }],
  });

  if (!order) return res.status(404).json({ message: 'Order not found.' });
  return res.json(serializeOrder(order));
});

router.use('/owner', requireStaff);

router.get('/owner/dashboard', async (req, res) => {
  const [cafe, orders, bookings, customers, user, rewards, staffMembers, tables] = await Promise.all([
    Cafe.findByPk(req.auth.cafe, { include: [{ model: MenuItem, as: 'menu' }] }),
    Order.findAll({ where: { cafeId: req.auth.cafe }, order: [['createdAt', 'DESC']], limit: 50, include: [{ model: OrderItem, as: 'items' }] }),
    Booking.findAll({
      where: { cafeId: req.auth.cafe },
      order: [['dateTime', 'DESC'], ['createdAt', 'DESC']],
      limit: 50,
      include: [{ model: CafeTable, as: 'table' }],
    }),
    Customer.findAll({
      where: { cafeId: req.auth.cafe },
      include: [
        { model: Reward, as: 'rewards' },
        { model: Order, as: 'orders', attributes: ['id', 'total', 'status', 'paymentStatus', 'createdAt'] },
      ],
      order: [['createdAt', 'DESC']],
    }),
    User.findByPk(req.auth.sub),
    Reward.findAll({
      include: [{ model: Customer, where: { cafeId: req.auth.cafe } }],
      order: [['createdAt', 'DESC']],
      limit: 100,
    }),
    User.findAll({
      where: { cafeId: req.auth.cafe },
      order: [['createdAt', 'ASC']],
    }),
    CafeTable.findAll({
      where: { cafeId: req.auth.cafe, isActive: true },
      order: [['tableNumber', 'ASC']],
    }),
  ]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const orderJson = orders.map(serializeOrder);
  const bookingJson = bookings.map(serializeBooking);
  const tableJson = tables.map(serializeTable);
  const visitsReq = cafe?.loyaltyVisitsRequired || 8;
  const customerJson = (customers || []).map(c => serializeCustomerCRM(c, visitsReq));
  const rewardJson = (rewards || []).map(r => ({
    ...serializeReward(r),
    customerName: r.Customer?.name || 'Valued Guest',
    customerPhone: r.Customer?.phone || '',
  }));
  const staffJson = (staffMembers || []).map(serializeUser);

  const totalDinerRevenue = customerJson.reduce((sum, c) => sum + (c.totalSpend || 0), 0);

  res.json({
    cafe: ownerCafe(cafe), orders: orderJson, bookings: bookingJson, tables: tableJson, customers: customerJson, rewards: rewardJson,
    user: user ? serializeUser(user) : { id: req.auth.sub, name: 'Super Admin', email: 'owner@perkbyte.demo', role: req.auth.role || 'owner', phone: '', status: 'active' },
    staff: staffJson,
    stats: {
      todayOrders: orderJson.filter(o => o.createdAt >= today).length || 12,
      todayRevenue: orderJson.filter(o => o.createdAt >= today && o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0) || 740,
      totalCustomers: customerJson.length || 8,
      totalDinerRevenue,
      pendingBookings: bookingJson.filter(b => b.status === 'pending').length,
      seatedBookings: bookingJson.filter(b => b.status === 'seated').length,
      totalTables: tableJson.length,
      occupiedTables: tableJson.filter(t => t.status === 'occupied').length,
      availableTables: tableJson.filter(t => t.status === 'available').length,
      activeRewards: rewardJson.filter(r => (r.status === 'available' || r.status === 'claimed') && (!r.expiresAt || new Date(r.expiresAt) > new Date())).length,
      redeemedRewards: rewardJson.filter(r => r.status === 'redeemed').length,
    },
  });
});

router.get('/owner/customers', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const cafe = await Cafe.findByPk(req.auth.cafe);
  const visitsReq = cafe?.loyaltyVisitsRequired || 8;
  const customers = await Customer.findAll({
    where: { cafeId: req.auth.cafe },
    include: [
      { model: Reward, as: 'rewards' },
      { model: Order, as: 'orders', attributes: ['id', 'total', 'status', 'paymentStatus', 'createdAt'] },
    ],
    order: [['createdAt', 'DESC']],
  });
  return res.json(customers.map(c => serializeCustomerCRM(c, visitsReq)));
});

router.get('/owner/customers/:id', async (req, res) => {
  const cafe = await Cafe.findByPk(req.auth.cafe);
  const visitsReq = cafe?.loyaltyVisitsRequired || 8;
  const customer = await Customer.findOne({
    where: { id: req.params.id, cafeId: req.auth.cafe },
    include: [
      { model: Reward, as: 'rewards' },
      {
        model: Order,
        as: 'orders',
        include: [{ model: OrderItem, as: 'items' }],
      },
    ],
  });

  if (!customer) {
    return res.status(404).json({ message: 'Customer not found.' });
  }

  const sortedOrders = [...(customer.orders || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const sortedRewards = [...(customer.rewards || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.json({
    customer: serializeCustomerCRM(customer, visitsReq),
    orders: sortedOrders.map(serializeOrder),
    rewards: sortedRewards.map(serializeReward),
    loyalty: calculateRewardProgress(customer.visits || 0, visitsReq),
  });
});

router.patch('/owner/customers/:id', async (req, res) => {
  const customer = await Customer.findOne({
    where: { id: req.params.id, cafeId: req.auth.cafe },
  });
  if (!customer) {
    return res.status(404).json({ message: 'Customer not found.' });
  }

  if (req.body.name !== undefined) customer.name = String(req.body.name).trim();
  if (req.body.email !== undefined) customer.email = String(req.body.email).trim();
  if (req.body.notes !== undefined) customer.notes = String(req.body.notes).trim();

  await customer.save();
  return res.json({
    success: true,
    message: 'Customer profile updated successfully.',
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      notes: customer.notes,
    },
  });
});

router.post('/owner/orders', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const cafe = await Cafe.findByPk(req.auth.cafe, {
      include: [{ model: MenuItem, as: 'menu' }],
    });
    if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });

    const name = String(req.body.name || req.body.customerName || '').trim();
    const rawPhone = String(req.body.phone || '').replace(/\D/g, '');
    const phone = rawPhone.slice(-10);

    if (!name || phone.length !== 10) {
      return res.status(400).json({ message: 'Valid customer name and 10-digit phone number are required.' });
    }

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (!rawItems.length) {
      return res.status(400).json({ message: 'At least one menu item is required to create an order.' });
    }

    // Find or create customer in this cafe
    let customer;
    if (req.body.customerId) {
      customer = await Customer.findOne({ where: { id: req.body.customerId, cafeId: cafe.id } });
    }
    if (!customer) {
      const [foundOrCreated] = await Customer.findOrCreate({
        where: { cafeId: cafe.id, phone },
        defaults: { name, email: req.body.email || null, notes: req.body.notes || null },
      });
      customer = foundOrCreated;
    }

    if (name && customer.name !== name) {
      customer.name = name;
      await customer.save();
    }
    if (req.body.email && !customer.email) {
      customer.email = String(req.body.email).trim();
      await customer.save();
    }

    const normalizedItems = normalizeOrderLineItems(rawItems, cafe.menu || [], 50);

    if (!normalizedItems.length) {
      return res.status(400).json({ message: 'Selected menu items could not be found or matched.' });
    }

    const subtotal = normalizedItems.reduce((s, i) => s + i.price * i.quantity, 0);
    let discount = 0;
    let rewardId = null;

    const paymentMethod = req.body.paymentMethod === 'demo_online' ? 'demo_online' : 'cash';
    const paymentStatus = req.body.paymentStatus === 'pending' ? 'pending' : 'paid';
    const status = ['placed', 'accepted', 'preparing', 'ready', 'completed'].includes(req.body.status)
      ? req.body.status
      : 'placed';
    const table = req.body.table ? String(req.body.table).trim() : 'Counter / Takeaway';

    const order = await sequelize.transaction(async (t) => {
      if (req.body.rewardId) {
        const reward = await Reward.findOne({
          where: { id: req.body.rewardId, customerId: customer.id },
          transaction: t,
        });
        if ((reward?.status === 'available' || reward?.status === 'claimed') && (!reward.expiresAt || new Date(reward.expiresAt) > new Date())) {
          discount = Math.min(Number(reward.amount) || 0, subtotal);
          reward.status = 'redeemed';
          reward.redeemedAt = new Date();
          reward.notes = 'Manual CRM order discount applied';
          await reward.save({ transaction: t });
          rewardId = reward.id;
        }
      }

      let discountType = null;
      let discountValue = 0;
      let discountReason = null;
      let discountAuthorizedBy = null;

      if (req.body.discountType && req.body.discountValue) {
        const calc = calculateDiscount(
          subtotal,
          req.body.discountType,
          req.body.discountValue,
          req.body.maxDiscountAmount,
          req.body.minOrderAmount
        );
        if (calc.discountAmount > 0) {
          discount = calc.discountAmount;
          discountType = req.body.discountType;
          discountValue = Number(req.body.discountValue) || 0;
          discountReason = req.body.discountReason || 'Manual POS Discount';
          discountAuthorizedBy = req.body.discountAuthorizedBy || req.auth.name || 'Staff';
        }
      }

      const activeShift = await RegisterShift.findOne({
        where: { cafeId: cafe.id, status: 'open' },
        order: [['openedAt', 'DESC']],
        transaction: t,
      });

      const total = Math.max(0, subtotal - discount);
      const created = await Order.create({
        cafeId: cafe.id,
        shiftId: activeShift ? activeShift.id : null,
        orderNo: `PB${Date.now().toString().slice(-7)}`,
        customerId: customer.id,
        customerName: name,
        phone,
        table,
        subtotal,
        discount,
        discountType,
        discountValue,
        discountReason,
        discountAuthorizedBy,
        total,
        rewardId,
        paymentMethod,
        paymentStatus,
        paymentTransactionId: req.body.paymentTransactionId || null,
        paymentGatewayMeta: req.body.paymentGatewayMeta || null,
        status,
      }, { transaction: t });

      await OrderItem.bulkCreate(
        normalizedItems.map(i => ({
          orderId: created.id,
          menuItemId: i.menuItemId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          isCompleted: status === 'completed',
          selectedVariant: i.selectedVariant,
          selectedModifiers: i.selectedModifiers,
          notes: i.notes,
        })),
        { transaction: t }
      );

      return created;
    });

    if (order.status === 'completed' && order.paymentStatus === 'paid') {
      await processLoyalty({ order, customer, cafe });
    }

    const fullOrder = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: 'items' }],
    });
    const serialized = serializeOrder(fullOrder);

    broadcastEvent(cafe.id, 'order_created', serialized);

    // Automatically deplete recipe ingredients according to BOM and trigger 86 if needed
    try {
      await depleteInventoryForOrder({ order: fullOrder, cafeId: cafe.id, staffName: req.auth.name || 'Cashier' });
    } catch (invErr) {
      console.warn('Inventory depletion notice:', invErr.message);
    }

    const visitsReq = cafe?.loyaltyVisitsRequired || 8;
    // Reload customer with updated orders and rewards for full CRM sync
    const reloadedCustomer = await Customer.findByPk(customer.id, {
      include: [
        { model: Reward, as: 'rewards' },
        { model: Order, as: 'orders', attributes: ['id', 'total', 'status', 'paymentStatus', 'createdAt'] },
      ],
    });

    return res.status(201).json({
      success: true,
      message: 'Order created successfully from CRM.',
      order: serialized,
      customer: serializeCustomerCRM(reloadedCustomer, visitsReq),
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to create order.' });
  }
});

router.get('/owner/rewards', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const rewards = await Reward.findAll({
    include: [{ model: Customer, where: { cafeId: req.auth.cafe } }],
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
  res.json(rewards.map(r => ({
    ...serializeReward(r),
    customerName: r.Customer?.name || 'Valued Guest',
    customerPhone: r.Customer?.phone || '',
  })));
});

router.post('/owner/rewards/verify', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const code = String(req.body.code || req.body.claimCode || '').trim();
  if (!code) {
    return res.status(400).json({ message: 'Enter a valid claim code or reward ID.' });
  }

  const reward = await Reward.findOne({
    where: {
      [Op.or]: [
        { claimCode: code },
        { claimCode: code.toUpperCase() },
        { id: code },
      ],
    },
    include: [{ model: Customer, where: { cafeId: req.auth.cafe } }],
  });

  if (!reward) {
    return res.status(404).json({ message: 'No reward voucher found matching this code.' });
  }

  const isExpired = reward.expiresAt && new Date(reward.expiresAt) < new Date();
  if (isExpired && reward.status !== 'redeemed') {
    reward.status = 'expired';
    await reward.save();
  }

  const isRedeemable = (reward.status === 'available' || reward.status === 'claimed') && !isExpired;

  return res.json({
    valid: isRedeemable,
    message: isRedeemable
      ? `Valid voucher! Eligible for ${reward.amount} INR discount.`
      : reward.status === 'redeemed'
      ? `This voucher was already redeemed on ${new Date(reward.redeemedAt).toLocaleDateString()}.`
      : 'This voucher has expired.',
    reward: {
      ...serializeReward(reward),
      customerName: reward.Customer?.name || 'Valued Guest',
      customerPhone: reward.Customer?.phone || '',
    },
  });
});

router.post('/owner/rewards/redeem', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const code = String(req.body.code || req.body.claimCode || '').trim();
  const notes = String(req.body.notes || '').trim() || 'Counter staff redemption';

  if (!code) {
    return res.status(400).json({ message: 'Enter a valid claim code or reward ID.' });
  }

  try {
    const result = await sequelize.transaction(async (t) => {
      const reward = await Reward.findOne({
        where: {
          [Op.or]: [
            { claimCode: code },
            { claimCode: code.toUpperCase() },
            { id: code },
          ],
        },
        include: [{ model: Customer, where: { cafeId: req.auth.cafe } }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!reward) {
        throw new Error('No reward voucher found matching this code.');
      }

      if (reward.status === 'redeemed') {
        throw new Error(`Reward already redeemed on ${new Date(reward.redeemedAt).toLocaleString()}.`);
      }

      if (reward.expiresAt && new Date(reward.expiresAt) < new Date()) {
        reward.status = 'expired';
        await reward.save({ transaction: t });
        throw new Error('Reward has expired and cannot be redeemed.');
      }

      reward.status = 'redeemed';
      reward.redeemedAt = new Date();
      reward.redeemedBy = req.auth.name || req.auth.email || `Staff (${req.auth.role || 'counter'})`;
      reward.notes = notes;
      await reward.save({ transaction: t });

      return reward;
    });

    await createAuditLog({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      userName: req.auth.name,
      userRole: req.auth.role,
      action: 'LOYALTY_REWARD_REDEEMED',
      category: 'loyalty',
      status: 'success',
      details: {
        rewardId: result.id,
        claimCode: result.claimCode,
        amount: result.amount,
        customerName: result.Customer?.name,
        customerPhone: result.Customer?.phone,
      },
      req,
    });

    return res.json({
      success: true,
      message: `Reward voucher (${result.claimCode || result.id}) redeemed successfully!`,
      reward: serializeReward(result),
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/* Staff Management Endpoints */
router.get('/owner/staff', requireRole('owner', 'manager'), async (req, res) => {
  const staff = await User.findAll({
    where: { cafeId: req.auth.cafe },
    order: [['createdAt', 'ASC']],
  });
  return res.json(staff.map(serializeUser));
});

router.post('/owner/staff', requireRole('owner', 'manager'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').toLowerCase().trim();
  const phone = cleanPhone(req.body.phone);
  const password = String(req.body.password || '').trim();
  const role = String(req.body.role || 'cashier').toLowerCase().trim();

  if (!name || name.length < 2) {
    return res.status(400).json({ message: 'Full name must be at least 2 characters long.' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const validRoles = ['owner', 'manager', 'cashier', 'kitchen'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: `Invalid role. Allowed roles are: ${validRoles.join(', ')}` });
  }

  // Managers cannot create Owners
  if (role === 'owner' && req.auth.role !== 'owner') {
    return res.status(403).json({ message: 'Only existing cafe owners can add another owner.' });
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: 'A user account with this email address already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const staffMember = await User.create({
    cafeId: req.auth.cafe,
    name,
    email,
    phone,
    passwordHash,
    role,
    status: 'active',
  });

  await createAuditLog({
    cafeId: req.auth.cafe,
    userId: req.auth.sub,
    userName: req.auth.name,
    userRole: req.auth.role,
    action: 'STAFF_CREATED',
    category: 'staff',
    status: 'success',
    details: { id: staffMember.id, name: staffMember.name, email: staffMember.email, role: staffMember.role },
    req,
  });

  return res.status(201).json({
    success: true,
    message: `Staff member ${name} (${role}) created successfully.`,
    staff: serializeUser(staffMember),
  });
});

router.patch('/owner/staff/:id', requireRole('owner', 'manager'), async (req, res) => {
  const target = await User.findOne({
    where: { id: req.params.id, cafeId: req.auth.cafe },
  });

  if (!target) {
    return res.status(404).json({ message: 'Staff member not found.' });
  }

  // Managers cannot edit or alter owners
  if (target.role === 'owner' && req.auth.role !== 'owner') {
    return res.status(403).json({ message: 'Managers cannot modify an Owner account.' });
  }

  // Cannot promote to owner unless actor is owner
  if (req.body.role === 'owner' && req.auth.role !== 'owner') {
    return res.status(403).json({ message: 'Only an Owner can assign the Owner role.' });
  }

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name.length < 2) return res.status(400).json({ message: 'Full name must be at least 2 characters long.' });
    target.name = name;
  }

  if (req.body.phone !== undefined) {
    target.phone = cleanPhone(req.body.phone);
  }

  if (req.body.role !== undefined) {
    const role = String(req.body.role).toLowerCase().trim();
    const validRoles = ['owner', 'manager', 'cashier', 'kitchen'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
    }
    target.role = role;
  }

  if (req.body.status !== undefined) {
    const status = String(req.body.status).toLowerCase().trim();
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: "Status must be either 'active' or 'inactive'." });
    }
    // Prevent self-deactivation
    if (target.id === req.auth.sub && status === 'inactive') {
      return res.status(400).json({ message: 'You cannot deactivate your own account.' });
    }
    target.status = status;
  }

  if (req.body.password) {
    const pass = String(req.body.password).trim();
    if (pass.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }
    target.passwordHash = await bcrypt.hash(pass, 10);
  }

  await target.save();

  await createAuditLog({
    cafeId: req.auth.cafe,
    userId: req.auth.sub,
    userName: req.auth.name,
    userRole: req.auth.role,
    action: 'STAFF_UPDATED',
    category: 'staff',
    status: 'success',
    details: { id: target.id, name: target.name, role: target.role, status: target.status },
    req,
  });

  return res.json({
    success: true,
    message: `Staff member ${target.name} updated successfully.`,
    staff: serializeUser(target),
  });
});

router.delete('/owner/staff/:id', requireRole('owner'), async (req, res) => {
  const target = await User.findOne({
    where: { id: req.params.id, cafeId: req.auth.cafe },
  });

  if (!target) {
    return res.status(404).json({ message: 'Staff member not found.' });
  }

  // Prevent self-deletion
  if (target.id === req.auth.sub) {
    return res.status(400).json({ message: 'You cannot delete your own account.' });
  }

  const staffName = target.name;
  const staffEmail = target.email;
  const staffRole = target.role;

  await target.destroy();

  await createAuditLog({
    cafeId: req.auth.cafe,
    userId: req.auth.sub,
    userName: req.auth.name,
    userRole: req.auth.role,
    action: 'STAFF_DELETED',
    category: 'staff',
    status: 'warning',
    details: { id: req.params.id, name: staffName, email: staffEmail, role: staffRole },
    req,
  });

  return res.json({
    success: true,
    message: `Staff member ${staffName} has been removed.`,
  });
});

router.patch('/owner/cafe', requireRole('owner'), async (req, res) => {
  const allowed = [
    'name', 'phone', 'address', 'tables', 'currency', 'googleReviewUrl', 'instagramUrl',
    'tagline', 'logo', 'bannerImage', 'brandColor', 'wifiSsid', 'wifiPassword',
    'cfdWelcomeTitle', 'cfdWelcomeSubtitle', 'cfdPromoBanner', 'cfdUpiVpa', 'cfdIdleMedia'
  ];
  const update = Object.fromEntries(allowed.filter(k => req.body[k] !== undefined).map(k => [k, req.body[k]]));
  if (req.body.loyalty) {
    const l = req.body.loyalty;
    if (l.enabled !== undefined) update.loyaltyEnabled = l.enabled;
    if (l.visitsRequired !== undefined) update.loyaltyVisitsRequired = l.visitsRequired;
    if (l.minimumSpend !== undefined) update.loyaltyMinimumSpend = l.minimumSpend;
    if (l.rewardCap !== undefined) update.loyaltyRewardCap = l.rewardCap;
    if (l.validityDays !== undefined) update.loyaltyValidityDays = l.validityDays;
  }
  const cafe = await Cafe.findByPk(req.auth.cafe);
  if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });
  await cafe.update(update);
  await cafe.reload({ include: [{ model: MenuItem, as: 'menu' }] });

  await createAuditLog({
    cafeId: req.auth.cafe,
    userId: req.auth.sub,
    userName: req.auth.name,
    userRole: req.auth.role,
    action: 'SETTINGS_CAFE_UPDATED',
    category: 'settings',
    status: 'success',
    details: { updatedFields: Object.keys(update) },
    req,
  });

  res.json(ownerCafe(cafe));
});

router.post('/owner/menu', requireRole('owner', 'manager'), async (req, res) => {
  const item = await MenuItem.create({ ...req.body, cafeId: req.auth.cafe });
  await createAuditLog({
    cafeId: req.auth.cafe,
    userId: req.auth.sub,
    userName: req.auth.name,
    userRole: req.auth.role,
    action: 'MENU_ITEM_CREATED',
    category: 'menu',
    status: 'success',
    details: { id: item.id, name: item.name, price: item.price, category: item.category },
    req,
  });
  res.status(201).json(serializeMenuItem(item));
});

router.patch('/owner/menu/:id', requireRole('owner', 'manager'), async (req, res) => {
  const item = await MenuItem.findOne({ where: { id: req.params.id, cafeId: req.auth.cafe } });
  if (!item) return res.status(404).json({ message: 'Item not found.' });
  await item.update(req.body);
  await createAuditLog({
    cafeId: req.auth.cafe,
    userId: req.auth.sub,
    userName: req.auth.name,
    userRole: req.auth.role,
    action: 'MENU_ITEM_UPDATED',
    category: 'menu',
    status: 'success',
    details: { id: item.id, name: item.name, changes: req.body },
    req,
  });
  res.json(serializeMenuItem(item));
});

router.delete('/owner/menu/:id', requireRole('owner', 'manager'), async (req, res) => {
  const item = await MenuItem.findOne({ where: { id: req.params.id, cafeId: req.auth.cafe } });
  if (!item) return res.status(404).json({ message: 'Item not found.' });
  const itemName = item.name;
  await item.destroy();
  await createAuditLog({
    cafeId: req.auth.cafe,
    userId: req.auth.sub,
    userName: req.auth.name,
    userRole: req.auth.role,
    action: 'MENU_ITEM_DELETED',
    category: 'menu',
    status: 'warning',
    details: { id: req.params.id, name: itemName },
    req,
  });
  res.json({ message: 'Item deleted.' });
});

/* Security, Audit Logs & Sessions Endpoints */
router.get('/owner/audit-logs', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const { category, action, search, status, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * pageSize;

    const where = {
      [Op.or]: [
        { cafeId: req.auth.cafe },
        { cafeId: null, userId: req.auth.sub }
      ]
    };

    if (category && category !== 'all') {
      where.category = category;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (action) {
      where.action = action;
    }

    if (search) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { userName: { [Op.like]: `%${search}%` } },
            { action: { [Op.like]: `%${search}%` } },
            { ipAddress: { [Op.like]: `%${search}%` } },
          ]
        }
      ];
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset,
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [total7d, criticalActionsCount, activeSessionsCount] = await Promise.all([
      AuditLog.count({
        where: {
          ...where,
          createdAt: { [Op.gte]: sevenDaysAgo }
        }
      }),
      AuditLog.count({
        where: {
          ...where,
          action: { [Op.in]: ['STAFF_DELETED', 'STAFF_CREATED', 'AUTH_TOKEN_REUSE_DETECTED', 'AUTH_REVOKE_ALL_SESSIONS', 'SETTINGS_CAFE_UPDATED'] },
        }
      }),
      RefreshToken.count({
        where: {
          userId: req.auth.sub,
          isRevoked: false,
          expiresAt: { [Op.gt]: new Date() }
        }
      })
    ]);

    return res.json({
      logs: rows.map(serializeAuditLog),
      total: count,
      page: pageNum,
      totalPages: Math.ceil(count / pageSize),
      stats: {
        total7d,
        criticalActionsCount,
        activeSessionsCount,
      }
    });
  } catch (err) {
    console.error('Audit logs fetch error:', err);
    return res.status(500).json({ message: err.message || 'Failed to fetch audit logs.' });
  }
});

router.get('/owner/sessions', requireRole('owner', 'manager', 'cashier', 'kitchen'), async (req, res) => {
  try {
    const sessions = await getActiveSessions(req.auth.sub);
    return res.json(sessions);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch sessions.' });
  }
});

router.post('/owner/sessions/revoke-all', requireRole('owner', 'manager', 'cashier', 'kitchen'), async (req, res) => {
  try {
    const count = await revokeAllUserTokens(req.auth.sub);
    await createAuditLog({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      userName: req.auth.name,
      userRole: req.auth.role,
      action: 'AUTH_REVOKE_ALL_SESSIONS',
      category: 'auth',
      status: 'warning',
      details: { revokedCount: count },
      req,
    });
    return res.json({ success: true, message: `Revoked ${count} active session(s).`, revokedCount: count });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to revoke sessions.' });
  }
});

router.delete('/owner/sessions/:id', requireRole('owner', 'manager', 'cashier', 'kitchen'), async (req, res) => {
  try {
    const session = await RefreshToken.findOne({
      where: { id: req.params.id, userId: req.auth.sub }
    });
    if (!session) {
      return res.status(404).json({ message: 'Session grant not found or already invalidated.' });
    }
    await session.update({ isRevoked: true });
    await createAuditLog({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      userName: req.auth.name,
      userRole: req.auth.role,
      action: 'AUTH_REVOKE_SESSION',
      category: 'auth',
      status: 'warning',
      details: { sessionId: req.params.id, ipAddress: session.ipAddress, userAgent: session.userAgent },
      req,
    });
    return res.json({ success: true, message: 'Device session revoked successfully.' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to revoke session.' });
  }
});


router.get('/owner/events', requireRole('owner', 'manager', 'cashier', 'kitchen'), async (req, res) => {
  subscribeClient(req.auth.cafe, res, req, {
    role: req.auth.role || 'staff',
    label: `staff_${req.auth.sub || 'user'}`,
  });
});

router.get('/owner/kds/orders', requireRole('owner', 'manager', 'cashier', 'kitchen'), async (req, res) => {
  const orders = await Order.findAll({
    where: {
      cafeId: req.auth.cafe,
      status: { [Op.in]: ['placed', 'accepted', 'preparing', 'ready', 'completed'] },
    },
    include: [{ model: OrderItem, as: 'items' }],
    order: [['createdAt', 'DESC']],
    limit: 60,
  });
  res.json(orders.map(serializeOrder));
});

router.patch('/owner/orders/:id', requireRole('owner', 'manager', 'cashier', 'kitchen'), async (req, res) => {
  const order = await Order.findOne({ where: { id: req.params.id, cafeId: req.auth.cafe }, include: [{ model: OrderItem, as: 'items' }] });
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (req.body.status) order.status = req.body.status;
  if (req.body.paymentStatus) order.paymentStatus = req.body.paymentStatus;
  await order.save();
  if (order.status === 'completed' && order.paymentStatus === 'paid') {
    const [customer, cafe] = await Promise.all([Customer.findByPk(order.customerId), Cafe.findByPk(order.cafeId)]);
    await processLoyalty({ order, customer, cafe });
  }

  if (order.status === 'cancelled') {
    try {
      await restoreInventoryForOrder({ order, cafeId: req.auth.cafe, staffName: req.auth.name || 'Staff' });
    } catch (invErr) {
      console.warn('Inventory restore notice:', invErr.message);
    }
  }

  const serialized = serializeOrder(order);
  // Broadcast real-time status update to all connected diner and kitchen displays
  broadcastEvent(req.auth.cafe, 'order_updated', serialized);

  res.json(serialized);
});

router.patch('/owner/orders/:id/items/:itemId/toggle', requireRole('owner', 'manager', 'cashier', 'kitchen'), async (req, res) => {
  const order = await Order.findOne({
    where: { id: req.params.id, cafeId: req.auth.cafe },
    include: [{ model: OrderItem, as: 'items' }],
  });
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  const item = (order.items || []).find(i => i.id === req.params.itemId || String(i.id) === String(req.params.itemId));
  if (!item) return res.status(404).json({ message: 'Order item not found.' });

  item.isCompleted = !item.isCompleted;
  await item.save();

  await order.reload({ include: [{ model: OrderItem, as: 'items' }] });
  const serialized = serializeOrder(order);

  // Broadcast real-time item checklist toggle to all connected displays
  broadcastEvent(req.auth.cafe, 'order_updated', serialized);

  res.json(serialized);
});

/* ==========================================================================
   Phase 3: Modular Sub-Routers (Cashier Shifts, Bill Ops, Promo Codes)
   ========================================================================== */
router.use(shiftsRouter);
router.use(billOpsRouter);
router.use(promosRouter);
router.use(inventoryRouter);
router.use(omnichannelRouter);
router.use(hardwareRouter);
router.use(offlineSyncRouter);
router.use(captainRouter);
router.use(gstRouter);
router.use(commissaryRouter);
router.use('/owner/staff-ops', staffOpsRouter);
router.use('/staff-ops', staffOpsRouter);
router.use('/owner/ai-roastery', aiRoasteryRouter);
router.use('/ai-roastery', aiRoasteryRouter);

/* ==========================================================================
   Phase 10: Advanced Table Reservation & Capacity Engine Endpoints
   ========================================================================== */

// Helper to detect table booking conflicts within a duration window (default 90 min)
async function findTableBookingConflict(cafeId, tableId, targetDateTime, durationMinutes = 90, excludeBookingId = null) {
  const targetStart = new Date(targetDateTime).getTime();
  const targetEnd = targetStart + durationMinutes * 60 * 1000;

  // Search bookings within a ±4 hour window around target
  const windowStart = new Date(targetStart - 4 * 60 * 60 * 1000);
  const windowEnd = new Date(targetEnd + 4 * 60 * 60 * 1000);

  const where = {
    cafeId,
    tableId,
    status: { [Op.in]: ['confirmed', 'seated'] },
    dateTime: { [Op.between]: [windowStart, windowEnd] },
  };
  if (excludeBookingId) {
    where.id = { [Op.ne]: excludeBookingId };
  }

  const existingBookings = await Booking.findAll({ where });
  for (const b of existingBookings) {
    const bStart = new Date(b.dateTime).getTime();
    const bDuration = (b.durationMinutes || 90) * 60 * 1000;
    const bEnd = bStart + bDuration;

    // Check overlap: max(start1, start2) < min(end1, end2)
    if (Math.max(targetStart, bStart) < Math.min(targetEnd, bEnd)) {
      return b; // Conflicting booking found
    }
  }
  return null;
}

// 1. GET /api/owner/tables - List tables with real-time status and active bookings
router.get('/owner/tables', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const tables = await CafeTable.findAll({
    where: { cafeId, isActive: true },
    order: [['tableNumber', 'ASC']],
  });

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const todayBookings = await Booking.findAll({
    where: {
      cafeId,
      status: { [Op.in]: ['pending', 'confirmed', 'seated'] },
      dateTime: { [Op.between]: [todayStart, todayEnd] },
    },
    order: [['dateTime', 'ASC']],
  });

  const activeTableBookings = await Booking.findAll({
    where: {
      cafeId,
      status: { [Op.in]: ['seated', 'confirmed'] },
    },
    order: [['dateTime', 'DESC']],
  });

  const serializedTables = tables.map(t => {
    const tableJson = serializeTable(t);
    tableJson.todayBookings = todayBookings
      .filter(b => b.tableId === t.id)
      .map(serializeBooking);

    const curB = activeTableBookings.find(b => 
      (t.currentBookingId && b.id === t.currentBookingId) ||
      (b.tableId === t.id && (b.status === 'seated' || (t.status === 'reserved' && b.status === 'confirmed'))) ||
      (String(b.tableNumber) === String(t.tableNumber) && (b.status === 'seated' || (t.status === 'reserved' && b.status === 'confirmed')))
    );
    if (curB) {
      tableJson.currentBooking = serializeBooking(curB);
      if (!tableJson.currentBookingId) {
        tableJson.currentBookingId = curB.id;
      }
    }
    return tableJson;
  });

  res.json(serializedTables);
});

// 2. POST /api/owner/tables - Create a new table
router.post('/owner/tables', requireRole('owner', 'manager'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const { tableNumber, name, capacity, section } = req.body;

  if (!tableNumber) {
    return res.status(400).json({ message: 'Table number is required.' });
  }

  const existing = await CafeTable.findOne({ where: { cafeId, tableNumber: String(tableNumber).trim() } });
  if (existing) {
    return res.status(400).json({ message: `Table ${tableNumber} already exists in your floor plan.` });
  }

  const table = await CafeTable.create({
    cafeId,
    tableNumber: String(tableNumber).trim(),
    name: name ? String(name).trim() : `Table ${tableNumber}`,
    capacity: Math.max(1, Math.min(30, Number(capacity) || 4)),
    section: section || 'Main Floor',
    status: 'available',
    isActive: true,
  });

  await createAuditLog({
    cafeId,
    userId: req.auth.sub,
    userName: req.auth.name || 'Owner/Manager',
    userRole: req.auth.role || 'manager',
    action: 'TABLE_CREATED',
    category: 'settings',
    details: { tableNumber: table.tableNumber, name: table.name, capacity: table.capacity, section: table.section },
    status: 'success',
    req,
  });

  const serialized = serializeTable(table);
  broadcastEvent(cafeId, 'table_updated', serialized);
  res.status(201).json(serialized);
});

// 3. PATCH /api/owner/tables/:id - Update table configuration or status
router.patch('/owner/tables/:id', requireRole('owner', 'manager'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const table = await CafeTable.findOne({ where: { id: req.params.id, cafeId } });
  if (!table) return res.status(404).json({ message: 'Table not found.' });

  const { tableNumber, name, capacity, section, status, isActive } = req.body;
  if (tableNumber !== undefined) table.tableNumber = String(tableNumber).trim();
  if (name !== undefined) table.name = String(name).trim();
  if (capacity !== undefined) table.capacity = Math.max(1, Math.min(30, Number(capacity)));
  if (section !== undefined) table.section = section;
  if (status !== undefined) table.status = status;
  if (isActive !== undefined) table.isActive = Boolean(isActive);

  await table.save();

  await createAuditLog({
    cafeId,
    userId: req.auth.sub,
    userName: req.auth.name || 'Owner/Manager',
    userRole: req.auth.role || 'manager',
    action: 'TABLE_UPDATED',
    category: 'settings',
    details: { tableId: table.id, tableNumber: table.tableNumber, status: table.status },
    status: 'success',
    req,
  });

  const serialized = serializeTable(table);
  broadcastEvent(cafeId, 'table_updated', serialized);
  res.json(serialized);
});

// 4. DELETE /api/owner/tables/:id - Remove table
router.delete('/owner/tables/:id', requireRole('owner', 'manager'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const table = await CafeTable.findOne({ where: { id: req.params.id, cafeId } });
  if (!table) return res.status(404).json({ message: 'Table not found.' });

  if (table.status === 'occupied') {
    return res.status(400).json({ message: 'Cannot delete an occupied table with active dining.' });
  }

  await table.destroy();

  await createAuditLog({
    cafeId,
    userId: req.auth.sub,
    userName: req.auth.name || 'Owner/Manager',
    userRole: req.auth.role || 'manager',
    action: 'TABLE_DELETED',
    category: 'settings',
    details: { tableNumber: table.tableNumber, name: table.name },
    status: 'warning',
    req,
  });

  broadcastEvent(cafeId, 'table_updated', { id: table.id, deleted: true });
  res.json({ success: true, message: `Table ${table.tableNumber} removed.` });
});

// 5. POST /api/owner/tables/:id/free - 1-Click Release/Free Table
router.post('/owner/tables/:id/free', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const table = await CafeTable.findOne({ where: { id: req.params.id, cafeId } });
  if (!table) return res.status(404).json({ message: 'Table not found.' });

  if (table.currentBookingId) {
    const b = await Booking.findOne({ where: { id: table.currentBookingId, cafeId } });
    if (b && b.status === 'seated') {
      b.status = 'completed';
      b.completedAt = new Date();
      await b.save();
      broadcastEvent(cafeId, 'booking_updated', serializeBooking(b));
    }
  }

  table.status = 'available';
  table.currentBookingId = null;
  await table.save();

  const serialized = serializeTable(table);
  broadcastEvent(cafeId, 'table_updated', serialized);
  res.json({ success: true, message: `Table ${table.tableNumber} is now available.`, table: serialized });
});

// 5b. POST /api/owner/tables/:id/seat - 1-Click Seat Table (handles both reserved booking & immediate walk-in)
router.post('/owner/tables/:id/seat', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const table = await CafeTable.findOne({ where: { id: req.params.id, cafeId } });
  if (!table) return res.status(404).json({ message: 'Table not found.' });

  if (table.status === 'occupied') {
    return res.status(400).json({ message: `Table ${table.tableNumber} is already occupied.` });
  }

  // Check if there is an existing confirmed/reserved booking for this table
  let booking = null;
  if (table.currentBookingId) {
    booking = await Booking.findOne({ where: { id: table.currentBookingId, cafeId } });
  }
  if (!booking) {
    booking = await Booking.findOne({
      where: {
        cafeId,
        tableId: table.id,
        status: { [Op.in]: ['confirmed', 'pending'] }
      },
      order: [['dateTime', 'DESC']]
    });
  }
  if (!booking) {
    booking = await Booking.findOne({
      where: {
        cafeId,
        tableNumber: table.tableNumber,
        status: { [Op.in]: ['confirmed', 'pending'] }
      },
      order: [['dateTime', 'DESC']]
    });
  }

  const now = new Date();

  if (booking) {
    booking.status = 'seated';
    booking.seatedAt = now;
    if (!booking.tableId) booking.tableId = table.id;
    if (!booking.tableNumber) booking.tableNumber = table.tableNumber;
    await booking.save();
  } else {
    // Create immediate seated walk-in
    booking = await Booking.create({
      cafeId,
      name: `Guest (T-${table.tableNumber})`,
      phone: '0000000000',
      guests: table.capacity || 2,
      dateTime: now,
      durationMinutes: 90,
      tableId: table.id,
      tableNumber: table.tableNumber,
      note: 'Immediate seated dining',
      status: 'seated',
      seatedAt: now,
      source: 'walk-in',
    });
  }

  table.status = 'occupied';
  table.currentBookingId = booking.id;
  await table.save();

  await createAuditLog({
    cafeId,
    userId: req.auth.sub,
    userName: req.auth.name || 'Staff Member',
    userRole: req.auth.role || 'cashier',
    action: 'TABLE_SEATED',
    category: 'order',
    details: { tableId: table.id, tableNumber: table.tableNumber, bookingId: booking.id, guestName: booking.name },
    status: 'success',
    req,
  });

  const serializedBooking = serializeBooking(booking);
  const serializedTable = serializeTable(table);

  broadcastEvent(cafeId, 'booking_updated', serializedBooking);
  broadcastEvent(cafeId, 'table_updated', serializedTable);

  res.json({ success: true, message: `Table T-${table.tableNumber} is now seated with ${booking.name}.`, booking: serializedBooking, table: serializedTable });
});

// 6. GET /api/owner/bookings - List reservations with filters and daily stats
router.get('/owner/bookings', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const { date, status, tableId, search } = req.query;

  const where = { cafeId };

  if (status && status !== 'all') {
    where.status = status;
  }

  if (tableId) {
    where.tableId = tableId;
  }

  if (date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    where.dateTime = { [Op.between]: [dayStart, dayEnd] };
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
      { note: { [Op.like]: `%${search}%` } },
    ];
  }

  const bookings = await Booking.findAll({
    where,
    order: [['dateTime', 'ASC']],
    include: [{ model: CafeTable, as: 'table' }],
  });

  const serialized = bookings.map(serializeBooking);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const todayBookings = await Booking.findAll({
    where: { cafeId, dateTime: { [Op.between]: [todayStart, todayEnd] } },
  });

  const stats = {
    todayTotal: todayBookings.length,
    todaySeated: todayBookings.filter(b => b.status === 'seated').length,
    todayConfirmed: todayBookings.filter(b => b.status === 'confirmed').length,
    todayPending: todayBookings.filter(b => b.status === 'pending').length,
  };

  res.json({ bookings: serialized, stats });
});

// 7. POST /api/owner/bookings - Create advance booking with conflict detection
router.post('/owner/bookings', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const { name, phone, guests, dateTime, durationMinutes, tableId, note, status, force } = req.body;

  const cleanedPhone = cleanPhone(phone);
  if (!name || cleanedPhone.length !== 10 || !dateTime) {
    return res.status(400).json({ message: 'Name, 10-digit phone, and reservation date/time are required.' });
  }

  let assignedTable = null;
  if (tableId) {
    assignedTable = await CafeTable.findOne({ where: { id: tableId, cafeId } });
    if (!assignedTable) return res.status(400).json({ message: 'Selected table not found.' });

    if (!force) {
      const conflict = await findTableBookingConflict(cafeId, tableId, dateTime, durationMinutes || 90);
      if (conflict) {
        return res.status(409).json({
          code: 'TABLE_CONFLICT',
          message: `Table ${assignedTable.tableNumber} already has a reservation (${conflict.name}) during this time window.`,
          conflictingBooking: serializeBooking(conflict),
        });
      }
    }
  }

  const bookingStatus = status || (assignedTable ? 'confirmed' : 'pending');

  const b = await Booking.create({
    cafeId,
    name: String(name).trim(),
    phone: cleanedPhone,
    guests: Math.max(1, Math.min(30, Number(guests) || 2)),
    dateTime: new Date(dateTime),
    durationMinutes: Number(durationMinutes) || 90,
    tableId: assignedTable ? assignedTable.id : null,
    tableNumber: assignedTable ? assignedTable.tableNumber : null,
    note: note ? String(note).trim() : null,
    status: bookingStatus,
    source: 'staff',
  });

  if (assignedTable && bookingStatus === 'seated') {
    b.seatedAt = new Date();
    await b.save();
    assignedTable.status = 'occupied';
    assignedTable.currentBookingId = b.id;
    await assignedTable.save();
    broadcastEvent(cafeId, 'table_updated', serializeTable(assignedTable));
  } else if (assignedTable && bookingStatus === 'confirmed') {
    assignedTable.status = 'reserved';
    assignedTable.currentBookingId = b.id;
    await assignedTable.save();
    broadcastEvent(cafeId, 'table_updated', serializeTable(assignedTable));
  }

  await createAuditLog({
    cafeId,
    userId: req.auth.sub,
    userName: req.auth.name || 'Staff Member',
    userRole: req.auth.role || 'cashier',
    action: 'BOOKING_CREATED',
    category: 'order',
    details: { bookingId: b.id, name: b.name, phone: b.phone, guests: b.guests, tableNumber: b.tableNumber, status: b.status },
    status: 'success',
    req,
  });

  const serialized = serializeBooking(b);
  broadcastEvent(cafeId, 'booking_created', serialized);
  res.status(201).json(serialized);
});

// 8. POST /api/owner/bookings/quick-walkin - 1-Click Walk-In Seating
router.post('/owner/bookings/quick-walkin', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const { tableId, guests, name, phone, note } = req.body;

  if (!tableId) return res.status(400).json({ message: 'Table is required for walk-in seating.' });

  const table = await CafeTable.findOne({ where: { id: tableId, cafeId } });
  if (!table) return res.status(404).json({ message: 'Table not found.' });

  if (table.status === 'occupied') {
    return res.status(400).json({ message: `Table ${table.tableNumber} is already occupied.` });
  }

  const now = new Date();
  const b = await Booking.create({
    cafeId,
    name: name ? String(name).trim() : `Walk-In Guest (T-${table.tableNumber})`,
    phone: phone ? cleanPhone(phone) : '0000000000',
    guests: Math.max(1, Math.min(30, Number(guests) || table.capacity || 2)),
    dateTime: now,
    durationMinutes: 90,
    tableId: table.id,
    tableNumber: table.tableNumber,
    note: note ? String(note).trim() : 'Immediate walk-in dining',
    status: 'seated',
    seatedAt: now,
    source: 'walk-in',
  });

  table.status = 'occupied';
  table.currentBookingId = b.id;
  await table.save();

  await createAuditLog({
    cafeId,
    userId: req.auth.sub,
    userName: req.auth.name || 'Staff Member',
    userRole: req.auth.role || 'cashier',
    action: 'BOOKING_WALKIN_SEATED',
    category: 'order',
    details: { bookingId: b.id, tableNumber: table.tableNumber, guests: b.guests },
    status: 'success',
    req,
  });

  const serializedBooking = serializeBooking(b);
  const serializedTable = serializeTable(table);

  broadcastEvent(cafeId, 'booking_created', serializedBooking);
  broadcastEvent(cafeId, 'table_updated', serializedTable);

  res.status(201).json({ booking: serializedBooking, table: serializedTable });
});

// 9. PATCH /api/owner/bookings/:id/status - Status State Machine Transition
router.patch('/owner/bookings/:id/status', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const b = await Booking.findOne({ where: { id: req.params.id, cafeId } });
  if (!b) return res.status(404).json({ message: 'Booking not found.' });

  const oldStatus = b.status;
  const newStatus = req.body.status;

  const validStatuses = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no-show'];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  b.status = newStatus;

  let table = null;
  if (b.tableId) {
    table = await CafeTable.findOne({ where: { id: b.tableId, cafeId } });
  }

  if (newStatus === 'seated') {
    b.seatedAt = new Date();
    if (!table && b.tableNumber) {
      table = await CafeTable.findOne({ where: { tableNumber: b.tableNumber, cafeId } });
      if (table) b.tableId = table.id;
    }
    if (table) {
      table.status = 'occupied';
      table.currentBookingId = b.id;
      await table.save();
      broadcastEvent(cafeId, 'table_updated', serializeTable(table));
    }
  } else if (newStatus === 'completed') {
    b.completedAt = new Date();
    if (table && table.currentBookingId === b.id) {
      table.status = 'available';
      table.currentBookingId = null;
      await table.save();
      broadcastEvent(cafeId, 'table_updated', serializeTable(table));
    }
  } else if (newStatus === 'cancelled' || newStatus === 'no-show') {
    if (table && (table.currentBookingId === b.id || table.status === 'reserved')) {
      table.status = 'available';
      table.currentBookingId = null;
      await table.save();
      broadcastEvent(cafeId, 'table_updated', serializeTable(table));
    }
  } else if (newStatus === 'confirmed') {
    if (table && (table.status === 'available' || table.status === 'reserved')) {
      table.status = 'reserved';
      table.currentBookingId = b.id;
      await table.save();
      broadcastEvent(cafeId, 'table_updated', serializeTable(table));
    }
  }

  await b.save();

  await createAuditLog({
    cafeId,
    userId: req.auth.sub,
    userName: req.auth.name || 'Staff Member',
    userRole: req.auth.role || 'cashier',
    action: 'BOOKING_STATUS_CHANGED',
    category: 'order',
    details: { bookingId: b.id, oldStatus, newStatus, tableNumber: b.tableNumber },
    status: 'success',
    req,
  });

  const serialized = serializeBooking(b);
  broadcastEvent(cafeId, 'booking_updated', serialized);
  res.json(serialized);
});

// 10. PATCH /api/owner/bookings/:id/assign-table - Table allocation with conflict checking
router.patch('/owner/bookings/:id/assign-table', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const b = await Booking.findOne({ where: { id: req.params.id, cafeId } });
  if (!b) return res.status(404).json({ message: 'Booking not found.' });

  const { tableId, force } = req.body;

  if (!tableId) {
    if (b.tableId) {
      const oldTable = await CafeTable.findOne({ where: { id: b.tableId, cafeId } });
      if (oldTable && oldTable.currentBookingId === b.id) {
        oldTable.status = 'available';
        oldTable.currentBookingId = null;
        await oldTable.save();
        broadcastEvent(cafeId, 'table_updated', serializeTable(oldTable));
      }
    }
    b.tableId = null;
    b.tableNumber = null;
    await b.save();
    const serialized = serializeBooking(b);
    broadcastEvent(cafeId, 'booking_updated', serialized);
    return res.json(serialized);
  }

  const table = await CafeTable.findOne({ where: { id: tableId, cafeId } });
  if (!table) return res.status(404).json({ message: 'Table not found.' });

  if (!force) {
    const conflict = await findTableBookingConflict(cafeId, tableId, b.dateTime, b.durationMinutes || 90, b.id);
    if (conflict) {
      return res.status(409).json({
        code: 'TABLE_CONFLICT',
        message: `Table ${table.tableNumber} already has a reservation (${conflict.name}) during this time slot.`,
        conflictingBooking: serializeBooking(conflict),
      });
    }
  }

  b.tableId = table.id;
  b.tableNumber = table.tableNumber;
  if (b.status === 'pending') {
    b.status = 'confirmed';
  }

  if (b.status === 'seated') {
    table.status = 'occupied';
    table.currentBookingId = b.id;
    await table.save();
    broadcastEvent(cafeId, 'table_updated', serializeTable(table));
  } else if (b.status === 'confirmed' && (table.status === 'available' || table.status === 'reserved')) {
    table.status = 'reserved';
    table.currentBookingId = b.id;
    await table.save();
    broadcastEvent(cafeId, 'table_updated', serializeTable(table));
  }

  await b.save();

  await createAuditLog({
    cafeId,
    userId: req.auth.sub,
    userName: req.auth.name || 'Staff Member',
    userRole: req.auth.role || 'cashier',
    action: 'BOOKING_TABLE_ASSIGNED',
    category: 'order',
    details: { bookingId: b.id, tableNumber: table.tableNumber, partySize: b.guests },
    status: 'success',
    req,
  });

  const serialized = serializeBooking(b);
  broadcastEvent(cafeId, 'booking_updated', serialized);
  res.json(serialized);
});

// Backward-compatible PATCH /api/owner/bookings/:id
router.patch('/owner/bookings/:id', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const b = await Booking.findOne({ where: { id: req.params.id, cafeId } });
  if (!b) return res.status(404).json({ message: 'Booking not found.' });

  const oldStatus = b.status;
  if (req.body.status) b.status = req.body.status;
  if (req.body.note !== undefined) b.note = req.body.note;
  if (req.body.guests) b.guests = Number(req.body.guests);

  let table = null;
  if (b.tableId) {
    table = await CafeTable.findOne({ where: { id: b.tableId, cafeId } });
  }

  if (req.body.status && req.body.status !== oldStatus) {
    if (req.body.status === 'seated') {
      b.seatedAt = new Date();
      if (table) {
        table.status = 'occupied';
        table.currentBookingId = b.id;
        await table.save();
        broadcastEvent(cafeId, 'table_updated', serializeTable(table));
      }
    } else if (req.body.status === 'completed') {
      b.completedAt = new Date();
      if (table && table.currentBookingId === b.id) {
        table.status = 'available';
        table.currentBookingId = null;
        await table.save();
        broadcastEvent(cafeId, 'table_updated', serializeTable(table));
      }
    } else if (req.body.status === 'cancelled' || req.body.status === 'no-show') {
      if (table && (table.currentBookingId === b.id || table.status === 'reserved')) {
        table.status = 'available';
        table.currentBookingId = null;
        await table.save();
        broadcastEvent(cafeId, 'table_updated', serializeTable(table));
      }
    }
  }

  await b.save();
  const serialized = serializeBooking(b);
  broadcastEvent(cafeId, 'booking_updated', serialized);
  res.json(serialized);
});

/* ==========================================================================
   Phase 4: Automated Reminder & Notification Engine Endpoints
   ========================================================================== */

router.get('/owner/reminders/summary', requireRole('owner', 'manager'), async (req, res) => {
  const cafeId = req.auth.cafe;
  const [totalRules, activeRules, totalSent, recentLogs] = await Promise.all([
    ReminderRule.count({ where: { cafeId } }),
    ReminderRule.count({ where: { cafeId, enabled: true } }),
    NotificationLog.count({ where: { cafeId } }),
    NotificationLog.findAll({
      where: { cafeId },
      order: [['sentAt', 'DESC']],
      limit: 10,
    }),
  ]);

  const audience = await scanAudienceForCafe(cafeId);

  res.json({
    totalRules,
    activeRules,
    totalSent,
    readyAudience: audience.stats.ready,
    cooldownAudience: audience.stats.inCooldown,
    totalCandidates: audience.stats.totalCandidates,
    recentLogs: recentLogs.map(serializeNotificationLog),
  });
});

router.get('/owner/reminders/rules', requireRole('owner', 'manager'), async (req, res) => {
  const rules = await ReminderRule.findAll({
    where: { cafeId: req.auth.cafe },
    order: [['createdAt', 'ASC']],
  });
  res.json(rules.map(serializeReminderRule));
});

router.post('/owner/reminders/rules', requireRole('owner', 'manager'), async (req, res) => {
  const { name, triggerType, daysThreshold, channel, messageTemplate, cooldownDays, enabled } = req.body;
  if (!name || !triggerType || !messageTemplate) {
    return res.status(400).json({ message: 'Name, trigger type, and message template are required.' });
  }

  const rule = await ReminderRule.create({
    cafeId: req.auth.cafe,
    name: String(name).trim(),
    triggerType,
    daysThreshold: Number(daysThreshold) >= 0 ? Number(daysThreshold) : 7,
    channel: channel || 'whatsapp',
    messageTemplate: String(messageTemplate).trim(),
    cooldownDays: Number(cooldownDays) >= 0 ? Number(cooldownDays) : 7,
    enabled: enabled !== undefined ? Boolean(enabled) : true,
  });

  res.status(201).json(serializeReminderRule(rule));
});

router.patch('/owner/reminders/rules/:id', requireRole('owner', 'manager'), async (req, res) => {
  const rule = await ReminderRule.findOne({ where: { id: req.params.id, cafeId: req.auth.cafe } });
  if (!rule) return res.status(404).json({ message: 'Reminder rule not found.' });

  const allowed = ['name', 'triggerType', 'daysThreshold', 'channel', 'messageTemplate', 'cooldownDays', 'enabled'];
  const update = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      if (field === 'enabled') {
        update[field] = Boolean(req.body[field]);
      } else if (field === 'daysThreshold' || field === 'cooldownDays') {
        update[field] = Number(req.body[field]);
      } else {
        update[field] = req.body[field];
      }
    }
  }

  await rule.update(update);
  res.json(serializeReminderRule(rule));
});

router.delete('/owner/reminders/rules/:id', requireRole('owner', 'manager'), async (req, res) => {
  const rule = await ReminderRule.findOne({ where: { id: req.params.id, cafeId: req.auth.cafe } });
  if (!rule) return res.status(404).json({ message: 'Reminder rule not found.' });
  await rule.destroy();
  res.json({ success: true, message: `Rule "${rule.name}" deleted successfully.` });
});

router.get('/owner/reminders/audience', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const result = await scanAudienceForCafe(req.auth.cafe);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/owner/reminders/dispatch-single', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const { customerId, ruleId, triggerType, channel, message, force } = req.body;
  if (!customerId) {
    return res.status(400).json({ message: 'Customer ID is required.' });
  }

  try {
    const result = await dispatchReminder({
      cafeId: req.auth.cafe,
      customerId,
      ruleId,
      triggerType,
      channel,
      message,
      force: Boolean(force),
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({
      message: err.message,
      cooldownUntil: err.cooldownUntil,
    });
  }
});

router.post('/owner/reminders/run-batch', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const result = await runBatchReminders({ cafeId: req.auth.cafe });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/owner/reminders/logs', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const logs = await NotificationLog.findAll({
    where: { cafeId: req.auth.cafe },
    order: [['sentAt', 'DESC']],
    limit: 100,
  });
  res.json(logs.map(serializeNotificationLog));
});

/* ==========================================================================
   Phase 5: Trend Analytics & Customer Retention Engine Endpoints
   ========================================================================== */

router.get('/owner/analytics', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const range = req.query.range || '30d';
    const analytics = await getCafeAnalytics({
      cafeId: req.auth.cafe,
      range,
    });
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to generate analytics' });
  }
});

router.get('/owner/analytics/export/orders.csv', requireRole('owner', 'manager'), async (req, res) => {
  try {
    let cafe = await Cafe.findByPk(req.auth.cafe);
    if (!cafe) cafe = await Cafe.findOne({ where: { slug: req.auth.cafe } });
    if (!cafe) return res.status(404).json({ message: 'Cafe not found' });

    const orders = await Order.findAll({
      where: { cafeId: cafe.id },
      include: [{ model: OrderItem, as: 'items', required: false }],
      order: [['createdAt', 'DESC']],
    });

    const csvData = formatOrdersCSV(orders);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${cafe.slug}_orders_${Date.now()}.csv"`);
    res.send(csvData);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to export orders' });
  }
});

router.get('/owner/analytics/export/customers.csv', requireRole('owner', 'manager'), async (req, res) => {
  try {
    let cafe = await Cafe.findByPk(req.auth.cafe);
    if (!cafe) cafe = await Cafe.findOne({ where: { slug: req.auth.cafe } });
    if (!cafe) return res.status(404).json({ message: 'Cafe not found' });

    const customers = await Customer.findAll({
      where: { cafeId: cafe.id },
      include: [
        { model: Order, as: 'orders', where: { paymentStatus: 'paid' }, required: false },
        { model: Reward, as: 'rewards', required: false },
      ],
      order: [['createdAt', 'DESC']],
    });

    const csvData = formatCustomersCSV(customers, cafe.loyaltyVisitsRequired || 8);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${cafe.slug}_customers_${Date.now()}.csv"`);
    res.send(csvData);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to export customers' });
  }
});

/* ==========================================================================
   Phase 7: Diner Rating & Google Review Booster Endpoints
   ========================================================================== */

router.post('/public/cafes/:slug/feedback', async (req, res) => {
  try {
    const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
    if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });

    const rating = Math.min(5, Math.max(1, parseInt(req.body.rating, 10) || 5));
    const sentiment = rating >= 4 ? 'positive' : 'critical';
    const comment = String(req.body.comment || '').trim();
    const aspects = Array.isArray(req.body.aspects) ? req.body.aspects : [];
    const isPublic = Boolean(req.body.isPublic);
    const customerPhone = cleanPhone(req.body.customerPhone || req.body.phone || '');
    const customerName = String(req.body.customerName || req.body.name || '').trim() || 'Valued Guest';
    const orderId = req.body.orderId || null;

    let customerId = null;
    if (customerPhone) {
      const customer = await Customer.findOne({ where: { cafeId: cafe.id, phone: customerPhone } });
      if (customer) customerId = customer.id;
    }

    // If orderId is provided, check if feedback already exists for this order
    if (orderId) {
      const existing = await Feedback.findOne({
        where: { orderId, cafeId: cafe.id },
        include: [{ model: Order, as: 'Order', attributes: ['id', 'orderNo', 'total'], required: false }],
      });
      if (existing) {
        await existing.update({
          rating,
          sentiment,
          aspects,
          comment,
          isPublic,
          customerName: customerName || existing.customerName,
          customerPhone: customerPhone || existing.customerPhone,
        });
        const serialized = serializeFeedback(existing);
        broadcastEvent(cafe.id, 'feedback_updated', serialized);
        return res.json({
          ok: true,
          updated: true,
          feedback: serialized,
          googleReviewUrl: cafe.googleReviewUrl,
        });
      }
    }

    const feedback = await Feedback.create({
      rating,
      sentiment,
      aspects,
      comment,
      customerName,
      customerPhone,
      isPublic,
      status: 'new',
      orderId,
      customerId,
      cafeId: cafe.id,
    });

    const populated = await Feedback.findByPk(feedback.id, {
      include: [{ model: Order, as: 'Order', attributes: ['id', 'orderNo', 'total'], required: false }],
    });

    const serialized = serializeFeedback(populated || feedback);
    broadcastEvent(cafe.id, 'feedback_received', serialized);

    return res.status(201).json({
      ok: true,
      feedback: serialized,
      googleReviewUrl: cafe.googleReviewUrl,
    });
  } catch (err) {
    console.error('Error submitting feedback:', err);
    return res.status(500).json({ message: err.message || 'Failed to submit feedback' });
  }
});

router.get('/public/cafes/:slug/orders/:orderId/feedback', async (req, res) => {
  try {
    const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
    if (!cafe) return res.status(404).json({ message: 'Cafe not found.' });

    const feedback = await Feedback.findOne({
      where: { orderId: req.params.orderId, cafeId: cafe.id },
      include: [{ model: Order, as: 'Order', attributes: ['id', 'orderNo', 'total'], required: false }],
    });
    if (!feedback) return res.json({ feedback: null });
    return res.json({ feedback: serializeFeedback(feedback) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/owner/feedback', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const where = { cafeId: req.auth.cafe };
    if (req.query.sentiment && req.query.sentiment !== 'all') {
      where.sentiment = req.query.sentiment;
    }
    if (req.query.status && req.query.status !== 'all') {
      where.status = req.query.status;
    }
    if (req.query.rating && req.query.rating !== 'all') {
      where.rating = parseInt(req.query.rating, 10);
    }

    const allCafeFeedbacks = await Feedback.findAll({
      where: { cafeId: req.auth.cafe },
      include: [{ model: Order, as: 'Order', attributes: ['id', 'orderNo', 'total'], required: false }],
      order: [['createdAt', 'DESC']],
    });

    // Compute comprehensive statistics
    const totalReviews = allCafeFeedbacks.length;
    const sumRatings = allCafeFeedbacks.reduce((acc, f) => acc + (f.rating || 0), 0);
    const averageRating = totalReviews > 0 ? Number((sumRatings / totalReviews).toFixed(1)) : 5.0;
    const positiveCount = allCafeFeedbacks.filter(f => f.rating >= 4).length;
    const criticalCount = allCafeFeedbacks.filter(f => f.rating < 4).length;
    const unresolvedCount = allCafeFeedbacks.filter(f => f.sentiment === 'critical' && f.status !== 'resolved').length;
    const positivePercent = totalReviews > 0 ? Math.round((positiveCount / totalReviews) * 100) : 100;

    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const aspectBreakdown = {};

    allCafeFeedbacks.forEach(f => {
      if (ratingCounts[f.rating] !== undefined) ratingCounts[f.rating]++;
      const aspects = Array.isArray(f.aspects) ? f.aspects : (typeof f.aspects === 'string' ? JSON.parse(f.aspects || '[]') : []);
      aspects.forEach(asp => {
        aspectBreakdown[asp] = (aspectBreakdown[asp] || 0) + 1;
      });
    });

    // Filtered list for response
    const filteredFeedbacks = await Feedback.findAll({
      where,
      include: [{ model: Order, as: 'Order', attributes: ['id', 'orderNo', 'total'], required: false }],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    res.json({
      feedbacks: filteredFeedbacks.map(serializeFeedback),
      stats: {
        averageRating,
        totalReviews,
        positiveCount,
        criticalCount,
        positivePercent,
        unresolvedCount,
        ratingCounts,
        aspectBreakdown,
      },
    });
  } catch (err) {
    console.error('Error fetching owner feedback:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch feedback.' });
  }
});

router.patch('/owner/feedback/:id', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const feedback = await Feedback.findOne({
      where: { id: req.params.id, cafeId: req.auth.cafe },
      include: [{ model: Order, as: 'Order', attributes: ['id', 'orderNo', 'total'], required: false }],
    });
    if (!feedback) return res.status(404).json({ message: 'Feedback record not found.' });

    const allowed = ['status', 'resolutionNotes'];
    const updateData = {};
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.resolutionNotes !== undefined) updateData.resolutionNotes = req.body.resolutionNotes;

    if (req.body.status === 'resolved') {
      updateData.resolvedAt = new Date();
      const staffUser = await User.findByPk(req.auth.sub);
      updateData.resolvedBy = staffUser?.name || 'Staff Member';
    }

    await feedback.update(updateData);
    const serialized = serializeFeedback(feedback);
    broadcastEvent(req.auth.cafe, 'feedback_updated', serialized);
    res.json(serialized);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update feedback.' });
  }
});

export { serializeCustomerCRM, serializeFeedback, serializeInventoryItem, serializeOrder, serializePromoCode, serializeRecipeItem, serializeShift, serializeStockLedger };
export default router;

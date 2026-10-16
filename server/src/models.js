import { DataTypes, Sequelize } from 'sequelize';
import { sequelize } from './db.js';

const uuidPk = { id: { type: DataTypes.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true } };

export const Cafe = sequelize.define('Cafe', {
  ...uuidPk,
  name: DataTypes.STRING,
  slug: { type: DataTypes.STRING, unique: true },
  phone: DataTypes.STRING,
  address: DataTypes.STRING,
  currency: { type: DataTypes.STRING, defaultValue: 'INR' },
  tables: { type: DataTypes.INTEGER, defaultValue: 12 },
  loyaltyEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  loyaltyVisitsRequired: { type: DataTypes.INTEGER, defaultValue: 8 },
  loyaltyMinimumSpend: { type: DataTypes.INTEGER, defaultValue: 300 },
  loyaltyRewardCap: { type: DataTypes.INTEGER, defaultValue: 1000 },
  loyaltyValidityDays: { type: DataTypes.INTEGER, defaultValue: 60 },
  googleReviewUrl: DataTypes.STRING(500),
  instagramUrl: DataTypes.STRING(500),
  tagline: DataTypes.STRING(255),
  logo: DataTypes.TEXT('long'),
  bannerImage: DataTypes.TEXT('long'),
  brandColor: { type: DataTypes.STRING(50), defaultValue: '#ea580c' },
  wifiSsid: DataTypes.STRING(100),
  wifiPassword: DataTypes.STRING(100),
  brandId: { type: DataTypes.UUID, allowNull: true },
  cfdWelcomeTitle: { type: DataTypes.STRING(255), defaultValue: 'Gusstora Specialty Coffee' },
  cfdWelcomeSubtitle: { type: DataTypes.STRING(255), defaultValue: 'Handcrafted Roasts & Fresh Bakes' },
  cfdPromoBanner: { type: DataTypes.STRING(500), allowNull: true },
  cfdUpiVpa: { type: DataTypes.STRING(100), allowNull: true },
  cfdIdleMedia: { type: DataTypes.TEXT, allowNull: true },
  gstin: { type: DataTypes.STRING(15), allowNull: true },
  legalBusinessName: { type: DataTypes.STRING(255), allowNull: true },
  stateCode: { type: DataTypes.STRING(5), defaultValue: '27' },
  stateName: { type: DataTypes.STRING(50), defaultValue: 'Maharashtra' },
  gstCompositionScheme: { type: DataTypes.BOOLEAN, defaultValue: false },
  gstEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  taxInclusivePricing: { type: DataTypes.BOOLEAN, defaultValue: true },
  defaultGstRate: { type: DataTypes.FLOAT, defaultValue: 5.0 },
  tallyCompany: { type: DataTypes.STRING(255), defaultValue: 'Gusstora Roasters' },
  tallySalesLedger: { type: DataTypes.STRING(255), defaultValue: 'Food & Beverage Sales' },
  tallyCgstLedger: { type: DataTypes.STRING(255), defaultValue: 'CGST Input/Output 2.5%' },
  tallySgstLedger: { type: DataTypes.STRING(255), defaultValue: 'SGST Input/Output 2.5%' },
  tallyIgstLedger: { type: DataTypes.STRING(255), defaultValue: 'IGST 5%' },
  invoicePrefix: { type: DataTypes.STRING(20), defaultValue: 'GST-2627/' },
  nextInvoiceSeq: { type: DataTypes.INTEGER, defaultValue: 1 },
}, { tableName: 'cafes' });

export const MenuItem = sequelize.define('MenuItem', {
  ...uuidPk,
  name: DataTypes.STRING,
  description: DataTypes.TEXT,
  category: DataTypes.STRING,
  price: DataTypes.FLOAT,
  image: DataTypes.TEXT('long'),
  available: { type: DataTypes.BOOLEAN, defaultValue: true },
  veg: { type: DataTypes.BOOLEAN, defaultValue: true },
  variants: { type: DataTypes.JSON, defaultValue: [] },
  modifierGroups: { type: DataTypes.JSON, defaultValue: [] },
  hsnCode: { type: DataTypes.STRING(20), defaultValue: '996331' },
  gstRate: { type: DataTypes.FLOAT, defaultValue: 5.0 },
  taxExempt: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'menu_items' });

export const User = sequelize.define('User', {
  ...uuidPk,
  name: DataTypes.STRING,
  email: { type: DataTypes.STRING, unique: true },
  phone: DataTypes.STRING,
  passwordHash: DataTypes.STRING,
  role: { type: DataTypes.STRING, defaultValue: 'owner' },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  pin: { type: DataTypes.STRING(10), defaultValue: '1234' },
  assignedSection: { type: DataTypes.STRING(50), defaultValue: 'All' },
  hourlyWage: { type: DataTypes.FLOAT, defaultValue: 0 },
  monthlySalary: { type: DataTypes.FLOAT, defaultValue: 0 },
  upiId: { type: DataTypes.STRING(100), allowNull: true },
  emergencyPhone: { type: DataTypes.STRING(50), allowNull: true },
  faceDescriptor: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'users' });

export const Customer = sequelize.define('Customer', {
  ...uuidPk,
  name: DataTypes.STRING,
  phone: DataTypes.STRING,
  email: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.STRING, allowNull: true },
  visits: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'customers',
  indexes: [{ unique: true, fields: ['cafeId', 'phone'] }],
});

export const Reward = sequelize.define('Reward', {
  ...uuidPk,
  amount: DataTypes.INTEGER,
  claimCode: { type: DataTypes.STRING, unique: true },
  claimedAt: DataTypes.DATE,
  status: { type: DataTypes.ENUM('available', 'claimed', 'redeemed', 'expired'), defaultValue: 'available' },
  expiresAt: DataTypes.DATE,
  redeemedAt: DataTypes.DATE,
  redeemedBy: DataTypes.STRING,
  notes: DataTypes.STRING,
  cafeId: DataTypes.UUID,
}, { tableName: 'rewards' });

export const Order = sequelize.define('Order', {
  ...uuidPk,
  orderNo: DataTypes.STRING,
  customerName: DataTypes.STRING,
  phone: DataTypes.STRING,
  table: { type: DataTypes.STRING, field: 'table_no' },
  subtotal: DataTypes.FLOAT,
  discount: { type: DataTypes.FLOAT, defaultValue: 0 },
  total: DataTypes.FLOAT,
  paymentMethod: { type: DataTypes.STRING, defaultValue: 'cash' },
  paymentStatus: { type: DataTypes.STRING, defaultValue: 'pending' },
  paymentTransactionId: { type: DataTypes.STRING, allowNull: true },
  paymentGatewayMeta: { type: DataTypes.JSON, allowNull: true },
  status: {
    type: DataTypes.ENUM('placed', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'),
    defaultValue: 'placed',
  },
  loyaltyProcessed: { type: DataTypes.BOOLEAN, defaultValue: false },
  rewardId: { type: DataTypes.UUID, allowNull: true },
  shiftId: { type: DataTypes.UUID, allowNull: true },
  discountType: { type: DataTypes.STRING(30), allowNull: true },
  discountValue: { type: DataTypes.FLOAT, defaultValue: 0 },
  discountReason: { type: DataTypes.STRING, allowNull: true },
  discountAuthorizedBy: { type: DataTypes.STRING, allowNull: true },
  splitBills: { type: DataTypes.JSON, allowNull: true },
  channel: { type: DataTypes.STRING(30), defaultValue: 'pos' }, // 'pos', 'qr', 'zomato', 'swiggy', 'urbanpiper', 'takeaway'
  externalOrderId: { type: DataTypes.STRING(100), allowNull: true },
  riderName: { type: DataTypes.STRING(100), allowNull: true },
  riderPhone: { type: DataTypes.STRING(50), allowNull: true },
  channelCommission: { type: DataTypes.FLOAT, defaultValue: 0 },
  brandId: { type: DataTypes.UUID, allowNull: true },
  offlineId: { type: DataTypes.STRING(100), allowNull: true },
  isOffline: { type: DataTypes.BOOLEAN, defaultValue: false },
  offlineSyncedAt: { type: DataTypes.DATE, allowNull: true },
  captainId: { type: DataTypes.UUID, allowNull: true },
  captainName: { type: DataTypes.STRING(100), allowNull: true },
  courseStatus: { type: DataTypes.JSON, allowNull: true },
  tableMergedWith: { type: DataTypes.STRING(50), allowNull: true },
  invoiceNumber: { type: DataTypes.STRING(50), allowNull: true },
  invoiceDate: { type: DataTypes.DATE, allowNull: true },
  customerGstin: { type: DataTypes.STRING(15), allowNull: true },
  customerLegalName: { type: DataTypes.STRING(255), allowNull: true },
  customerStateCode: { type: DataTypes.STRING(5), allowNull: true },
  isB2B: { type: DataTypes.BOOLEAN, defaultValue: false },
  isInterState: { type: DataTypes.BOOLEAN, defaultValue: false },
  taxableAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  cgstAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  sgstAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  igstAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  totalTax: { type: DataTypes.FLOAT, defaultValue: 0 },
  hsnSummary: { type: DataTypes.JSON, allowNull: true },
  eInvoiceIrn: { type: DataTypes.STRING(100), allowNull: true },
  eInvoiceAckNo: { type: DataTypes.STRING(50), allowNull: true },
  eInvoiceAckDate: { type: DataTypes.DATE, allowNull: true },
  eInvoiceQrCode: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'orders' });

export const OrderItem = sequelize.define('OrderItem', {
  ...uuidPk,
  menuItemId: DataTypes.UUID,
  name: DataTypes.STRING,
  price: DataTypes.FLOAT,
  quantity: DataTypes.INTEGER,
  isCompleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  selectedVariant: { type: DataTypes.JSON, allowNull: true },
  selectedModifiers: { type: DataTypes.JSON, defaultValue: [] },
  notes: { type: DataTypes.STRING, allowNull: true },
  course: { type: DataTypes.STRING(30), defaultValue: 'mains' },
  itemStatus: { type: DataTypes.STRING(30), defaultValue: 'fired' },
  voidReason: { type: DataTypes.STRING(255), allowNull: true },
  voidAuthorizedBy: { type: DataTypes.STRING(100), allowNull: true },
  kitchenNotes: { type: DataTypes.STRING(255), allowNull: true },
  hsnCode: { type: DataTypes.STRING(20), defaultValue: '996331' },
  gstRate: { type: DataTypes.FLOAT, defaultValue: 5.0 },
  taxableAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  cgstRate: { type: DataTypes.FLOAT, defaultValue: 2.5 },
  cgstAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  sgstRate: { type: DataTypes.FLOAT, defaultValue: 2.5 },
  sgstAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  igstRate: { type: DataTypes.FLOAT, defaultValue: 0 },
  igstAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  totalTax: { type: DataTypes.FLOAT, defaultValue: 0 },
}, { tableName: 'order_items' });

export const CafeTable = sequelize.define('CafeTable', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  tableNumber: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: true },
  capacity: { type: DataTypes.INTEGER, defaultValue: 4 },
  section: { type: DataTypes.STRING, defaultValue: 'Main Floor' },
  status: { type: DataTypes.STRING, defaultValue: 'available' }, // 'available', 'reserved', 'occupied', 'billed', 'cleaning', 'blocked'
  currentBookingId: { type: DataTypes.UUID, allowNull: true },
  mergedIntoTableId: { type: DataTypes.UUID, allowNull: true },
  activeOrderId: { type: DataTypes.UUID, allowNull: true },
  occupiedSince: { type: DataTypes.DATE, allowNull: true },
  guestCount: { type: DataTypes.INTEGER, defaultValue: 2 },
  dinerName: { type: DataTypes.STRING(100), allowNull: true },
  dinerPhone: { type: DataTypes.STRING(50), allowNull: true },
  assignedCaptainId: { type: DataTypes.UUID, allowNull: true },
  assignedCaptainName: { type: DataTypes.STRING(100), allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'cafe_tables' });

export const Booking = sequelize.define('Booking', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  name: DataTypes.STRING,
  phone: DataTypes.STRING,
  guests: { type: DataTypes.INTEGER, defaultValue: 2 },
  dateTime: DataTypes.DATE,
  durationMinutes: { type: DataTypes.INTEGER, defaultValue: 90 },
  tableId: { type: DataTypes.UUID, allowNull: true },
  tableNumber: { type: DataTypes.STRING, allowNull: true },
  note: DataTypes.STRING,
  status: { type: DataTypes.STRING, defaultValue: 'pending' }, // 'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no-show'
  seatedAt: { type: DataTypes.DATE, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  source: { type: DataTypes.STRING, defaultValue: 'online' }, // 'online', 'phone', 'walk-in', 'staff'
}, { tableName: 'bookings' });

export const OtpVerification = sequelize.define('OtpVerification', {
  ...uuidPk,
  phone: { type: DataTypes.STRING, allowNull: false },
  otp: { type: DataTypes.STRING, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  verified: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'otp_verifications' });

export const ReminderRule = sequelize.define('ReminderRule', {
  ...uuidPk,
  name: DataTypes.STRING,
  triggerType: {
    type: DataTypes.ENUM('near_reward', 'inactive_days', 'expiring_reward', 'first_visit'),
    defaultValue: 'near_reward',
  },
  daysThreshold: { type: DataTypes.INTEGER, defaultValue: 7 },
  channel: { type: DataTypes.ENUM('whatsapp', 'sms', 'email'), defaultValue: 'whatsapp' },
  messageTemplate: DataTypes.TEXT,
  cooldownDays: { type: DataTypes.INTEGER, defaultValue: 7 },
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  cafeId: DataTypes.UUID,
}, { tableName: 'reminder_rules' });

export const NotificationLog = sequelize.define('NotificationLog', {
  ...uuidPk,
  customerId: DataTypes.UUID,
  customerName: DataTypes.STRING,
  customerPhone: DataTypes.STRING,
  reminderRuleId: DataTypes.UUID,
  triggerType: DataTypes.STRING,
  channel: { type: DataTypes.STRING, defaultValue: 'whatsapp' },
  status: { type: DataTypes.ENUM('queued', 'sent', 'delivered', 'failed'), defaultValue: 'sent' },
  messageContent: DataTypes.TEXT,
  metadata: DataTypes.TEXT,
  sentAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
  cafeId: DataTypes.UUID,
}, { tableName: 'notification_logs' });

export const Feedback = sequelize.define('Feedback', {
  ...uuidPk,
  rating: { type: DataTypes.INTEGER, allowNull: false },
  sentiment: {
    type: DataTypes.ENUM('positive', 'critical'),
    defaultValue: 'positive',
  },
  aspects: { type: DataTypes.JSON, defaultValue: [] },
  comment: { type: DataTypes.TEXT, allowNull: true },
  customerName: { type: DataTypes.STRING, allowNull: true },
  customerPhone: { type: DataTypes.STRING, allowNull: true },
  isPublic: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: {
    type: DataTypes.ENUM('new', 'reviewed', 'resolved'),
    defaultValue: 'new',
  },
  resolutionNotes: { type: DataTypes.TEXT, allowNull: true },
  resolvedAt: { type: DataTypes.DATE, allowNull: true },
  resolvedBy: { type: DataTypes.STRING, allowNull: true },
  orderId: { type: DataTypes.UUID, allowNull: true },
  customerId: { type: DataTypes.UUID, allowNull: true },
  cafeId: { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'feedbacks' });

export const RefreshToken = sequelize.define('RefreshToken', {
  ...uuidPk,
  tokenHash: { type: DataTypes.STRING(128), allowNull: false, unique: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  cafeId: { type: DataTypes.UUID, allowNull: true },
  family: { type: DataTypes.STRING(64), allowNull: false },
  isRevoked: { type: DataTypes.BOOLEAN, defaultValue: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  userAgent: { type: DataTypes.STRING(255), allowNull: true },
  ipAddress: { type: DataTypes.STRING(100), allowNull: true },
}, { 
  tableName: 'refresh_tokens',
  indexes: [
    { fields: ['tokenHash'] },
    { fields: ['userId'] },
    { fields: ['family'] },
  ]
});

export const AuditLog = sequelize.define('AuditLog', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: true },
  userId: { type: DataTypes.UUID, allowNull: true },
  userName: { type: DataTypes.STRING, defaultValue: 'System' },
  userRole: { type: DataTypes.STRING, defaultValue: 'system' },
  action: { type: DataTypes.STRING(100), allowNull: false },
  category: { 
    type: DataTypes.ENUM('auth', 'staff', 'menu', 'loyalty', 'settings', 'order'),
    defaultValue: 'auth'
  },
  details: { type: DataTypes.JSON, defaultValue: {} },
  status: { type: DataTypes.ENUM('success', 'warning', 'failure'), defaultValue: 'success' },
  ipAddress: { type: DataTypes.STRING(100), allowNull: true },
  userAgent: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: 'audit_logs',
  indexes: [
    { fields: ['cafeId'] },
    { fields: ['category'] },
    { fields: ['action'] },
    { fields: ['createdAt'] }
  ]
});

export const RegisterShift = sequelize.define('RegisterShift', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  staffName: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM('open', 'closed'), defaultValue: 'open' },
  openedAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
  closedAt: { type: DataTypes.DATE, allowNull: true },
  openingFloat: { type: DataTypes.FLOAT, defaultValue: 0.0 },
  closingFloatExpected: { type: DataTypes.FLOAT, defaultValue: 0.0 },
  closingFloatCounted: { type: DataTypes.FLOAT, defaultValue: 0.0 },
  cashVariance: { type: DataTypes.FLOAT, defaultValue: 0.0 },
  notes: { type: DataTypes.TEXT, allowNull: true },
  summary: { type: DataTypes.JSON, allowNull: true },
}, {
  tableName: 'register_shifts',
  indexes: [
    { fields: ['cafeId'] },
    { fields: ['status'] },
    { fields: ['openedAt'] },
  ],
});

export const PromoCode = sequelize.define('PromoCode', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  code: { type: DataTypes.STRING(50), allowNull: false },
  discountType: { type: DataTypes.ENUM('percent', 'flat'), defaultValue: 'percent' },
  discountValue: { type: DataTypes.FLOAT, allowNull: false },
  minOrderAmount: { type: DataTypes.FLOAT, defaultValue: 0.0 },
  maxDiscountAmount: { type: DataTypes.FLOAT, allowNull: true },
  usageLimit: { type: DataTypes.INTEGER, allowNull: true },
  usedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'promo_codes',
  indexes: [
    { fields: ['cafeId', 'code'] },
    { fields: ['isActive'] },
  ],
});

export const InventoryItem = sequelize.define('InventoryItem', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  sku: { type: DataTypes.STRING(50), allowNull: true },
  category: { type: DataTypes.STRING(50), defaultValue: 'coffee' }, // coffee, dairy, syrup, bakery, packaging, other
  currentStock: { type: DataTypes.FLOAT, defaultValue: 0.0 },
  unit: { type: DataTypes.STRING(20), defaultValue: 'kg' }, // kg, g, L, ml, pcs
  lowStockThreshold: { type: DataTypes.FLOAT, defaultValue: 1.0 },
  costPerUnit: { type: DataTypes.FLOAT, defaultValue: 0.0 },
  supplier: { type: DataTypes.STRING, allowNull: true },
  supplierEmail: { type: DataTypes.STRING(255), allowNull: true },
  supplierPhone: { type: DataTypes.STRING(50), allowNull: true },
  reorderQuantity: { type: DataTypes.FLOAT, defaultValue: 5.0 },
  targetStockLevel: { type: DataTypes.FLOAT, defaultValue: 10.0 },
  isCommissaryProduced: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.ENUM('in_stock', 'low_stock', 'out_of_stock'), defaultValue: 'in_stock' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'inventory_items',
  indexes: [
    { fields: ['cafeId'] },
    { fields: ['category'] },
    { fields: ['status'] },
  ],
});

export const RecipeItem = sequelize.define('RecipeItem', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  menuItemId: { type: DataTypes.UUID, allowNull: false },
  inventoryItemId: { type: DataTypes.UUID, allowNull: false },
  quantityRequired: { type: DataTypes.FLOAT, allowNull: false },
  unit: { type: DataTypes.STRING(20), defaultValue: 'g' },
  variantName: { type: DataTypes.STRING(100), allowNull: true },
}, {
  tableName: 'recipe_items',
  indexes: [
    { fields: ['cafeId'] },
    { fields: ['menuItemId'] },
    { fields: ['inventoryItemId'] },
  ],
});

export const StockLedger = sequelize.define('StockLedger', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  inventoryItemId: { type: DataTypes.UUID, allowNull: false },
  changeType: {
    type: DataTypes.ENUM('purchase_restock', 'order_consumption', 'order_cancellation_restore', 'waste_spoilage', 'manual_adjustment'),
    allowNull: false,
  },
  quantityDelta: { type: DataTypes.FLOAT, allowNull: false },
  stockBefore: { type: DataTypes.FLOAT, allowNull: false },
  stockAfter: { type: DataTypes.FLOAT, allowNull: false },
  referenceId: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  recordedBy: { type: DataTypes.STRING, defaultValue: 'System' },
}, {
  tableName: 'stock_ledgers',
  indexes: [
    { fields: ['cafeId'] },
    { fields: ['inventoryItemId'] },
    { fields: ['changeType'] },
    { fields: ['createdAt'] },
  ],
});

export const Brand = sequelize.define('Brand', {
  ...uuidPk,
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, unique: true, allowNull: false },
  logo: { type: DataTypes.TEXT('long'), allowNull: true },
  headquarters: { type: DataTypes.STRING, allowNull: true },
  ownerId: { type: DataTypes.UUID, allowNull: true },
  settings: { type: DataTypes.JSON, defaultValue: {} },
}, {
  tableName: 'brands',
});

export const DeliveryChannel = sequelize.define('DeliveryChannel', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  channel: { type: DataTypes.STRING(30), allowNull: false }, // 'zomato', 'swiggy', 'urbanpiper'
  storeId: { type: DataTypes.STRING(100), allowNull: true },
  status: { type: DataTypes.ENUM('online', 'paused', 'offline'), defaultValue: 'online' },
  commissionRate: { type: DataTypes.FLOAT, defaultValue: 18.0 }, // 18% standard
  autoAccept: { type: DataTypes.BOOLEAN, defaultValue: true },
  apiKey: { type: DataTypes.STRING(255), allowNull: true },
  webhookSecret: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: 'delivery_channels',
  indexes: [
    { fields: ['cafeId', 'channel'], unique: true },
  ],
});

export const WhatsAppConfig = sequelize.define('WhatsAppConfig', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false, unique: true },
  phoneNumberId: { type: DataTypes.STRING(100), allowNull: true },
  wabaId: { type: DataTypes.STRING(100), allowNull: true },
  accessToken: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('active', 'mock', 'disabled'), defaultValue: 'mock' },
  autoOrderConfirmation: { type: DataTypes.BOOLEAN, defaultValue: true },
  autoOrderReady: { type: DataTypes.BOOLEAN, defaultValue: true },
  autoLoyaltyAlerts: { type: DataTypes.BOOLEAN, defaultValue: true },
  webhookVerifyToken: { type: DataTypes.STRING(100), defaultValue: 'gusstora_wa_verify_2026' },
}, {
  tableName: 'whatsapp_configs',
});

export const PrinterConfig = sequelize.define('PrinterConfig', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('receipt', 'barista_kot', 'kitchen_kot', 'all_kot'), defaultValue: 'receipt' },
  connectionType: { type: DataTypes.ENUM('network', 'usb', 'bluetooth', 'browser'), defaultValue: 'network' },
  ipAddress: { type: DataTypes.STRING(100), defaultValue: '127.0.0.1' },
  port: { type: DataTypes.INTEGER, defaultValue: 9100 },
  paperWidth: { type: DataTypes.INTEGER, defaultValue: 80 },
  autoPrintOnOrder: { type: DataTypes.BOOLEAN, defaultValue: true },
  autoDrawerKick: { type: DataTypes.BOOLEAN, defaultValue: false },
  categories: { type: DataTypes.JSON, defaultValue: ['*'] },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'printer_configs',
  indexes: [{ fields: ['cafeId'] }],
});

export const EDCTerminal = sequelize.define('EDCTerminal', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  provider: { type: DataTypes.ENUM('pine_labs', 'razorpay_pos', 'mosambee', 'paytm_soundbox'), defaultValue: 'pine_labs' },
  terminalId: { type: DataTypes.STRING(100), allowNull: true },
  ipAddress: { type: DataTypes.STRING(100), defaultValue: '192.168.1.150' },
  cloudWebhookKey: { type: DataTypes.STRING(255), allowNull: true },
  autoSettleOrder: { type: DataTypes.BOOLEAN, defaultValue: true },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastStatus: { type: DataTypes.STRING(50), defaultValue: 'online' },
  lastTransactionAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'edc_terminals',
  indexes: [{ fields: ['cafeId'] }],
});

export const HardwareLog = sequelize.define('HardwareLog', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  deviceType: { type: DataTypes.ENUM('printer', 'edc', 'soundbox', 'scale', 'scanner'), allowNull: false },
  deviceName: { type: DataTypes.STRING, allowNull: true },
  action: { type: DataTypes.STRING(100), allowNull: false },
  status: { type: DataTypes.ENUM('success', 'failed', 'simulated'), defaultValue: 'success' },
  payload: { type: DataTypes.JSON, allowNull: true },
  response: { type: DataTypes.JSON, allowNull: true },
  message: { type: DataTypes.STRING(500), allowNull: true },
}, {
  tableName: 'hardware_logs',
  indexes: [{ fields: ['cafeId'] }, { fields: ['createdAt'] }],
});


// Associations — aliases match the nested keys the client already expects
// (cafe.menu, customer.rewards, order.items) so route serialization stays simple.
Cafe.hasMany(MenuItem, { as: 'menu', foreignKey: 'cafeId' });
MenuItem.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(User, { foreignKey: 'cafeId' });
User.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(Customer, { foreignKey: 'cafeId' });
Customer.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(Order, { foreignKey: 'cafeId' });
Order.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(Booking, { foreignKey: 'cafeId' });
Booking.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(CafeTable, { as: 'cafeTables', foreignKey: 'cafeId' });
CafeTable.belongsTo(Cafe, { foreignKey: 'cafeId' });

CafeTable.hasMany(Booking, { as: 'bookings', foreignKey: 'tableId' });
Booking.belongsTo(CafeTable, { as: 'table', foreignKey: 'tableId' });

Cafe.hasMany(Reward, { as: 'rewards', foreignKey: 'cafeId' });
Reward.belongsTo(Cafe, { foreignKey: 'cafeId' });

Customer.hasMany(Reward, { as: 'rewards', foreignKey: 'customerId' });
Reward.belongsTo(Customer, { foreignKey: 'customerId' });

Customer.hasMany(Order, { as: 'orders', foreignKey: 'customerId' });
Order.belongsTo(Customer, { foreignKey: 'customerId' });

Order.hasMany(OrderItem, { as: 'items', foreignKey: 'orderId' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

Cafe.hasMany(ReminderRule, { as: 'reminderRules', foreignKey: 'cafeId' });
ReminderRule.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(NotificationLog, { as: 'notificationLogs', foreignKey: 'cafeId' });
NotificationLog.belongsTo(Cafe, { foreignKey: 'cafeId' });

Customer.hasMany(NotificationLog, { as: 'notificationLogs', foreignKey: 'customerId' });
NotificationLog.belongsTo(Customer, { foreignKey: 'customerId' });

ReminderRule.hasMany(NotificationLog, { foreignKey: 'reminderRuleId' });
NotificationLog.belongsTo(ReminderRule, { foreignKey: 'reminderRuleId' });

Cafe.hasMany(Feedback, { as: 'feedbacks', foreignKey: 'cafeId' });
Feedback.belongsTo(Cafe, { foreignKey: 'cafeId' });

Order.hasOne(Feedback, { as: 'feedback', foreignKey: 'orderId' });
Feedback.belongsTo(Order, { foreignKey: 'orderId' });

Customer.hasMany(Feedback, { as: 'feedbacks', foreignKey: 'customerId' });
Feedback.belongsTo(Customer, { foreignKey: 'customerId' });

Cafe.hasMany(RefreshToken, { as: 'refreshTokens', foreignKey: 'cafeId' });
RefreshToken.belongsTo(Cafe, { foreignKey: 'cafeId' });

User.hasMany(RefreshToken, { as: 'refreshTokens', foreignKey: 'userId' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

Cafe.hasMany(AuditLog, { as: 'auditLogs', foreignKey: 'cafeId' });
AuditLog.belongsTo(Cafe, { foreignKey: 'cafeId' });

User.hasMany(AuditLog, { as: 'auditLogs', foreignKey: 'userId' });
AuditLog.belongsTo(User, { foreignKey: 'userId' });

Cafe.hasMany(RegisterShift, { as: 'shifts', foreignKey: 'cafeId' });
RegisterShift.belongsTo(Cafe, { foreignKey: 'cafeId' });

User.hasMany(RegisterShift, { as: 'shifts', foreignKey: 'userId' });
RegisterShift.belongsTo(User, { foreignKey: 'userId' });

RegisterShift.hasMany(Order, { as: 'orders', foreignKey: 'shiftId' });
Order.belongsTo(RegisterShift, { as: 'shift', foreignKey: 'shiftId' });

Cafe.hasMany(PromoCode, { as: 'promoCodes', foreignKey: 'cafeId' });
PromoCode.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(InventoryItem, { as: 'inventoryItems', foreignKey: 'cafeId' });
InventoryItem.belongsTo(Cafe, { foreignKey: 'cafeId' });

MenuItem.hasMany(RecipeItem, { as: 'recipes', foreignKey: 'menuItemId' });
RecipeItem.belongsTo(MenuItem, { as: 'menuItem', foreignKey: 'menuItemId' });

InventoryItem.hasMany(RecipeItem, { as: 'usedInRecipes', foreignKey: 'inventoryItemId' });
RecipeItem.belongsTo(InventoryItem, { as: 'ingredient', foreignKey: 'inventoryItemId' });

InventoryItem.hasMany(StockLedger, { as: 'movements', foreignKey: 'inventoryItemId' });
StockLedger.belongsTo(InventoryItem, { as: 'item', foreignKey: 'inventoryItemId' });

Cafe.hasMany(StockLedger, { as: 'stockLedgers', foreignKey: 'cafeId' });
StockLedger.belongsTo(Cafe, { foreignKey: 'cafeId' });

Brand.hasMany(Cafe, { as: 'outlets', foreignKey: 'brandId' });
Cafe.belongsTo(Brand, { as: 'brand', foreignKey: 'brandId' });

Brand.hasMany(Order, { as: 'orders', foreignKey: 'brandId' });
Order.belongsTo(Brand, { as: 'brand', foreignKey: 'brandId' });

Cafe.hasMany(DeliveryChannel, { as: 'deliveryChannels', foreignKey: 'cafeId' });
DeliveryChannel.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasOne(WhatsAppConfig, { as: 'whatsappConfig', foreignKey: 'cafeId' });
WhatsAppConfig.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(PrinterConfig, { as: 'printers', foreignKey: 'cafeId' });
PrinterConfig.belongsTo(Cafe, { foreignKey: 'cafeId' });

export const CommissaryBatch = sequelize.define('CommissaryBatch', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  brandId: { type: DataTypes.UUID, allowNull: true },
  batchNumber: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  recipeName: { type: DataTypes.STRING(255), allowNull: false },
  outputInventoryItemId: { type: DataTypes.UUID, allowNull: true },
  outputItemName: { type: DataTypes.STRING(255), allowNull: false },
  plannedQuantity: { type: DataTypes.FLOAT, defaultValue: 0 },
  producedQuantity: { type: DataTypes.FLOAT, defaultValue: 0 },
  unit: { type: DataTypes.STRING(30), defaultValue: 'kg' },
  shrinkagePercent: { type: DataTypes.FLOAT, defaultValue: 0 },
  status: { type: DataTypes.ENUM('planned', 'in_progress', 'completed', 'cancelled'), defaultValue: 'planned' },
  bomIngredients: { type: DataTypes.JSON, defaultValue: [] },
  totalCost: { type: DataTypes.FLOAT, defaultValue: 0 },
  costPerUnit: { type: DataTypes.FLOAT, defaultValue: 0 },
  roasterNotes: { type: DataTypes.TEXT, allowNull: true },
  operatorName: { type: DataTypes.STRING(100), defaultValue: 'Master Roaster' },
  startedAt: { type: DataTypes.DATE, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'commissary_batches',
  indexes: [{ fields: ['cafeId'] }, { fields: ['status'] }, { fields: ['batchNumber'] }],
});

export const StockIndent = sequelize.define('StockIndent', {
  ...uuidPk,
  brandId: { type: DataTypes.UUID, allowNull: true },
  requestingCafeId: { type: DataTypes.UUID, allowNull: false },
  supplyingCafeId: { type: DataTypes.UUID, allowNull: false },
  indentNumber: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  status: { type: DataTypes.ENUM('draft', 'submitted', 'approved', 'dispatched', 'received', 'rejected', 'cancelled'), defaultValue: 'submitted' },
  priority: { type: DataTypes.ENUM('normal', 'high', 'urgent'), defaultValue: 'normal' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  requestedBy: { type: DataTypes.STRING(100), defaultValue: 'Store Manager' },
  approvedBy: { type: DataTypes.STRING(100), allowNull: true },
  dispatchedBy: { type: DataTypes.STRING(100), allowNull: true },
  receivedBy: { type: DataTypes.STRING(100), allowNull: true },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true },
  submittedAt: { type: DataTypes.DATE, allowNull: true },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
  dispatchedAt: { type: DataTypes.DATE, allowNull: true },
  receivedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'stock_indents',
  indexes: [{ fields: ['requestingCafeId'] }, { fields: ['supplyingCafeId'] }, { fields: ['status'] }],
});

export const StockIndentItem = sequelize.define('StockIndentItem', {
  ...uuidPk,
  indentId: { type: DataTypes.UUID, allowNull: false },
  inventoryItemId: { type: DataTypes.UUID, allowNull: true },
  destinationInventoryItemId: { type: DataTypes.UUID, allowNull: true },
  itemName: { type: DataTypes.STRING(255), allowNull: false },
  category: { type: DataTypes.STRING(100), defaultValue: 'General' },
  unit: { type: DataTypes.STRING(30), defaultValue: 'kg' },
  requestedQty: { type: DataTypes.FLOAT, defaultValue: 0 },
  approvedQty: { type: DataTypes.FLOAT, defaultValue: 0 },
  dispatchedQty: { type: DataTypes.FLOAT, defaultValue: 0 },
  receivedQty: { type: DataTypes.FLOAT, defaultValue: 0 },
  varianceQty: { type: DataTypes.FLOAT, defaultValue: 0 },
  varianceReason: { type: DataTypes.STRING(255), allowNull: true },
  notes: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: 'stock_indent_items',
  indexes: [{ fields: ['indentId'] }],
});

export const StockTransfer = sequelize.define('StockTransfer', {
  ...uuidPk,
  indentId: { type: DataTypes.UUID, allowNull: false },
  stnNumber: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  supplyingCafeId: { type: DataTypes.UUID, allowNull: false },
  requestingCafeId: { type: DataTypes.UUID, allowNull: false },
  transporterName: { type: DataTypes.STRING(150), defaultValue: 'Gusstora Fleet Logistics' },
  vehicleNumber: { type: DataTypes.STRING(50), defaultValue: 'MH-12-GF-4491' },
  driverContact: { type: DataTypes.STRING(50), allowNull: true },
  status: { type: DataTypes.ENUM('in_transit', 'delivered', 'disputed'), defaultValue: 'in_transit' },
  dispatchTime: { type: DataTypes.DATE, allowNull: false },
  deliveryTime: { type: DataTypes.DATE, allowNull: true },
  stnItems: { type: DataTypes.JSON, defaultValue: [] },
}, {
  tableName: 'stock_transfers',
  indexes: [{ fields: ['indentId'] }, { fields: ['stnNumber'] }],
});

export const StockWastageLog = sequelize.define('StockWastageLog', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  inventoryItemId: { type: DataTypes.UUID, allowNull: false },
  itemName: { type: DataTypes.STRING(255), allowNull: false },
  quantity: { type: DataTypes.FLOAT, defaultValue: 0 },
  unit: { type: DataTypes.STRING(30), defaultValue: 'kg' },
  costPerUnit: { type: DataTypes.FLOAT, defaultValue: 0 },
  totalCost: { type: DataTypes.FLOAT, defaultValue: 0 },
  reason: { type: DataTypes.ENUM('expired', 'barista_spill', 'test_roast', 'batch_defect', 'machine_calibration', 'transit_damage', 'customer_complaint'), defaultValue: 'expired' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  loggedBy: { type: DataTypes.STRING(100), defaultValue: 'Head Barista' },
  approvedBy: { type: DataTypes.STRING(100), allowNull: true },
  status: { type: DataTypes.ENUM('pending_review', 'approved', 'rejected'), defaultValue: 'approved' },
  loggedAt: { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'stock_wastage_logs',
  indexes: [{ fields: ['cafeId'] }, { fields: ['reason'] }, { fields: ['loggedAt'] }],
});

export const PurchaseOrder = sequelize.define('PurchaseOrder', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  poNumber: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  supplierName: { type: DataTypes.STRING(255), allowNull: false },
  supplierEmail: { type: DataTypes.STRING(255), allowNull: true },
  supplierPhone: { type: DataTypes.STRING(50), allowNull: true },
  status: { type: DataTypes.ENUM('draft', 'sent', 'partially_received', 'fulfilled', 'cancelled'), defaultValue: 'draft' },
  triggerReason: { type: DataTypes.ENUM('manual', 'rop_auto_alert', 'emergency_stockout'), defaultValue: 'manual' },
  items: { type: DataTypes.JSON, defaultValue: [] },
  totalAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  notes: { type: DataTypes.TEXT, allowNull: true },
  expectedDeliveryDate: { type: DataTypes.DATEONLY, allowNull: true },
  createdByUser: { type: DataTypes.STRING(100), defaultValue: 'Inventory Manager' },
  sentAt: { type: DataTypes.DATE, allowNull: true },
  fulfilledAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'purchase_orders',
  indexes: [{ fields: ['cafeId'] }, { fields: ['status'] }, { fields: ['poNumber'] }],
});

Cafe.hasMany(EDCTerminal, { as: 'edcTerminals', foreignKey: 'cafeId' });
EDCTerminal.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(HardwareLog, { as: 'hardwareLogs', foreignKey: 'cafeId' });
HardwareLog.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(CommissaryBatch, { as: 'commissaryBatches', foreignKey: 'cafeId' });
CommissaryBatch.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(StockIndent, { as: 'outgoingIndents', foreignKey: 'requestingCafeId' });
StockIndent.belongsTo(Cafe, { as: 'requestingCafe', foreignKey: 'requestingCafeId' });

Cafe.hasMany(StockIndent, { as: 'incomingIndents', foreignKey: 'supplyingCafeId' });
StockIndent.belongsTo(Cafe, { as: 'supplyingCafe', foreignKey: 'supplyingCafeId' });

StockIndent.hasMany(StockIndentItem, { as: 'items', foreignKey: 'indentId' });
StockIndentItem.belongsTo(StockIndent, { as: 'indent', foreignKey: 'indentId' });

StockIndent.hasOne(StockTransfer, { as: 'transfer', foreignKey: 'indentId' });
StockTransfer.belongsTo(StockIndent, { as: 'indent', foreignKey: 'indentId' });

Cafe.hasMany(StockWastageLog, { as: 'wastageLogs', foreignKey: 'cafeId' });
StockWastageLog.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(PurchaseOrder, { as: 'purchaseOrders', foreignKey: 'cafeId' });
PurchaseOrder.belongsTo(Cafe, { foreignKey: 'cafeId' });

export const StaffSchedule = sequelize.define('StaffSchedule', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  staffName: { type: DataTypes.STRING(100), allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  shiftType: {
    type: DataTypes.ENUM('morning', 'afternoon', 'evening', 'night', 'full_day', 'custom'),
    defaultValue: 'morning',
  },
  startTime: { type: DataTypes.STRING(10), defaultValue: '08:00' },
  endTime: { type: DataTypes.STRING(10), defaultValue: '16:00' },
  role: { type: DataTypes.STRING(50), defaultValue: 'barista' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.ENUM('scheduled', 'completed', 'absent', 'cancelled', 'swapped'),
    defaultValue: 'scheduled',
  },
}, {
  tableName: 'staff_schedules',
  indexes: [{ fields: ['cafeId', 'date'] }, { fields: ['userId'] }],
});

export const StaffAttendance = sequelize.define('StaffAttendance', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  scheduleId: { type: DataTypes.UUID, allowNull: true },
  staffName: { type: DataTypes.STRING(100), allowNull: false },
  role: { type: DataTypes.STRING(50), defaultValue: 'barista' },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  clockInTime: { type: DataTypes.DATE, allowNull: false },
  clockOutTime: { type: DataTypes.DATE, allowNull: true },
  clockInMethod: {
    type: DataTypes.ENUM('pin', 'selfie', 'biometric', 'manual_manager'),
    defaultValue: 'pin',
  },
  clockOutMethod: {
    type: DataTypes.ENUM('pin', 'selfie', 'biometric', 'manual_manager'),
    allowNull: true,
  },
  selfieUrl: { type: DataTypes.TEXT('long'), allowNull: true },
  clockOutSelfieUrl: { type: DataTypes.TEXT('long'), allowNull: true },
  status: {
    type: DataTypes.ENUM('clocked_in', 'on_break', 'clocked_out'),
    defaultValue: 'clocked_in',
  },
  totalWorkMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalBreakMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
  netWorkMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
  overtimeMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
  isLate: { type: DataTypes.BOOLEAN, defaultValue: false },
  lateMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
  leftEarly: { type: DataTypes.BOOLEAN, defaultValue: false },
  breaks: { type: DataTypes.JSON, defaultValue: [] },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'staff_attendances',
  indexes: [{ fields: ['cafeId', 'date'] }, { fields: ['userId', 'date'] }, { fields: ['status'] }],
});

export const TipPool = sequelize.define('TipPool', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  shiftId: { type: DataTypes.UUID, allowNull: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  periodStart: { type: DataTypes.DATE, allowNull: true },
  periodEnd: { type: DataTypes.DATE, allowNull: true },
  cashTips: { type: DataTypes.FLOAT, defaultValue: 0 },
  cardTips: { type: DataTypes.FLOAT, defaultValue: 0 },
  serviceChargeAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  totalAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  distributionMethod: {
    type: DataTypes.ENUM('role_weighted', 'hours_worked', 'equal_split'),
    defaultValue: 'role_weighted',
  },
  roleWeights: { type: DataTypes.JSON, defaultValue: { barista: 40, captain: 35, kitchen: 25, cashier: 20 } },
  status: {
    type: DataTypes.ENUM('open', 'calculated', 'settled', 'cancelled'),
    defaultValue: 'open',
  },
  calculatedAt: { type: DataTypes.DATE, allowNull: true },
  settledAt: { type: DataTypes.DATE, allowNull: true },
  settledBy: { type: DataTypes.STRING(100), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'tip_pools',
  indexes: [{ fields: ['cafeId', 'date'] }, { fields: ['status'] }],
});

export const TipDistribution = sequelize.define('TipDistribution', {
  ...uuidPk,
  tipPoolId: { type: DataTypes.UUID, allowNull: false },
  cafeId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  staffName: { type: DataTypes.STRING(100), allowNull: false },
  role: { type: DataTypes.STRING(50), defaultValue: 'barista' },
  hoursWorked: { type: DataTypes.FLOAT, defaultValue: 0 },
  weightApplied: { type: DataTypes.FLOAT, defaultValue: 1.0 },
  sharePercent: { type: DataTypes.FLOAT, defaultValue: 0 },
  allocatedAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  status: {
    type: DataTypes.ENUM('pending', 'paid'),
    defaultValue: 'pending',
  },
  payoutMethod: {
    type: DataTypes.ENUM('cash', 'upi', 'bank_transfer', 'salary_credit'),
    defaultValue: 'cash',
  },
  paymentRef: { type: DataTypes.STRING(100), allowNull: true },
  paidAt: { type: DataTypes.DATE, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'tip_distributions',
  indexes: [{ fields: ['tipPoolId'] }, { fields: ['userId'] }],
});

Cafe.hasMany(StaffSchedule, { as: 'staffSchedules', foreignKey: 'cafeId' });
StaffSchedule.belongsTo(Cafe, { foreignKey: 'cafeId' });

User.hasMany(StaffSchedule, { as: 'schedules', foreignKey: 'userId' });
StaffSchedule.belongsTo(User, { as: 'user', foreignKey: 'userId' });

Cafe.hasMany(StaffAttendance, { as: 'staffAttendances', foreignKey: 'cafeId' });
StaffAttendance.belongsTo(Cafe, { foreignKey: 'cafeId' });

User.hasMany(StaffAttendance, { as: 'attendances', foreignKey: 'userId' });
StaffAttendance.belongsTo(User, { as: 'user', foreignKey: 'userId' });

Cafe.hasMany(TipPool, { as: 'tipPools', foreignKey: 'cafeId' });
TipPool.belongsTo(Cafe, { foreignKey: 'cafeId' });

TipPool.hasMany(TipDistribution, { as: 'distributions', foreignKey: 'tipPoolId' });
TipDistribution.belongsTo(TipPool, { as: 'tipPool', foreignKey: 'tipPoolId' });

User.hasMany(TipDistribution, { as: 'tipDistributions', foreignKey: 'userId' });
TipDistribution.belongsTo(User, { foreignKey: 'userId' });

// ==========================================
// Phase 12: Beyond Petpooja - AI Roastery OS
// ==========================================

export const AiMenuSnapshot = sequelize.define('AiMenuSnapshot', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  snapshotDate: { type: DataTypes.DATEONLY, allowNull: false },
  totalItemsAnalyzed: { type: DataTypes.INTEGER, defaultValue: 0 },
  starsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  plowhorsesCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  puzzlesCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  dogsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  averageMargin: { type: DataTypes.FLOAT, defaultValue: 0 },
  averageVolume: { type: DataTypes.FLOAT, defaultValue: 0 },
  totalVolume: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalRevenue: { type: DataTypes.FLOAT, defaultValue: 0 },
  totalContribution: { type: DataTypes.FLOAT, defaultValue: 0 },
  healthScore: { type: DataTypes.FLOAT, defaultValue: 80 },
  itemsData: { type: DataTypes.JSON, defaultValue: [] },
  categoryBreakdown: { type: DataTypes.JSON, defaultValue: {} },
  actionableInsights: { type: DataTypes.JSON, defaultValue: [] },
}, {
  tableName: 'ai_menu_snapshots',
  indexes: [{ fields: ['cafeId', 'snapshotDate'] }],
});

export const AiPrepForecast = sequelize.define('AiPrepForecast', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  targetDate: { type: DataTypes.DATEONLY, allowNull: false },
  dayOfWeek: { type: DataTypes.STRING(20), defaultValue: 'Monday' },
  expectedTotalOrders: { type: DataTypes.INTEGER, defaultValue: 0 },
  expectedRevenue: { type: DataTypes.FLOAT, defaultValue: 0 },
  weatherCondition: { type: DataTypes.STRING(50), defaultValue: 'Sunny' },
  isHoliday: { type: DataTypes.BOOLEAN, defaultValue: false },
  prepRecommendations: { type: DataTypes.JSON, defaultValue: [] },
  hourlyRushHeatmap: { type: DataTypes.JSON, defaultValue: [] },
  status: {
    type: DataTypes.ENUM('draft', 'acknowledged', 'completed'),
    defaultValue: 'draft',
  },
  actualConsumption: { type: DataTypes.JSON, allowNull: true },
  acknowledgedBy: { type: DataTypes.STRING(100), allowNull: true },
  acknowledgedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'ai_prep_forecasts',
  indexes: [{ fields: ['cafeId', 'targetDate'] }],
});

export const AiAffinityRule = sequelize.define('AiAffinityRule', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  primaryMenuItemId: { type: DataTypes.UUID, allowNull: false },
  primaryItemName: { type: DataTypes.STRING(255), allowNull: false },
  pairedMenuItemId: { type: DataTypes.UUID, allowNull: false },
  pairedItemName: { type: DataTypes.STRING(255), allowNull: false },
  coOccurrenceCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  support: { type: DataTypes.FLOAT, defaultValue: 0.05 },
  confidence: { type: DataTypes.FLOAT, defaultValue: 0.5 },
  lift: { type: DataTypes.FLOAT, defaultValue: 1.5 },
  pairingDiscount: { type: DataTypes.FLOAT, defaultValue: 0 },
  customPitchText: { type: DataTypes.STRING(500), allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastMinedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'ai_affinity_rules',
  indexes: [{ fields: ['cafeId'] }, { fields: ['primaryMenuItemId'] }],
});

export const AiMarketingCampaign = sequelize.define('AiMarketingCampaign', {
  ...uuidPk,
  cafeId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  campaignType: {
    type: DataTypes.ENUM('churn_winback', 'vip_loyalty_booster', 'weekend_regular_nudge', 'new_guest_repeat', 'custom_broadcast'),
    defaultValue: 'churn_winback',
  },
  targetSegment: {
    type: DataTypes.STRING(50),
    defaultValue: 'at_risk',
  },
  channel: {
    type: DataTypes.ENUM('whatsapp', 'sms', 'omnichannel'),
    defaultValue: 'whatsapp',
  },
  promoCodeId: { type: DataTypes.UUID, allowNull: true },
  promoCode: { type: DataTypes.STRING(50), allowNull: true },
  discountPercent: { type: DataTypes.FLOAT, defaultValue: 15 },
  messageTemplate: { type: DataTypes.TEXT, allowNull: false },
  targetAudienceCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  sentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  deliveredCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  readCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  redeemedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  attributedRevenue: { type: DataTypes.FLOAT, defaultValue: 0 },
  status: {
    type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'completed', 'active'),
    defaultValue: 'draft',
  },
  triggerMode: {
    type: DataTypes.ENUM('manual_blast', 'autonomous_autopilot'),
    defaultValue: 'manual_blast',
  },
  scheduledAt: { type: DataTypes.DATE, allowNull: true },
  lastExecutedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'ai_marketing_campaigns',
  indexes: [{ fields: ['cafeId'] }, { fields: ['campaignType'] }, { fields: ['status'] }],
});

export const AiCampaignRecipient = sequelize.define('AiCampaignRecipient', {
  ...uuidPk,
  campaignId: { type: DataTypes.UUID, allowNull: false },
  cafeId: { type: DataTypes.UUID, allowNull: false },
  customerId: { type: DataTypes.UUID, allowNull: true },
  customerName: { type: DataTypes.STRING(100), allowNull: false },
  phone: { type: DataTypes.STRING(50), allowNull: false },
  rfmSegment: { type: DataTypes.STRING(50), defaultValue: 'at_risk' },
  customizedMessage: { type: DataTypes.TEXT, allowNull: true },
  deliveryStatus: {
    type: DataTypes.ENUM('queued', 'sent', 'delivered', 'failed'), 
    defaultValue: 'queued',
  },
  sentAt: { type: DataTypes.DATE, allowNull: true },
  redeemed: { type: DataTypes.BOOLEAN, defaultValue: false },
  redeemedOrderId: { type: DataTypes.UUID, allowNull: true },
  redeemedAt: { type: DataTypes.DATE, allowNull: true },
  orderAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
}, {
  tableName: 'ai_campaign_recipients',
  indexes: [{ fields: ['campaignId'] }, { fields: ['phone'] }],
});

Cafe.hasMany(AiMenuSnapshot, { as: 'menuSnapshots', foreignKey: 'cafeId' });
AiMenuSnapshot.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(AiPrepForecast, { as: 'prepForecasts', foreignKey: 'cafeId' });
AiPrepForecast.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(AiAffinityRule, { as: 'affinityRules', foreignKey: 'cafeId' });
AiAffinityRule.belongsTo(Cafe, { foreignKey: 'cafeId' });

Cafe.hasMany(AiMarketingCampaign, { as: 'aiCampaigns', foreignKey: 'cafeId' });
AiMarketingCampaign.belongsTo(Cafe, { foreignKey: 'cafeId' });

AiMarketingCampaign.hasMany(AiCampaignRecipient, { as: 'recipients', foreignKey: 'campaignId' });
AiCampaignRecipient.belongsTo(AiMarketingCampaign, { as: 'campaign', foreignKey: 'campaignId' });








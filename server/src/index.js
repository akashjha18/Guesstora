import 'dotenv/config';
import express from 'express'; import cors from 'cors'; import morgan from 'morgan';
import mysql from 'mysql2/promise';
import { DataTypes } from 'sequelize';
import { config, sequelize } from './db.js';
import { validateAppConfig } from './config.js';
import { buildBootstrapConnectionConfig, buildCreateDatabaseSql } from './database.js';
import { Cafe } from './models.js';
import routes from './routes.js'; import { seed, shouldSeedDemoData } from './seed.js';
import { createRateLimiter } from './security.js';
import { runMigrations } from './migrations.js';
import { ensureOmnichannelSchema } from './schemaOmnichannel.js';
import { ensureHardwareSchema } from './schemaHardware.js';
import { ensureOfflineAndCfdSchema } from './schemaOffline.js';
import { ensureCaptainSchema } from './schemaCaptain.js';
import { ensureGstSchema } from './schemaGst.js';
import { ensureCommissarySchema } from './schemaCommissary.js';
import { ensureStaffOpsSchema } from './schemaStaffOps.js';
import { ensureAiRoasterySchema } from './schemaAiRoastery.js';
import { createHealthHandlers } from './health.js';

try {
  validateAppConfig(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const bootstrapConfig = buildBootstrapConnectionConfig(process.env);
const bootstrapDb = await mysql.createConnection({
  host: bootstrapConfig.host,
  port: bootstrapConfig.port,
  user: bootstrapConfig.user,
  password: bootstrapConfig.password,
  database: bootstrapConfig.database,
});
await bootstrapDb.execute(buildCreateDatabaseSql(config.databaseName));
await bootstrapDb.end();

await sequelize.authenticate();
const migrations = [
  { id: '001_initial_schema', up: async () => {} },
  {
    id: '002_reward_claim_code',
    up: async ({ queryInterface }) => {
      try {
        const table = await queryInterface.describeTable('rewards').catch(() => null);
        if (table) {
          if (!table.claimCode) {
            await queryInterface.addColumn('rewards', 'claimCode', { type: 'VARCHAR(50)', allowNull: true }).catch(() => {});
          }
          if (!table.claimedAt) {
            await queryInterface.addColumn('rewards', 'claimedAt', { type: 'DATETIME', allowNull: true }).catch(() => {});
          }
          if (!table.notes) {
            await queryInterface.addColumn('rewards', 'notes', { type: 'VARCHAR(255)', allowNull: true }).catch(() => {});
          }
          if (!table.cafeId) {
            await queryInterface.addColumn('rewards', 'cafeId', { type: DataTypes.UUID, allowNull: true }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Migration 002 notice:', err.message);
      }
    }
  },
  {
    id: '003_customer_crm_fields',
    up: async ({ queryInterface }) => {
      try {
        const table = await queryInterface.describeTable('customers').catch(() => null);
        if (table) {
          if (!table.email) {
            await queryInterface.addColumn('customers', 'email', { type: 'VARCHAR(255)', allowNull: true }).catch(() => {});
          }
          if (!table.notes) {
            await queryInterface.addColumn('customers', 'notes', { type: 'VARCHAR(500)', allowNull: true }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Migration 003 notice:', err.message);
      }
    }
  },
  {
    id: '004_staff_fields',
    up: async ({ queryInterface }) => {
      try {
        const usersTable = await queryInterface.describeTable('users').catch(() => null);
        if (usersTable) {
          if (!usersTable.phone) {
            await queryInterface.addColumn('users', 'phone', { type: 'VARCHAR(50)', allowNull: true }).catch(() => {});
          }
          if (!usersTable.status) {
            await queryInterface.addColumn('users', 'status', { type: 'VARCHAR(20)', defaultValue: 'active' }).catch(() => {});
          }
        }
        const rewardsTable = await queryInterface.describeTable('rewards').catch(() => null);
        if (rewardsTable) {
          if (!rewardsTable.redeemedBy) {
            await queryInterface.addColumn('rewards', 'redeemedBy', { type: 'VARCHAR(100)', allowNull: true }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Migration 004 notice:', err.message);
      }
    }
  },
  {
    id: '005_reminder_engine',
    up: async ({ queryInterface }) => {
      try {
        const rulesTable = await queryInterface.describeTable('reminder_rules').catch(() => null);
        if (!rulesTable) {
          await queryInterface.createTable('reminder_rules', {
            id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
            name: { type: 'VARCHAR(255)', allowNull: false },
            triggerType: { type: 'VARCHAR(50)', defaultValue: 'near_reward' },
            daysThreshold: { type: 'INTEGER', defaultValue: 7 },
            channel: { type: 'VARCHAR(20)', defaultValue: 'whatsapp' },
            messageTemplate: { type: 'TEXT', allowNull: true },
            cooldownDays: { type: 'INTEGER', defaultValue: 7 },
            enabled: { type: 'BOOLEAN', defaultValue: true },
            cafeId: { type: DataTypes.UUID, allowNull: true },
            createdAt: { type: 'DATETIME', allowNull: false },
            updatedAt: { type: 'DATETIME', allowNull: false },
          }, { logging: false }).catch(() => {});
        }

        const logsTable = await queryInterface.describeTable('notification_logs').catch(() => null);
        if (!logsTable) {
          await queryInterface.createTable('notification_logs', {
            id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
            customerId: { type: DataTypes.UUID, allowNull: true },
            customerName: { type: 'VARCHAR(255)', allowNull: true },
            customerPhone: { type: 'VARCHAR(50)', allowNull: true },
            reminderRuleId: { type: DataTypes.UUID, allowNull: true },
            triggerType: { type: 'VARCHAR(50)', allowNull: true },
            channel: { type: 'VARCHAR(20)', defaultValue: 'whatsapp' },
            status: { type: 'VARCHAR(20)', defaultValue: 'sent' },
            messageContent: { type: 'TEXT', allowNull: true },
            metadata: { type: 'TEXT', allowNull: true },
            sentAt: { type: 'DATETIME', allowNull: false },
            cafeId: { type: DataTypes.UUID, allowNull: true },
            createdAt: { type: 'DATETIME', allowNull: false },
            updatedAt: { type: 'DATETIME', allowNull: false },
          }, { logging: false }).catch(() => {});
        }
      } catch (err) {
        console.warn('Migration 005 notice:', err.message);
      }
    }
  },
  {
    id: '006_order_item_is_completed',
    up: async ({ queryInterface }) => {
      try {
        const orderItemsTable = await queryInterface.describeTable('order_items').catch(() => null);
        if (orderItemsTable && !orderItemsTable.isCompleted) {
          await queryInterface.addColumn('order_items', 'isCompleted', { type: 'BOOLEAN', defaultValue: false }).catch(() => {});
        }
      } catch (err) {
        console.warn('Migration 006 notice:', err.message);
      }
    }
  },
  {
    id: '007_feedback_system',
    up: async ({ queryInterface }) => {
      try {
        const feedbackTable = await queryInterface.describeTable('feedbacks').catch(() => null);
        if (!feedbackTable) {
          await queryInterface.createTable('feedbacks', {
            id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
            rating: { type: 'INTEGER', allowNull: false },
            sentiment: { type: 'VARCHAR(20)', defaultValue: 'positive' },
            aspects: { type: 'JSON', allowNull: true },
            comment: { type: 'TEXT', allowNull: true },
            customerName: { type: 'VARCHAR(255)', allowNull: true },
            customerPhone: { type: 'VARCHAR(50)', allowNull: true },
            isPublic: { type: 'BOOLEAN', defaultValue: false },
            status: { type: 'VARCHAR(20)', defaultValue: 'new' },
            resolutionNotes: { type: 'TEXT', allowNull: true },
            resolvedAt: { type: 'DATETIME', allowNull: true },
            resolvedBy: { type: 'VARCHAR(255)', allowNull: true },
            orderId: { type: DataTypes.UUID, allowNull: true },
            customerId: { type: DataTypes.UUID, allowNull: true },
            cafeId: { type: DataTypes.UUID, allowNull: false },
            createdAt: { type: 'DATETIME', allowNull: false },
            updatedAt: { type: 'DATETIME', allowNull: false },
          }, { logging: false }).catch(() => {});
        }
      } catch (err) {
        console.warn('Migration 007 notice:', err.message);
      }
    }
  },
  {
    id: '008_cafe_branding_fields',
    up: async ({ queryInterface }) => {
      try {
        const cafeTable = await queryInterface.describeTable('cafes').catch(() => null);
        if (cafeTable) {
          if (!cafeTable.tagline) {
            await queryInterface.addColumn('cafes', 'tagline', { type: 'VARCHAR(255)', allowNull: true }).catch(() => {});
          }
          if (!cafeTable.logo) {
            await queryInterface.addColumn('cafes', 'logo', { type: 'LONGTEXT', allowNull: true }).catch(() => {});
          }
          if (!cafeTable.bannerImage) {
            await queryInterface.addColumn('cafes', 'bannerImage', { type: 'LONGTEXT', allowNull: true }).catch(() => {});
          }
          if (!cafeTable.brandColor) {
            await queryInterface.addColumn('cafes', 'brandColor', { type: 'VARCHAR(50)', defaultValue: '#ea580c' }).catch(() => {});
          }
          if (!cafeTable.wifiSsid) {
            await queryInterface.addColumn('cafes', 'wifiSsid', { type: 'VARCHAR(100)', allowNull: true }).catch(() => {});
          }
          if (!cafeTable.wifiPassword) {
            await queryInterface.addColumn('cafes', 'wifiPassword', { type: 'VARCHAR(100)', allowNull: true }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Migration 008 notice:', err.message);
      }
    }
  },
  {
    id: '009_auth_tokens_and_audit_logs',
    up: async ({ queryInterface }) => {
      try {
        const hasRefresh = await queryInterface.describeTable('refresh_tokens').catch(() => null);
        if (!hasRefresh) {
          await queryInterface.createTable('refresh_tokens', {
            id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
            tokenHash: { type: 'VARCHAR(128)', allowNull: false, unique: true },
            userId: { type: DataTypes.UUID, allowNull: false },
            cafeId: { type: DataTypes.UUID, allowNull: true },
            family: { type: 'VARCHAR(64)', allowNull: false },
            isRevoked: { type: 'TINYINT(1)', defaultValue: 0 },
            expiresAt: { type: 'DATETIME', allowNull: false },
            userAgent: { type: 'VARCHAR(255)', allowNull: true },
            ipAddress: { type: 'VARCHAR(100)', allowNull: true },
            createdAt: { type: 'DATETIME', allowNull: false },
            updatedAt: { type: 'DATETIME', allowNull: false },
          }, { logging: false }).catch(() => {});
        }

        const hasAudit = await queryInterface.describeTable('audit_logs').catch(() => null);
        if (!hasAudit) {
          await queryInterface.createTable('audit_logs', {
            id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
            cafeId: { type: DataTypes.UUID, allowNull: true },
            userId: { type: DataTypes.UUID, allowNull: true },
            userName: { type: 'VARCHAR(255)', defaultValue: 'System' },
            userRole: { type: 'VARCHAR(50)', defaultValue: 'system' },
            action: { type: 'VARCHAR(100)', allowNull: false },
            category: { type: 'VARCHAR(50)', defaultValue: 'auth' },
            details: { type: 'JSON', allowNull: true },
            status: { type: 'VARCHAR(20)', defaultValue: 'success' },
            ipAddress: { type: 'VARCHAR(100)', allowNull: true },
            userAgent: { type: 'VARCHAR(255)', allowNull: true },
            createdAt: { type: 'DATETIME', allowNull: false },
            updatedAt: { type: 'DATETIME', allowNull: false },
          }, { logging: false }).catch(() => {});
        }
      } catch (err) {
        console.warn('Migration 009 notice:', err.message);
      }
    }
  },
  {
    id: '010_tables_and_advanced_reservations',
    up: async ({ queryInterface }) => {
      try {
        const hasTables = await queryInterface.describeTable('cafe_tables').catch(() => null);
        if (!hasTables) {
          await queryInterface.createTable('cafe_tables', {
            id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
            cafeId: { type: DataTypes.UUID, allowNull: false },
            tableNumber: { type: 'VARCHAR(50)', allowNull: false },
            name: { type: 'VARCHAR(255)', allowNull: true },
            capacity: { type: 'INTEGER', defaultValue: 4 },
            section: { type: 'VARCHAR(50)', defaultValue: 'Main Floor' },
            status: { type: 'VARCHAR(50)', defaultValue: 'available' },
            currentBookingId: { type: DataTypes.UUID, allowNull: true },
            isActive: { type: 'TINYINT(1)', defaultValue: 1 },
            createdAt: { type: 'DATETIME', allowNull: false },
            updatedAt: { type: 'DATETIME', allowNull: false },
          }, { logging: false }).catch(() => {});
        }

        const bookingsTable = await queryInterface.describeTable('bookings').catch(() => null);
        if (bookingsTable) {
          if (!bookingsTable.durationMinutes) {
            await queryInterface.addColumn('bookings', 'durationMinutes', { type: 'INTEGER', defaultValue: 90 }).catch(() => {});
          }
          if (!bookingsTable.tableId) {
            await queryInterface.addColumn('bookings', 'tableId', { type: DataTypes.UUID, allowNull: true }).catch(() => {});
          }
          if (!bookingsTable.tableNumber) {
            await queryInterface.addColumn('bookings', 'tableNumber', { type: 'VARCHAR(50)', allowNull: true }).catch(() => {});
          }
          if (!bookingsTable.seatedAt) {
            await queryInterface.addColumn('bookings', 'seatedAt', { type: 'DATETIME', allowNull: true }).catch(() => {});
          }
          if (!bookingsTable.completedAt) {
            await queryInterface.addColumn('bookings', 'completedAt', { type: 'DATETIME', allowNull: true }).catch(() => {});
          }
          if (!bookingsTable.source) {
            await queryInterface.addColumn('bookings', 'source', { type: 'VARCHAR(50)', defaultValue: 'online' }).catch(() => {});
          }
          await queryInterface.sequelize.query("ALTER TABLE bookings MODIFY COLUMN status VARCHAR(50) DEFAULT 'pending';").catch(() => {});
        }
      } catch (err) {
        console.warn('Migration 010 notice:', err.message);
      }
    }
  },
  {
    id: '011_booking_status_expansion',
    up: async ({ queryInterface }) => {
      try {
        await queryInterface.sequelize.query("ALTER TABLE bookings MODIFY COLUMN status VARCHAR(50) DEFAULT 'pending';");
      } catch (err) {
        console.warn('Migration 011 notice:', err.message);
      }
    }
  },
  {
    id: '012_menu_item_modifiers_and_variants',
    up: async ({ queryInterface }) => {
      try {
        const menuTable = await queryInterface.describeTable('menu_items').catch(() => null);
        if (menuTable) {
          if (!menuTable.variants) {
            await queryInterface.addColumn('menu_items', 'variants', { type: 'JSON', allowNull: true }).catch(() => {});
          }
          if (!menuTable.modifierGroups) {
            await queryInterface.addColumn('menu_items', 'modifierGroups', { type: 'JSON', allowNull: true }).catch(() => {});
          }
        }

        const orderItemsTable = await queryInterface.describeTable('order_items').catch(() => null);
        if (orderItemsTable) {
          if (!orderItemsTable.selectedVariant) {
            await queryInterface.addColumn('order_items', 'selectedVariant', { type: 'JSON', allowNull: true }).catch(() => {});
          }
          if (!orderItemsTable.selectedModifiers) {
            await queryInterface.addColumn('order_items', 'selectedModifiers', { type: 'JSON', allowNull: true }).catch(() => {});
          }
          if (!orderItemsTable.notes) {
            await queryInterface.addColumn('order_items', 'notes', { type: 'VARCHAR(255)', allowNull: true }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Migration 012 notice:', err.message);
      }
    }
  },
  {
    id: '013_payment_gateway_metadata',
    up: async ({ queryInterface }) => {
      try {
        const ordersTable = await queryInterface.describeTable('orders').catch(() => null);
        if (ordersTable) {
          if (!ordersTable.paymentTransactionId) {
            await queryInterface.addColumn('orders', 'paymentTransactionId', { type: 'VARCHAR(255)', allowNull: true }).catch(() => {});
          }
          if (!ordersTable.paymentGatewayMeta) {
            await queryInterface.addColumn('orders', 'paymentGatewayMeta', { type: 'JSON', allowNull: true }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Migration 013 notice:', err.message);
      }
    }
  },
  {
    id: '014_shifts_and_discounts',
    up: async ({ queryInterface }) => {
      try {
        const shiftsTable = await queryInterface.describeTable('register_shifts').catch(() => null);
        if (!shiftsTable) {
          await queryInterface.createTable('register_shifts', {
            id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
            cafeId: { type: DataTypes.UUID, allowNull: false },
            userId: { type: DataTypes.UUID, allowNull: false },
            staffName: { type: 'VARCHAR(100)', allowNull: false },
            status: { type: 'VARCHAR(20)', defaultValue: 'open' },
            openedAt: { type: 'DATETIME', allowNull: false },
            closedAt: { type: 'DATETIME', allowNull: true },
            openingFloat: { type: 'FLOAT', defaultValue: 0 },
            closingFloatExpected: { type: 'FLOAT', defaultValue: 0 },
            closingFloatCounted: { type: 'FLOAT', defaultValue: 0 },
            cashVariance: { type: 'FLOAT', defaultValue: 0 },
            notes: { type: 'TEXT', allowNull: true },
            summary: { type: 'JSON', allowNull: true },
            createdAt: { type: 'DATETIME', allowNull: false },
            updatedAt: { type: 'DATETIME', allowNull: false },
          }, { logging: false }).catch(() => {});
        }

        const promoTable = await queryInterface.describeTable('promo_codes').catch(() => null);
        if (!promoTable) {
          await queryInterface.createTable('promo_codes', {
            id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
            cafeId: { type: DataTypes.UUID, allowNull: false },
            code: { type: 'VARCHAR(50)', allowNull: false },
            discountType: { type: 'VARCHAR(20)', defaultValue: 'percent' },
            discountValue: { type: 'FLOAT', allowNull: false },
            minOrderAmount: { type: 'FLOAT', defaultValue: 0 },
            maxDiscountAmount: { type: 'FLOAT', allowNull: true },
            usageLimit: { type: 'INTEGER', allowNull: true },
            usedCount: { type: 'INTEGER', defaultValue: 0 },
            isActive: { type: 'TINYINT(1)', defaultValue: 1 },
            expiresAt: { type: 'DATETIME', allowNull: true },
            createdAt: { type: 'DATETIME', allowNull: false },
            updatedAt: { type: 'DATETIME', allowNull: false },
          }, { logging: false }).catch(() => {});
        }

        const ordersTable = await queryInterface.describeTable('orders').catch(() => null);
        if (ordersTable) {
          if (!ordersTable.shiftId) {
            await queryInterface.addColumn('orders', 'shiftId', { type: DataTypes.UUID, allowNull: true }).catch(() => {});
          }
          if (!ordersTable.discountType) {
            await queryInterface.addColumn('orders', 'discountType', { type: 'VARCHAR(30)', allowNull: true }).catch(() => {});
          }
          if (!ordersTable.discountValue) {
            await queryInterface.addColumn('orders', 'discountValue', { type: 'FLOAT', defaultValue: 0 }).catch(() => {});
          }
          if (!ordersTable.discountReason) {
            await queryInterface.addColumn('orders', 'discountReason', { type: 'VARCHAR(255)', allowNull: true }).catch(() => {});
          }
          if (!ordersTable.discountAuthorizedBy) {
            await queryInterface.addColumn('orders', 'discountAuthorizedBy', { type: 'VARCHAR(100)', allowNull: true }).catch(() => {});
          }
          if (!ordersTable.splitBills) {
            await queryInterface.addColumn('orders', 'splitBills', { type: 'JSON', allowNull: true }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Migration 014 notice:', err.message);
      }
    }
  },
  {
    id: '015_omnichannel_brand_channels',
    up: async () => {
      await ensureOmnichannelSchema();
    }
  },
  {
    id: '016_hardware_printers_edc',
    up: async () => {
      await ensureHardwareSchema();
    }
  },
  {
    id: '017_offline_sync_and_cfd',
    up: async () => {
      await ensureOfflineAndCfdSchema();
    }
  },
  {
    id: '018_waiter_captain_and_table_ops',
    up: async () => {
      await ensureCaptainSchema();
    }
  },
  {
    id: '019_gst_tax_and_tally_sync',
    up: async () => {
      await ensureGstSchema();
    }
  },
  {
    id: '020_commissary_indents_and_inventory',
    up: async () => {
      await ensureCommissarySchema();
    }
  },
  {
    id: '021_staff_attendance_and_payroll',
    up: async () => {
      await ensureStaffOpsSchema();
    }
  },
  {
    id: '022_ai_roastery_os_and_smart_automation',
    up: async () => {
      await ensureAiRoasterySchema();
    }
  },
  {
    id: '023_complete_cafe_schema',
    up: async ({ queryInterface }) => {
      const existingColumns = await queryInterface.describeTable('cafes').catch(() => null);
      if (!existingColumns) return;

      for (const [name, attribute] of Object.entries(Cafe.getAttributes())) {
        if (existingColumns[name]) continue;
        const { type, allowNull, defaultValue } = attribute;
        await queryInterface.addColumn('cafes', name, { type, allowNull, defaultValue });
      }
    }
  },
];
await runMigrations({ sequelize, migrations });
await sequelize.sync();
if (shouldSeedDemoData()) await seed();

const app = express();
const loginLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60000 });
const captainLoginLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 });
const orderLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60000 });
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin))) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.set('trust proxy', config.trustProxyHops);
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  },
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
const health = createHealthHandlers({ authenticate: () => sequelize.authenticate() });
app.get('/api/health', health.live);
app.get('/api/health/live', health.live);
app.get('/api/health/ready', health.ready);
app.use('/api/auth/login', (req, res, next) => {
  if (!loginLimiter(req.ip)) {
    return res.status(429).json({ message: 'Too many login attempts. Please wait a minute and try again.' });
  }
  next();
});
app.use('/api/public/cafes/:slug/captain/login', (req, res, next) => {
  if (!captainLoginLimiter(req.ip)) {
    return res.status(429).json({ message: 'Too many sign-in attempts. Please wait a minute and try again.' });
  }
  next();
});
app.use('/api/public/cafes/:slug/orders', (req, res, next) => {
  if (!orderLimiter(req.ip)) {
    return res.status(429).json({ message: 'Too many order attempts. Please wait a minute and try again.' });
  }
  next();
});
app.use('/api', routes);
app.use((err, _q, res, _n) => { console.error(err); res.status(500).json({ message: 'Something went wrong.' }); });

const server = app.listen(config.port, () => console.log(`GUESTORA API on :${config.port}`));
let shutdownStarted = false;
const shutdown = signal => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.log(`Received ${signal}; stopping API gracefully.`);

  const forceClose = setTimeout(() => {
    console.error('Graceful shutdown timed out; closing active HTTP connections.');
    server.closeAllConnections();
  }, 10000);
  forceClose.unref();

  server.close(async error => {
    clearTimeout(forceClose);
    if (error) {
      console.error('HTTP server shutdown failed:', error);
      process.exitCode = 1;
    }
    try {
      await sequelize.close();
      console.log('Database connections closed.');
    } catch (closeError) {
      console.error('Database shutdown failed:', closeError);
      process.exitCode = 1;
    }
  });
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

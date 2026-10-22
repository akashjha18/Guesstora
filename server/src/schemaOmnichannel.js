import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

/**
 * Ensures Phase 5 Omnichannel and Brand Hierarchy tables and columns exist in the database.
 */
export async function ensureOmnichannelSchema() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    // 1. Brands table
    const brandsTable = await queryInterface.describeTable('brands').catch(() => null);
    if (!brandsTable) {
      await queryInterface.createTable('brands', {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        name: { type: 'VARCHAR(100)', allowNull: false },
        slug: { type: 'VARCHAR(100)', allowNull: false, unique: true },
        logo: { type: 'VARCHAR(255)', allowNull: true },
        headquarters: { type: 'VARCHAR(255)', allowNull: true },
        ownerId: { type: DataTypes.UUID, allowNull: true },
        settings: { type: 'JSON', allowNull: true },
        createdAt: { type: 'DATETIME', allowNull: false },
        updatedAt: { type: 'DATETIME', allowNull: false },
      }, { logging: false }).catch(() => {});
    }

    // 2. Delivery channels table
    const channelsTable = await queryInterface.describeTable('delivery_channels').catch(() => null);
    if (!channelsTable) {
      await queryInterface.createTable('delivery_channels', {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        cafeId: { type: DataTypes.UUID, allowNull: false },
        channel: { type: 'VARCHAR(50)', allowNull: false },
        storeId: { type: 'VARCHAR(100)', allowNull: true },
        status: { type: 'VARCHAR(20)', defaultValue: 'offline' },
        commissionRate: { type: 'FLOAT', defaultValue: 18.0 },
        autoAccept: { type: 'TINYINT(1)', defaultValue: 1 },
        apiKey: { type: 'VARCHAR(255)', allowNull: true },
        webhookSecret: { type: 'VARCHAR(255)', allowNull: true },
        createdAt: { type: 'DATETIME', allowNull: false },
        updatedAt: { type: 'DATETIME', allowNull: false },
      }, { logging: false }).catch(() => {});
    }

    // 3. WhatsApp configs table
    const waTable = await queryInterface.describeTable('whatsapp_configs').catch(() => null);
    if (!waTable) {
      await queryInterface.createTable('whatsapp_configs', {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        cafeId: { type: DataTypes.UUID, allowNull: false },
        phoneNumberId: { type: 'VARCHAR(100)', allowNull: true },
        wabaId: { type: 'VARCHAR(100)', allowNull: true },
        accessToken: { type: 'TEXT', allowNull: true },
        status: { type: 'VARCHAR(20)', defaultValue: 'mock' },
        autoOrderConfirmation: { type: 'TINYINT(1)', defaultValue: 1 },
        autoOrderReady: { type: 'TINYINT(1)', defaultValue: 1 },
        autoLoyaltyAlerts: { type: 'TINYINT(1)', defaultValue: 1 },
        webhookVerifyToken: { type: 'VARCHAR(100)', allowNull: true },
        createdAt: { type: 'DATETIME', allowNull: false },
        updatedAt: { type: 'DATETIME', allowNull: false },
      }, { logging: false }).catch(() => {});
    }

    // 4. Cafes table extensions
    const cafesTable = await queryInterface.describeTable('cafes').catch(() => null);
    if (cafesTable) {
      if (!cafesTable.brandId) {
        await queryInterface.addColumn('cafes', 'brandId', { type: DataTypes.UUID, allowNull: true }).catch(() => {});
      }
    }

    // 5. Orders table extensions
    const ordersTable = await queryInterface.describeTable('orders').catch(() => null);
    if (ordersTable) {
      if (!ordersTable.channel) {
        await queryInterface.addColumn('orders', 'channel', { type: 'VARCHAR(50)', defaultValue: 'pos' }).catch(() => {});
      }
      if (!ordersTable.externalOrderId) {
        await queryInterface.addColumn('orders', 'externalOrderId', { type: 'VARCHAR(100)', allowNull: true }).catch(() => {});
      }
      if (!ordersTable.riderName) {
        await queryInterface.addColumn('orders', 'riderName', { type: 'VARCHAR(100)', allowNull: true }).catch(() => {});
      }
      if (!ordersTable.riderPhone) {
        await queryInterface.addColumn('orders', 'riderPhone', { type: 'VARCHAR(20)', allowNull: true }).catch(() => {});
      }
      if (!ordersTable.channelCommission) {
        await queryInterface.addColumn('orders', 'channelCommission', { type: 'FLOAT', defaultValue: 0 }).catch(() => {});
      }
      if (!ordersTable.brandId) {
        await queryInterface.addColumn('orders', 'brandId', { type: DataTypes.UUID, allowNull: true }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('ensureOmnichannelSchema notice:', err.message);
  }
}

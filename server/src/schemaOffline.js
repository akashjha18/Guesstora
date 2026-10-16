import { sequelize } from './db.js';

export async function ensureOfflineAndCfdSchema() {
  const qi = sequelize.getQueryInterface();

  // 1. Ensure offline columns on orders table
  try {
    const ordersTable = await qi.describeTable('orders').catch(() => null);
    if (ordersTable) {
      if (!ordersTable.offlineId) {
        await qi.addColumn('orders', 'offlineId', {
          type: 'VARCHAR(100)',
          allowNull: true,
        }).catch(() => {});
        await qi.addIndex('orders', ['offlineId'], {
          name: 'idx_orders_offline_id',
          unique: false,
        }).catch(() => {});
      }
      if (!ordersTable.isOffline) {
        await qi.addColumn('orders', 'isOffline', {
          type: 'TINYINT(1)',
          defaultValue: 0,
        }).catch(() => {});
      }
      if (!ordersTable.offlineSyncedAt) {
        await qi.addColumn('orders', 'offlineSyncedAt', {
          type: 'DATETIME',
          allowNull: true,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('ensureOfflineAndCfdSchema orders notice:', err.message);
  }

  // 2. Ensure CFD columns on cafes table
  try {
    const cafesTable = await qi.describeTable('cafes').catch(() => null);
    if (cafesTable) {
      if (!cafesTable.cfdWelcomeTitle) {
        await qi.addColumn('cafes', 'cfdWelcomeTitle', {
          type: 'VARCHAR(255)',
          defaultValue: 'Gusstora Specialty Coffee',
        }).catch(() => {});
      }
      if (!cafesTable.cfdWelcomeSubtitle) {
        await qi.addColumn('cafes', 'cfdWelcomeSubtitle', {
          type: 'VARCHAR(255)',
          defaultValue: 'Handcrafted Roasts & Fresh Bakes',
        }).catch(() => {});
      }
      if (!cafesTable.cfdPromoBanner) {
        await qi.addColumn('cafes', 'cfdPromoBanner', {
          type: 'VARCHAR(500)',
          allowNull: true,
        }).catch(() => {});
      }
      if (!cafesTable.cfdUpiVpa) {
        await qi.addColumn('cafes', 'cfdUpiVpa', {
          type: 'VARCHAR(100)',
          allowNull: true,
        }).catch(() => {});
      }
      if (!cafesTable.cfdIdleMedia) {
        await qi.addColumn('cafes', 'cfdIdleMedia', {
          type: 'TEXT',
          allowNull: true,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('ensureOfflineAndCfdSchema cafes notice:', err.message);
  }
}

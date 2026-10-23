import { sequelize } from './db.js';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User } from './models.js';

export async function ensureCaptainSchema() {
  const qi = sequelize.getQueryInterface();

  // 1. Ensure staff PIN and Captain section assignment
  try {
    const usersTable = await qi.describeTable('users').catch(() => null);
    if (usersTable) {
      if (!usersTable.pin) {
        await qi.addColumn('users', 'pin', {
          type: 'VARCHAR(255)',
          defaultValue: null,
          allowNull: true,
        }).catch(() => {});
      } else {
        await qi.changeColumn('users', 'pin', {
          type: 'VARCHAR(255)',
          defaultValue: null,
          allowNull: true,
        });
        await sequelize.query("UPDATE users SET pin = NULL WHERE pin IN ('1234', '0000')");
      }
      if (!usersTable.assignedSection) {
        await qi.addColumn('users', 'assignedSection', {
          type: 'VARCHAR(50)',
          defaultValue: 'All',
          allowNull: true,
        }).catch(() => {});
      }

      const usersWithPins = await User.findAll({
        where: { pin: { [Op.ne]: null } },
        attributes: ['id', 'pin'],
      });
      for (const user of usersWithPins) {
        if (/^\$2[aby]\$/.test(user.pin)) continue;
        user.pin = /^\d{4}$/.test(user.pin) && !['1234', '0000'].includes(user.pin)
          ? await bcrypt.hash(user.pin, 10)
          : null;
        await user.save({ fields: ['pin'] });
      }
    }
  } catch (err) {
    console.warn('ensureCaptainSchema users notice:', err.message);
  }

  // 2. Ensure Captain & course management columns on orders table
  try {
    const ordersTable = await qi.describeTable('orders').catch(() => null);
    if (ordersTable) {
      if (!ordersTable.captainId) {
        await qi.addColumn('orders', 'captainId', {
          type: 'CHAR(36)',
          allowNull: true,
        }).catch(() => {});
      }
      if (!ordersTable.captainName) {
        await qi.addColumn('orders', 'captainName', {
          type: 'VARCHAR(100)',
          allowNull: true,
        }).catch(() => {});
      }
      if (!ordersTable.courseStatus) {
        await qi.addColumn('orders', 'courseStatus', {
          type: 'JSON',
          allowNull: true,
        }).catch(() => {});
      }
      if (!ordersTable.tableMergedWith) {
        await qi.addColumn('orders', 'tableMergedWith', {
          type: 'VARCHAR(50)',
          allowNull: true,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('ensureCaptainSchema orders notice:', err.message);
  }

  // 3. Ensure course-wise KOT and void security columns on order_items table
  try {
    const orderItemsTable = await qi.describeTable('order_items').catch(() => null);
    if (orderItemsTable) {
      if (!orderItemsTable.course) {
        await qi.addColumn('order_items', 'course', {
          type: 'VARCHAR(30)',
          defaultValue: 'mains',
          allowNull: true,
        }).catch(() => {});
      }
      if (!orderItemsTable.itemStatus) {
        await qi.addColumn('order_items', 'itemStatus', {
          type: 'VARCHAR(30)',
          defaultValue: 'fired',
          allowNull: true,
        }).catch(() => {});
      }
      if (!orderItemsTable.voidReason) {
        await qi.addColumn('order_items', 'voidReason', {
          type: 'VARCHAR(255)',
          allowNull: true,
        }).catch(() => {});
      }
      if (!orderItemsTable.voidAuthorizedBy) {
        await qi.addColumn('order_items', 'voidAuthorizedBy', {
          type: 'VARCHAR(100)',
          allowNull: true,
        }).catch(() => {});
      }
      if (!orderItemsTable.kitchenNotes) {
        await qi.addColumn('order_items', 'kitchenNotes', {
          type: 'VARCHAR(255)',
          allowNull: true,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('ensureCaptainSchema order_items notice:', err.message);
  }

  // 4. Ensure interactive table management columns on cafe_tables table
  try {
    const tablesTable = await qi.describeTable('cafe_tables').catch(() => null);
    if (tablesTable) {
      if (!tablesTable.mergedIntoTableId) {
        await qi.addColumn('cafe_tables', 'mergedIntoTableId', {
          type: 'CHAR(36)',
          allowNull: true,
        }).catch(() => {});
      }
      if (!tablesTable.activeOrderId) {
        await qi.addColumn('cafe_tables', 'activeOrderId', {
          type: 'CHAR(36)',
          allowNull: true,
        }).catch(() => {});
      }
      if (!tablesTable.occupiedSince) {
        await qi.addColumn('cafe_tables', 'occupiedSince', {
          type: 'DATETIME',
          allowNull: true,
        }).catch(() => {});
      }
      if (!tablesTable.guestCount) {
        await qi.addColumn('cafe_tables', 'guestCount', {
          type: 'INTEGER',
          defaultValue: 2,
          allowNull: true,
        }).catch(() => {});
      }
      if (!tablesTable.dinerName) {
        await qi.addColumn('cafe_tables', 'dinerName', {
          type: 'VARCHAR(100)',
          allowNull: true,
        }).catch(() => {});
      }
      if (!tablesTable.dinerPhone) {
        await qi.addColumn('cafe_tables', 'dinerPhone', {
          type: 'VARCHAR(50)',
          allowNull: true,
        }).catch(() => {});
      }
      if (!tablesTable.assignedCaptainId) {
        await qi.addColumn('cafe_tables', 'assignedCaptainId', {
          type: 'CHAR(36)',
          allowNull: true,
        }).catch(() => {});
      }
      if (!tablesTable.assignedCaptainName) {
        await qi.addColumn('cafe_tables', 'assignedCaptainName', {
          type: 'VARCHAR(100)',
          allowNull: true,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('ensureCaptainSchema cafe_tables notice:', err.message);
  }
}

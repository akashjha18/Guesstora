import { sequelize } from './db.js';

export async function ensureHardwareSchema() {
  const qi = sequelize.getQueryInterface();

  // 1. Printer Configurations Table
  await qi.createTable('printer_configs', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    name: { type: 'VARCHAR(255)', allowNull: false },
    role: { type: 'VARCHAR(50)', defaultValue: 'receipt' }, // 'receipt', 'barista_kot', 'kitchen_kot', 'all_kot'
    connectionType: { type: 'VARCHAR(50)', defaultValue: 'network' }, // 'network', 'usb', 'bluetooth', 'browser'
    ipAddress: { type: 'VARCHAR(100)', defaultValue: '127.0.0.1' },
    port: { type: 'INTEGER', defaultValue: 9100 },
    paperWidth: { type: 'INTEGER', defaultValue: 80 }, // 80 or 58
    autoPrintOnOrder: { type: 'TINYINT(1)', defaultValue: 1 },
    autoDrawerKick: { type: 'TINYINT(1)', defaultValue: 0 },
    categories: { type: 'JSON', allowNull: true }, // array of categories routed here
    active: { type: 'TINYINT(1)', defaultValue: 1 },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }, { logging: false }).catch(() => {});

  // 2. EDC Card Terminals Table
  await qi.createTable('edc_terminals', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    name: { type: 'VARCHAR(255)', allowNull: false },
    provider: { type: 'VARCHAR(50)', defaultValue: 'pine_labs' }, // 'pine_labs', 'razorpay_pos', 'mosambee', 'paytm_soundbox'
    terminalId: { type: 'VARCHAR(100)', allowNull: true },
    ipAddress: { type: 'VARCHAR(100)', defaultValue: '192.168.1.150' },
    cloudWebhookKey: { type: 'VARCHAR(255)', allowNull: true },
    autoSettleOrder: { type: 'TINYINT(1)', defaultValue: 1 },
    active: { type: 'TINYINT(1)', defaultValue: 1 },
    lastStatus: { type: 'VARCHAR(50)', defaultValue: 'online' },
    lastTransactionAt: { type: 'DATETIME', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }, { logging: false }).catch(() => {});

  // 3. Hardware Audit Logs Table
  await qi.createTable('hardware_logs', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    deviceType: { type: 'VARCHAR(50)', allowNull: false }, // 'printer', 'edc', 'soundbox', 'scale', 'scanner'
    deviceName: { type: 'VARCHAR(255)', allowNull: true },
    action: { type: 'VARCHAR(100)', allowNull: false },
    status: { type: 'VARCHAR(50)', defaultValue: 'success' }, // 'success', 'failed', 'simulated'
    payload: { type: 'JSON', allowNull: true },
    response: { type: 'JSON', allowNull: true },
    message: { type: 'VARCHAR(500)', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }, { logging: false }).catch(() => {});
}

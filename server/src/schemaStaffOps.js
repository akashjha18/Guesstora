import { sequelize } from './db.js';

export async function ensureStaffOpsSchema() {
  const qi = sequelize.getQueryInterface();

  async function safeAddColumn(table, column, definition) {
    try {
      const desc = await qi.describeTable(table);
      if (!desc[column]) {
        await qi.addColumn(table, column, definition);
      }
    } catch (err) {
      // Table might not exist yet or column already present
    }
  }

  // 1. Extend users table with payroll, wage, and biometric descriptors
  await safeAddColumn('users', 'hourlyWage', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
  await safeAddColumn('users', 'monthlySalary', {
    type: sequelize.Sequelize.FLOAT,
    defaultValue: 0,
  });
  await safeAddColumn('users', 'upiId', {
    type: sequelize.Sequelize.STRING(100),
    allowNull: true,
  });
  await safeAddColumn('users', 'emergencyPhone', {
    type: sequelize.Sequelize.STRING(50),
    allowNull: true,
  });
  await safeAddColumn('users', 'faceDescriptor', {
    type: sequelize.Sequelize.TEXT,
    allowNull: true,
  });

  // 2. Staff Schedules (Shift Rostering & Schedule Planner)
  await qi.createTable('staff_schedules', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    userId: { type: 'CHAR(36)', allowNull: false },
    staffName: { type: 'VARCHAR(100)', allowNull: false },
    date: { type: 'DATEONLY', allowNull: false },
    shiftType: {
      type: 'VARCHAR(40)',
      defaultValue: 'morning', // 'morning', 'afternoon', 'evening', 'night', 'full_day', 'custom'
    },
    startTime: { type: 'VARCHAR(10)', defaultValue: '08:00' },
    endTime: { type: 'VARCHAR(10)', defaultValue: '16:00' },
    role: { type: 'VARCHAR(50)', defaultValue: 'barista' },
    notes: { type: 'TEXT', allowNull: true },
    status: {
      type: 'VARCHAR(30)',
      defaultValue: 'scheduled', // 'scheduled', 'completed', 'absent', 'cancelled', 'swapped'
    },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }).catch(() => {});

  // 3. Staff Attendances (Biometric / Selfie / PIN Time Clock & Breaks)
  await qi.createTable('staff_attendances', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    userId: { type: 'CHAR(36)', allowNull: false },
    scheduleId: { type: 'CHAR(36)', allowNull: true },
    staffName: { type: 'VARCHAR(100)', allowNull: false },
    role: { type: 'VARCHAR(50)', defaultValue: 'barista' },
    date: { type: 'DATEONLY', allowNull: false },
    clockInTime: { type: 'DATETIME', allowNull: false },
    clockOutTime: { type: 'DATETIME', allowNull: true },
    clockInMethod: {
      type: 'VARCHAR(30)',
      defaultValue: 'pin', // 'pin', 'selfie', 'biometric', 'manual_manager'
    },
    clockOutMethod: {
      type: 'VARCHAR(30)',
      allowNull: true,
    },
    selfieUrl: { type: 'LONGTEXT', allowNull: true },
    clockOutSelfieUrl: { type: 'LONGTEXT', allowNull: true },
    status: {
      type: 'VARCHAR(30)',
      defaultValue: 'clocked_in', // 'clocked_in', 'on_break', 'clocked_out'
    },
    totalWorkMinutes: { type: 'INTEGER', defaultValue: 0 },
    totalBreakMinutes: { type: 'INTEGER', defaultValue: 0 },
    netWorkMinutes: { type: 'INTEGER', defaultValue: 0 },
    overtimeMinutes: { type: 'INTEGER', defaultValue: 0 },
    isLate: { type: 'TINYINT(1)', defaultValue: 0 },
    lateMinutes: { type: 'INTEGER', defaultValue: 0 },
    leftEarly: { type: 'TINYINT(1)', defaultValue: 0 },
    breaks: { type: 'JSON', allowNull: true },
    notes: { type: 'TEXT', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }).catch(() => {});

  // 4. Tip Pools (Daily / Shift Tip Jar & Service Charge Pool)
  await qi.createTable('tip_pools', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    shiftId: { type: 'CHAR(36)', allowNull: true },
    title: { type: 'VARCHAR(255)', allowNull: false },
    date: { type: 'DATEONLY', allowNull: false },
    periodStart: { type: 'DATETIME', allowNull: true },
    periodEnd: { type: 'DATETIME', allowNull: true },
    cashTips: { type: 'FLOAT', defaultValue: 0 },
    cardTips: { type: 'FLOAT', defaultValue: 0 },
    serviceChargeAmount: { type: 'FLOAT', defaultValue: 0 },
    totalAmount: { type: 'FLOAT', defaultValue: 0 },
    distributionMethod: {
      type: 'VARCHAR(40)',
      defaultValue: 'role_weighted', // 'role_weighted', 'hours_worked', 'equal_split'
    },
    roleWeights: { type: 'JSON', allowNull: true },
    status: {
      type: 'VARCHAR(30)',
      defaultValue: 'open', // 'open', 'calculated', 'settled', 'cancelled'
    },
    calculatedAt: { type: 'DATETIME', allowNull: true },
    settledAt: { type: 'DATETIME', allowNull: true },
    settledBy: { type: 'VARCHAR(100)', allowNull: true },
    notes: { type: 'TEXT', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }).catch(() => {});

  // 5. Tip Distributions (Individual Staff Payout Ledger)
  await qi.createTable('tip_distributions', {
    id: { type: 'CHAR(36)', allowNull: false, primaryKey: true },
    tipPoolId: { type: 'CHAR(36)', allowNull: false },
    cafeId: { type: 'CHAR(36)', allowNull: false },
    userId: { type: 'CHAR(36)', allowNull: false },
    staffName: { type: 'VARCHAR(100)', allowNull: false },
    role: { type: 'VARCHAR(50)', defaultValue: 'barista' },
    hoursWorked: { type: 'FLOAT', defaultValue: 0 },
    weightApplied: { type: 'FLOAT', defaultValue: 1.0 },
    sharePercent: { type: 'FLOAT', defaultValue: 0 },
    allocatedAmount: { type: 'FLOAT', defaultValue: 0 },
    status: {
      type: 'VARCHAR(30)',
      defaultValue: 'pending', // 'pending', 'paid'
    },
    payoutMethod: {
      type: 'VARCHAR(30)',
      defaultValue: 'cash', // 'cash', 'upi', 'bank_transfer', 'salary_credit'
    },
    paymentRef: { type: 'VARCHAR(100)', allowNull: true },
    paidAt: { type: 'DATETIME', allowNull: true },
    notes: { type: 'TEXT', allowNull: true },
    createdAt: { type: 'DATETIME', allowNull: false },
    updatedAt: { type: 'DATETIME', allowNull: false },
  }).catch(() => {});

  // Create indexes for high-speed queries
  try {
    await qi.addIndex('staff_schedules', ['cafeId', 'date']).catch(() => {});
    await qi.addIndex('staff_schedules', ['userId']).catch(() => {});
    await qi.addIndex('staff_attendances', ['cafeId', 'date']).catch(() => {});
    await qi.addIndex('staff_attendances', ['userId', 'date']).catch(() => {});
    await qi.addIndex('staff_attendances', ['status']).catch(() => {});
    await qi.addIndex('tip_pools', ['cafeId', 'date']).catch(() => {});
    await qi.addIndex('tip_pools', ['status']).catch(() => {});
    await qi.addIndex('tip_distributions', ['tipPoolId']).catch(() => {});
    await qi.addIndex('tip_distributions', ['userId']).catch(() => {});
  } catch (idxErr) {
    // Indexes might already exist
  }
}

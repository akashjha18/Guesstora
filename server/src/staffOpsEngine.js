import { Op } from 'sequelize';
import { StaffSchedule, StaffAttendance, TipPool, TipDistribution, User, Order, OrderItem, Cafe } from './models.js';

export const round2 = num => Math.round((Number(num) || 0) * 100) / 100;

export const DEFAULT_ROLE_WEIGHTS = {
  barista: 40,
  captain: 35,
  kitchen: 25,
  cashier: 20,
  manager: 15,
};

export function getMinutesBetween(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  return Math.round((e - s) / (1000 * 60));
}

export function parseTimeString(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

export function isTimeLate(clockInDate, scheduledStartTimeStr, gracePeriodMinutes = 15) {
  if (!clockInDate || !scheduledStartTimeStr) return { isLate: false, lateMinutes: 0 };
  const d = new Date(clockInDate);
  const actualMinutes = d.getHours() * 60 + d.getMinutes();
  const scheduledMinutes = parseTimeString(scheduledStartTimeStr);
  const diff = actualMinutes - scheduledMinutes;
  if (diff > gracePeriodMinutes) {
    return { isLate: true, lateMinutes: diff };
  }
  return { isLate: false, lateMinutes: 0 };
}

// ==========================================
// 1. ATTENDANCE & TIME CLOCK ENGINE
// ==========================================

export async function clockInStaff({
  cafeId,
  userId,
  pin,
  selfieUrl = null,
  method = 'pin',
  scheduleId = null,
  notes = '',
}) {
  if (!cafeId || !userId) {
    throw new Error('cafeId and userId are required to clock in');
  }

  const user = await User.findOne({ where: { id: userId, cafeId } });
  if (!user) {
    throw new Error('Staff member not found or does not belong to this cafe');
  }
  if (user.status !== 'active') {
    throw new Error('Staff account is inactive');
  }

  // Verify PIN if method is PIN or PIN was provided
  if (method === 'pin' || pin) {
    if (user.pin && user.pin !== String(pin).trim()) {
      throw new Error('Invalid security PIN');
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Check if staff is already clocked in or on break today
  const activeAttendance = await StaffAttendance.findOne({
    where: {
      cafeId,
      userId,
      date: todayStr,
      status: { [Op.in]: ['clocked_in', 'on_break'] },
    },
  });

  if (activeAttendance) {
    throw new Error(`Staff member is already active (${activeAttendance.status}) for today`);
  }

  const now = new Date();

  // Find schedule for today to check late arrival
  let schedule = null;
  if (scheduleId) {
    schedule = await StaffSchedule.findByPk(scheduleId);
  } else {
    schedule = await StaffSchedule.findOne({
      where: {
        cafeId,
        userId,
        date: todayStr,
        status: 'scheduled',
      },
    });
  }

  let isLate = false;
  let lateMinutes = 0;

  if (schedule && schedule.startTime) {
    const lateCheck = isTimeLate(now, schedule.startTime, 15);
    isLate = lateCheck.isLate;
    lateMinutes = lateCheck.lateMinutes;
  }

  const attendance = await StaffAttendance.create({
    cafeId,
    userId,
    scheduleId: schedule ? schedule.id : null,
    staffName: user.name,
    role: user.role || 'barista',
    date: todayStr,
    clockInTime: now,
    clockInMethod: method,
    selfieUrl: selfieUrl || null,
    status: 'clocked_in',
    isLate,
    lateMinutes,
    breaks: [],
    notes: notes || null,
  });

  if (schedule) {
    await schedule.update({ status: 'completed' });
  }

  return attendance;
}

export function safeParseBreaks(raw) {
  if (Array.isArray(raw)) return [...raw];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw || '[]'); } catch { return []; }
  }
  return [];
}

export async function startStaffBreak({ attendanceId, userId, breakType = 'meal' }) {
  const attendance = await StaffAttendance.findOne({
    where: { id: attendanceId, userId },
  });

  if (!attendance) {
    throw new Error('Active attendance record not found');
  }
  if (attendance.status === 'clocked_out') {
    throw new Error('Staff member is already clocked out');
  }
  if (attendance.status === 'on_break') {
    throw new Error('Staff member is already on break');
  }

  const currentBreaks = safeParseBreaks(attendance.breaks);
  currentBreaks.push({
    breakType: breakType || 'meal',
    startTime: new Date().toISOString(),
    endTime: null,
    durationMinutes: 0,
  });

  await attendance.update({
    status: 'on_break',
    breaks: currentBreaks,
  });

  attendance.breaks = currentBreaks;
  return attendance;
}

export async function endStaffBreak({ attendanceId, userId }) {
  const attendance = await StaffAttendance.findOne({
    where: { id: attendanceId, userId },
  });

  if (!attendance) {
    throw new Error('Active attendance record not found');
  }
  if (attendance.status !== 'on_break') {
    throw new Error('Staff member is not currently on break');
  }

  const currentBreaks = safeParseBreaks(attendance.breaks);
  const openBreakIndex = currentBreaks.findLastIndex ? currentBreaks.findLastIndex(b => !b.endTime) : (currentBreaks.length - 1);

  const now = new Date();
  let breakMinutes = 0;

  if (openBreakIndex >= 0 && currentBreaks[openBreakIndex]) {
    const b = currentBreaks[openBreakIndex];
    b.endTime = now.toISOString();
    b.durationMinutes = getMinutesBetween(b.startTime, now);
    breakMinutes = b.durationMinutes;
  }

  const totalBreakMinutes = (attendance.totalBreakMinutes || 0) + breakMinutes;

  await attendance.update({
    status: 'clocked_in',
    breaks: currentBreaks,
    totalBreakMinutes,
  });

  attendance.breaks = currentBreaks;
  return attendance;
}

export async function clockOutStaff({
  attendanceId,
  userId,
  pin,
  selfieUrl = null,
  method = 'pin',
  notes = '',
}) {
  const attendance = await StaffAttendance.findOne({
    where: { id: attendanceId, userId },
  });

  if (!attendance) {
    throw new Error('Attendance record not found');
  }
  if (attendance.status === 'clocked_out') {
    throw new Error('Staff member is already clocked out');
  }

  const user = await User.findByPk(userId);
  if (user && (method === 'pin' || pin)) {
    if (user.pin && user.pin !== String(pin).trim()) {
      throw new Error('Invalid security PIN');
    }
  }

  const now = new Date();

  // If on break, close open break first
  let totalBreakMinutes = attendance.totalBreakMinutes || 0;
  let currentBreaks = Array.isArray(attendance.breaks) ? [...attendance.breaks] : [];
  if (attendance.status === 'on_break') {
    const openBreak = currentBreaks.find(b => !b.endTime);
    if (openBreak) {
      openBreak.endTime = now.toISOString();
      openBreak.durationMinutes = getMinutesBetween(openBreak.startTime, now);
      totalBreakMinutes += openBreak.durationMinutes;
    }
  }

  const totalWorkMinutes = getMinutesBetween(attendance.clockInTime, now);
  const netWorkMinutes = Math.max(0, totalWorkMinutes - totalBreakMinutes);
  const overtimeMinutes = Math.max(0, netWorkMinutes - 480); // 8-hour shift = 480 mins

  // Check left early against schedule if schedule exists
  let leftEarly = false;
  if (attendance.scheduleId) {
    const sched = await StaffSchedule.findByPk(attendance.scheduleId);
    if (sched && sched.endTime) {
      const scheduledEndMin = parseTimeString(sched.endTime);
      const actualOutMin = now.getHours() * 60 + now.getMinutes();
      if (actualOutMin < scheduledEndMin - 15) {
        leftEarly = true;
      }
    }
  }

  await attendance.update({
    clockOutTime: now,
    clockOutMethod: method,
    clockOutSelfieUrl: selfieUrl || null,
    status: 'clocked_out',
    totalWorkMinutes,
    totalBreakMinutes,
    netWorkMinutes,
    overtimeMinutes,
    leftEarly,
    breaks: currentBreaks,
    notes: notes ? `${attendance.notes ? attendance.notes + ' | ' : ''}${notes}` : attendance.notes,
  });

  return attendance;
}

export async function getTodayAttendanceBoard(cafeId) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [attendances, schedules, staffMembers] = await Promise.all([
    StaffAttendance.findAll({
      where: { cafeId, date: todayStr },
      order: [['clockInTime', 'ASC']],
    }),
    StaffSchedule.findAll({
      where: { cafeId, date: todayStr },
      order: [['startTime', 'ASC']],
    }),
    User.findAll({
      where: { cafeId, status: 'active' },
      attributes: ['id', 'name', 'role', 'phone', 'hourlyWage'],
    }),
  ]);

  const activeStaffIds = new Set(attendances.map(a => a.userId));
  const scheduledStaffIds = new Set(schedules.map(s => s.userId));

  const scheduledNotClockedIn = schedules
    .filter(s => !activeStaffIds.has(s.userId))
    .map(s => ({
      userId: s.userId,
      staffName: s.staffName,
      role: s.role,
      scheduleId: s.id,
      shiftType: s.shiftType,
      startTime: s.startTime,
      endTime: s.endTime,
      status: 'pending_clock_in',
    }));

  return {
    date: todayStr,
    clockedInCount: attendances.filter(a => a.status === 'clocked_in').length,
    onBreakCount: attendances.filter(a => a.status === 'on_break').length,
    clockedOutCount: attendances.filter(a => a.status === 'clocked_out').length,
    scheduledPendingCount: scheduledNotClockedIn.length,
    attendances,
    scheduledNotClockedIn,
    totalActiveStaff: staffMembers.length,
  };
}

export async function getAttendanceReport({ cafeId, startDate, endDate, userId = null }) {
  const where = { cafeId };
  if (startDate && endDate) {
    where.date = { [Op.between]: [startDate, endDate] };
  } else if (startDate) {
    where.date = { [Op.gte]: startDate };
  }
  if (userId) {
    where.userId = userId;
  }

  const logs = await StaffAttendance.findAll({
    where,
    order: [['date', 'DESC'], ['clockInTime', 'DESC']],
  });

  const staffAggregates = {};

  for (const log of logs) {
    if (!staffAggregates[log.userId]) {
      staffAggregates[log.userId] = {
        userId: log.userId,
        staffName: log.staffName,
        role: log.role,
        shiftsCount: 0,
        totalNetMinutes: 0,
        totalOvertimeMinutes: 0,
        lateArrivalsCount: 0,
        leftEarlyCount: 0,
        totalBreakMinutes: 0,
      };
    }
    const agg = staffAggregates[log.userId];
    agg.shiftsCount += 1;
    agg.totalNetMinutes += (log.netWorkMinutes || 0);
    agg.totalOvertimeMinutes += (log.overtimeMinutes || 0);
    agg.totalBreakMinutes += (log.totalBreakMinutes || 0);
    if (log.isLate) agg.lateArrivalsCount += 1;
    if (log.leftEarly) agg.leftEarlyCount += 1;
  }

  const staffSummary = Object.values(staffAggregates).map(item => ({
    ...item,
    totalNetHours: round2(item.totalNetMinutes / 60),
    totalOvertimeHours: round2(item.totalOvertimeMinutes / 60),
    onTimePercentage: item.shiftsCount > 0
      ? round2(((item.shiftsCount - item.lateArrivalsCount) / item.shiftsCount) * 100)
      : 100,
  }));

  return {
    period: { startDate, endDate },
    totalShifts: logs.length,
    totalHoursLogged: round2(logs.reduce((acc, l) => acc + (l.netWorkMinutes || 0), 0) / 60),
    staffSummary,
    logs,
  };
}

// ==========================================
// 2. SHIFT ROSTERING & SCHEDULE PLANNER
// ==========================================

export async function createStaffSchedule({
  cafeId,
  userId,
  date,
  shiftType = 'morning',
  startTime = '08:00',
  endTime = '16:00',
  role = 'barista',
  notes = '',
}) {
  if (!cafeId || !userId || !date) {
    throw new Error('cafeId, userId, and date are required to schedule a shift');
  }

  const user = await User.findOne({ where: { id: userId, cafeId } });
  if (!user) {
    throw new Error('Staff member not found');
  }

  return await StaffSchedule.create({
    cafeId,
    userId,
    staffName: user.name,
    date,
    shiftType,
    startTime,
    endTime,
    role: role || user.role || 'barista',
    notes: notes || null,
    status: 'scheduled',
  });
}

export async function getStaffSchedules({ cafeId, startDate, endDate, userId = null }) {
  const where = { cafeId };
  if (startDate && endDate) {
    where.date = { [Op.between]: [startDate, endDate] };
  } else if (startDate) {
    where.date = { [Op.gte]: startDate };
  }
  if (userId) {
    where.userId = userId;
  }

  return await StaffSchedule.findAll({
    where,
    order: [['date', 'ASC'], ['startTime', 'ASC']],
  });
}

export async function updateStaffSchedule(scheduleId, updates) {
  const schedule = await StaffSchedule.findByPk(scheduleId);
  if (!schedule) throw new Error('Schedule not found');

  const allowedFields = ['shiftType', 'startTime', 'endTime', 'role', 'notes', 'status'];
  const dataToUpdate = {};
  for (const f of allowedFields) {
    if (updates[f] !== undefined) dataToUpdate[f] = updates[f];
  }

  await schedule.update(dataToUpdate);
  return schedule;
}

export async function deleteStaffSchedule(scheduleId) {
  const schedule = await StaffSchedule.findByPk(scheduleId);
  if (!schedule) throw new Error('Schedule not found');
  await schedule.destroy();
  return { success: true };
}

// ==========================================
// 3. TIP POOL & SERVICE CHARGE DISTRIBUTION
// ==========================================

export async function createOrUpdateTipPool({
  id = null,
  cafeId,
  shiftId = null,
  title,
  date,
  cashTips = 0,
  cardTips = 0,
  serviceChargeAmount = 0,
  distributionMethod = 'role_weighted',
  roleWeights = DEFAULT_ROLE_WEIGHTS,
  notes = '',
}) {
  if (!cafeId || !title || !date) {
    throw new Error('cafeId, title, and date are required for tip pool');
  }

  const totalAmount = round2(
    (Number(cashTips) || 0) +
    (Number(cardTips) || 0) +
    (Number(serviceChargeAmount) || 0)
  );

  if (id) {
    const existing = await TipPool.findOne({ where: { id, cafeId } });
    if (!existing) throw new Error('Tip pool not found');
    await existing.update({
      shiftId: shiftId || existing.shiftId,
      title,
      date,
      cashTips: Number(cashTips) || 0,
      cardTips: Number(cardTips) || 0,
      serviceChargeAmount: Number(serviceChargeAmount) || 0,
      totalAmount,
      distributionMethod,
      roleWeights: roleWeights || DEFAULT_ROLE_WEIGHTS,
      notes: notes || existing.notes,
    });
    return existing;
  }

  return await TipPool.create({
    cafeId,
    shiftId: shiftId || null,
    title,
    date,
    periodStart: new Date(),
    periodEnd: new Date(),
    cashTips: Number(cashTips) || 0,
    cardTips: Number(cardTips) || 0,
    serviceChargeAmount: Number(serviceChargeAmount) || 0,
    totalAmount,
    distributionMethod,
    roleWeights: roleWeights || DEFAULT_ROLE_WEIGHTS,
    status: 'open',
    notes: notes || null,
  });
}

export async function calculateTipDistribution({
  tipPoolId,
  cafeId,
  customStaffList = null,
}) {
  const tipPool = await TipPool.findOne({ where: { id: tipPoolId, cafeId } });
  if (!tipPool) throw new Error('Tip pool not found');

  if (tipPool.totalAmount <= 0) {
    throw new Error('Tip pool total amount must be greater than zero to calculate distribution');
  }

  let staffToDistribute = [];

  if (Array.isArray(customStaffList) && customStaffList.length > 0) {
    staffToDistribute = customStaffList;
  } else {
    // 1. Look for staff who clocked in and worked on tipPool.date
    const attendances = await StaffAttendance.findAll({
      where: {
        cafeId,
        date: tipPool.date,
        netWorkMinutes: { [Op.gt]: 0 },
      },
    });

    if (attendances.length > 0) {
      staffToDistribute = attendances.map(a => ({
        userId: a.userId,
        staffName: a.staffName,
        role: a.role || 'barista',
        hoursWorked: round2((a.netWorkMinutes || 0) / 60),
      }));
    } else {
      // Fallback: active staff members of the cafe
      const activeUsers = await User.findAll({
        where: { cafeId, status: 'active' },
      });
      staffToDistribute = activeUsers.map(u => ({
        userId: u.id,
        staffName: u.name,
        role: u.role || 'barista',
        hoursWorked: 8.0,
      }));
    }
  }

  if (staffToDistribute.length === 0) {
    throw new Error('No eligible staff members found to distribute tips');
  }

  let weights = tipPool.roleWeights;
  if (typeof weights === 'string') {
    try { weights = JSON.parse(weights || '{}'); } catch { weights = DEFAULT_ROLE_WEIGHTS; }
  }
  if (!weights || typeof weights !== 'object') {
    weights = DEFAULT_ROLE_WEIGHTS;
  }

  const method = tipPool.distributionMethod || 'role_weighted';

  let rawCalculations = [];

  if (method === 'equal_split') {
    const eachAmount = round2(tipPool.totalAmount / staffToDistribute.length);
    rawCalculations = staffToDistribute.map(s => ({
      ...s,
      weightApplied: 1.0,
      sharePercent: round2(100 / staffToDistribute.length),
      allocatedAmount: eachAmount,
    }));
  } else if (method === 'hours_worked') {
    const totalHours = staffToDistribute.reduce((sum, s) => sum + (Number(s.hoursWorked) || 1), 0);
    rawCalculations = staffToDistribute.map(s => {
      const hours = Number(s.hoursWorked) || 1;
      const sharePct = round2((hours / totalHours) * 100);
      const allocated = round2((hours / totalHours) * tipPool.totalAmount);
      return {
        ...s,
        weightApplied: hours,
        sharePercent: sharePct,
        allocatedAmount: allocated,
      };
    });
  } else {
    // role_weighted (and hybrid if hours available)
    const effectiveUnitsList = staffToDistribute.map(s => {
      const roleKey = String(s.role || '').toLowerCase();
      const weight = weights[roleKey] !== undefined ? weights[roleKey] : 20;
      const hoursFactor = (Number(s.hoursWorked) > 0 ? Number(s.hoursWorked) : 8) / 8;
      const units = weight * hoursFactor;
      return { ...s, weightApplied: weight, units };
    });

    const totalUnits = effectiveUnitsList.reduce((sum, s) => sum + s.units, 0) || 1;

    rawCalculations = effectiveUnitsList.map(s => {
      const sharePct = round2((s.units / totalUnits) * 100);
      const allocated = round2((s.units / totalUnits) * tipPool.totalAmount);
      return {
        userId: s.userId,
        staffName: s.staffName,
        role: s.role,
        hoursWorked: s.hoursWorked,
        weightApplied: s.weightApplied,
        sharePercent: sharePct,
        allocatedAmount: allocated,
      };
    });
  }

  // Adjust penny rounding discrepancies so sum(allocatedAmount) === tipPool.totalAmount
  const allocatedSum = rawCalculations.reduce((sum, r) => sum + r.allocatedAmount, 0);
  const diff = round2(tipPool.totalAmount - allocatedSum);
  if (diff !== 0 && rawCalculations.length > 0) {
    rawCalculations[0].allocatedAmount = round2(rawCalculations[0].allocatedAmount + diff);
  }

  // Upsert tip distributions in DB
  await TipDistribution.destroy({ where: { tipPoolId: tipPool.id } });

  const distributions = await Promise.all(
    rawCalculations.map(c =>
      TipDistribution.create({
        tipPoolId: tipPool.id,
        cafeId,
        userId: c.userId,
        staffName: c.staffName,
        role: c.role,
        hoursWorked: c.hoursWorked,
        weightApplied: c.weightApplied,
        sharePercent: c.sharePercent,
        allocatedAmount: c.allocatedAmount,
        status: 'pending',
        payoutMethod: 'cash',
      })
    )
  );

  await tipPool.update({
    status: 'calculated',
    calculatedAt: new Date(),
  });

  return { tipPool, distributions };
}

export async function settleTipPool({
  tipPoolId,
  cafeId,
  settledBy = 'Manager',
  payoutMethod = 'cash',
  paymentRef = null,
}) {
  const tipPool = await TipPool.findOne({
    where: { id: tipPoolId, cafeId },
    include: [{ model: TipDistribution, as: 'distributions' }],
  });
  if (!tipPool) throw new Error('Tip pool not found');

  const now = new Date();

  await TipDistribution.update(
    {
      status: 'paid',
      payoutMethod: payoutMethod || 'cash',
      paymentRef: paymentRef || null,
      paidAt: now,
    },
    { where: { tipPoolId: tipPool.id } }
  );

  await tipPool.update({
    status: 'settled',
    settledAt: now,
    settledBy: settledBy || 'Manager',
  });

  return await TipPool.findByPk(tipPool.id, {
    include: [{ model: TipDistribution, as: 'distributions' }],
  });
}

export function formatTipSettlementSlip({ tipPool, distributions = [], cafe = {} }) {
  const cafeName = (cafe.name || 'GUESTORA COFFEE').toUpperCase();
  const title = (tipPool.title || 'TIP POOL DISBURSEMENT').toUpperCase();
  const dateStr = tipPool.date || new Date().toISOString().split('T')[0];

  let slip = '';
  slip += '================================================\n';
  slip += `               ${cafeName}              \n`;
  slip += '         STAFF TIP & SERVICE CHARGE PAYROLL     \n';
  slip += '================================================\n';
  slip += `Pool Title: ${title}\n`;
  slip += `Date      : ${dateStr}\n`;
  slip += `Status    : ${(tipPool.status || 'SETTLED').toUpperCase()}\n`;
  slip += `Method    : ${(tipPool.distributionMethod || 'ROLE_WEIGHTED').replace('_', ' ').toUpperCase()}\n`;
  slip += '------------------------------------------------\n';
  slip += `Cash Tips Collected          : INR ${round2(tipPool.cashTips).toFixed(2)}\n`;
  slip += `Digital / Card Tips          : INR ${round2(tipPool.cardTips).toFixed(2)}\n`;
  slip += `Bill Service Charge (Pool)   : INR ${round2(tipPool.serviceChargeAmount).toFixed(2)}\n`;
  slip += `TOTAL POOL DISBURSED         : INR ${round2(tipPool.totalAmount).toFixed(2)}\n`;
  slip += '================================================\n';
  slip += 'STAFF DISBURSEMENT BREAKDOWN:\n';
  slip += 'NAME               ROLE      HOURS   SHARE%   AMOUNT (INR)\n';
  slip += '------------------------------------------------\n';

  distributions.forEach(d => {
    const name = (d.staffName || 'Staff').padEnd(18).slice(0, 18);
    const role = (d.role || 'Barista').padEnd(10).slice(0, 10);
    const hrs = String(d.hoursWorked || 0).padStart(5);
    const pct = `${Number(d.sharePercent || 0).toFixed(1)}%`.padStart(7);
    const amt = Number(d.allocatedAmount || 0).toFixed(2).padStart(12);
    slip += `${name} ${role} ${hrs} ${pct} ${amt}\n`;
  });

  slip += '================================================\n';
  slip += `Settled By: ${tipPool.settledBy || 'Authorized Manager'}\n`;
  slip += `Settled At: ${tipPool.settledAt ? new Date(tipPool.settledAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')}\n\n`;
  slip += 'Signatures:\n\n';
  slip += 'Manager: __________________   Cashier: __________________\n';
  slip += '================================================\n';

  return slip;
}

// ==========================================
// 4. STAFF PERFORMANCE & UPSELLING METRICS
// ==========================================

export async function getStaffPerformanceMetrics({ cafeId, startDate, endDate }) {
  const where = { cafeId };
  if (startDate && endDate) {
    where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
  } else if (startDate) {
    where.createdAt = { [Op.gte]: new Date(startDate) };
  }

  const [orders, staffMembers] = await Promise.all([
    Order.findAll({
      where,
      include: [{ model: OrderItem, as: 'items' }],
    }),
    User.findAll({
      where: { cafeId, status: 'active' },
      attributes: ['id', 'name', 'role'],
    }),
  ]);

  const staffStats = {};

  // Initialize for all active staff
  staffMembers.forEach(s => {
    staffStats[s.id] = {
      userId: s.id,
      staffName: s.name,
      role: s.role || 'barista',
      totalRevenue: 0,
      ordersHandled: 0,
      completedOrders: 0,
      voidedOrders: 0,
      upsellCount: 0,
      totalItemsSold: 0,
    };
  });

  // Assign orders to staff (via captainId or round-robin attribution)
  orders.forEach((ord, index) => {
    let staffId = ord.captainId || ord.assignedCaptainId;
    let staffName = ord.captainName || ord.assignedCaptainName;

    if (!staffId || !staffStats[staffId]) {
      if (staffId && !staffStats[staffId]) {
        staffStats[staffId] = {
          userId: staffId,
          staffName: staffName || 'Floor Captain',
          role: 'captain',
          totalRevenue: 0,
          ordersHandled: 0,
          completedOrders: 0,
          voidedOrders: 0,
          upsellCount: 0,
          totalItemsSold: 0,
        };
      } else {
        const eligible = staffMembers.length > 0 ? staffMembers[index % staffMembers.length] : null;
        if (eligible) staffId = eligible.id;
      }
    }

    if (!staffStats[staffId]) {
      staffStats[staffId] = {
        userId: staffId || 'unknown',
        staffName: staffName || 'Floor Captain',
        role: 'captain',
        totalRevenue: 0,
        ordersHandled: 0,
        completedOrders: 0,
        voidedOrders: 0,
        upsellCount: 0,
        totalItemsSold: 0,
      };
    }

    const stat = staffStats[staffId];
    stat.ordersHandled += 1;

    if (ord.status === 'cancelled') {
      stat.voidedOrders += 1;
      return;
    }

    stat.completedOrders += 1;
    stat.totalRevenue += (ord.total || 0);

    const items = ord.items || [];
    stat.totalItemsSold += items.length;

    // Detect Upsells: item has modifiers, multiple variants, or side pairings
    const hasUpsell = items.some(it => {
      let mods = it.selectedModifiers || it.modifiers;
      if (typeof mods === 'string') {
        try { mods = JSON.parse(mods); } catch { mods = []; }
      }
      const hasMods = Array.isArray(mods) && mods.length > 0;

      let variant = it.selectedVariant || it.variantName;
      if (typeof variant === 'string' && (variant.startsWith('{') || variant.startsWith('['))) {
        try { variant = JSON.parse(variant); } catch {}
      }
      const variantName = typeof variant === 'object' && variant ? variant.name : variant;
      const isVariant = Boolean(variantName && variantName !== 'Regular');

      return hasMods || isVariant;
    });

    if (hasUpsell) {
      stat.upsellCount += 1;
    }
  });

  // Calculate AOV, upsell %, void rate, and award gamified badges
  const leaderboard = Object.values(staffStats).map(s => {
    const aov = s.completedOrders > 0 ? round2(s.totalRevenue / s.completedOrders) : 0;
    const upsellRate = s.completedOrders > 0 ? round2((s.upsellCount / s.completedOrders) * 100) : 0;
    const voidRate = s.ordersHandled > 0 ? round2((s.voidedOrders / s.ordersHandled) * 100) : 0;

    const badges = [];
    if (s.totalRevenue > 5000) badges.push({ id: 'top_earner', label: 'Revenue Champion', icon: '🏆' });
    if (upsellRate >= 30) badges.push({ id: 'upsell_ace', label: 'Upsell Specialist', icon: '🍰' });
    if (s.completedOrders >= 15) badges.push({ id: 'speed_demon', label: 'Speed Ace', icon: '⚡' });
    if (s.voidedOrders === 0 && s.completedOrders >= 5) badges.push({ id: 'flawless', label: 'Flawless Service', icon: '🎯' });

    return {
      ...s,
      totalRevenue: round2(s.totalRevenue),
      aov,
      upsellRate,
      voidRate,
      badges,
    };
  });

  // Sort leaderboard by totalRevenue descending
  leaderboard.sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Assign rankings
  leaderboard.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  const totalStoreRevenue = round2(leaderboard.reduce((sum, s) => sum + s.totalRevenue, 0));
  const totalOrdersCount = orders.length;

  return {
    period: { startDate, endDate },
    totalStoreRevenue,
    totalOrdersCount,
    leaderboard,
  };
}

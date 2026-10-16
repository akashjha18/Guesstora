import { Router } from 'express';
import { requireStaff, requireRole } from '../auth.js';
import { Cafe, TipPool, TipDistribution } from '../models.js';
import {
  clockInStaff,
  startStaffBreak,
  endStaffBreak,
  clockOutStaff,
  getTodayAttendanceBoard,
  getAttendanceReport,
  createStaffSchedule,
  getStaffSchedules,
  updateStaffSchedule,
  deleteStaffSchedule,
  createOrUpdateTipPool,
  calculateTipDistribution,
  settleTipPool,
  formatTipSettlementSlip,
  getStaffPerformanceMetrics,
} from '../staffOpsEngine.js';
import {
  serializeStaffSchedule,
  serializeStaffAttendance,
  serializeTipPool,
} from './serializers.js';

export const staffOpsRouter = Router();

// All staff operations require authenticated staff token
staffOpsRouter.use(requireStaff);

// ==========================================
// 1. TIME CLOCK & ATTENDANCE ENDPOINTS
// ==========================================

// Punch Clock In (Selfie, PIN, or Biometric)
staffOpsRouter.post('/clock-in', async (req, res) => {
  try {
    const { userId, pin, selfieUrl, method, scheduleId, notes } = req.body;
    // Allow user to clock in themselves or manager to clock in staff
    const targetUserId = userId || req.auth.sub;

    const attendance = await clockInStaff({
      cafeId: req.auth.cafe,
      userId: targetUserId,
      pin,
      selfieUrl,
      method: method || 'pin',
      scheduleId,
      notes,
    });

    res.status(201).json({
      success: true,
      attendance: serializeStaffAttendance(attendance),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start Shift Break
staffOpsRouter.post('/break/start', async (req, res) => {
  try {
    const { attendanceId, breakType } = req.body;
    const userId = req.body.userId || req.auth.sub;

    const attendance = await startStaffBreak({
      attendanceId,
      userId,
      breakType: breakType || 'meal',
    });

    res.json({
      success: true,
      attendance: serializeStaffAttendance(attendance),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// End Shift Break
staffOpsRouter.post('/break/end', async (req, res) => {
  try {
    const { attendanceId } = req.body;
    const userId = req.body.userId || req.auth.sub;

    const attendance = await endStaffBreak({
      attendanceId,
      userId,
    });

    res.json({
      success: true,
      attendance: serializeStaffAttendance(attendance),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Punch Clock Out
staffOpsRouter.post('/clock-out', async (req, res) => {
  try {
    const { attendanceId, pin, selfieUrl, method, notes } = req.body;
    const userId = req.body.userId || req.auth.sub;

    const attendance = await clockOutStaff({
      attendanceId,
      userId,
      pin,
      selfieUrl,
      method: method || 'pin',
      notes,
    });

    res.json({
      success: true,
      attendance: serializeStaffAttendance(attendance),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Live Today's Attendance Board (All active & scheduled staff)
staffOpsRouter.get('/attendance/today', async (req, res) => {
  try {
    const board = await getTodayAttendanceBoard(req.auth.cafe);
    res.json({
      ...board,
      attendances: board.attendances.map(serializeStaffAttendance),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Historical Attendance & Payroll Hours Report
staffOpsRouter.get('/attendance/report', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const report = await getAttendanceReport({
      cafeId: req.auth.cafe,
      startDate,
      endDate,
      userId,
    });
    res.json({
      ...report,
      logs: report.logs.map(serializeStaffAttendance),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. SHIFT ROSTERING & SCHEDULE PLANNER
// ==========================================

// List Schedules
staffOpsRouter.get('/schedules', async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const schedules = await getStaffSchedules({
      cafeId: req.auth.cafe,
      startDate,
      endDate,
      userId,
    });
    res.json(schedules.map(serializeStaffSchedule));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign Shift Schedule
staffOpsRouter.post('/schedules', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const { userId, date, shiftType, startTime, endTime, role, notes } = req.body;
    const schedule = await createStaffSchedule({
      cafeId: req.auth.cafe,
      userId,
      date,
      shiftType,
      startTime,
      endTime,
      role,
      notes,
    });
    res.status(201).json(serializeStaffSchedule(schedule));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Schedule
staffOpsRouter.patch('/schedules/:id', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const updated = await updateStaffSchedule(req.params.id, req.body);
    res.json(serializeStaffSchedule(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Schedule
staffOpsRouter.delete('/schedules/:id', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const result = await deleteStaffSchedule(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 3. TIP POOL & SERVICE CHARGE DISTRIBUTION
// ==========================================

// List Tip Pools
staffOpsRouter.get('/tip-pools', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const pools = await TipPool.findAll({
      where: { cafeId: req.auth.cafe },
      include: [{ model: TipDistribution, as: 'distributions' }],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
    });
    res.json(pools.map(serializeTipPool));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create or Update Tip Pool
staffOpsRouter.post('/tip-pools', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const pool = await createOrUpdateTipPool({
      ...req.body,
      cafeId: req.auth.cafe,
    });
    res.status(201).json(serializeTipPool(pool));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Calculate Tip Pool Distribution
staffOpsRouter.post('/tip-pools/:id/calculate', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const result = await calculateTipDistribution({
      tipPoolId: req.params.id,
      cafeId: req.auth.cafe,
      customStaffList: req.body.customStaffList,
    });
    res.json({
      success: true,
      tipPool: serializeTipPool(result.tipPool),
      distributions: result.distributions,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Settle Tip Pool & Disburse Payouts
staffOpsRouter.post('/tip-pools/:id/settle', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const { payoutMethod, paymentRef } = req.body;
    const settled = await settleTipPool({
      tipPoolId: req.params.id,
      cafeId: req.auth.cafe,
      settledBy: req.auth.name || 'Manager',
      payoutMethod: payoutMethod || 'cash',
      paymentRef,
    });
    res.json({
      success: true,
      tipPool: serializeTipPool(settled),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Printable Tip Settlement Slip
staffOpsRouter.get('/tip-pools/:id/slip', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const [tipPool, cafe] = await Promise.all([
      TipPool.findOne({
        where: { id: req.params.id, cafeId: req.auth.cafe },
        include: [{ model: TipDistribution, as: 'distributions' }],
      }),
      Cafe.findByPk(req.auth.cafe),
    ]);

    if (!tipPool) return res.status(404).json({ error: 'Tip pool not found' });

    const slip = formatTipSettlementSlip({
      tipPool,
      distributions: tipPool.distributions || [],
      cafe: cafe || {},
    });

    res.json({ slip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. STAFF PERFORMANCE & UPSELLING METRICS
// ==========================================

staffOpsRouter.get('/performance', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const metrics = await getStaffPerformanceMetrics({
      cafeId: req.auth.cafe,
      startDate,
      endDate,
    });
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

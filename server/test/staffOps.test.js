import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  Cafe,
  User,
  StaffSchedule,
  StaffAttendance,
  TipPool,
  TipDistribution,
  Order,
  OrderItem,
} from '../src/models.js';
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
  isTimeLate,
  round2,
} from '../src/staffOpsEngine.js';
import { ensureStaffOpsSchema } from '../src/schemaStaffOps.js';

describe('Phase 11: Staff Operations, Biometric Attendance & Tip Payroll', () => {
  let testCafe;
  let baristaUser;
  let captainUser;
  let kitchenUser;

  before(async () => {
    await ensureStaffOpsSchema();

    testCafe = await Cafe.create({
      name: 'GUESTORA Artisan Roastery - Bandra',
      slug: `gusstora-bandra-${Date.now()}`,
      phone: '9876543210',
      address: 'Pali Hill, Bandra West, Mumbai',
    });

    baristaUser = await User.create({
      name: 'Aarav Sharma',
      email: `aarav.${Date.now()}@gusstora.demo`,
      role: 'barista',
      pin: '4321',
      cafeId: testCafe.id,
      status: 'active',
      hourlyWage: 150,
    });

    captainUser = await User.create({
      name: 'Priya Patel',
      email: `priya.${Date.now()}@gusstora.demo`,
      role: 'captain',
      pin: '5678',
      cafeId: testCafe.id,
      status: 'active',
      hourlyWage: 140,
    });

    kitchenUser = await User.create({
      name: 'Chef Vikram Roy',
      email: `vikram.${Date.now()}@gusstora.demo`,
      role: 'kitchen',
      pin: '9999',
      cafeId: testCafe.id,
      status: 'active',
      hourlyWage: 160,
    });
  });

  after(async () => {
    try {
      await TipDistribution.destroy({ where: { cafeId: testCafe.id } });
      await TipPool.destroy({ where: { cafeId: testCafe.id } });
      await StaffAttendance.destroy({ where: { cafeId: testCafe.id } });
      await StaffSchedule.destroy({ where: { cafeId: testCafe.id } });
      await User.destroy({ where: { cafeId: testCafe.id } });
      await Cafe.destroy({ where: { id: testCafe.id } });
    } catch (e) {
      // cleanup
    }
  });

  describe('1. Staff Shift Rostering & Schedule Planner', () => {
    let createdSchedule;

    it('creates a morning shift schedule for a staff member', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      createdSchedule = await createStaffSchedule({
        cafeId: testCafe.id,
        userId: baristaUser.id,
        date: todayStr,
        shiftType: 'morning',
        startTime: '08:00',
        endTime: '16:00',
        role: 'barista',
        notes: 'Espresso Bar Lead',
      });

      assert.ok(createdSchedule.id);
      assert.equal(createdSchedule.staffName, baristaUser.name);
      assert.equal(createdSchedule.shiftType, 'morning');
      assert.equal(createdSchedule.startTime, '08:00');
      assert.equal(createdSchedule.status, 'scheduled');
    });

    it('retrieves scheduled shifts by date range and cafe', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const schedules = await getStaffSchedules({
        cafeId: testCafe.id,
        startDate: todayStr,
        endDate: todayStr,
      });

      assert.ok(Array.isArray(schedules));
      assert.ok(schedules.length >= 1);
      assert.equal(schedules[0].cafeId, testCafe.id);
    });

    it('updates shift schedule details and status', async () => {
      const updated = await updateStaffSchedule(createdSchedule.id, {
        notes: 'Shift modified: Opening Barista',
      });
      assert.equal(updated.notes, 'Shift modified: Opening Barista');
    });
  });

  describe('2. Biometric / PIN Time Clock & Break Management', () => {
    let activeAttendance;

    it('rejects clock-in when PIN is invalid', async () => {
      await assert.rejects(
        async () => {
          await clockInStaff({
            cafeId: testCafe.id,
            userId: baristaUser.id,
            pin: '0000', // incorrect PIN
            method: 'pin',
          });
        },
        { message: 'Invalid security PIN' }
      );
    });

    it('correctly detects late arrival against scheduled start time', () => {
      const checkOnTime = isTimeLate(new Date('2026-10-14T08:10:00'), '08:00', 15);
      assert.equal(checkOnTime.isLate, false);

      const checkLate = isTimeLate(new Date('2026-10-14T08:35:00'), '08:00', 15);
      assert.equal(checkLate.isLate, true);
      assert.equal(checkLate.lateMinutes, 35);
    });

    it('successfully clocks in staff member with PIN and selfie capture', async () => {
      activeAttendance = await clockInStaff({
        cafeId: testCafe.id,
        userId: baristaUser.id,
        pin: '4321',
        method: 'selfie',
        selfieUrl: 'data:image/jpeg;base64,mockBiometricSelfieDataUri12345',
        notes: 'Morning shift opening',
      });

      assert.ok(activeAttendance.id);
      assert.equal(activeAttendance.status, 'clocked_in');
      assert.equal(activeAttendance.clockInMethod, 'selfie');
      assert.ok(activeAttendance.selfieUrl);
    });

    it('blocks duplicate active clock-in for same staff on same day', async () => {
      await assert.rejects(
        async () => {
          await clockInStaff({
            cafeId: testCafe.id,
            userId: baristaUser.id,
            pin: '4321',
          });
        },
        /already active/
      );
    });

    it('starts a meal break and updates status to on_break', async () => {
      const onBreak = await startStaffBreak({
        attendanceId: activeAttendance.id,
        userId: baristaUser.id,
        breakType: 'lunch',
      });

      assert.equal(onBreak.status, 'on_break');
      assert.ok(Array.isArray(onBreak.breaks));
      assert.equal(onBreak.breaks.length, 1);
      assert.equal(onBreak.breaks[0].breakType, 'lunch');
      assert.ok(onBreak.breaks[0].startTime);
    });

    it('ends staff break and resumes status to clocked_in', async () => {
      const resumed = await endStaffBreak({
        attendanceId: activeAttendance.id,
        userId: baristaUser.id,
      });

      assert.equal(resumed.status, 'clocked_in');
      assert.ok(resumed.breaks[0].endTime);
    });

    it('clocks out staff member and calculates work and break hours', async () => {
      const clockedOut = await clockOutStaff({
        attendanceId: activeAttendance.id,
        userId: baristaUser.id,
        pin: '4321',
        method: 'pin',
        notes: 'Completed full bar shift',
      });

      assert.equal(clockedOut.status, 'clocked_out');
      assert.ok(clockedOut.clockOutTime);
      assert.ok(clockedOut.totalWorkMinutes >= 0);
    });

    it('returns accurate summary for today attendance board', async () => {
      const board = await getTodayAttendanceBoard(testCafe.id);

      assert.ok(board.date);
      assert.equal(board.clockedOutCount, 1);
      assert.equal(board.totalActiveStaff, 3);
    });

    it('generates date-range attendance and payroll hours report', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const report = await getAttendanceReport({
        cafeId: testCafe.id,
        startDate: todayStr,
        endDate: todayStr,
      });

      assert.ok(report.totalShifts >= 1);
      assert.ok(Array.isArray(report.staffSummary));
      const baristaSummary = report.staffSummary.find(s => s.userId === baristaUser.id);
      assert.ok(baristaSummary);
      assert.equal(baristaSummary.shiftsCount, 1);
    });
  });

  describe('3. Tip Pool & Service Charge Payroll Distribution', () => {
    let tipPool;

    it('creates a daily tip pool aggregating Cash, Card, and Service Charge', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      tipPool = await createOrUpdateTipPool({
        cafeId: testCafe.id,
        title: 'Bandra Weekend Tip & Service Charge Pool',
        date: todayStr,
        cashTips: 1200,
        cardTips: 2500,
        serviceChargeAmount: 1300,
        distributionMethod: 'role_weighted',
        roleWeights: { barista: 40, captain: 35, kitchen: 25 },
        notes: 'Saturday rush collection',
      });

      assert.ok(tipPool.id);
      assert.equal(tipPool.totalAmount, 5000);
      assert.equal(tipPool.status, 'open');
    });

    it('calculates role-weighted tip distribution across staff roster', async () => {
      const customStaffList = [
        { userId: baristaUser.id, staffName: baristaUser.name, role: 'barista', hoursWorked: 8 },
        { userId: captainUser.id, staffName: captainUser.name, role: 'captain', hoursWorked: 8 },
        { userId: kitchenUser.id, staffName: kitchenUser.name, role: 'kitchen', hoursWorked: 8 },
      ];

      const { tipPool: updatedPool, distributions } = await calculateTipDistribution({
        tipPoolId: tipPool.id,
        cafeId: testCafe.id,
        customStaffList,
      });

      assert.equal(updatedPool.status, 'calculated');
      assert.equal(distributions.length, 3);

      // Total pool = 5000
      // Weights: Barista 40 (40%), Captain 35 (35%), Kitchen 25 (25%) -> sum = 100
      const baristaDist = distributions.find(d => d.role === 'barista');
      const captainDist = distributions.find(d => d.role === 'captain');
      const kitchenDist = distributions.find(d => d.role === 'kitchen');

      assert.equal(baristaDist.allocatedAmount, 2000);
      assert.equal(captainDist.allocatedAmount, 1750);
      assert.equal(kitchenDist.allocatedAmount, 1250);

      // Verify exact sum equals total pool amount
      const sum = distributions.reduce((acc, d) => acc + d.allocatedAmount, 0);
      assert.equal(round2(sum), 5000);
    });

    it('calculates hours-worked proportionate distribution accurately', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const hoursPool = await createOrUpdateTipPool({
        cafeId: testCafe.id,
        title: 'Hours-Worked Tip Pool',
        date: todayStr,
        cashTips: 3000,
        cardTips: 0,
        serviceChargeAmount: 0,
        distributionMethod: 'hours_worked',
      });

      const customStaffList = [
        { userId: baristaUser.id, staffName: baristaUser.name, role: 'barista', hoursWorked: 6 },
        { userId: captainUser.id, staffName: captainUser.name, role: 'captain', hoursWorked: 4 },
      ];

      const { distributions } = await calculateTipDistribution({
        tipPoolId: hoursPool.id,
        cafeId: testCafe.id,
        customStaffList,
      });

      // Total 10 hours. Barista 6 hrs (60% = 1800), Captain 4 hrs (40% = 1200)
      const bDist = distributions.find(d => d.userId === baristaUser.id);
      const cDist = distributions.find(d => d.userId === captainUser.id);

      assert.equal(bDist.allocatedAmount, 1800);
      assert.equal(cDist.allocatedAmount, 1200);
    });

    it('settles tip pool and advances status to paid with payment references', async () => {
      const settled = await settleTipPool({
        tipPoolId: tipPool.id,
        cafeId: testCafe.id,
        settledBy: 'Floor Manager Arjun',
        payoutMethod: 'upi',
        paymentRef: 'UPI-DISBURSE-998822',
      });

      assert.equal(settled.status, 'settled');
      assert.equal(settled.settledBy, 'Floor Manager Arjun');

      const dists = await TipDistribution.findAll({ where: { tipPoolId: tipPool.id } });
      assert.ok(dists.every(d => d.status === 'paid'));
      assert.ok(dists.every(d => d.payoutMethod === 'upi'));
    });

    it('generates compliant 80mm printable tip settlement slip', () => {
      const slip = formatTipSettlementSlip({
        tipPool,
        distributions: [
          { staffName: 'Aarav Sharma', role: 'Barista', hoursWorked: 8, sharePercent: 40, allocatedAmount: 2000 },
          { staffName: 'Priya Patel', role: 'Captain', hoursWorked: 8, sharePercent: 35, allocatedAmount: 1750 },
          { staffName: 'Chef Vikram', role: 'Kitchen', hoursWorked: 8, sharePercent: 25, allocatedAmount: 1250 },
        ],
        cafe: testCafe,
      });

      assert.ok(slip.includes('STAFF TIP & SERVICE CHARGE PAYROLL'));
      assert.ok(slip.includes('Aarav Sharma'));
      assert.ok(slip.includes('TOTAL POOL DISBURSED'));
      assert.ok(slip.includes('Signatures:'));
    });
  });

  describe('4. Staff Performance & Upselling Analytics', () => {
    before(async () => {
      // Create mock orders attributed to captainUser
      const order1 = await Order.create({
        orderNo: 'GST-TEST-001',
        cafeId: testCafe.id,
        subtotal: 750,
        total: 750,
        status: 'completed',
        captainId: captainUser.id,
        captainName: captainUser.name,
      });
      await OrderItem.create({
        orderId: order1.id,
        name: 'Pour Over V60 Single Origin',
        price: 350,
        quantity: 1,
        selectedModifiers: [{ name: 'Oat Milk Sub', price: 40 }],
      });
      await OrderItem.create({
        orderId: order1.id,
        name: 'Almond Croissant',
        price: 250,
        quantity: 1,
      });

      const order2 = await Order.create({
        orderNo: 'GST-TEST-002',
        cafeId: testCafe.id,
        subtotal: 300,
        total: 300,
        status: 'completed',
        captainId: captainUser.id,
        captainName: captainUser.name,
      });
      await OrderItem.create({
        orderId: order2.id,
        name: 'Flat White',
        price: 260,
        quantity: 1,
      });
    });

    it('calculates revenue, AOV, upselling rate, and awards badges', async () => {
      const metrics = await getStaffPerformanceMetrics({
        cafeId: testCafe.id,
      });

      assert.ok(metrics.leaderboard);
      assert.ok(metrics.leaderboard.length >= 1);

      const captainStat = metrics.leaderboard.find(s => s.userId === captainUser.id);
      assert.ok(captainStat);
      assert.ok(captainStat.totalRevenue >= 1050);
      assert.ok(captainStat.completedOrders >= 2);
      assert.ok(captainStat.aov > 0);
      assert.ok(captainStat.upsellRate > 0);
      assert.ok(Array.isArray(captainStat.badges));
    });
  });
});

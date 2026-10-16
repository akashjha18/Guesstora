import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Clock,
  Calendar,
  DollarSign,
  Award,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  LogOut,
  Camera,
  Key,
  Plus,
  RefreshCw,
  Printer,
  ChevronRight,
  TrendingUp,
  Sliders,
  Filter,
  Eye,
  Trash2,
  Edit2,
  X,
  Coins,
  ShieldCheck,
  Zap,
  Coffee,
  Check,
  AlertTriangle,
  UserCheck,
  CalendarDays,
  FileText,
  Percent
} from 'lucide-react';
import { api, BASE } from '../api';

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function StaffOperationsManager({ cafe, token, staffList = [] }) {
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'roster' | 'tips' | 'analytics'
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  // Active cafe staff list fallback
  const [activeStaff, setActiveStaff] = useState(staffList);

  // ==========================================
  // TAB 1: ATTENDANCE & TIME CLOCK STATE
  // ==========================================
  const [todayBoard, setTodayBoard] = useState({
    date: new Date().toISOString().split('T')[0],
    summary: { totalScheduled: 0, currentlyActive: 0, onBreak: 0, completed: 0, lateArrivals: 0 },
    attendances: [],
    todaySchedules: [],
  });

  // Time Clock Modal State
  const [timeClockModal, setTimeClockModal] = useState(false);
  const [selectedStaffForClock, setSelectedStaffForClock] = useState('');
  const [clockActionType, setClockActionType] = useState('in'); // 'in' | 'break_start' | 'break_end' | 'out'
  const [clockPin, setClockPin] = useState('');
  const [clockMethod, setClockMethod] = useState('pin'); // 'pin' | 'selfie'
  const [clockNotes, setClockNotes] = useState('');
  const [breakTypeInput, setBreakTypeInput] = useState('meal');
  const [activeAttendanceIdForAction, setActiveAttendanceIdForAction] = useState(null);

  // Webcam Camera Stream State
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  // Attendance History Report State
  const [reportRange, setReportRange] = useState('today'); // 'today' | '7days' | '30days'
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [reportSummary, setReportSummary] = useState(null);

  // ==========================================
  // TAB 2: SHIFT ROSTERING & SCHEDULE STATE
  // ==========================================
  const [schedules, setSchedules] = useState([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    userId: '',
    date: new Date().toISOString().split('T')[0],
    shiftType: 'morning',
    startTime: '08:00',
    endTime: '16:30',
    role: 'barista',
    notes: '',
  });

  // ==========================================
  // TAB 3: TIP POOL & SERVICE CHARGE PAYROLL STATE
  // ==========================================
  const [tipPools, setTipPools] = useState([]);
  const [activeTipPool, setActiveTipPool] = useState(null);
  const [createTipPoolModal, setCreateTipPoolModal] = useState(false);
  const [tipPoolForm, setTipPoolForm] = useState({
    title: `Tips - ${new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`,
    date: new Date().toISOString().split('T')[0],
    cashTips: 1200,
    cardTips: 1800,
    serviceChargeAmount: 950,
    distributionMethod: 'role_weighted',
    roleWeights: { barista: 40, captain: 35, kitchen: 25, cashier: 20 },
    notes: '',
  });
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [slipContent, setSlipContent] = useState('');
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [payoutMethodInput, setPayoutMethodInput] = useState('upi');
  const [payoutRefInput, setPayoutRefInput] = useState('');

  // ==========================================
  // TAB 4: PERFORMANCE & UPSELLING ANALYTICS STATE
  // ==========================================
  const [perfRange, setPerfRange] = useState('7days');
  const [perfMetrics, setPerfMetrics] = useState(null);
  const [loadingPerf, setLoadingPerf] = useState(false);

  // Show auto-dismiss notification
  const showNotice = (msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 4000);
  };

  // Initial Data Fetch
  useEffect(() => {
    fetchActiveStaff();
    fetchTodayBoard();
    fetchSchedules();
    fetchTipPools();
    fetchPerformanceMetrics('7days');
  }, []);

  async function fetchActiveStaff() {
    try {
      const res = await api('/owner/staff');
      if (Array.isArray(res)) {
        setActiveStaff(res.filter(s => s.status === 'active'));
      }
    } catch (e) {
      console.warn('Could not fetch staff list:', e);
    }
  }

  // --- Fetch Attendance Board ---
  async function fetchTodayBoard() {
    try {
      setLoading(true);
      const res = await api('/staff-ops/attendance/today');
      setTodayBoard(res);
    } catch (e) {
      console.error('Error fetching today attendance:', e);
    } finally {
      setLoading(false);
    }
  }

  // --- Fetch Attendance Report ---
  async function fetchAttendanceReport(range = reportRange) {
    try {
      setLoading(true);
      const today = new Date();
      let start = new Date();
      if (range === 'today') {
        start = today.toISOString().split('T')[0];
      } else if (range === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        start = d.toISOString().split('T')[0];
      } else if (range === '30days') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        start = d.toISOString().split('T')[0];
      }
      const end = today.toISOString().split('T')[0];
      const res = await api(`/staff-ops/attendance/report?startDate=${start}&endDate=${end}`);
      setAttendanceLogs(res.logs || []);
      setReportSummary(res.summary || null);
    } catch (e) {
      console.error('Error fetching attendance report:', e);
    } finally {
      setLoading(false);
    }
  }

  // --- Fetch Schedules ---
  async function fetchSchedules() {
    try {
      const today = new Date();
      const past = new Date();
      past.setDate(past.getDate() - 3);
      const future = new Date();
      future.setDate(future.getDate() + 14);

      const res = await api(
        `/staff-ops/schedules?startDate=${past.toISOString().split('T')[0]}&endDate=${future.toISOString().split('T')[0]}`
      );
      if (Array.isArray(res)) setSchedules(res);
    } catch (e) {
      console.error('Error fetching schedules:', e);
    }
  }

  // --- Fetch Tip Pools ---
  async function fetchTipPools() {
    try {
      const res = await api('/staff-ops/tip-pools');
      if (Array.isArray(res)) {
        setTipPools(res);
        if (res.length > 0 && !activeTipPool) {
          setActiveTipPool(res[0]);
        }
      }
    } catch (e) {
      console.error('Error fetching tip pools:', e);
    }
  }

  // --- Fetch Performance Metrics ---
  async function fetchPerformanceMetrics(range = perfRange) {
    try {
      setLoadingPerf(true);
      let startDate = null;
      const today = new Date();
      if (range === 'today') {
        startDate = today.toISOString().split('T')[0];
      } else if (range === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString().split('T')[0];
      } else if (range === '30days') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString().split('T')[0];
      }
      const query = startDate ? `?startDate=${startDate}` : '';
      const res = await api(`/staff-ops/performance${query}`);
      setPerfMetrics(res);
    } catch (e) {
      console.error('Error fetching performance metrics:', e);
    } finally {
      setLoadingPerf(false);
    }
  }

  // Camera Management for Biometric Clock-In
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable, using biometric fallback:', err.message);
      setCameraActive(false);
      // Fallback placeholder biometric scan
      setCapturedPhoto('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23ea7a33" opacity="0.2"/><path d="M50 25a15 15 0 100 30 15 15 0 000-30zM30 75c0-10 10-18 20-18s20 8 20 18z" fill="%23ea7a33"/></svg>');
    }
  };

  const captureCameraPhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 320;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Close Clock Modal & Cleanup
  const closeClockModal = () => {
    stopCamera();
    setTimeClockModal(false);
    setClockPin('');
    setCapturedPhoto(null);
    setClockNotes('');
    setSelectedStaffForClock('');
    setActiveAttendanceIdForAction(null);
  };

  // Submit Time Clock Action (Clock In / Break / Clock Out)
  async function handleClockActionSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);

    try {
      if (clockActionType === 'in') {
        if (!selectedStaffForClock) {
          throw new Error('Please select a staff member to clock in');
        }
        await api('/staff-ops/clock-in', {
          method: 'POST',
          body: JSON.stringify({
            userId: selectedStaffForClock,
            pin: clockPin || undefined,
            selfieUrl: capturedPhoto,
            method: capturedPhoto ? 'selfie' : 'pin',
            notes: clockNotes,
          }),
        });
        showNotice('Staff successfully clocked in!');
      } else if (clockActionType === 'break_start') {
        if (!activeAttendanceIdForAction) throw new Error('Missing active attendance record');
        await api('/staff-ops/break/start', {
          method: 'POST',
          body: JSON.stringify({
            attendanceId: activeAttendanceIdForAction,
            userId: selectedStaffForClock,
            breakType: breakTypeInput,
          }),
        });
        showNotice('Break started. Status updated to On Break.');
      } else if (clockActionType === 'break_end') {
        if (!activeAttendanceIdForAction) throw new Error('Missing active attendance record');
        await api('/staff-ops/break/end', {
          method: 'POST',
          body: JSON.stringify({
            attendanceId: activeAttendanceIdForAction,
            userId: selectedStaffForClock,
          }),
        });
        showNotice('Break ended. Staff resumed duty!');
      } else if (clockActionType === 'out') {
        if (!activeAttendanceIdForAction) throw new Error('Missing active attendance record');
        await api('/staff-ops/clock-out', {
          method: 'POST',
          body: JSON.stringify({
            attendanceId: activeAttendanceIdForAction,
            userId: selectedStaffForClock,
            pin: clockPin || undefined,
            notes: clockNotes,
          }),
        });
        showNotice('Staff clocked out. Shift hours calculated.');
      }

      closeClockModal();
      fetchTodayBoard();
      fetchAttendanceReport();
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Submit Shift Schedule Form
  async function handleSaveSchedule(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!scheduleForm.userId || !scheduleForm.date) {
      showNotice('Please select a staff member and date', 'error');
      return;
    }

    setLoading(true);
    try {
      if (editingScheduleId) {
        await api(`/staff-ops/schedules/${editingScheduleId}`, {
          method: 'PATCH',
          body: JSON.stringify(scheduleForm),
        });
        showNotice('Shift schedule updated!');
      } else {
        await api('/staff-ops/schedules', {
          method: 'POST',
          body: JSON.stringify(scheduleForm),
        });
        showNotice('New shift rostered successfully!');
      }
      setScheduleModalOpen(false);
      setEditingScheduleId(null);
      fetchSchedules();
      fetchTodayBoard();
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Delete Schedule
  async function handleDeleteSchedule(id) {
    if (!window.confirm('Are you sure you want to delete this scheduled shift?')) return;
    try {
      await api(`/staff-ops/schedules/${id}`, { method: 'DELETE' });
      showNotice('Shift schedule deleted');
      fetchSchedules();
      fetchTodayBoard();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  // Save / Calculate / Settle Tip Pools
  async function handleSaveTipPool(e) {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    try {
      const res = await api('/staff-ops/tip-pools', {
        method: 'POST',
        body: JSON.stringify(tipPoolForm),
      });
      showNotice('Tip pool created successfully!');
      setCreateTipPoolModal(false);
      fetchTipPools();
      setActiveTipPool(res);
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCalculateDistribution(poolId) {
    setLoading(true);
    try {
      const res = await api(`/staff-ops/tip-pools/${poolId}/calculate`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      showNotice(`Calculated split across ${res.distributions.length} staff members!`);
      fetchTipPools();
      setActiveTipPool(res.tipPool);
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSettleTipPool(poolId) {
    setLoading(true);
    try {
      const res = await api(`/staff-ops/tip-pools/${poolId}/settle`, {
        method: 'POST',
        body: JSON.stringify({
          payoutMethod: payoutMethodInput,
          paymentRef: payoutRefInput,
        }),
      });
      showNotice('Tip pool disbursed and marked as settled!');
      setSettleModalOpen(false);
      fetchTipPools();
      setActiveTipPool(res.tipPool);
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handlePrintSlip(poolId) {
    try {
      const res = await api(`/staff-ops/tip-pools/${poolId}/slip`);
      setSlipContent(res.slip);
      setSlipModalOpen(true);
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  return (
    <div className="crm-orders-wrapper" style={{ padding: '0 0 60px 0' }}>
      {/* Toast Alert Notice */}
      {notice && (
        <div
          className={`theme-toast ${notice.type === 'error' ? 'error' : 'success'}`}
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: notice.type === 'error' ? '#7f1d1d' : '#14532d',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            border: `1px solid ${notice.type === 'error' ? '#ef4444' : '#22c55e'}`,
          }}
        >
          {notice.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span style={{ fontSize: 14, fontWeight: 500 }}>{notice.msg}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 8 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="crm-orders-header-card" style={{ marginBottom: 20 }}>
        <div className="crm-orders-header-left">
          <div className="crm-orders-brand-emblem" style={{ background: 'linear-gradient(135deg, #ea7a33, #b45309)' }}>
            <UserCheck size={24} style={{ color: '#fff' }} />
          </div>
          <div className="crm-orders-brand-info">
            <div className="crm-orders-title-row">
              <h1 className="crm-orders-title">Staff Operations & Tip Payroll</h1>
              <span className="crm-menu-status-badge" style={{ background: 'rgba(234, 122, 51, 0.15)', color: '#ea7a33' }}>
                <span className="crm-pulse-dot" style={{ background: '#ea7a33' }} />
                Phase 11 Operations
              </span>
            </div>
            <p className="crm-orders-subtitle">
              Biometric selfie time clock, shift rostering, role-weighted tip pools & upsell performance analytics
            </p>
          </div>
        </div>

        <div className="crm-orders-header-actions" style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={() => {
              setClockActionType('in');
              setTimeClockModal(true);
            }}
            style={{ background: '#ea7a33', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Camera size={16} />
            <span>Time Clock / Punch In</span>
          </button>

          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => {
              setEditingScheduleId(null);
              setScheduleForm({
                userId: activeStaff[0]?.id || '',
                date: new Date().toISOString().split('T')[0],
                shiftType: 'morning',
                startTime: '08:00',
                endTime: '16:30',
                role: activeStaff[0]?.role || 'barista',
                notes: '',
              });
              setScheduleModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            <span>Roster Shift</span>
          </button>
        </div>
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          borderBottom: '1px solid #3d2b1f',
          paddingBottom: 14,
          marginBottom: 24,
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          className={`filter-chip ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('attendance');
            fetchTodayBoard();
          }}
          style={{
            background: activeTab === 'attendance' ? '#ea7a33' : '#221915',
            color: activeTab === 'attendance' ? '#fff' : '#a89f91',
            border: `1px solid ${activeTab === 'attendance' ? '#ea7a33' : '#3d2b1f'}`,
            padding: '8px 18px',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <Clock size={16} />
          <span>Live Attendance ({todayBoard?.summary?.currentlyActive || 0} Active)</span>
        </button>

        <button
          type="button"
          className={`filter-chip ${activeTab === 'roster' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('roster');
            fetchSchedules();
          }}
          style={{
            background: activeTab === 'roster' ? '#ea7a33' : '#221915',
            color: activeTab === 'roster' ? '#fff' : '#a89f91',
            border: `1px solid ${activeTab === 'roster' ? '#ea7a33' : '#3d2b1f'}`,
            padding: '8px 18px',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <CalendarDays size={16} />
          <span>Shift Rostering & Planner</span>
        </button>

        <button
          type="button"
          className={`filter-chip ${activeTab === 'tips' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('tips');
            fetchTipPools();
          }}
          style={{
            background: activeTab === 'tips' ? '#ea7a33' : '#221915',
            color: activeTab === 'tips' ? '#fff' : '#a89f91',
            border: `1px solid ${activeTab === 'tips' ? '#ea7a33' : '#3d2b1f'}`,
            padding: '8px 18px',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <DollarSign size={16} />
          <span>Tip Pool & Service Charge Payroll</span>
        </button>

        <button
          type="button"
          className={`filter-chip ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('analytics');
            fetchPerformanceMetrics();
          }}
          style={{
            background: activeTab === 'analytics' ? '#ea7a33' : '#221915',
            color: activeTab === 'analytics' ? '#fff' : '#a89f91',
            border: `1px solid ${activeTab === 'analytics' ? '#ea7a33' : '#3d2b1f'}`,
            padding: '8px 18px',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <Award size={16} />
          <span>Performance & Upsell Leaderboard</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. ATTENDANCE & LIVE TIME CLOCK TAB */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* TOP SUMMARY CARDS */}
          <div className="stats-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="stat-card" style={{ background: '#221915', border: '1px solid #3d2b1f' }}>
              <div className="stat-card-top">
                <div className="stat-icon-wrap" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                  <UserCheck size={22} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Currently Clocked In</span>
                  <h3 className="stat-value">{todayBoard?.summary?.currentlyActive || 0} Staff</h3>
                </div>
              </div>
              <div className="stat-card-bottom" style={{ color: '#22c55e', fontSize: 12 }}>
                ● Actively serving floor & barista bar
              </div>
            </div>

            <div className="stat-card" style={{ background: '#221915', border: '1px solid #3d2b1f' }}>
              <div className="stat-card-top">
                <div className="stat-icon-wrap" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
                  <Pause size={22} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">On Break</span>
                  <h3 className="stat-value">{todayBoard?.summary?.onBreak || 0} Staff</h3>
                </div>
              </div>
              <div className="stat-card-bottom" style={{ color: '#eab308', fontSize: 12 }}>
                Meal / Rest pause active
              </div>
            </div>

            <div className="stat-card" style={{ background: '#221915', border: '1px solid #3d2b1f' }}>
              <div className="stat-card-top">
                <div className="stat-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                  <Calendar size={22} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Scheduled Today</span>
                  <h3 className="stat-value">{todayBoard?.summary?.totalScheduled || 0} Shifts</h3>
                </div>
              </div>
              <div className="stat-card-bottom" style={{ color: '#93c5fd', fontSize: 12 }}>
                {todayBoard?.summary?.completed || 0} shifts completed
              </div>
            </div>

            <div className="stat-card" style={{ background: '#221915', border: '1px solid #3d2b1f' }}>
              <div className="stat-card-top">
                <div className="stat-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                  <AlertTriangle size={22} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Late Arrivals</span>
                  <h3 className="stat-value">{todayBoard?.summary?.lateArrivals || 0}</h3>
                </div>
              </div>
              <div className="stat-card-bottom" style={{ color: '#f87171', fontSize: 12 }}>
                Arrived &gt;15 mins past start
              </div>
            </div>
          </div>

          {/* TODAY'S LIVE STAFF ATTENDANCE BOARD */}
          <div style={{ background: '#221915', border: '1px solid #3d2b1f', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f9fafb' }}>
                  Today's Live Floor Attendance Board ({todayBoard.date})
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a89f91' }}>
                  Real-time punch records, break timers, and clock-out actions
                </p>
              </div>
              <button
                type="button"
                className="crm-btn-secondary"
                onClick={fetchTodayBoard}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {todayBoard.attendances.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8c8279' }}>
                <Clock size={36} style={{ color: '#ea7a33', opacity: 0.6, marginBottom: 12 }} />
                <h4 style={{ margin: '0 0 6px', color: '#f9fafb' }}>No Clock-In Records Yet Today</h4>
                <p style={{ margin: 0, fontSize: 13 }}>
                  Staff can punch in using PIN or biometric selfie camera verification.
                </p>
                <button
                  type="button"
                  className="crm-btn-primary"
                  onClick={() => {
                    setClockActionType('in');
                    setTimeClockModal(true);
                  }}
                  style={{ marginTop: 16, background: '#ea7a33' }}
                >
                  <Camera size={14} style={{ marginRight: 6 }} />
                  Punch First Clock-In
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #3d2b1f', color: '#a89f91', fontSize: 12 }}>
                      <th style={{ padding: '10px 12px' }}>STAFF MEMBER</th>
                      <th style={{ padding: '10px 12px' }}>ROLE</th>
                      <th style={{ padding: '10px 12px' }}>CLOCK IN</th>
                      <th style={{ padding: '10px 12px' }}>STATUS</th>
                      <th style={{ padding: '10px 12px' }}>WORK HOURS</th>
                      <th style={{ padding: '10px 12px' }}>BREAKS</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>OPERATIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayBoard.attendances.map(att => {
                      const user = att.user || {};
                      const isClockedIn = att.status === 'clocked_in';
                      const isOnBreak = att.status === 'on_break';
                      const isCompleted = att.status === 'clocked_out';

                      return (
                        <tr
                          key={att.id}
                          style={{
                            borderBottom: '1px solid rgba(61, 43, 31, 0.5)',
                            transition: 'background 0.2s',
                          }}
                        >
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {att.clockInSelfie ? (
                                <img
                                  src={att.clockInSelfie}
                                  alt="Selfie"
                                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #ea7a33' }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    background: '#2a201b',
                                    color: '#ea7a33',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    border: '1px solid #3d2b1f',
                                  }}
                                >
                                  {(user.name || 'S').charAt(0)}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 600, color: '#f9fafb' }}>{user.name || 'Staff Member'}</div>
                                <div style={{ fontSize: 11, color: '#8c8279' }}>{user.phone || user.email || 'Floor Staff'}</div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '12px' }}>
                            <span
                              style={{
                                textTransform: 'capitalize',
                                background: '#2a201b',
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: 12,
                                color: '#e5e7eb',
                                border: '1px solid #3d2b1f',
                              }}
                            >
                              {user.role || 'Barista'}
                            </span>
                          </td>

                          <td style={{ padding: '12px' }}>
                            <div style={{ color: '#f9fafb', fontWeight: 500 }}>
                              {att.clockInTime ? new Date(att.clockInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                            </div>
                            {att.isLate && (
                              <span
                                style={{
                                  fontSize: 10,
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  color: '#ef4444',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontWeight: 600,
                                }}
                              >
                                Late +{att.lateMinutes}m
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '12px' }}>
                            {isClockedIn && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  background: 'rgba(34, 197, 94, 0.15)',
                                  color: '#22c55e',
                                  padding: '4px 10px',
                                  borderRadius: 20,
                                  fontWeight: 600,
                                  fontSize: 12,
                                }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                                Active
                              </span>
                            )}
                            {isOnBreak && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  background: 'rgba(234, 179, 8, 0.15)',
                                  color: '#eab308',
                                  padding: '4px 10px',
                                  borderRadius: 20,
                                  fontWeight: 600,
                                  fontSize: 12,
                                }}
                              >
                                <Pause size={10} />
                                On Break
                              </span>
                            )}
                            {isCompleted && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  background: 'rgba(107, 114, 128, 0.2)',
                                  color: '#9ca3af',
                                  padding: '4px 10px',
                                  borderRadius: 20,
                                  fontWeight: 500,
                                  fontSize: 12,
                                }}
                              >
                                Clocked Out
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '12px', color: '#f9fafb', fontWeight: 600 }}>
                            {att.workHours > 0 ? `${att.workHours} hrs` : '--'}
                          </td>

                          <td style={{ padding: '12px', color: '#a89f91' }}>
                            {Array.isArray(att.breaks) && att.breaks.length > 0 ? (
                              <span>{att.breaks.length} breaks ({att.breakHours || 0}h)</span>
                            ) : (
                              <span style={{ color: '#6b7280' }}>None</span>
                            )}
                          </td>

                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              {isClockedIn && (
                                <>
                                  <button
                                    type="button"
                                    className="crm-btn-secondary"
                                    onClick={() => {
                                      setSelectedStaffForClock(att.userId);
                                      setActiveAttendanceIdForAction(att.id);
                                      setClockActionType('break_start');
                                      setTimeClockModal(true);
                                    }}
                                    style={{ padding: '5px 10px', fontSize: 12, background: '#2a201b' }}
                                    title="Start Meal or Coffee Break"
                                  >
                                    <Pause size={12} style={{ marginRight: 4 }} />
                                    Take Break
                                  </button>

                                  <button
                                    type="button"
                                    className="crm-btn-secondary"
                                    onClick={() => {
                                      setSelectedStaffForClock(att.userId);
                                      setActiveAttendanceIdForAction(att.id);
                                      setClockActionType('out');
                                      setTimeClockModal(true);
                                    }}
                                    style={{ padding: '5px 10px', fontSize: 12, background: '#3d1a16', color: '#ef4444', borderColor: '#7f1d1d' }}
                                    title="Punch Clock Out"
                                  >
                                    <LogOut size={12} style={{ marginRight: 4 }} />
                                    Clock Out
                                  </button>
                                </>
                              )}

                              {isOnBreak && (
                                <button
                                  type="button"
                                  className="crm-btn-primary"
                                  onClick={() => {
                                    setSelectedStaffForClock(att.userId);
                                    setActiveAttendanceIdForAction(att.id);
                                    setClockActionType('break_end');
                                    setTimeClockModal(true);
                                  }}
                                  style={{ padding: '5px 10px', fontSize: 12, background: '#22c55e' }}
                                  title="Resume Shift Duty"
                                >
                                  <Play size={12} style={{ marginRight: 4 }} />
                                  Resume Duty
                                </button>
                              )}

                              {isCompleted && (
                                <span style={{ fontSize: 12, color: '#6b7280' }}>Shift Ended</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* HISTORICAL ATTENDANCE & PAYROLL LOGS ACCORDION */}
          <div style={{ background: '#221915', border: '1px solid #3d2b1f', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f9fafb' }}>
                  Payroll Hours & Attendance Audit Log
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a89f91' }}>
                  Aggregated work hours, break deduction & punctuality compliance
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {['today', '7days', '30days'].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setReportRange(r);
                      fetchAttendanceReport(r);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: reportRange === r ? '#ea7a33' : '#1a1412',
                      color: reportRange === r ? '#fff' : '#a89f91',
                      border: '1px solid #3d2b1f',
                    }}
                  >
                    {r === 'today' ? 'Today' : r === '7days' ? 'Last 7 Days' : 'Last 30 Days'}
                  </button>
                ))}
              </div>
            </div>

            {reportSummary && (
              <div
                style={{
                  display: 'flex',
                  gap: 20,
                  background: '#1a1412',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 16,
                  border: '1px solid #3d2b1f',
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ color: '#8c8279' }}>Total Work Hours: </span>
                  <strong style={{ color: '#22c55e' }}>{reportSummary.totalWorkHours} hrs</strong>
                </div>
                <div>
                  <span style={{ color: '#8c8279' }}>Break Hours: </span>
                  <strong style={{ color: '#eab308' }}>{reportSummary.totalBreakHours} hrs</strong>
                </div>
                <div>
                  <span style={{ color: '#8c8279' }}>Completed Shifts: </span>
                  <strong style={{ color: '#f9fafb' }}>{reportSummary.totalRecords}</strong>
                </div>
                <div>
                  <span style={{ color: '#8c8279' }}>Late Incident Count: </span>
                  <strong style={{ color: '#ef4444' }}>{reportSummary.lateArrivals}</strong>
                </div>
              </div>
            )}

            {attendanceLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#8c8279', fontSize: 13 }}>
                Click a range above or no historical attendance found for this timeframe.
              </div>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #3d2b1f', color: '#8c8279' }}>
                      <th style={{ padding: '8px' }}>DATE</th>
                      <th style={{ padding: '8px' }}>STAFF</th>
                      <th style={{ padding: '8px' }}>IN</th>
                      <th style={{ padding: '8px' }}>OUT</th>
                      <th style={{ padding: '8px' }}>HOURS</th>
                      <th style={{ padding: '8px' }}>PUNCTUALITY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceLogs.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid rgba(61, 43, 31, 0.4)' }}>
                        <td style={{ padding: '8px', color: '#f9fafb' }}>{l.date}</td>
                        <td style={{ padding: '8px', fontWeight: 600, color: '#f9fafb' }}>{l.user?.name || 'Staff'}</td>
                        <td style={{ padding: '8px', color: '#22c55e' }}>
                          {l.clockInTime ? new Date(l.clockInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                        </td>
                        <td style={{ padding: '8px', color: '#ef4444' }}>
                          {l.clockOutTime ? new Date(l.clockOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                        </td>
                        <td style={{ padding: '8px', fontWeight: 700, color: '#ea7a33' }}>{l.workHours} hrs</td>
                        <td style={{ padding: '8px' }}>
                          {l.isLate ? (
                            <span style={{ color: '#ef4444' }}>Late +{l.lateMinutes}m</span>
                          ) : (
                            <span style={{ color: '#22c55e' }}>On Time</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SHIFT ROSTERING & PLANNER TAB */}
      {/* ========================================================================= */}
      {activeTab === 'roster' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f9fafb' }}>
                Weekly Shift Rostering & Schedule Planner
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a89f91' }}>
                Assign staff shifts, configure opening/closing shifts, and monitor roster compliance
              </p>
            </div>
            <button
              type="button"
              className="crm-btn-primary"
              onClick={() => {
                setEditingScheduleId(null);
                setScheduleForm({
                  userId: activeStaff[0]?.id || '',
                  date: new Date().toISOString().split('T')[0],
                  shiftType: 'morning',
                  startTime: '08:00',
                  endTime: '16:30',
                  role: activeStaff[0]?.role || 'barista',
                  notes: '',
                });
                setScheduleModalOpen(true);
              }}
              style={{ background: '#ea7a33', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} />
              <span>Add Scheduled Shift</span>
            </button>
          </div>

          <div style={{ background: '#221915', border: '1px solid #3d2b1f', borderRadius: 12, padding: 20 }}>
            {schedules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8c8279' }}>
                <CalendarDays size={36} style={{ color: '#ea7a33', opacity: 0.6, marginBottom: 12 }} />
                <h4 style={{ margin: '0 0 6px', color: '#f9fafb' }}>No Shifts Rostered</h4>
                <p style={{ margin: 0, fontSize: 13 }}>Schedule morning, evening, or custom shifts for your team.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {schedules.map(sch => {
                  const user = sch.user || {};
                  return (
                    <div
                      key={sch.id}
                      style={{
                        background: '#1a1412',
                        border: '1px solid #3d2b1f',
                        borderRadius: 10,
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: '#2a201b',
                                color: '#ea7a33',
                                padding: '3px 8px',
                                borderRadius: 4,
                                border: '1px solid #3d2b1f',
                              }}
                            >
                              {sch.shiftType.replace('_', ' ')}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              color: sch.status === 'scheduled' ? '#22c55e' : '#9ca3af',
                              fontWeight: 600,
                            }}
                          >
                            ● {sch.status}
                          </span>
                        </div>

                        <div style={{ fontSize: 15, fontWeight: 700, color: '#f9fafb', marginBottom: 4 }}>
                          {user.name || 'Staff Member'}
                        </div>
                        <div style={{ fontSize: 12, color: '#8c8279', marginBottom: 12 }}>
                          Role: <span style={{ color: '#e5e7eb', textTransform: 'capitalize' }}>{sch.role}</span>
                        </div>

                        <div
                          style={{
                            background: '#221915',
                            padding: '10px 12px',
                            borderRadius: 6,
                            border: '1px solid #3d2b1f',
                            marginBottom: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#f9fafb', fontWeight: 600 }}>
                            <Clock size={14} style={{ color: '#ea7a33' }} />
                            <span>{sch.startTime} - {sch.endTime}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#8c8279', marginTop: 4 }}>
                            Date: {sch.date}
                          </div>
                        </div>

                        {sch.notes && (
                          <div style={{ fontSize: 11, color: '#a89f91', fontStyle: 'italic', marginBottom: 12 }}>
                            "{sch.notes}"
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #3d2b1f', paddingTop: 10 }}>
                        <button
                          type="button"
                          className="crm-btn-secondary"
                          onClick={() => {
                            setEditingScheduleId(sch.id);
                            setScheduleForm({
                              userId: sch.userId,
                              date: sch.date,
                              shiftType: sch.shiftType,
                              startTime: sch.startTime,
                              endTime: sch.endTime,
                              role: sch.role,
                              notes: sch.notes || '',
                            });
                            setScheduleModalOpen(true);
                          }}
                          style={{ padding: '4px 8px', fontSize: 11 }}
                        >
                          <Edit2 size={12} style={{ marginRight: 4 }} /> Edit
                        </button>

                        <button
                          type="button"
                          className="crm-btn-secondary"
                          onClick={() => handleDeleteSchedule(sch.id)}
                          style={{ padding: '4px 8px', fontSize: 11, color: '#ef4444' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TIP POOL & SERVICE CHARGE PAYROLL TAB */}
      {/* ========================================================================= */}
      {activeTab === 'tips' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f9fafb' }}>
                Tip Pool & Service Charge Payroll Engine
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a89f91' }}>
                Aggregate cash tips, card tips & service charges. Calculate role-weighted or hours-based fair split.
              </p>
            </div>
            <button
              type="button"
              className="crm-btn-primary"
              onClick={() => setCreateTipPoolModal(true)}
              style={{ background: '#ea7a33', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} />
              <span>Create Daily Tip Pool</span>
            </button>
          </div>

          {/* ACTIVE TIP POOL CARD */}
          {activeTipPool ? (
            <div style={{ background: '#221915', border: '1px solid #3d2b1f', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 20, color: '#f9fafb', fontWeight: 800 }}>{activeTipPool.title}</h2>
                    <span
                      style={{
                        textTransform: 'uppercase',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: activeTipPool.status === 'settled' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 122, 51, 0.2)',
                        color: activeTipPool.status === 'settled' ? '#22c55e' : '#ea7a33',
                        border: `1px solid ${activeTipPool.status === 'settled' ? '#22c55e' : '#ea7a33'}`,
                      }}
                    >
                      {activeTipPool.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#8c8279', marginTop: 4 }}>
                    Date: {activeTipPool.date} | Method:{' '}
                    <strong style={{ color: '#e5e7eb' }}>{(activeTipPool.distributionMethod || 'role_weighted').replace('_', ' ')}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  {activeTipPool.status !== 'settled' && (
                    <button
                      type="button"
                      className="crm-btn-primary"
                      onClick={() => handleCalculateDistribution(activeTipPool.id)}
                      style={{ background: '#ea7a33', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Sliders size={14} />
                      <span>Calculate Split</span>
                    </button>
                  )}

                  {activeTipPool.status === 'calculated' && (
                    <button
                      type="button"
                      className="crm-btn-primary"
                      onClick={() => setSettleModalOpen(true)}
                      style={{ background: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <CheckCircle2 size={14} />
                      <span>Disburse & Settle Payouts</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => handlePrintSlip(activeTipPool.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Printer size={14} />
                    <span>80mm Thermal Slip</span>
                  </button>
                </div>
              </div>

              {/* STATS METRIC ROW */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                  marginTop: 20,
                  marginBottom: 24,
                }}
              >
                <div style={{ background: '#1a1412', padding: 14, borderRadius: 8, border: '1px solid #3d2b1f' }}>
                  <div style={{ fontSize: 12, color: '#8c8279' }}>Cash Tips</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>
                    {money(activeTipPool.cashTips)}
                  </div>
                </div>

                <div style={{ background: '#1a1412', padding: 14, borderRadius: 8, border: '1px solid #3d2b1f' }}>
                  <div style={{ fontSize: 12, color: '#8c8279' }}>Digital / Card Tips</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6', marginTop: 4 }}>
                    {money(activeTipPool.cardTips)}
                  </div>
                </div>

                <div style={{ background: '#1a1412', padding: 14, borderRadius: 8, border: '1px solid #3d2b1f' }}>
                  <div style={{ fontSize: 12, color: '#8c8279' }}>Service Charges</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#eab308', marginTop: 4 }}>
                    {money(activeTipPool.serviceChargeAmount)}
                  </div>
                </div>

                <div style={{ background: '#2a1a12', padding: 14, borderRadius: 8, border: '1px solid #ea7a33' }}>
                  <div style={{ fontSize: 12, color: '#ea7a33', fontWeight: 600 }}>TOTAL POOL TO DISBURSE</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f9fafb', marginTop: 4 }}>
                    {money(activeTipPool.totalAmount)}
                  </div>
                </div>
              </div>

              {/* DISTRIBUTIONS BREAKDOWN TABLE */}
              <div style={{ marginTop: 20 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#f9fafb', fontWeight: 700 }}>
                  Staff Disbursement Breakdown ({activeTipPool.distributions?.length || 0} Recipients)
                </h4>

                {(!activeTipPool.distributions || activeTipPool.distributions.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', color: '#8c8279', background: '#1a1412', borderRadius: 8 }}>
                    <p style={{ margin: 0, fontSize: 13 }}>Click "Calculate Split" to run the distribution algorithm across clocked-in staff.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', background: '#1a1412', borderRadius: 8, border: '1px solid #3d2b1f' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #3d2b1f', color: '#8c8279', fontSize: 12 }}>
                          <th style={{ padding: '10px 14px' }}>STAFF MEMBER</th>
                          <th style={{ padding: '10px 14px' }}>ROLE</th>
                          <th style={{ padding: '10px 14px' }}>HOURS WORKED</th>
                          <th style={{ padding: '10px 14px' }}>WEIGHT SHARE %</th>
                          <th style={{ padding: '10px 14px' }}>ALLOCATED PAYOUT</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTipPool.distributions.map(d => (
                          <tr key={d.id} style={{ borderBottom: '1px solid rgba(61, 43, 31, 0.4)' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: '#f9fafb' }}>{d.staffName}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ textTransform: 'capitalize', color: '#e5e7eb' }}>{d.role}</span>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#a89f91' }}>{d.hoursWorked} hrs</td>
                            <td style={{ padding: '12px 14px', color: '#ea7a33', fontWeight: 600 }}>{d.sharePercent}%</td>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#22c55e', fontSize: 14 }}>
                              {money(d.allocatedAmount)}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  background: d.status === 'paid' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                                  color: d.status === 'paid' ? '#22c55e' : '#eab308',
                                }}
                              >
                                {d.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', background: '#221915', borderRadius: 12, border: '1px solid #3d2b1f' }}>
              <Coins size={36} style={{ color: '#ea7a33', opacity: 0.6, marginBottom: 12 }} />
              <h4 style={{ color: '#f9fafb' }}>No Tip Pools Created</h4>
              <p style={{ color: '#8c8279', fontSize: 13 }}>Create a tip pool to distribute cash, card, and bill service charges.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PERFORMANCE & UPSELLING ANALYTICS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f9fafb' }}>
                Staff Performance & Upselling Leaderboard
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a89f91' }}>
                Track server revenue, orders handled, average ticket size, upsell rate, and gamified medals
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {['today', '7days', '30days'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setPerfRange(r);
                    fetchPerformanceMetrics(r);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: perfRange === r ? '#ea7a33' : '#221915',
                    color: perfRange === r ? '#fff' : '#a89f91',
                    border: '1px solid #3d2b1f',
                  }}
                >
                  {r === 'today' ? 'Today' : r === '7days' ? 'Last 7 Days' : 'Last 30 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* OVERVIEW STATS */}
          <div className="stats-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="stat-card" style={{ background: '#221915', border: '1px solid #3d2b1f' }}>
              <div className="stat-card-top">
                <div className="stat-icon-wrap" style={{ background: 'rgba(234, 122, 51, 0.15)', color: '#ea7a33' }}>
                  <TrendingUp size={22} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Total Handled Revenue</span>
                  <h3 className="stat-value">{money(perfMetrics?.totalStoreRevenue || 0)}</h3>
                </div>
              </div>
              <div className="stat-card-bottom" style={{ color: '#ea7a33', fontSize: 12 }}>
                Across {perfMetrics?.totalOrdersCount || 0} customer orders
              </div>
            </div>

            <div className="stat-card" style={{ background: '#221915', border: '1px solid #3d2b1f' }}>
              <div className="stat-card-top">
                <div className="stat-icon-wrap" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                  <Coffee size={22} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Top Server</span>
                  <h3 className="stat-value">
                    {perfMetrics?.leaderboard && perfMetrics.leaderboard[0]
                      ? perfMetrics.leaderboard[0].staffName
                      : '--'}
                  </h3>
                </div>
              </div>
              <div className="stat-card-bottom" style={{ color: '#22c55e', fontSize: 12 }}>
                🥇 #1 Rank Leaderboard
              </div>
            </div>

            <div className="stat-card" style={{ background: '#221915', border: '1px solid #3d2b1f' }}>
              <div className="stat-card-top">
                <div className="stat-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                  <Award size={22} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Avg Store Ticket</span>
                  <h3 className="stat-value">
                    {money(
                      perfMetrics?.leaderboard && perfMetrics.leaderboard.length > 0
                        ? perfMetrics.leaderboard.reduce((a, b) => a + (b.aov || 0), 0) / perfMetrics.leaderboard.length
                        : 0
                    )}
                  </h3>
                </div>
              </div>
              <div className="stat-card-bottom" style={{ color: '#93c5fd', fontSize: 12 }}>
                Average ticket size
              </div>
            </div>
          </div>

          {/* LEADERBOARD TABLE */}
          <div style={{ background: '#221915', border: '1px solid #3d2b1f', borderRadius: 12, padding: 20 }}>
            {(!perfMetrics?.leaderboard || perfMetrics.leaderboard.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#8c8279' }}>
                <Award size={36} style={{ color: '#ea7a33', opacity: 0.6, marginBottom: 12 }} />
                <h4 style={{ color: '#f9fafb' }}>No Completed Orders Recorded</h4>
                <p style={{ fontSize: 13 }}>Orders assigned to servers or floor captains will automatically rank here.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #3d2b1f', color: '#8c8279', fontSize: 12 }}>
                      <th style={{ padding: '12px' }}>RANK</th>
                      <th style={{ padding: '12px' }}>STAFF MEMBER</th>
                      <th style={{ padding: '12px' }}>ROLE</th>
                      <th style={{ padding: '12px' }}>REVENUE</th>
                      <th style={{ padding: '12px' }}>ORDERS</th>
                      <th style={{ padding: '12px' }}>AVG TICKET (AOV)</th>
                      <th style={{ padding: '12px' }}>UPSELL RATE</th>
                      <th style={{ padding: '12px' }}>ACHIEVEMENTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfMetrics.leaderboard.map(item => {
                      const medal =
                        item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`;

                      return (
                        <tr
                          key={item.userId}
                          style={{
                            borderBottom: '1px solid rgba(61, 43, 31, 0.4)',
                            background: item.rank === 1 ? 'rgba(234, 122, 51, 0.05)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '14px 12px', fontSize: 16, fontWeight: 700 }}>{medal}</td>
                          <td style={{ padding: '14px 12px', fontWeight: 600, color: '#f9fafb' }}>
                            {item.staffName}
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            <span style={{ textTransform: 'capitalize', color: '#e5e7eb' }}>{item.role}</span>
                          </td>
                          <td style={{ padding: '14px 12px', fontWeight: 700, color: '#22c55e', fontSize: 14 }}>
                            {money(item.totalRevenue)}
                          </td>
                          <td style={{ padding: '14px 12px', color: '#f9fafb' }}>
                            {item.completedOrders} orders
                          </td>
                          <td style={{ padding: '14px 12px', color: '#a89f91' }}>{money(item.aov)}</td>
                          <td style={{ padding: '14px 12px' }}>
                            <span
                              style={{
                                fontWeight: 700,
                                color: item.upsellRate >= 30 ? '#ea7a33' : '#a89f91',
                              }}
                            >
                              {item.upsellRate}%
                            </span>
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {item.badges && item.badges.length > 0 ? (
                                item.badges.map(b => (
                                  <span
                                    key={b.id}
                                    title={b.label}
                                    style={{
                                      fontSize: 11,
                                      background: '#2a201b',
                                      border: '1px solid #3d2b1f',
                                      padding: '2px 8px',
                                      borderRadius: 12,
                                      color: '#f9fafb',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <span>{b.icon}</span>
                                    <span>{b.label}</span>
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: '#6b7280', fontSize: 11 }}>In Training</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: TIME CLOCK / BIOMETRIC SELFIE PUNCH IN MODAL */}
      {/* ========================================================================= */}
      {timeClockModal && (
        <div className="crm-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="crm-modal-card"
            style={{
              background: '#1a1412',
              border: '1px solid #3d2b1f',
              borderRadius: 14,
              padding: 24,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#ea7a33', padding: 8, borderRadius: 8, color: '#fff' }}>
                  <Clock size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#f9fafb' }}>
                    {clockActionType === 'in'
                      ? 'Clock In / Time Punch'
                      : clockActionType === 'break_start'
                      ? 'Start Shift Break'
                      : clockActionType === 'break_end'
                      ? 'End Break & Resume'
                      : 'Clock Out / End Shift'}
                  </h3>
                  <span style={{ fontSize: 12, color: '#8c8279' }}>
                    {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • PIN / Biometric Verification
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeClockModal}
                style={{ background: 'none', border: 'none', color: '#a89f91', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleClockActionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Select Staff if Clocking in */}
              {clockActionType === 'in' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 6 }}>
                    Select Staff Member
                  </label>
                  <select
                    className="crm-form-input"
                    value={selectedStaffForClock}
                    onChange={e => setSelectedStaffForClock(e.target.value)}
                    required
                    style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                  >
                    <option value="">-- Choose Staff Member --</option>
                    {activeStaff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Break Type Selector */}
              {clockActionType === 'break_start' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 6 }}>
                    Break Category
                  </label>
                  <select
                    className="crm-form-input"
                    value={breakTypeInput}
                    onChange={e => setBreakTypeInput(e.target.value)}
                    style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                  >
                    <option value="meal">Meal Break (30 mins)</option>
                    <option value="coffee">Coffee / Tea Break (15 mins)</option>
                    <option value="rest">Rest / Personal (10 mins)</option>
                  </select>
                </div>
              )}

              {/* Verification Mode Switcher (PIN vs Selfie) */}
              {(clockActionType === 'in' || clockActionType === 'out') && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setClockMethod('pin');
                      stopCamera();
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: clockMethod === 'pin' ? '#ea7a33' : '#221915',
                      color: clockMethod === 'pin' ? '#fff' : '#a89f91',
                      border: '1px solid #3d2b1f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Key size={14} /> Security PIN
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setClockMethod('selfie');
                      startCamera();
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: clockMethod === 'selfie' ? '#ea7a33' : '#221915',
                      color: clockMethod === 'selfie' ? '#fff' : '#a89f91',
                      border: '1px solid #3d2b1f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Camera size={14} /> Biometric Selfie
                  </button>
                </div>
              )}

              {/* Method A: PIN Keypad */}
              {clockMethod === 'pin' && (clockActionType === 'in' || clockActionType === 'out') && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 6 }}>
                    4-Digit Staff Security PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={clockPin}
                    onChange={e => setClockPin(e.target.value)}
                    placeholder="Enter 4-digit PIN"
                    className="crm-form-input"
                    style={{
                      width: '100%',
                      textAlign: 'center',
                      letterSpacing: 8,
                      fontSize: 20,
                      fontWeight: 700,
                      background: '#221915',
                      borderColor: '#3d2b1f',
                      color: '#f9fafb',
                    }}
                  />
                  {/* Quick Number Pad Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'Clear', 0, 'OK'].map(digit => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => {
                          if (digit === 'Clear') setClockPin('');
                          else if (digit === 'OK') {
                            /* No-op, ready to submit */
                          } else if (clockPin.length < 4) {
                            setClockPin(prev => prev + digit);
                          }
                        }}
                        style={{
                          padding: '10px',
                          background: '#221915',
                          border: '1px solid #3d2b1f',
                          borderRadius: 6,
                          color: '#f9fafb',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {digit}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Method B: Biometric Selfie Capture */}
              {clockMethod === 'selfie' && (clockActionType === 'in' || clockActionType === 'out') && (
                <div style={{ textAlign: 'center' }}>
                  {capturedPhoto ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={capturedPhoto}
                        alt="Captured"
                        style={{ width: 160, height: 160, borderRadius: 12, objectFit: 'cover', border: '2px solid #22c55e' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCapturedPhoto(null);
                          startCamera();
                        }}
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          background: '#ef4444',
                          border: 'none',
                          borderRadius: '50%',
                          width: 24,
                          height: 24,
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          width: '100%',
                          height: 180,
                          background: '#000',
                          borderRadius: 8,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                        }}
                      >
                        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                      </div>

                      <button
                        type="button"
                        className="crm-btn-primary"
                        onClick={captureCameraPhoto}
                        style={{ marginTop: 10, width: '100%', background: '#ea7a33' }}
                      >
                        <Camera size={14} style={{ marginRight: 6 }} />
                        Snap Photo Verification
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Optional Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={clockNotes}
                  onChange={e => setClockNotes(e.target.value)}
                  placeholder="e.g. Covering morning rush on Barista bar"
                  className="crm-form-input"
                  style={{ width: '100%', background: '#221915', borderColor: '#3d2b1f', color: '#f9fafb' }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={closeClockModal}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="crm-btn-primary"
                  style={{ flex: 2, justifyContent: 'center', background: '#ea7a33' }}
                >
                  {loading ? 'Verifying...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SHIFT ROSTER CREATION / EDIT MODAL */}
      {/* ========================================================================= */}
      {scheduleModalOpen && (
        <div className="crm-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="crm-modal-card"
            style={{
              background: '#1a1412',
              border: '1px solid #3d2b1f',
              borderRadius: 14,
              padding: 24,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#ea7a33', padding: 8, borderRadius: 8, color: '#fff' }}>
                  <Calendar size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: 17, color: '#f9fafb' }}>
                  {editingScheduleId ? 'Edit Shift Schedule' : 'Roster New Shift'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#a89f91', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                  Staff Member
                </label>
                <select
                  className="crm-form-input"
                  value={scheduleForm.userId}
                  onChange={e => setScheduleForm({ ...scheduleForm, userId: e.target.value })}
                  required
                  style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                >
                  <option value="">-- Choose Staff Member --</option>
                  {activeStaff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                    Date
                  </label>
                  <input
                    type="date"
                    className="crm-form-input"
                    value={scheduleForm.date}
                    onChange={e => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                    required
                    style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                    Shift Template
                  </label>
                  <select
                    className="crm-form-input"
                    value={scheduleForm.shiftType}
                    onChange={e => {
                      const type = e.target.value;
                      let st = scheduleForm.startTime;
                      let et = scheduleForm.endTime;
                      if (type === 'morning') {
                        st = '07:30';
                        et = '15:30';
                      } else if (type === 'afternoon') {
                        st = '12:00';
                        et = '20:30';
                      } else if (type === 'evening') {
                        st = '15:00';
                        et = '23:30';
                      } else if (type === 'night') {
                        st = '22:00';
                        et = '06:00';
                      } else if (type === 'full_day') {
                        st = '09:00';
                        et = '21:00';
                      }
                      setScheduleForm({ ...scheduleForm, shiftType: type, startTime: st, endTime: et });
                    }}
                    style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                  >
                    <option value="morning">Morning (07:30 - 15:30)</option>
                    <option value="afternoon">Afternoon (12:00 - 20:30)</option>
                    <option value="evening">Evening (15:00 - 23:30)</option>
                    <option value="night">Night (22:00 - 06:00)</option>
                    <option value="full_day">Full Day (09:00 - 21:00)</option>
                    <option value="custom">Custom Hours</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    className="crm-form-input"
                    value={scheduleForm.startTime}
                    onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                    required
                    style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                    End Time
                  </label>
                  <input
                    type="time"
                    className="crm-form-input"
                    value={scheduleForm.endTime}
                    onChange={e => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                    required
                    style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                  Assigned Operational Role
                </label>
                <select
                  className="crm-form-input"
                  value={scheduleForm.role}
                  onChange={e => setScheduleForm({ ...scheduleForm, role: e.target.value })}
                  style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                >
                  <option value="barista">Barista</option>
                  <option value="captain">Floor Captain</option>
                  <option value="kitchen">Kitchen Staff</option>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Shift Manager</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                  Instructions / Shift Notes
                </label>
                <input
                  type="text"
                  className="crm-form-input"
                  value={scheduleForm.notes}
                  onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  placeholder="e.g. Lead morning espresso bar opening"
                  style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setScheduleModalOpen(false)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="crm-btn-primary"
                  style={{ flex: 2, justifyContent: 'center', background: '#ea7a33' }}
                >
                  {editingScheduleId ? 'Update Roster' : 'Save Shift Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREATE TIP POOL MODAL */}
      {/* ========================================================================= */}
      {createTipPoolModal && (
        <div className="crm-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="crm-modal-card"
            style={{
              background: '#1a1412',
              border: '1px solid #3d2b1f',
              borderRadius: 14,
              padding: 24,
              width: '100%',
              maxWidth: 500,
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#ea7a33', padding: 8, borderRadius: 8, color: '#fff' }}>
                  <Coins size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: 17, color: '#f9fafb' }}>Create Shift Tip Pool</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateTipPoolModal(false)}
                style={{ background: 'none', border: 'none', color: '#a89f91', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTipPool} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                  Pool Title
                </label>
                <input
                  type="text"
                  className="crm-form-input"
                  value={tipPoolForm.title}
                  onChange={e => setTipPoolForm({ ...tipPoolForm, title: e.target.value })}
                  required
                  style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                  Date
                </label>
                <input
                  type="date"
                  className="crm-form-input"
                  value={tipPoolForm.date}
                  onChange={e => setTipPoolForm({ ...tipPoolForm, date: e.target.value })}
                  required
                  style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                    Cash Tips (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="crm-form-input"
                    value={tipPoolForm.cashTips}
                    onChange={e => setTipPoolForm({ ...tipPoolForm, cashTips: Number(e.target.value) || 0 })}
                    style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                    Card Tips (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="crm-form-input"
                    value={tipPoolForm.cardTips}
                    onChange={e => setTipPoolForm({ ...tipPoolForm, cardTips: Number(e.target.value) || 0 })}
                    style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                    Service Charge (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="crm-form-input"
                    value={tipPoolForm.serviceChargeAmount}
                    onChange={e => setTipPoolForm({ ...tipPoolForm, serviceChargeAmount: Number(e.target.value) || 0 })}
                    style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                  />
                </div>
              </div>

              <div style={{ background: '#2a1a12', padding: '10px 14px', borderRadius: 8, border: '1px solid #ea7a33', textAlign: 'right' }}>
                <span style={{ fontSize: 12, color: '#ea7a33' }}>Total Pool Aggregated: </span>
                <strong style={{ fontSize: 16, color: '#f9fafb' }}>
                  {money((tipPoolForm.cashTips || 0) + (tipPoolForm.cardTips || 0) + (tipPoolForm.serviceChargeAmount || 0))}
                </strong>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                  Disbursement Formula
                </label>
                <select
                  className="crm-form-input"
                  value={tipPoolForm.distributionMethod}
                  onChange={e => setTipPoolForm({ ...tipPoolForm, distributionMethod: e.target.value })}
                  style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                >
                  <option value="role_weighted">Role-Weighted Split (Barista 40%, Captain 35%, Kitchen 25%, Cashier 20%)</option>
                  <option value="hours_worked">Hours-Worked Proportionate Split</option>
                  <option value="equal">Equal Split Across Active Shift Roster</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setCreateTipPoolModal(false)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="crm-btn-primary"
                  style={{ flex: 2, justifyContent: 'center', background: '#ea7a33' }}
                >
                  Save & Initialize Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: SETTLE PAYOUTS MODAL */}
      {/* ========================================================================= */}
      {settleModalOpen && activeTipPool && (
        <div className="crm-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="crm-modal-card"
            style={{
              background: '#1a1412',
              border: '1px solid #3d2b1f',
              borderRadius: 14,
              padding: 24,
              width: '100%',
              maxWidth: 440,
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#22c55e', padding: 8, borderRadius: 8, color: '#fff' }}>
                  <CheckCircle2 size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: 17, color: '#f9fafb' }}>Settle Tip Disbursement</h3>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#a89f91', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#a89f91' }}>
                Disbursing <strong style={{ color: '#22c55e' }}>{money(activeTipPool.totalAmount)}</strong> across{' '}
                <strong>{activeTipPool.distributions?.length || 0} team members</strong>.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                  Disbursement Mode
                </label>
                <select
                  className="crm-form-input"
                  value={payoutMethodInput}
                  onChange={e => setPayoutMethodInput(e.target.value)}
                  style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                >
                  <option value="upi">Instant UPI Payout</option>
                  <option value="cash">Direct Cash Distribution</option>
                  <option value="salary_credit">Monthly Salary Payroll Credit</option>
                  <option value="bank_transfer">Direct Bank NEFT / IMPS</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a89f91', marginBottom: 4 }}>
                  Transaction / Voucher Reference
                </label>
                <input
                  type="text"
                  className="crm-form-input"
                  value={payoutRefInput}
                  onChange={e => setPayoutRefInput(e.target.value)}
                  placeholder="e.g. UPI-TXN-882194 or Petty Cash Slip #104"
                  style={{ width: '100%', background: '#221915', color: '#f9fafb', borderColor: '#3d2b1f' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setSettleModalOpen(false)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSettleTipPool(activeTipPool.id)}
                  className="crm-btn-primary"
                  style={{ flex: 2, justifyContent: 'center', background: '#22c55e' }}
                >
                  Confirm & Settle Payouts
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: 80MM ESC/POS THERMAL TIP DISBURSEMENT SLIP MODAL */}
      {/* ========================================================================= */}
      {slipModalOpen && (
        <div className="crm-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="crm-modal-card"
            style={{
              background: '#1a1412',
              border: '1px solid #3d2b1f',
              borderRadius: 14,
              padding: 24,
              width: '100%',
              maxWidth: 520,
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Printer size={18} style={{ color: '#ea7a33' }} />
                <h3 style={{ margin: 0, fontSize: 17, color: '#f9fafb' }}>80mm Thermal Tip Settlement Slip</h3>
              </div>
              <button
                type="button"
                onClick={() => setSlipModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#a89f91', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <pre
              style={{
                background: '#0d0a09',
                color: '#22c55e',
                padding: 16,
                borderRadius: 8,
                fontSize: 11,
                fontFamily: 'Courier New, monospace',
                maxHeight: 380,
                overflowY: 'auto',
                border: '1px solid #3d2b1f',
                lineHeight: 1.4,
              }}
            >
              {slipContent}
            </pre>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="crm-btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(slipContent);
                  showNotice('Slip copied to clipboard!');
                }}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Copy Text
              </button>
              <button
                type="button"
                className="crm-btn-primary"
                onClick={() => {
                  window.print();
                }}
                style={{ flex: 1, justifyContent: 'center', background: '#ea7a33' }}
              >
                <Printer size={14} style={{ marginRight: 6 }} /> Print Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

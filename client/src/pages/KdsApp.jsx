import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ChefHat,
  Clock,
  Coffee,
  Maximize2,
  MessageSquare,
  Minimize2,
  PackageOpen,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Utensils,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { api, BASE, getToken } from '../api';

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

// Synthesize pleasant kitchen chime without any external audio asset
function playAudioChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // First tone (D5 ~587.3Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.65);

    // Second bell harmonic (A5 ~880Hz -> D6 ~1174.6Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.32);
    gain2.gain.setValueAtTime(0.25, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.85);
  } catch (err) {
    console.warn('Audio chime notice:', err);
  }
}

// Calculate elapsed time formatted with mm:ss or hh:mm:ss
function formatElapsed(createdAt, nowMs) {
  if (!createdAt) return '00:00';
  const start = new Date(createdAt).getTime();
  const diffSec = Math.max(0, Math.floor((nowMs - start) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  const pad = n => String(n).padStart(2, '0');

  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${pad(hrs)}:${pad(remMins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

// SLA status determination: <10m normal, 10-20m warning, >20m overdue
function getSlaStatus(createdAt, nowMs) {
  if (!createdAt) return { label: 'Normal', level: 'normal' };
  const diffMins = (nowMs - new Date(createdAt).getTime()) / 60000;
  if (diffMins > 20) return { label: 'URGENT OVERDUE', level: 'urgent' };
  if (diffMins > 10) return { label: 'ATTENTION', level: 'warning' };
  return { label: 'ON TRACK', level: 'normal' };
}

// Station determination: Barista (beverages), Kitchen (food), or Hybrid
function getStationBadge(items = []) {
  if (!items.length) return { label: 'GENERAL', type: 'general' };
  let hasDrink = false;
  let hasFood = false;
  const drinkTerms = [
    'coffee', 'latte', 'cappuccino', 'espresso', 'brew', 'tea',
    'cooler', 'shake', 'mocha', 'cortado', 'americano', 'macchiato', 'frappe'
  ];
  for (const it of items) {
    const n = (it.name || '').toLowerCase();
    if (drinkTerms.some(t => n.includes(t))) {
      hasDrink = true;
    } else {
      hasFood = true;
    }
  }
  if (hasDrink && hasFood) return { label: 'BEV + FOOD', type: 'hybrid' };
  if (hasDrink) return { label: 'BARISTA', type: 'beverage' };
  return { label: 'KITCHEN', type: 'kitchen' };
}

function KdsItemsChecklist({ items, orderId, toggleItemCompleted }) {
  return (
    <div className="kds-items-checklist">
      {(items || []).map(item => {
        const itemId = item.id || item._id;
        const isStruck = Boolean(item.isCompleted);

        return (
          <div
            key={itemId || item.name}
            className={`kds-check-item ${isStruck ? 'struck' : ''}`}
            onClick={() => toggleItemCompleted(orderId, itemId)}
            title="Tap to toggle prepared item"
          >
            <div className={`kds-checkbox ${isStruck ? 'checked' : ''}`}>
              {isStruck && <Check size={13} strokeWidth={3} />}
            </div>
            <span className="kds-item-qty">{item.quantity}×</span>
            <div className="kds-item-details-wrap">
              <div className="kds-item-title-row">
                <span className="kds-item-name">{item.name}</span>
                {item.selectedVariant && (
                  <span className="kds-variant-badge">[{item.selectedVariant.name}]</span>
                )}
              </div>
              {Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                <div className="kds-modifiers-flow">
                  {item.selectedModifiers.map((m, idx) => (
                    <span key={idx} className="kds-mod-tag">+{m.name}</span>
                  ))}
                </div>
              )}
              {item.notes && (
                <div className="kds-item-prep-note">
                  <MessageSquare size={11} />
                  <span>{item.notes}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function KdsApp() {
  const nav = useNavigate();
  const { slug } = useParams();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cafeInfo, setCafeInfo] = useState(null);
  const [stationFilter, setStationFilter] = useState('all'); // 'all' | 'beverages' | 'kitchen'
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompletedCol, setShowCompletedCol] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('gusstora_kds_sound') !== 'false';
  });
  const [connected, setConnected] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const [actionPendingId, setActionPendingId] = useState(null);
  const [kotPrintOrder, setKotPrintOrder] = useState(null);

  const eventSourceRef = useRef(null);
  const alertTimeoutRef = useRef(null);

  // Live timer tick every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Initial load
  const loadOrders = async () => {
    try {
      setError('');
      const data = await api('/owner/kds/orders');
      setOrders(Array.isArray(data) ? data : []);

      // If we don't have cafe info yet, load from dashboard
      if (!cafeInfo) {
        const dash = await api('/owner/dashboard').catch(() => null);
        if (dash?.cafe) setCafeInfo(dash.cafe);
      }
    } catch (err) {
      console.error('KDS load error:', err);
      setError(err.message || 'Failed to connect to kitchen tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Connect SSE Live Stream
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const sseUrl = `${BASE}/owner/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener('open', () => {
      setConnected(true);
    });

    es.addEventListener('connected', () => {
      setConnected(true);
    });

    es.addEventListener('order_created', e => {
      try {
        const newOrder = JSON.parse(e.data);
        setOrders(prev => {
          // Prevent duplicates
          const filtered = prev.filter(o => o.id !== newOrder.id && o._id !== newOrder._id);
          return [newOrder, ...filtered];
        });

        // Trigger visual alert & pleasant audio chime
        setNewOrderAlert(newOrder);
        if (soundEnabled) {
          playAudioChime();
        }

        if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = setTimeout(() => {
          setNewOrderAlert(null);
        }, 5000);
      } catch (err) {
        console.error('Error handling order_created event:', err);
      }
    });

    es.addEventListener('order_updated', e => {
      try {
        const updated = JSON.parse(e.data);
        setOrders(prev =>
          prev.map(o => (o.id === updated.id || o._id === updated._id ? updated : o))
        );
      } catch (err) {
        console.error('Error handling order_updated event:', err);
      }
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    };
  }, [soundEnabled]);

  // Audio toggle
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('gusstora_kds_sound', String(next));
      if (next) playAudioChime();
      return next;
    });
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Order status advancement
  const updateOrderStatus = async (orderId, newStatus, paymentStatus) => {
    setActionPendingId(orderId);
    // Optimistic update
    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId || o._id === orderId) {
          return {
            ...o,
            status: newStatus,
            paymentStatus: paymentStatus || o.paymentStatus,
          };
        }
        return o;
      })
    );

    try {
      const body = { status: newStatus };
      if (paymentStatus) body.paymentStatus = paymentStatus;
      await api(`/owner/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error('Failed to advance order:', err);
      setError('Could not update order ticket status: ' + err.message);
      loadOrders();
    } finally {
      setActionPendingId(null);
    }
  };

  // Item preparation strike-off toggle
  const toggleItemCompleted = async (orderId, itemId) => {
    // Optimistic item update
    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId || o._id === orderId) {
          const updatedItems = (o.items || []).map(it => {
            if (it.id === itemId || it._id === itemId) {
              return { ...it, isCompleted: !it.isCompleted };
            }
            return it;
          });
          return { ...o, items: updatedItems };
        }
        return o;
      })
    );

    try {
      await api(`/owner/orders/${orderId}/items/${itemId}/toggle`, {
        method: 'PATCH',
      });
    } catch (err) {
      console.error('Failed to toggle item strike-off:', err);
      loadOrders();
    }
  };

  // Bulk toggle all items on a ticket (quick prep strike-off)
  const strikeAllItems = async (orderId, items = []) => {
    if (!items.length) return;
    const allDone = items.every(it => Boolean(it.isCompleted));
    const targetState = !allDone;

    // Optimistic bulk update
    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId || o._id === orderId) {
          const updatedItems = (o.items || []).map(it => ({
            ...it,
            isCompleted: targetState,
          }));
          return { ...o, items: updatedItems };
        }
        return o;
      })
    );

    // Call server API for items that need updating
    try {
      const itemsToToggle = items.filter(it => Boolean(it.isCompleted) !== targetState);
      await Promise.all(
        itemsToToggle.map(it => {
          const itemId = it.id || it._id;
          return api(`/owner/orders/${orderId}/items/${itemId}/toggle`, {
            method: 'PATCH',
          });
        })
      );
    } catch (err) {
      console.error('Failed to bulk toggle items:', err);
      loadOrders();
    }
  };

  // Calculate average wait time and urgent tickets count
  const { avgWaitMins, urgentCount } = useMemo(() => {
    const activeOrders = orders.filter(
      o => o.status === 'placed' || o.status === 'accepted' || o.status === 'preparing'
    );
    if (!activeOrders.length) return { avgWaitMins: 0, urgentCount: 0 };

    let totalWaitMs = 0;
    let urgent = 0;
    activeOrders.forEach(o => {
      if (o.createdAt) {
        const diffMs = Math.max(0, nowMs - new Date(o.createdAt).getTime());
        totalWaitMs += diffMs;
        if (diffMs > 20 * 60000) {
          urgent += 1;
        }
      }
    });

    const avgMins = Math.round(totalWaitMs / activeOrders.length / 60000);
    return { avgWaitMins: avgMins, urgentCount: urgent };
  }, [orders, nowMs]);

  // Filter orders by station / category and live search
  const filteredOrders = useMemo(() => {
    let list = orders;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(o =>
        (o.orderNo || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        String(o.table || '').toLowerCase().includes(q) ||
        (o.items || []).some(it => (it.name || '').toLowerCase().includes(q))
      );
    }

    if (stationFilter === 'all') return list;

    return list.filter(o => {
      const items = o.items || [];
      if (stationFilter === 'beverages') {
        return items.some(it => {
          const name = (it.name || '').toLowerCase();
          return (
            name.includes('coffee') ||
            name.includes('latte') ||
            name.includes('cappuccino') ||
            name.includes('espresso') ||
            name.includes('brew') ||
            name.includes('tea') ||
            name.includes('cooler') ||
            name.includes('shake') ||
            name.includes('mocha') ||
            name.includes('cortado')
          );
        });
      }
      if (stationFilter === 'kitchen') {
        return items.some(it => {
          const name = (it.name || '').toLowerCase();
          return !(
            name.includes('coffee') ||
            name.includes('latte') ||
            name.includes('cappuccino') ||
            name.includes('espresso') ||
            name.includes('tea') ||
            name.includes('cooler') ||
            name.includes('shake') ||
            name.includes('cold brew')
          );
        });
      }
      return true;
    });
  }, [orders, stationFilter, searchQuery]);

  // Group orders into the 4 KDS columns
  const placedOrders = useMemo(
    () => filteredOrders.filter(o => o.status === 'placed' || o.status === 'accepted'),
    [filteredOrders]
  );
  const cookingOrders = useMemo(
    () => filteredOrders.filter(o => o.status === 'preparing'),
    [filteredOrders]
  );
  const readyOrders = useMemo(
    () => filteredOrders.filter(o => o.status === 'ready'),
    [filteredOrders]
  );
  const completedOrders = useMemo(
    () => filteredOrders.filter(o => o.status === 'completed').slice(0, 10),
    [filteredOrders]
  );

  const activeTotal = placedOrders.length + cookingOrders.length + readyOrders.length;

  return (
    <div className={`kds-viewport ${isFullscreen ? 'kds-fullscreen' : ''}`}>
      {/* ================= TOP COMMAND BAR ================= */}
      <header className="kds-header-bar">
        <div className="kds-brand-block">
          <button
            type="button"
            className="kds-back-btn"
            onClick={() => nav('/owner')}
            title="Return to Owner Control Center"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="kds-logo-wrap" style={{ width: 42, height: 42, minWidth: 42, minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            <img src="/gusstora_emblem.png" alt="Gusstora" width="34" height="34" className="kds-logo-img" style={{ width: 34, height: 34, maxWidth: 34, maxHeight: 34, objectFit: 'contain', display: 'block' }} />
          </div>
          <div>
            <div className="kds-title-row">
              <h1 className="kds-heading">{cafeInfo?.name || 'Gusstora Artisan Roastery'}</h1>
              <span className="kds-badge">KDS LIVE</span>
            </div>
            <div className="kds-sub-meta">
              <span>Kitchen Display & Expediter Board</span>
              <span className="kds-meta-sep">•</span>
              <span className="kds-active-pill">{activeTotal} Active Tickets</span>
              {avgWaitMins > 0 && (
                <span className="kds-avg-wait-pill" title="Average wait time for active kitchen tickets">
                  <Clock size={11} />
                  <span>Avg {avgWaitMins}m wait</span>
                </span>
              )}
              {urgentCount > 0 && (
                <span className="kds-urgent-pill" title="Tickets taking more than 20 minutes">
                  <AlertTriangle size={11} />
                  <span>{urgentCount} Overdue (&gt;20m)</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Live Station Filters */}
        <div className="kds-station-filters">
          <button
            type="button"
            className={`kds-filter-pill ${stationFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStationFilter('all')}
          >
            <PackageOpen size={14} />
            <span>All Stations ({orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length})</span>
          </button>
          <button
            type="button"
            className={`kds-filter-pill ${stationFilter === 'beverages' ? 'active' : ''}`}
            onClick={() => setStationFilter('beverages')}
          >
            <Coffee size={14} />
            <span>Barista & Drinks</span>
          </button>
          <button
            type="button"
            className={`kds-filter-pill ${stationFilter === 'kitchen' ? 'active' : ''}`}
            onClick={() => setStationFilter('kitchen')}
          >
            <Utensils size={14} />
            <span>Kitchen & Food</span>
          </button>
        </div>

        {/* Right: Search, Clock, Status, Fullscreen & Controls */}
        <div className="kds-controls-block">
          <div className="kds-search-box">
            <Search size={14} />
            <input
              type="text"
              className="kds-search-input"
              placeholder="Search table / #"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="kds-clock-box">
            <Clock size={15} className="kds-clock-icon" />
            <span className="kds-clock-time">
              {new Date(nowMs).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              })}
            </span>
          </div>

          <div
            className={`kds-connection-pill ${connected ? 'online' : 'reconnecting'}`}
            title={connected ? 'Real-time SSE active' : 'Reconnecting to live server...'}
          >
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{connected ? 'LIVE SYNC' : 'RECONNECTING'}</span>
          </div>

          <button
            type="button"
            className={`kds-icon-action-btn ${soundEnabled ? 'active' : ''}`}
            onClick={toggleSound}
            title={soundEnabled ? 'Mute Kitchen Chime' : 'Enable Kitchen Chime'}
          >
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            <span className="kds-btn-text">{soundEnabled ? 'Sound ON' : 'Muted'}</span>
          </button>

          <button
            type="button"
            className="kds-test-sound-btn"
            onClick={() => playAudioChime()}
            title="Preview kitchen chime volume and harmonic tone"
          >
            <Volume2 size={13} />
            <span>Test Chime</span>
          </button>

          <button
            type="button"
            className="kds-icon-action-btn"
            onClick={loadOrders}
            title="Manual sync"
          >
            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} />
          </button>

          <button
            type="button"
            className="kds-icon-action-btn fullscreen-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            <span className="kds-btn-text">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        </div>
      </header>

      {/* ================= NEW ORDER TOAST ALERT ================= */}
      {newOrderAlert && (
        <div className="kds-new-order-toast" onClick={() => setNewOrderAlert(null)}>
          <div className="kds-toast-bell">
            <Bell size={22} className="kds-bell-ring" />
          </div>
          <div className="kds-toast-content">
            <div className="kds-toast-header">
              <strong>NEW ORDER RECEIVED!</strong>
              <span className="kds-toast-order-no">#{newOrderAlert.orderNo}</span>
            </div>
            <p>
              {newOrderAlert.table ? `Table ${newOrderAlert.table}` : 'Takeaway'} •{' '}
              {newOrderAlert.items?.length || 0} item(s) • {newOrderAlert.customerName || 'Guest'}
            </p>
          </div>
          <span className="kds-toast-dismiss">Tap to dismiss</span>
        </div>
      )}

      {error && (
        <div className="kds-error-strip">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* ================= 4-COLUMN WORKFLOW GRID ================= */}
      <main className="kds-workflow-grid">
        {/* ================= COLUMN 1: INCOMING & PLACED ================= */}
        <section className="kds-col col-incoming">
          <div className="kds-col-header">
            <div className="kds-col-title-area">
              <span className="kds-col-indicator orange"></span>
              <h2>1. Incoming & Placed</h2>
            </div>
            <span className="kds-col-count-badge">{placedOrders.length}</span>
          </div>

          <div className="kds-tickets-scroll">
            {placedOrders.map(order => {
              const orderId = order.id || order._id;
              const sla = getSlaStatus(order.createdAt, nowMs);
              const elapsed = formatElapsed(order.createdAt, nowMs);
              const station = getStationBadge(order.items);
              const isTakeaway = String(order.table || '').toLowerCase().includes('takeaway');

              return (
                <article
                  key={orderId}
                  className={`kds-ticket-card ${newOrderAlert?.orderNo === order.orderNo ? 'ticket-highlight' : ''}`}
                >
                  <div className="kds-ticket-head">
                    <div>
                      <div className="kds-ticket-no">#{order.orderNo}</div>
                      <div className="kds-ticket-customer">{order.customerName || 'Guest'}</div>
                      <div style={{ marginTop: '4px' }}>
                        <span className={`kds-station-badge ${station.type}`}>
                          {station.label}
                        </span>
                      </div>
                    </div>
                    <div className="kds-ticket-meta-right">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {isTakeaway ? (
                          <span className="kds-table-tag takeaway-tag">
                            <ShoppingBag size={11} />
                            Takeaway
                          </span>
                        ) : (
                          <span className="kds-table-tag">
                            Table {order.table || '1'}
                          </span>
                        )}
                        <span className={`kds-pay-pill ${order.paymentStatus === 'paid' ? 'paid' : 'unpaid'}`}>
                          {order.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                        </span>
                        <button
                          type="button"
                          className="kds-mini-icon-btn"
                          onClick={() => setKotPrintOrder(order)}
                          title="Print Kitchen Ticket (KOT)"
                          style={{ background: '#251b14', border: '1px solid #4a3325', color: '#ea7a33', padding: '3px 6px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 'bold' }}
                        >
                          <Printer size={11} />
                          <span>KOT</span>
                        </button>
                      </div>
                      <div className={`kds-sla-timer ${sla.level}`}>
                        <Clock size={12} />
                        <span>{elapsed}</span>
                      </div>
                    </div>
                  </div>

                  {(order.notes || order.note) && (
                    <div className="kds-ticket-notes">
                      <MessageSquare size={12} />
                      <span>{order.notes || order.note}</span>
                    </div>
                  )}

                  {/* Item Strike-Off Checklist */}
                  <div className="kds-checklist-head">
                    <span>Prep Checklist ({(order.items || []).filter(i => i.isCompleted).length}/{(order.items || []).length})</span>
                    {(order.items || []).length > 1 && (
                      <button
                        type="button"
                        className="kds-strike-all-btn"
                        onClick={() => strikeAllItems(orderId, order.items)}
                        title="Toggle all items on this ticket"
                      >
                        <CheckCheck size={12} />
                        <span>{(order.items || []).every(i => i.isCompleted) ? 'Reset' : 'Strike All'}</span>
                      </button>
                    )}
                  </div>

                  <KdsItemsChecklist
                    items={order.items}
                    orderId={orderId}
                    toggleItemCompleted={toggleItemCompleted}
                  />

                  <div className="kds-ticket-footer">
                    <button
                      type="button"
                      className="kds-action-btn cook-btn"
                      disabled={actionPendingId === orderId}
                      onClick={() => updateOrderStatus(orderId, 'preparing')}
                    >
                      <ChefHat size={16} />
                      <span>Start Cooking</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </article>
              );
            })}

            {placedOrders.length === 0 && (
              <div className="kds-empty-col">
                <PackageOpen size={36} className="empty-icon" />
                <h4>No Incoming Tickets</h4>
                <p>New orders placed by diners will chime in live.</p>
              </div>
            )}
          </div>
        </section>

        {/* ================= COLUMN 2: IN KITCHEN (COOKING) ================= */}
        <section className="kds-col col-cooking">
          <div className="kds-col-header">
            <div className="kds-col-title-area">
              <span className="kds-col-indicator amber"></span>
              <h2>2. In Kitchen (Cooking)</h2>
            </div>
            <span className="kds-col-count-badge amber">{cookingOrders.length}</span>
          </div>

          <div className="kds-tickets-scroll">
            {cookingOrders.map(order => {
              const orderId = order.id || order._id;
              const sla = getSlaStatus(order.createdAt, nowMs);
              const elapsed = formatElapsed(order.createdAt, nowMs);
              const station = getStationBadge(order.items);
              const isTakeaway = String(order.table || '').toLowerCase().includes('takeaway');

              return (
                <article key={orderId} className="kds-ticket-card in-prep">
                  <div className="kds-ticket-head">
                    <div>
                      <div className="kds-ticket-no">#{order.orderNo}</div>
                      <div className="kds-ticket-customer">{order.customerName || 'Guest'}</div>
                      <div style={{ marginTop: '4px' }}>
                        <span className={`kds-station-badge ${station.type}`}>
                          {station.label}
                        </span>
                      </div>
                    </div>
                    <div className="kds-ticket-meta-right">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {isTakeaway ? (
                          <span className="kds-table-tag takeaway-tag">
                            <ShoppingBag size={11} />
                            Takeaway
                          </span>
                        ) : (
                          <span className="kds-table-tag">
                            Table {order.table || '1'}
                          </span>
                        )}
                        <span className={`kds-pay-pill ${order.paymentStatus === 'paid' ? 'paid' : 'unpaid'}`}>
                          {order.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                        </span>
                      </div>
                      <div className={`kds-sla-timer ${sla.level}`}>
                        <Clock size={12} />
                        <span>{elapsed}</span>
                      </div>
                    </div>
                  </div>

                  {(order.notes || order.note) && (
                    <div className="kds-ticket-notes">
                      <MessageSquare size={12} />
                      <span>{order.notes || order.note}</span>
                    </div>
                  )}

                  {/* Item Strike-Off Checklist */}
                  <div className="kds-checklist-head">
                    <span>Prep Checklist ({(order.items || []).filter(i => i.isCompleted).length}/{(order.items || []).length})</span>
                    {(order.items || []).length > 1 && (
                      <button
                        type="button"
                        className="kds-strike-all-btn"
                        onClick={() => strikeAllItems(orderId, order.items)}
                        title="Toggle all items on this ticket"
                      >
                        <CheckCheck size={12} />
                        <span>{(order.items || []).every(i => i.isCompleted) ? 'Reset' : 'Strike All'}</span>
                      </button>
                    )}
                  </div>

                  <KdsItemsChecklist
                    items={order.items}
                    orderId={orderId}
                    toggleItemCompleted={toggleItemCompleted}
                  />

                  <div className="kds-ticket-footer dual-action">
                    <button
                      type="button"
                      className="kds-recall-btn"
                      disabled={actionPendingId === orderId}
                      onClick={() => updateOrderStatus(orderId, 'placed')}
                      title="Recall back to Placed"
                    >
                      <RotateCcw size={14} />
                      <span>Recall</span>
                    </button>

                    <button
                      type="button"
                      className="kds-action-btn ready-btn"
                      disabled={actionPendingId === orderId}
                      onClick={() => updateOrderStatus(orderId, 'ready')}
                    >
                      <Bell size={16} />
                      <span>Mark Ready</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </article>
              );
            })}

            {cookingOrders.length === 0 && (
              <div className="kds-empty-col">
                <ChefHat size={36} className="empty-icon" />
                <h4>Kitchen Clear</h4>
                <p>All active tickets are fulfilled or awaiting preparation.</p>
              </div>
            )}
          </div>
        </section>

        {/* ================= COLUMN 3: READY FOR SERVICE ================= */}
        <section className="kds-col col-ready">
          <div className="kds-col-header">
            <div className="kds-col-title-area">
              <span className="kds-col-indicator green"></span>
              <h2>3. Ready for Service</h2>
            </div>
            <span className="kds-col-count-badge green">{readyOrders.length}</span>
          </div>

          <div className="kds-tickets-scroll">
            {readyOrders.map(order => {
              const orderId = order.id || order._id;
              const sla = getSlaStatus(order.createdAt, nowMs);
              const elapsed = formatElapsed(order.createdAt, nowMs);
              const station = getStationBadge(order.items);
              const isTakeaway = String(order.table || '').toLowerCase().includes('takeaway');

              return (
                <article key={orderId} className="kds-ticket-card ready-to-serve">
                  <div className="kds-ticket-head">
                    <div>
                      <div className="kds-ticket-no">#{order.orderNo}</div>
                      <div className="kds-ticket-customer">{order.customerName || 'Guest'}</div>
                      <div style={{ marginTop: '4px' }}>
                        <span className={`kds-station-badge ${station.type}`}>
                          {station.label}
                        </span>
                      </div>
                    </div>
                    <div className="kds-ticket-meta-right">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {isTakeaway ? (
                          <span className="kds-table-tag takeaway-tag">
                            <ShoppingBag size={11} />
                            Pickup Counter
                          </span>
                        ) : (
                          <span className="kds-table-tag ready-tag">
                            Table {order.table || '1'}
                          </span>
                        )}
                        <span className={`kds-pay-pill ${order.paymentStatus === 'paid' ? 'paid' : 'unpaid'}`}>
                          {order.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                        </span>
                      </div>
                      <div className={`kds-sla-timer ${sla.level}`}>
                        <Clock size={12} />
                        <span>{elapsed}</span>
                      </div>
                    </div>
                  </div>

                  {(order.notes || order.note) && (
                    <div className="kds-ticket-notes">
                      <MessageSquare size={12} />
                      <span>{order.notes || order.note}</span>
                    </div>
                  )}

                  <div className="kds-checklist-head">
                    <span>Prep Checklist ({(order.items || []).filter(i => i.isCompleted).length}/{(order.items || []).length})</span>
                    {(order.items || []).length > 1 && (
                      <button
                        type="button"
                        className="kds-strike-all-btn"
                        onClick={() => strikeAllItems(orderId, order.items)}
                        title="Toggle all items on this ticket"
                      >
                        <CheckCheck size={12} />
                        <span>{(order.items || []).every(i => i.isCompleted) ? 'Reset' : 'Strike All'}</span>
                      </button>
                    )}
                  </div>

                  <KdsItemsChecklist
                    items={order.items}
                    orderId={orderId}
                    toggleItemCompleted={toggleItemCompleted}
                  />

                  <div className="kds-ticket-footer dual-action">
                    <button
                      type="button"
                      className="kds-recall-btn"
                      disabled={actionPendingId === orderId}
                      onClick={() => updateOrderStatus(orderId, 'preparing')}
                      title="Move back to Cooking"
                    >
                      <RotateCcw size={14} />
                      <span>Back</span>
                    </button>

                    <button
                      type="button"
                      className="kds-action-btn complete-btn"
                      disabled={actionPendingId === orderId}
                      onClick={() => updateOrderStatus(orderId, 'completed', 'paid')}
                    >
                      <CheckCircle2 size={16} />
                      <span>Served & Fulfilled</span>
                    </button>
                  </div>
                </article>
              );
            })}

            {readyOrders.length === 0 && (
              <div className="kds-empty-col">
                <CheckCircle2 size={36} className="empty-icon" />
                <h4>No Orders Awaiting Pickup</h4>
                <p>Orders marked ready will appear here for expediters.</p>
              </div>
            )}
          </div>
        </section>

        {/* ================= COLUMN 4: RECENT FULFILLED ================= */}
        {showCompletedCol && (
          <section className="kds-col col-completed">
            <div className="kds-col-header">
              <div className="kds-col-title-area">
                <span className="kds-col-indicator slate"></span>
                <h2>4. Fulfilled (Recent)</h2>
              </div>
              <span className="kds-col-count-badge slate">{completedOrders.length}</span>
            </div>

            <div className="kds-tickets-scroll">
              {completedOrders.map(order => {
                const orderId = order.id || order._id;
                const station = getStationBadge(order.items);
                const isTakeaway = String(order.table || '').toLowerCase().includes('takeaway');

                return (
                  <article key={orderId} className="kds-ticket-card fulfilled">
                    <div className="kds-ticket-head">
                      <div>
                        <div className="kds-ticket-no">#{order.orderNo}</div>
                        <div className="kds-ticket-customer">{order.customerName || 'Guest'}</div>
                        <div style={{ marginTop: '4px' }}>
                          <span className={`kds-station-badge ${station.type}`}>
                            {station.label}
                          </span>
                        </div>
                      </div>
                      <span className="kds-fulfilled-badge">Fulfilled</span>
                    </div>

                    <div className="kds-fulfilled-summary">
                      <span>{(order.items || []).reduce((s, i) => s + (i.quantity || 1), 0)} items</span>
                      <span>•</span>
                      <span>{money(order.total)}</span>
                      <span>•</span>
                      <span>
                        {isTakeaway ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <ShoppingBag size={11} /> Takeaway
                          </span>
                        ) : (
                          `Table ${order.table || '1'}`
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="kds-recall-small-btn"
                      disabled={actionPendingId === orderId}
                      onClick={() => updateOrderStatus(orderId, 'ready')}
                    >
                      <RotateCcw size={12} />
                      <span>Recall to Ready</span>
                    </button>
                  </article>
                );
              })}

              {completedOrders.length === 0 && (
                <div className="kds-empty-col">
                  <Check size={36} className="empty-icon" />
                  <h4>No Recent Completed Orders</h4>
                  <p>Fulfilled tickets show here for expediters and counter staff.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ===================== THERMAL KOT PRINT MODAL ===================== */}
      {kotPrintOrder && (
        <div className="kot-receipt-preview-modal-backdrop" onClick={() => setKotPrintOrder(null)}>
          <div className="kot-receipt-preview-card" onClick={e => e.stopPropagation()}>
            <div className="kot-preview-header">
              <div className="kot-preview-title">
                <Printer size={16} />
                <span>Thermal KOT Preview</span>
              </div>
              <button
                className="customizer-close-btn"
                onClick={() => setKotPrintOrder(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* 80mm ESC/POS Thermal Layout */}
            <div className="kot-thermal-receipt">
              <div className="kot-head-brand">
                <h2 className="kot-cafe-name">{cafeInfo?.name || 'GUSSTORA ROASTERY'}</h2>
                <div className="kot-doc-type">*** KITCHEN ORDER TICKET (KOT) ***</div>
              </div>

              <table className="kot-meta-table">
                <tbody>
                  <tr>
                    <td><strong>KOT / TOKEN:</strong></td>
                    <td className="td-right"><strong>#{kotPrintOrder.orderNo}</strong></td>
                  </tr>
                  <tr>
                    <td><strong>TABLE / AREA:</strong></td>
                    <td className="td-right">TABLE {kotPrintOrder.table || '01'}</td>
                  </tr>
                  <tr>
                    <td><strong>CUSTOMER:</strong></td>
                    <td className="td-right">{kotPrintOrder.customerName || 'Guest'}</td>
                  </tr>
                  <tr>
                    <td><strong>TIME PUNCHED:</strong></td>
                    <td className="td-right">{new Date(kotPrintOrder.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                  </tr>
                  <tr>
                    <td><strong>STATION:</strong></td>
                    <td className="td-right">{getStationBadge(kotPrintOrder.items).label}</td>
                  </tr>
                </tbody>
              </table>

              <table className="kot-items-table">
                <thead>
                  <tr>
                    <th className="th-qty">QTY</th>
                    <th>ITEM DESCRIPTION</th>
                  </tr>
                </thead>
                <tbody>
                  {(kotPrintOrder.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 'bold' }}>{it.quantity}x</td>
                      <td>
                        <div className="kot-line-name">{it.name}</div>
                        {it.selectedVariant && (
                          <div className="kot-line-variant">[{it.selectedVariant.name.toUpperCase()}]</div>
                        )}
                        {Array.isArray(it.selectedModifiers) && it.selectedModifiers.length > 0 && (
                          it.selectedModifiers.map((m, mIdx) => (
                            <div key={mIdx} className="kot-line-mod">» {m.name}</div>
                          ))
                        )}
                        {it.notes && (
                          <div className="kot-line-note">COOK NOTE: {it.notes}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="kot-receipt-footer">
                <div>TOTAL ITEMS: {(kotPrintOrder.items || []).reduce((s, i) => s + (i.quantity || 1), 0)}</div>
                <div style={{ marginTop: 4 }}>Punched via Gusstora KDS Cloud System</div>
              </div>
            </div>

            <div className="kot-actions-bar">
              <button
                type="button"
                className="kot-print-btn"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>Print Physical KOT</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Armchair,
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  Clock,
  Coffee,
  CreditCard,
  DollarSign,
  Flame,
  History,
  Layers,
  Lock,
  LogOut,
  Minimize2,
  Minus,
  MoveRight,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  Utensils,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { api, BASE, getToken } from '../api';

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

// Audio chime for tactile floor feedback
function playCaptainTone(type = 'success') {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'fire') {
      // Ascending double beep for Fire KOT
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    } else if (type === 'void') {
      // Low alert tone
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    } else {
      // Pleasant chime for seating / refresh
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch {
    // Ignore audio errors on strict autoplay policies
  }
}

export default function CaptainApp() {
  const { slug: routeSlug } = useParams();
  const navigate = useNavigate();
  const slug = routeSlug || 'demo-cafe';

  // Auth & Captain state
  const [captainToken, setCaptainToken] = useState(() => localStorage.getItem('gusstora_captain_token') || '');
  const [currentCaptain, setCurrentCaptain] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gusstora_captain_user') || 'null');
    } catch {
      return null;
    }
  });
  const canManageFloor = ['owner', 'manager', 'cashier'].includes(currentCaptain?.role);

  // Staff password sign-in state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Floor plan data state
  const [cafeData, setCafeData] = useState(null);
  const [tables, setTables] = useState([]);
  const [sections, setSections] = useState(['All']);
  const [activeSection, setActiveSection] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, available: 0, occupied: 0, billed: 0, cleaning: 0 });
  const [isLoadingFloor, setIsLoadingFloor] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Menu catalog state (for taking orders)
  const [menuCatalog, setMenuCatalog] = useState([]);
  const [menuCategories, setMenuCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  // Active interactive modals / drawers
  const [selectedTable, setSelectedTable] = useState(null);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'seat' | 'table-hub' | 'order-sheet' | 'transfer' | 'merge' | 'void'

  // Seat drawer state
  const [seatPax, setSeatPax] = useState(2);
  const [seatDinerName, setSeatDinerName] = useState('');
  const [seatDinerPhone, setSeatDinerPhone] = useState('');
  const [isSeating, setIsSeating] = useState(false);

  // New Order / KOT cart state
  const [orderCart, setOrderCart] = useState([]);
  const [orderChefNotes, setOrderChefNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Transfer & Merge state
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferReason, setTransferReason] = useState('Guest requested table change');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeReason, setMergeReason] = useState('Combined group seating');

  // Void item state
  const [voidingItemId, setVoidingItemId] = useState(null);
  const [voidReason, setVoidReason] = useState('Guest changed mind');
  const [isVoiding, setIsVoiding] = useState(false);

  // UI settings
  const [isMuted, setIsMuted] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  // Toast / notification banner
  const showToast = (message, type = 'success') => {
    setActionNotice({ message, type });
    if (!isMuted) {
      playCaptainTone(type === 'error' ? 'void' : type === 'fire' ? 'fire' : 'success');
    }
    setTimeout(() => {
      setActionNotice(prev => (prev?.message === message ? null : prev));
    }, 3800);
  };

  // Helper auth headers
  const getAuthHeaders = () => {
    const token = captainToken || getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };
  };

  // 2. Fetch Floor Plan
  const loadFloorPlan = async () => {
    setIsLoadingFloor(true);
    try {
      const res = await fetch(`${BASE}/captain/floor-plan`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (res.status === 401 || res.status === 403) {
        // Session expired or unauthorized
        setCaptainToken('');
        localStorage.removeItem('gusstora_captain_token');
        localStorage.removeItem('gusstora_captain_user');
        return;
      }

      if (res.ok && (data.tables || data.ok)) {
        if (data.cafe) setCafeData(data.cafe);
        setTables(data.tables || []);
        const availableSections = data.sections || ['All'];
        setSections(availableSections);
        setActiveSection(current =>
          current === 'All' || availableSections.includes(current)
            ? current
            : availableSections[0] || 'All',
        );
        setSelectedTable(current => {
          const currentTable = current && data.tables?.find(table => table.id === current.id);
          if (currentTable) return currentTable;
          const defaultSection = availableSections[0];
          return data.tables?.find(table => table.section === defaultSection && table.status === 'available')
            || data.tables?.find(table => table.section === defaultSection)
            || null;
        });
        setStats(data.stats || { total: 0, available: 0, occupied: 0, billed: 0, cleaning: 0 });
        setLastRefreshed(new Date());

        // If a table drawer is currently open, refresh its data
        if (selectedTable) {
          const updated = (data.tables || []).find(t => t.id === selectedTable.id);
          if (updated) setSelectedTable(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load floor plan:', err);
    } finally {
      setIsLoadingFloor(false);
    }
  };

  // 3. Fetch Cafe Menu for order taking
  const loadCafeMenu = async () => {
    try {
      const res = await fetch(`${BASE}/public/cafes/${slug}`);
      const data = await res.json();
      if (data?.menu) {
        setMenuCatalog(data.menu || []);
        const cats = Array.from(new Set((data.menu || []).map(m => m.category || 'General')));
        setMenuCategories(['All', ...cats]);
      }
      if (data?.name) {
        setCafeData(prev => ({ ...(prev || {}), name: data.name, slug: data.slug }));
      }
    } catch {
      // Fail gracefully
    }
  };

  // Initial load
  useEffect(() => {
    loadCafeMenu();
  }, [slug]);

  useEffect(() => {
    if (captainToken) {
      loadFloorPlan();
      const interval = setInterval(loadFloorPlan, 15000); // 15s live floor polling
      return () => clearInterval(interval);
    }
  }, [captainToken]);

  const handleLogin = async event => {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch(`${BASE}/public/cafes/${slug}/captain/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        setCaptainToken(data.token);
        setCurrentCaptain(data.user);
        localStorage.setItem('gusstora_captain_token', data.token);
        localStorage.setItem('gusstora_captain_user', JSON.stringify(data.user));
        setLoginPassword('');
        showToast(`Welcome ${data.user?.name || 'Staff'}! Floor unlocked.`, 'success');
      } else {
        setLoginError(data.message || 'Unable to sign in. Check your email and password.');
        if (!isMuted) playCaptainTone('void');
      }
    } catch {
      setLoginError('Connection error while signing in.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setCaptainToken('');
    setCurrentCaptain(null);
    localStorage.removeItem('gusstora_captain_token');
    localStorage.removeItem('gusstora_captain_user');
    setActiveDrawer(null);
    setSelectedTable(null);
    setLoginPassword('');
    showToast('Session locked. Sign in to resume.', 'success');
  };

  // Table status filtering
  const filteredTables = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    return tables.filter(table => {
      const matchesSection = activeSection === 'All' || table.section === activeSection;
      const matchesSearch = !query ||
        String(table.tableNumber || '').toLowerCase().includes(query) ||
        String(table.name || '').toLowerCase().includes(query);
      return matchesSection && matchesSearch;
    });
  }, [tables, activeSection, tableSearch]);

  // Open appropriate action for a table
  const handleTableClick = table => {
    setSelectedTable(table);
    if (table.status === 'available') {
      setSeatPax(table.capacity || 2);
      setSeatDinerName('');
      setSeatDinerPhone('');
      setActiveDrawer('seat');
    } else if (table.status === 'occupied') {
      setActiveDrawer('table-hub');
    } else if (table.status === 'billed') {
      setActiveDrawer('table-hub');
    } else if (table.status === 'cleaning') {
      handleReleaseTable(table.id);
    } else {
      setActiveDrawer('table-hub');
    }
  };

  // Action: Seat Table
  const handleSeatTable = async andTakeOrder => {
    if (!selectedTable) return;
    setIsSeating(true);
    try {
      const res = await fetch(`${BASE}/captain/tables/${selectedTable.id}/seat`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          guestCount: seatPax,
          dinerName: seatDinerName || undefined,
          dinerPhone: seatDinerPhone || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.ok)) {
        showToast(`Table ${selectedTable.tableNumber} seated with ${seatPax} guests.`, 'success');
        await loadFloorPlan();
        if (andTakeOrder) {
          setOrderCart([]);
          setOrderChefNotes('');
          setActiveDrawer('order-sheet');
        } else {
          setActiveDrawer(null);
        }
      } else {
        showToast(data.message || 'Failed to seat table', 'error');
      }
    } catch {
      showToast('Network error while seating table', 'error');
    } finally {
      setIsSeating(false);
    }
  };

  // Order Taking: Add to Cart with smart course classification
  const handleAddToCart = (menuItem, initialCourse = null) => {
    const defaultCourse =
      initialCourse ||
      (menuItem.category?.toLowerCase().includes('starter') || menuItem.category?.toLowerCase().includes('snack')
        ? 'starters'
        : menuItem.category?.toLowerCase().includes('beverage') || menuItem.category?.toLowerCase().includes('coffee')
        ? 'beverages'
        : menuItem.category?.toLowerCase().includes('dessert')
        ? 'desserts'
        : 'mains');

    setOrderCart(prev => {
      const existingIdx = prev.findIndex(item => item.menuItemId === menuItem.id && item.course === defaultCourse);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].quantity += 1;
        return copy;
      }
      return [
        ...prev,
        {
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
          course: defaultCourse,
          itemStatus: defaultCourse === 'mains' ? 'hold' : 'fired', // Mains default to hold, others to fired
          kitchenNotes: '',
        },
      ];
    });
  };

  const handleUpdateCartQty = (idx, delta) => {
    setOrderCart(prev => {
      const copy = [...prev];
      copy[idx].quantity += delta;
      if (copy[idx].quantity <= 0) {
        copy.splice(idx, 1);
      }
      return copy;
    });
  };

  const handleUpdateCartCourse = (idx, newCourse) => {
    setOrderCart(prev => {
      const copy = [...prev];
      copy[idx].course = newCourse;
      return copy;
    });
  };

  const handleToggleCartHold = idx => {
    setOrderCart(prev => {
      const copy = [...prev];
      copy[idx].itemStatus = copy[idx].itemStatus === 'hold' ? 'fired' : 'hold';
      return copy;
    });
  };

  const handleUpdateCartNotes = (idx, notes) => {
    setOrderCart(prev => {
      const copy = [...prev];
      copy[idx].kitchenNotes = notes;
      return copy;
    });
  };

  // Submit Order / Fire KOT
  const handleFireKOT = async () => {
    if (!selectedTable || orderCart.length === 0) return;
    setIsSubmittingOrder(true);
    try {
      const res = await fetch(`${BASE}/captain/tables/${selectedTable.id}/order`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          items: orderCart,
          chefNotes: orderChefNotes || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.ok)) {
        showToast(`KOT Fired! Ticket #${data.order?.orderNumber || ''} sent to kitchen.`, 'fire');
        setOrderCart([]);
        setOrderChefNotes('');
        await loadFloorPlan();
        setActiveDrawer('table-hub');
      } else {
        showToast(data.message || 'Failed to fire KOT', 'error');
      }
    } catch {
      showToast('Network error while firing KOT', 'error');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Action: Fire Course Now (e.g. Mains or Desserts)
  const handleFireCourse = async course => {
    if (!selectedTable?.activeOrder?.id) return;
    try {
      const res = await fetch(`${BASE}/captain/orders/${selectedTable.activeOrder.id}/fire-course`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ course }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.ok)) {
        showToast(`Fired ${course.toUpperCase()} (${data.firedCount} items released to kitchen)!`, 'fire');
        await loadFloorPlan();
      } else {
        showToast(data.message || 'Failed to fire course', 'error');
      }
    } catch {
      showToast('Network error while firing course', 'error');
    }
  };

  // Action: Void Item
  const handleVoidItem = async () => {
    if (!selectedTable?.activeOrder?.id || !voidingItemId) return;
    setIsVoiding(true);
    try {
      const res = await fetch(`${BASE}/captain/orders/${selectedTable.activeOrder.id}/items/${voidingItemId}/void`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          reason: voidReason,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.ok)) {
        showToast(`Item voided. Subtotal recalculated.`, 'success');
        setVoidingItemId(null);
        await loadFloorPlan();
        setActiveDrawer('table-hub');
      } else {
        showToast(data.message || 'Void authorization failed', 'error');
      }
    } catch {
      showToast('Network error while voiding item', 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  // Action: Transfer Table
  const handleTransferTable = async () => {
    if (!selectedTable || !transferTargetId) return;
    try {
      const res = await fetch(`${BASE}/captain/tables/transfer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fromTableId: selectedTable.id,
          toTableId: transferTargetId,
          reason: transferReason,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.ok)) {
        showToast(`Party transferred successfully to Table ${data.toTable?.tableNumber}!`, 'success');
        await loadFloorPlan();
        setActiveDrawer(null);
      } else {
        showToast(data.message || 'Failed to transfer table', 'error');
      }
    } catch {
      showToast('Network error while transferring table', 'error');
    }
  };

  // Action: Merge Tables
  const handleMergeTables = async () => {
    if (!selectedTable || !mergeTargetId) return;
    try {
      const res = await fetch(`${BASE}/captain/tables/merge`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          primaryTableId: selectedTable.id,
          secondaryTableId: mergeTargetId,
          reason: mergeReason,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.ok)) {
        showToast(`Tables merged successfully!`, 'success');
        await loadFloorPlan();
        setActiveDrawer(null);
      } else {
        showToast(data.message || 'Failed to merge tables', 'error');
      }
    } catch {
      showToast('Network error while merging tables', 'error');
    }
  };

  // Action: Request Bill
  const handleRequestBill = async tableId => {
    const id = tableId || selectedTable?.id;
    if (!id) return;
    try {
      const res = await fetch(`${BASE}/captain/tables/${id}/request-bill`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.ok)) {
        showToast(`Bill requested! Table marked as Billed.`, 'success');
        await loadFloorPlan();
      } else {
        showToast(data.message || 'Failed to request bill', 'error');
      }
    } catch {
      showToast('Network error requesting bill', 'error');
    }
  };

  // Action: Release / Clean Table
  const handleReleaseTable = async tableId => {
    const id = tableId || selectedTable?.id;
    if (!id) return;
    try {
      const res = await fetch(`${BASE}/captain/tables/${id}/release`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.ok)) {
        showToast(`Table released and marked Available!`, 'success');
        await loadFloorPlan();
        setActiveDrawer(null);
      } else {
        showToast(data.message || 'Failed to release table', 'error');
      }
    } catch {
      showToast('Network error releasing table', 'error');
    }
  };

  // Filtered menu items for ordering sheet
  const filteredMenuItems = useMemo(() => {
    return menuCatalog.filter(item => {
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch =
        !menuSearchQuery ||
        item.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(menuSearchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [menuCatalog, selectedCategory, menuSearchQuery]);

  // Cart total calculations
  const cartSubtotal = useMemo(() => {
    return orderCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [orderCart]);

  // -------------------------------------------------------------
  // RENDER: 1. Staff sign-in screen (when locked or not authenticated)
  // -------------------------------------------------------------
  if (!captainToken || !currentCaptain) {
    return (
      <div className="captain-app captain-pin-screen">
        {/* Floating Notification */}
        {actionNotice && (
          <div className={`captain-floating-toast ${actionNotice.type}`}>
            {actionNotice.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{actionNotice.message}</span>
          </div>
        )}

        <div className="captain-pin-container">
          {/* Brand & Outlet Branding */}
          <div className="captain-pin-brand">
            <div className="captain-brand-badge">
              <Smartphone size={24} className="captain-accent-icon" />
              <span>GUESTORA Captain</span>
            </div>
            <h1 className="captain-pin-title">Waiter & Floor Terminal</h1>
            <p className="captain-pin-subtitle">Sign in with your staff email and password</p>
          </div>

          <form className="captain-login-form" onSubmit={handleLogin}>
            <div className="captain-input-group">
              <label className="captain-input-label" htmlFor="captain-login-email">Staff email</label>
              <input
                id="captain-login-email"
                className="captain-input-field"
                type="email"
                autoComplete="username"
                required
                value={loginEmail}
                onChange={event => setLoginEmail(event.target.value)}
              />
            </div>
            <div className="captain-input-group">
              <label className="captain-input-label" htmlFor="captain-login-password">Password</label>
              <input
                id="captain-login-password"
                className="captain-input-field"
                type="password"
                autoComplete="current-password"
                minLength={6}
                required
                value={loginPassword}
                onChange={event => setLoginPassword(event.target.value)}
              />
            </div>
            {loginError && (
              <div className="captain-pin-error" role="alert">
                <AlertCircle size={14} />
                <span>{loginError}</span>
              </div>
            )}
            <button type="submit" className="captain-primary-btn" disabled={isLoggingIn}>
              <Lock size={18} />
              <span>{isLoggingIn ? 'Signing in…' : 'Sign in to Captain'}</span>
            </button>
            <p className="captain-pin-hint">Use the password set for your staff account in CRM.</p>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: 2. Interactive Floor Plan & Hub
  // -------------------------------------------------------------
  return (
    <div className="captain-app">
      {/* Floating Notification */}
      {actionNotice && (
        <div className={`captain-floating-toast ${actionNotice.type}`}>
          {actionNotice.type === 'error' ? (
            <AlertCircle size={18} />
          ) : actionNotice.type === 'fire' ? (
            <Flame size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <span>{actionNotice.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="captain-header">
        <div className="captain-header-left">
          <div className="captain-header-brand">
            <span className="captain-brand-mark"><Utensils size={21} /></span>
            <div className="captain-brand-copy">
              <span className="captain-brand-title">Table Management</span>
              <span className="captain-brand-cafe">{cafeData?.name || 'GUESTORA'}</span>
            </div>
          </div>
          <div className="captain-header-waiter-badge">
            <div className="captain-waiter-avatar">{currentCaptain.name.charAt(0).toUpperCase()}</div>
            <div className="captain-waiter-info">
              <span className="captain-waiter-name">{currentCaptain.name}</span>
              <span className="captain-waiter-role">
                {currentCaptain.role} · {currentCaptain.assignedSection || 'All Sections'}
              </span>
            </div>
          </div>
        </div>

        <div className="captain-header-actions">
          <label className="captain-table-search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search table number"
              placeholder="Search table number..."
              value={tableSearch}
              onChange={event => setTableSearch(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="captain-action-icon-btn"
            onClick={() => setIsMuted(prev => !prev)}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            type="button"
            className={`captain-action-icon-btn ${isLoadingFloor ? 'spinning' : ''}`}
            onClick={loadFloorPlan}
            title="Refresh Floor Plan"
          >
            <RefreshCw size={18} />
          </button>

          <button
            type="button"
            className="captain-action-icon-btn lock-btn"
            onClick={handleLogout}
            title="Switch Waiter / Lock"
          >
            <Lock size={18} />
          </button>
        </div>
      </header>

      {/* Section Tabs */}
      <nav className="captain-sections-scroll" aria-label="Floor sections">
        <button
          type="button"
          className={`captain-section-tab ${activeSection === 'All' ? 'active' : ''}`}
          onClick={() => {
            setActiveSection('All');
            setSelectedTable(tables.find(table => table.status === 'available') || tables[0] || null);
          }}
        >
          All Tables
        </button>
        {sections.map(sec => (
          <button
            key={sec}
            type="button"
            className={`captain-section-tab ${activeSection === sec ? 'active' : ''}`}
            onClick={() => {
              setActiveSection(sec);
              const sectionTables = tables.filter(table => table.section === sec);
              setSelectedTable(sectionTables.find(table => table.status === 'available') || sectionTables[0] || null);
            }}
          >
            {sec}
          </button>
        ))}
      </nav>

      <main className="captain-main-content grid-layout">
        <aside className="captain-status-panel" aria-label="Table status summary">
          <div className="captain-kpi-item available">
            <span className="captain-kpi-icon"><Armchair size={22} /></span>
            <span className="captain-kpi-copy">
              <strong className="captain-kpi-val">{stats.available}</strong>
              <span className="captain-kpi-lbl">Vacant Tables</span>
            </span>
          </div>
          <div className="captain-kpi-item occupied">
            <span className="captain-kpi-icon"><Flame size={21} /></span>
            <span className="captain-kpi-copy">
              <strong className="captain-kpi-val">{stats.occupied}</strong>
              <span className="captain-kpi-lbl">Active KOT</span>
            </span>
          </div>
          <div className="captain-kpi-item billed">
            <span className="captain-kpi-icon"><CreditCard size={21} /></span>
            <span className="captain-kpi-copy">
              <strong className="captain-kpi-val">{stats.billed}</strong>
              <span className="captain-kpi-lbl">Billed Tables</span>
            </span>
          </div>
          <div className="captain-kpi-item cleaning">
            <span className="captain-kpi-icon"><Sparkles size={21} /></span>
            <span className="captain-kpi-copy">
              <strong className="captain-kpi-val">{stats.cleaning}</strong>
              <span className="captain-kpi-lbl">Clean Tables</span>
            </span>
          </div>
        </aside>

        <section className="captain-grid-canvas grid-canvas" aria-label="Tables in selected section">
          <div className="captain-table-grid">
          {filteredTables.map(table => {
            const isOcc = table.status === 'occupied';
            const isBilled = table.status === 'billed';
            const isClean = table.status === 'cleaning';
            const isRes = table.status === 'reserved';
            const isAvail = table.status === 'available';

            const activeOrder = table.activeOrder;
            const tableOrderTotal = activeOrder?.total ?? table.orderSummary?.runningTotal;
            const courseBreakdown = activeOrder?.courseStatus || Object.fromEntries(
              Object.entries(table.orderSummary?.courseBreakdown || {}).map(([course, counts]) => [
                course,
                counts.fired ? 'fired' : counts.hold ? 'hold' : counts.served ? 'served' : '',
              ]),
            );

            return (
              <div
                key={table.id}
                className={`captain-table-card ${table.status} ${selectedTable?.id === table.id ? 'selected' : ''}`}
                onClick={() => handleTableClick(table)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleTableClick(table);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Table ${table.tableNumber}, ${table.capacity} seats, ${table.status}`}
              >
                {/* Table Header Row */}
                <div className="captain-card-top">
                  <div className="captain-table-badge">
                    <span className="captain-table-num">{table.tableNumber}</span>
                    <span className="captain-table-pax">{table.capacity} Pax</span>
                  </div>
                  <div className={`captain-status-pill ${table.status}`}>
                    {isAvail && 'VACANT'}
                    {isOcc && 'KOT ACTIVE'}
                    {isBilled && 'BILLED'}
                    {isClean && 'NEEDS CLEAN'}
                    {isRes && 'RESERVED'}
                  </div>
                </div>

                {/* Card Body by Status */}
                {isAvail && (
                  <div className="captain-card-body vacant">
                    <div className="captain-vacant-cta">
                      <UserPlus size={16} />
                      <span>Tap to Seat Guests</span>
                    </div>
                  </div>
                )}

                {isOcc && (
                  <div className="captain-card-body occupied">
                    <div className="captain-body-stats">
                      <div className="captain-stat-pill timer">
                        <Clock size={12} />
                        <span>{table.elapsedMinutes || 0}m</span>
                      </div>
                      <div className="captain-stat-pill total">
                        {tableOrderTotal !== undefined && <span>{money(tableOrderTotal)}</span>}
                      </div>
                    </div>

                    <div className="captain-party-info">
                      <span className="captain-pax-count">
                        <Users size={12} /> {table.guestCount || 2} Guests
                      </span>
                      {table.assignedCaptainName && (
                        <span className="captain-assigned-waiter">By {table.assignedCaptainName}</span>
                      )}
                    </div>

                    {/* Course Status Indicators */}
                    <div className="captain-courses-mini-row">
                      {courseBreakdown.starters && (
                        <span className={`captain-course-badge ${courseBreakdown.starters}`}>
                          Starters: {courseBreakdown.starters.toUpperCase()}
                        </span>
                      )}
                      {courseBreakdown.mains && (
                        <span className={`captain-course-badge ${courseBreakdown.mains}`}>
                          Mains: {courseBreakdown.mains.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {isBilled && (
                  <div className="captain-card-body billed">
                    <div className="captain-billed-total">
                      <span>Total Bill:</span>
                      {tableOrderTotal !== undefined && <strong>{money(tableOrderTotal)}</strong>}
                    </div>
                    <div className="captain-billed-hint">
                      <CreditCard size={13} />
                      <span>Awaiting Settlement</span>
                    </div>
                  </div>
                )}

                {isClean && (
                  <div className="captain-card-body cleaning">
                    <div className="captain-clean-hint">
                      <Sparkles size={14} />
                      <span>Turnaround • Tap to Ready</span>
                    </div>
                  </div>
                )}

                {isRes && (
                  <div className="captain-card-body reserved">
                    <span className="captain-reserved-diner">{table.dinerName || 'Guest Reservation'}</span>
                  </div>
                )}
              </div>
            );
          })}
          </div>
          {!filteredTables.length && (
            <div className="captain-no-tables">
              <Armchair size={24} />
              <span>{tableSearch ? 'No tables match your search.' : 'No tables in this section yet.'}</span>
            </div>
          )}
        </section>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* DRAWER 1: Seat Guests on Vacant Table */}
      {/* ------------------------------------------------------------- */}
      {activeDrawer === 'seat' && selectedTable && (
        <div className="captain-modal-backdrop" onClick={() => setActiveDrawer(null)}>
          <div className="captain-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="captain-sheet-header">
              <div className="captain-sheet-title-group">
                <h3>Seat Table {selectedTable.tableNumber}</h3>
                <span>Section: {selectedTable.section} • Capacity: {selectedTable.capacity} Pax</span>
              </div>
              <button type="button" className="captain-sheet-close" onClick={() => setActiveDrawer(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="captain-sheet-body">
              {/* Quick Guest Count Selector */}
              <label className="captain-input-label">Number of Guests (Pax):</label>
              <div className="captain-pax-grid">
                {[1, 2, 3, 4, 5, 6, 8, 10].map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`captain-pax-btn ${seatPax === p ? 'active' : ''}`}
                    onClick={() => setSeatPax(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Optional Diner Info */}
              <div className="captain-input-group">
                <label className="captain-input-label">Diner Name (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Aditi Sharma"
                  className="captain-input-field"
                  value={seatDinerName}
                  onChange={e => setSeatDinerName(e.target.value)}
                />
              </div>

              <div className="captain-input-group">
                <label className="captain-input-label">Phone Number (Optional):</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  className="captain-input-field"
                  value={seatDinerPhone}
                  onChange={e => setSeatDinerPhone(e.target.value)}
                />
              </div>

              <div className="captain-sheet-actions">
                <button
                  type="button"
                  className="captain-primary-btn"
                  onClick={() => handleSeatTable(true)}
                  disabled={isSeating}
                >
                  <Utensils size={18} />
                  <span>Seat & Take Order Now</span>
                </button>
                <button
                  type="button"
                  className="captain-secondary-btn"
                  onClick={() => handleSeatTable(false)}
                  disabled={isSeating}
                >
                  <span>Seat Only</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DRAWER 2: Table Live Hub (Active KOT, Course Firing, Actions) */}
      {/* ------------------------------------------------------------- */}
      {activeDrawer === 'table-hub' && selectedTable && (
        <div className="captain-modal-backdrop" onClick={() => setActiveDrawer(null)}>
          <div className="captain-bottom-sheet table-hub-sheet" onClick={e => e.stopPropagation()}>
            <div className="captain-sheet-header">
              <div className="captain-sheet-title-group">
                <div className="captain-hub-table-pill">
                  <span className="hub-table-number">{selectedTable.tableNumber}</span>
                  <span className={`hub-status-tag ${selectedTable.status}`}>{selectedTable.status.toUpperCase()}</span>
                </div>
                <span>
                  {selectedTable.guestCount || 2} Guests • Seated {selectedTable.elapsedMinutes || 0}m ago
                  {selectedTable.assignedCaptainName ? ` • Captain: ${selectedTable.assignedCaptainName}` : ''}
                </span>
              </div>
              <button type="button" className="captain-sheet-close" onClick={() => setActiveDrawer(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="captain-sheet-body">
              {/* Active Items & Course Breakdown */}
              {selectedTable.activeOrder ? (
                <div className="captain-order-breakdown">
                  <div className="captain-order-meta-header">
                    <span>Active Ticket #{selectedTable.activeOrder.orderNumber}</span>
                    <strong className="captain-hub-order-total">{money(selectedTable.activeOrder.total)}</strong>
                  </div>

                  {/* Fire Course Quick Controls */}
                  <div className="captain-fire-courses-bar">
                    <span className="fire-bar-label">Course Controls:</span>
                    <div className="fire-bar-buttons">
                      <button
                        type="button"
                        className="captain-fire-pill mains"
                        onClick={() => handleFireCourse('mains')}
                      >
                        <Flame size={14} />
                        <span>Fire Mains</span>
                      </button>
                      <button
                        type="button"
                        className="captain-fire-pill desserts"
                        onClick={() => handleFireCourse('desserts')}
                      >
                        <Flame size={14} />
                        <span>Fire Desserts</span>
                      </button>
                    </div>
                  </div>

                  {/* Grouped items list */}
                  <div className="captain-hub-items-list">
                    {(selectedTable.activeOrder.items || []).map(item => (
                      <div key={item.id} className={`captain-hub-item-card ${item.itemStatus}`}>
                        <div className="hub-item-left">
                          <span className={`hub-course-tag ${item.course || 'mains'}`}>
                            {item.course || 'mains'}
                          </span>
                          <span className="hub-item-qty">{item.quantity}x</span>
                          <div className="hub-item-details">
                            <span className="hub-item-name">{item.name}</span>
                            {(item.notes || item.kitchenNotes) && (
                              <span className="hub-item-notes">Note: {item.notes || item.kitchenNotes}</span>
                            )}
                          </div>
                        </div>

                        <div className="hub-item-right">
                          <span className="hub-item-price">{money(item.price * item.quantity)}</span>
                          <span className={`hub-status-badge ${item.itemStatus}`}>
                            {item.itemStatus === 'hold' ? '⏳ HOLD' : item.itemStatus === 'voided' ? '🚫 VOID' : '🔥 FIRED'}
                          </span>
                          {canManageFloor && item.itemStatus !== 'voided' && (
                            <button
                              type="button"
                              className="hub-void-icon-btn"
                              title="Void this item"
                              onClick={() => {
                                setVoidingItemId(item.id);
                                setActiveDrawer('void');
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="captain-empty-order-state">
                  <Utensils size={32} />
                  <p>No active items yet for this seated table.</p>
                </div>
              )}

              {/* Action Buttons Hub (48px+ touch targets) */}
              <div className="captain-hub-actions-grid">
                <button
                  type="button"
                  className="captain-hub-action-btn primary"
                  onClick={() => {
                    setOrderCart([]);
                    setOrderChefNotes('');
                    setActiveDrawer('order-sheet');
                  }}
                >
                  <Plus size={18} />
                  <span>+ Add Items / KOT</span>
                </button>

                {canManageFloor && <button
                  type="button"
                  className="captain-hub-action-btn secondary"
                  onClick={() => {
                    setTransferTargetId('');
                    setActiveDrawer('transfer');
                  }}
                >
                  <MoveRight size={18} />
                  <span>Transfer Table</span>
                </button>}

                {canManageFloor && <button
                  type="button"
                  className="captain-hub-action-btn secondary"
                  onClick={() => {
                    setMergeTargetId('');
                    setActiveDrawer('merge');
                  }}
                >
                  <Layers size={18} />
                  <span>Merge Tables</span>
                </button>}

                <button
                  type="button"
                  className="captain-hub-action-btn bill"
                  onClick={() => handleRequestBill(selectedTable.id)}
                >
                  <CreditCard size={18} />
                  <span>Request Bill</span>
                </button>

                {canManageFloor && <button
                  type="button"
                  className="captain-hub-action-btn clean"
                  onClick={() => handleReleaseTable(selectedTable.id)}
                >
                  <Sparkles size={18} />
                  <span>Release / Ready</span>
                </button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DRAWER 3: Mobile Menu Ordering Sheet (Full Screen Bottom Sheet) */}
      {/* ------------------------------------------------------------- */}
      {activeDrawer === 'order-sheet' && selectedTable && (
        <div className="captain-modal-backdrop" onClick={() => setActiveDrawer('table-hub')}>
          <div className="captain-order-full-sheet" onClick={e => e.stopPropagation()}>
            {/* Sheet Header */}
            <div className="captain-sheet-header">
              <div className="captain-sheet-title-group">
                <h3>Take Order • Table {selectedTable.tableNumber}</h3>
                <span>Add items, assign courses & fire KOT directly to kitchen</span>
              </div>
              <button
                type="button"
                className="captain-sheet-close"
                onClick={() => setActiveDrawer('table-hub')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Menu Search & Category Chips */}
            <div className="captain-order-filter-bar">
              <div className="captain-search-input-wrap">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search dishes, coffee, drinks..."
                  value={menuSearchQuery}
                  onChange={e => setMenuSearchQuery(e.target.value)}
                />
                {menuSearchQuery && (
                  <button type="button" onClick={() => setMenuSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="captain-cat-chips-scroll">
                {menuCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`captain-cat-chip ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu List & Active Cart Split Layout */}
            <div className="captain-order-sheet-content">
              {/* Menu items list */}
              <div className="captain-menu-items-scroll">
                {filteredMenuItems.map(item => {
                  const inCartCount = orderCart
                    .filter(c => c.menuItemId === item.id)
                    .reduce((sum, c) => sum + c.quantity, 0);

                  return (
                    <div key={item.id} className="captain-menu-card">
                      <div className="captain-menu-info">
                        <span className="captain-menu-name">{item.name}</span>
                        <span className="captain-menu-price">{money(item.price)}</span>
                        {item.description && (
                          <p className="captain-menu-desc">{item.description}</p>
                        )}
                      </div>

                      <div className="captain-menu-actions">
                        {inCartCount > 0 && (
                          <span className="captain-cart-badge">{inCartCount} in cart</span>
                        )}
                        <button
                          type="button"
                          className="captain-add-item-btn"
                          onClick={() => handleAddToCart(item)}
                        >
                          <Plus size={16} />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Cart Tray */}
              {orderCart.length > 0 && (
                <div className="captain-order-cart-tray">
                  <div className="captain-cart-tray-header">
                    <h4>Current KOT Items ({orderCart.length})</h4>
                    <span className="captain-cart-subtotal">{money(cartSubtotal)}</span>
                  </div>

                  <div className="captain-cart-items-scroll">
                    {orderCart.map((cartItem, idx) => (
                      <div key={`${cartItem.menuItemId}-${cartItem.course}-${idx}`} className="captain-cart-item-row">
                        <div className="cart-row-main">
                          <div className="cart-name-and-course">
                            <span className="cart-item-name">{cartItem.name}</span>
                            <div className="cart-course-selector">
                              {['starters', 'mains', 'desserts', 'beverages'].map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  className={`cart-course-btn ${cartItem.course === c ? 'active' : ''}`}
                                  onClick={() => handleUpdateCartCourse(idx, c)}
                                >
                                  {c.charAt(0).toUpperCase() + c.slice(1, 4)}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="cart-row-controls">
                            <div className="cart-qty-stepper">
                              <button type="button" onClick={() => handleUpdateCartQty(idx, -1)}>
                                <Minus size={13} />
                              </button>
                              <span>{cartItem.quantity}</span>
                              <button type="button" onClick={() => handleUpdateCartQty(idx, 1)}>
                                <Plus size={13} />
                              </button>
                            </div>
                            <span className="cart-item-total">{money(cartItem.price * cartItem.quantity)}</span>
                          </div>
                        </div>

                        {/* Hold / Fire Switch & Chef Notes */}
                        <div className="cart-row-sub">
                          <button
                            type="button"
                            className={`cart-hold-toggle ${cartItem.itemStatus}`}
                            onClick={() => handleToggleCartHold(idx)}
                          >
                            {cartItem.itemStatus === 'hold' ? '⏳ HOLD (Fire Later)' : '🔥 FIRE IMMEDIATELY'}
                          </button>

                          <input
                            type="text"
                            placeholder="Special kitchen notes (e.g. less spicy)..."
                            className="cart-notes-input"
                            value={cartItem.kitchenNotes}
                            onChange={e => handleUpdateCartNotes(idx, e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Master Chef Note */}
                  <div className="captain-chef-notes-wrap">
                    <input
                      type="text"
                      placeholder="Master Order Note for Kitchen / Barista (Optional)..."
                      value={orderChefNotes}
                      onChange={e => setOrderChefNotes(e.target.value)}
                      className="captain-chef-input"
                    />
                  </div>

                  {/* Big FIRE KOT button */}
                  <button
                    type="button"
                    className="captain-fire-kot-cta"
                    onClick={handleFireKOT}
                    disabled={isSubmittingOrder}
                  >
                    <Flame size={20} />
                    <span>FIRE KOT ({orderCart.length} items • {money(cartSubtotal)})</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: Transfer Table */}
      {/* ------------------------------------------------------------- */}
      {activeDrawer === 'transfer' && selectedTable && (
        <div className="captain-modal-backdrop" onClick={() => setActiveDrawer('table-hub')}>
          <div className="captain-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="captain-sheet-header">
              <div className="captain-sheet-title-group">
                <h3>Transfer Table {selectedTable.tableNumber}</h3>
                <span>Move guests and running KOT ticket to another vacant table</span>
              </div>
              <button type="button" className="captain-sheet-close" onClick={() => setActiveDrawer('table-hub')}>
                <X size={20} />
              </button>
            </div>

            <div className="captain-sheet-body">
              <label className="captain-input-label">Select Destination Vacant Table:</label>
              <div className="captain-target-tables-grid">
                {tables
                  .filter(t => t.id !== selectedTable.id && t.status === 'available')
                  .map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={`captain-target-table-btn ${transferTargetId === t.id ? 'active' : ''}`}
                      onClick={() => setTransferTargetId(t.id)}
                    >
                      <span className="target-num">{t.tableNumber}</span>
                      <span className="target-pax">{t.capacity} Pax • {t.section}</span>
                    </button>
                  ))}
              </div>

              <div className="captain-input-group">
                <label className="captain-input-label">Transfer Reason:</label>
                <input
                  type="text"
                  className="captain-input-field"
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                />
              </div>

              <div className="captain-sheet-actions">
                <button
                  type="button"
                  className="captain-primary-btn"
                  onClick={handleTransferTable}
                  disabled={!transferTargetId}
                >
                  <MoveRight size={18} />
                  <span>Confirm Table Transfer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: Merge Tables */}
      {/* ------------------------------------------------------------- */}
      {activeDrawer === 'merge' && selectedTable && (
        <div className="captain-modal-backdrop" onClick={() => setActiveDrawer('table-hub')}>
          <div className="captain-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="captain-sheet-header">
              <div className="captain-sheet-title-group">
                <h3>Merge With Table {selectedTable.tableNumber}</h3>
                <span>Combine adjacent tables into a single running party</span>
              </div>
              <button type="button" className="captain-sheet-close" onClick={() => setActiveDrawer('table-hub')}>
                <X size={20} />
              </button>
            </div>

            <div className="captain-sheet-body">
              <label className="captain-input-label">Select Table to Merge:</label>
              <div className="captain-target-tables-grid">
                {tables
                  .filter(t => t.id !== selectedTable.id)
                  .map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={`captain-target-table-btn ${mergeTargetId === t.id ? 'active' : ''}`}
                      onClick={() => setMergeTargetId(t.id)}
                    >
                      <span className="target-num">{t.tableNumber}</span>
                      <span className="target-pax">{t.capacity} Pax • {t.status.toUpperCase()}</span>
                    </button>
                  ))}
              </div>

              <div className="captain-input-group">
                <label className="captain-input-label">Merge Reason:</label>
                <input
                  type="text"
                  className="captain-input-field"
                  value={mergeReason}
                  onChange={e => setMergeReason(e.target.value)}
                />
              </div>

              <div className="captain-sheet-actions">
                <button
                  type="button"
                  className="captain-primary-btn"
                  onClick={handleMergeTables}
                  disabled={!mergeTargetId}
                >
                  <Layers size={18} />
                  <span>Confirm Table Merge</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: Security Void Item Authorization */}
      {/* ------------------------------------------------------------- */}
      {canManageFloor && activeDrawer === 'void' && selectedTable && voidingItemId && (
        <div className="captain-modal-backdrop" onClick={() => setActiveDrawer('table-hub')}>
          <div className="captain-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="captain-sheet-header">
              <div className="captain-sheet-title-group">
                <h3>Void Order Item</h3>
                <span>Record a reason for this correction. Access is limited to floor managers and cashiers.</span>
              </div>
              <button type="button" className="captain-sheet-close" onClick={() => setActiveDrawer('table-hub')}>
                <X size={20} />
              </button>
            </div>

            <div className="captain-sheet-body">
              <div className="captain-input-group">
                <label className="captain-input-label">Void Reason Code:</label>
                <select
                  className="captain-input-field"
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                >
                  <option value="Guest changed mind">Guest changed mind</option>
                  <option value="Wrong item keyed">Wrong item keyed</option>
                  <option value="Kitchen preparation delay">Kitchen preparation delay</option>
                  <option value="Quality / Taste dissatisfaction">Quality / Taste dissatisfaction</option>
                  <option value="Item out of stock">Item out of stock</option>
                </select>
              </div>

              <div className="captain-sheet-actions">
                <button
                  type="button"
                  className="captain-danger-btn"
                  onClick={handleVoidItem}
                  disabled={isVoiding}
                >
                  <ShieldAlert size={18} />
                  <span>Void Item</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

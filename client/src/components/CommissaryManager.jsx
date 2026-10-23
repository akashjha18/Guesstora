import React, { useState, useEffect } from 'react';
import {
  Flame,
  Truck,
  AlertTriangle,
  FileText,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  Boxes,
  ArrowRight,
  TrendingDown,
  Printer,
  X,
  Search,
  Filter,
  Package,
  Calendar,
  Layers,
  Sparkles,
  Info,
  DollarSign,
  ChevronRight,
  Copy,
  Check,
  Send,
  Building,
  User,
  Coffee,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import { BASE } from '../api';

export default function CommissaryManager({ cafe, token }) {
  const [activeTab, setActiveTab] = useState('batches'); // 'batches' | 'indents' | 'wastage' | 'rop_orders'
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  // Reference data
  const [inventoryItems, setInventoryItems] = useState([]);
  const [allCafes, setAllCafes] = useState([]);

  // --- Sub-Tab 1: Commissary Production Batches State ---
  const [batches, setBatches] = useState([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [completeBatchModalOpen, setCompleteBatchModalOpen] = useState(false);
  const [selectedBatchForCompletion, setSelectedBatchForCompletion] = useState(null);
  const [newBatch, setNewBatch] = useState({
    recipeName: 'House Dark Espresso Roast 10kg',
    outputInventoryItemId: '',
    outputItemName: '',
    plannedQuantity: 10,
    unit: 'kg',
    bomIngredients: [],
    operatorName: 'Master Roaster',
    roasterNotes: '',
  });
  const [completionForm, setCompletionForm] = useState({
    producedQuantity: '',
    shrinkagePercent: '',
    roasterNotes: '',
    operatorName: 'Master Roaster',
  });

  // --- Sub-Tab 2: Inter-Store Indents State ---
  const [indents, setIndents] = useState([]);
  const [indentFilter, setIndentFilter] = useState('all'); // 'all' | 'incoming' | 'outgoing'
  const [indentModalOpen, setIndentModalOpen] = useState(false);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [newIndent, setNewIndent] = useState({
    supplyingCafeId: '',
    priority: 'normal',
    notes: '',
    requestedBy: 'Store Manager',
    items: [],
  });
  const [dispatchForm, setDispatchForm] = useState({
    dispatchedBy: 'Logistics Lead',
    transporterName: 'GUESTORA Fleet Logistics',
    vehicleNumber: 'MH-12-GF-4491',
    driverContact: '+91 98200 44123',
    dispatchQuantities: [],
  });
  const [receiveForm, setReceiveForm] = useState({
    receivedBy: 'Store Receiving Lead',
    receivedQuantities: [],
  });

  // --- Sub-Tab 3: Spoilage & Wastage State ---
  const [wastageSummary, setWastageSummary] = useState({ totalLoss: 0, totalEntries: 0, byReason: {}, recentLogs: [] });
  const [wastageModalOpen, setWastageModalOpen] = useState(false);
  const [newWastage, setNewWastage] = useState({
    inventoryItemId: '',
    quantity: 1,
    unit: 'kg',
    reason: 'barista_spill',
    notes: '',
    loggedBy: 'Head Barista',
    costPerUnit: '',
  });

  // --- Sub-Tab 4: Automated Reorder Point & Purchase Orders State ---
  const [ropAlerts, setRopAlerts] = useState({ triggeredCount: 0, lowStockItems: [], groupedBySupplier: {} });
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [printPoModalOpen, setPrintPoModalOpen] = useState(false);
  const [printablePoData, setPrintablePoData] = useState(null);
  const [copiedPrintText, setCopiedPrintText] = useState(false);
  const [newPo, setNewPo] = useState({
    supplierName: '',
    supplierEmail: '',
    supplierPhone: '',
    expectedDeliveryDate: '',
    notes: '',
    createdByUser: 'Inventory Manager',
    items: [],
  });

  const showNotice = (msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 4000);
  };

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // Fetch Inventory items and sister cafes for dropdowns
  const fetchAuxData = async () => {
    try {
      const invRes = await fetch(`${BASE}/owner/inventory`, { headers: getAuthHeaders() });
      if (invRes.ok) {
        const invData = await invRes.json();
        setInventoryItems(invData.items || []);
      }
      const cafesRes = await fetch(`${BASE}/owner/brand/outlets`, { headers: getAuthHeaders() });
      if (cafesRes.ok) {
        const cData = await cafesRes.json();
        setAllCafes(cData || []);
      }
    } catch (e) {
      // ignore
    }
  };

  // 1. Fetch Commissary Batches
  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/owner/commissary/batches`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBatches(data);
      }
    } catch (err) {
      showNotice('Failed to load commissary batches', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Indents
  const fetchIndents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/owner/commissary/indents?type=${indentFilter}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setIndents(data);
      }
    } catch (err) {
      showNotice('Failed to load stock indents', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Wastage
  const fetchWastage = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/owner/commissary/wastage`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setWastageSummary(data);
      }
    } catch (err) {
      showNotice('Failed to load wastage records', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 4. Fetch ROP Alerts & POs
  const fetchRopAndPOs = async () => {
    setLoading(true);
    try {
      const [alertsRes, posRes] = await Promise.all([
        fetch(`${BASE}/owner/commissary/rop/alerts`, { headers: getAuthHeaders() }),
        fetch(`${BASE}/owner/commissary/purchase-orders`, { headers: getAuthHeaders() }),
      ]);
      if (alertsRes.ok) setRopAlerts(await alertsRes.json());
      if (posRes.ok) setPurchaseOrders(await posRes.json());
    } catch (err) {
      showNotice('Failed to load ROP and purchase orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuxData();
  }, []);

  useEffect(() => {
    if (activeTab === 'batches') fetchBatches();
    if (activeTab === 'indents') fetchIndents();
    if (activeTab === 'wastage') fetchWastage();
    if (activeTab === 'rop_orders') fetchRopAndPOs();
  }, [activeTab, indentFilter]);

  // Handler: Create Batch
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BASE}/owner/commissary/batches`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newBatch),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showNotice('Production batch created successfully!');
      setBatchModalOpen(false);
      fetchBatches();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  // Handler: Start Batch
  const handleStartBatch = async (batchId) => {
    try {
      const res = await fetch(`${BASE}/owner/commissary/batches/${batchId}/start`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ operatorName: 'Master Roaster' }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showNotice('Batch marked in production!');
      fetchBatches();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  // Handler: Complete Batch
  const handleCompleteBatch = async (e) => {
    e.preventDefault();
    if (!selectedBatchForCompletion) return;
    try {
      const res = await fetch(`${BASE}/owner/commissary/batches/${selectedBatchForCompletion.id}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(completionForm),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();
      showNotice(`Batch completed! Deducted raw materials and yielded ${data.batch.producedQuantity} ${data.batch.unit}.`);
      setCompleteBatchModalOpen(false);
      fetchBatches();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  // Handler: Create Indent
  const handleCreateIndent = async (e) => {
    e.preventDefault();
    if (!newIndent.supplyingCafeId) {
      showNotice('Please select the supplying commissary or warehouse', 'error');
      return;
    }
    if (!newIndent.items.length) {
      showNotice('Please add at least one line item to the indent', 'error');
      return;
    }
    try {
      const res = await fetch(`${BASE}/owner/commissary/indents`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newIndent),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showNotice('Indent request submitted to commissary!');
      setIndentModalOpen(false);
      fetchIndents();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  // Handler: Approve Indent
  const handleApproveIndent = async (indentId) => {
    try {
      const res = await fetch(`${BASE}/owner/commissary/indents/${indentId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ approvedBy: 'Commissary Manager' }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showNotice('Indent approved! Ready for STN dispatch.');
      fetchIndents();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  // Handler: Dispatch STN
  const handleDispatchSTN = async (e) => {
    e.preventDefault();
    if (!selectedIndent) return;
    try {
      const res = await fetch(`${BASE}/owner/commissary/indents/${selectedIndent.id}/dispatch`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(dispatchForm),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showNotice('STN generated and items dispatched! Commissary stock deducted.');
      setDispatchModalOpen(false);
      fetchIndents();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  // Handler: Receive GRN
  const handleReceiveGRN = async (e) => {
    e.preventDefault();
    if (!selectedIndent) return;
    try {
      const res = await fetch(`${BASE}/owner/commissary/indents/${selectedIndent.id}/receive`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(receiveForm),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showNotice('GRN acknowledged! Outlet stock replenished and variances logged.');
      setReceiveModalOpen(false);
      fetchIndents();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  // Handler: Log Wastage
  const handleLogWastage = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BASE}/owner/commissary/wastage`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newWastage),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showNotice('Wastage logged and stock deducted!');
      setWastageModalOpen(false);
      fetchWastage();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  // Handler: Create Purchase Order
  const handleCreatePo = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BASE}/owner/commissary/purchase-orders`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newPo),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showNotice('Supplier purchase order drafted!');
      setPoModalOpen(false);
      fetchRopAndPOs();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  // Handler: Update PO Status
  const handleUpdatePoStatus = async (poId, status, autoRestock = false) => {
    try {
      const res = await fetch(`${BASE}/owner/commissary/purchase-orders/${poId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, autoRestock, recordedBy: 'Store Manager' }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showNotice(`Purchase order marked as ${status.toUpperCase()}!${autoRestock ? ' Stock replenished.' : ''}`);
      fetchRopAndPOs();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  // Handler: View & Print PO
  const handlePrintPo = async (poId) => {
    try {
      const res = await fetch(`${BASE}/owner/commissary/purchase-orders/${poId}/print`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();
      setPrintablePoData(data);
      setPrintPoModalOpen(true);
      setCopiedPrintText(false);
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  return (
    <div style={{ padding: '0 20px', maxWidth: 1400, margin: '0 auto', color: '#111827' }}>
      {/* Toast Notice */}
      {notice && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: notice.type === 'error' ? '#991b1b' : '#15803d',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {notice.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notice.msg}</span>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="crm-orders-header-card">
        <div className="crm-orders-header-left">
          <div className="crm-orders-brand-emblem">
            <Truck size={28} />
          </div>
          <div>
            <div className="crm-orders-title-row">
              <h1 className="crm-orders-title">Central Commissary & Multi-Store Inventory</h1>
              <span className="crm-orders-live-badge">
                <span className="crm-orders-live-pulse" />
                CENTRAL COMMISSARY
              </span>
            </div>
            <p className="crm-orders-subtitle">
              Master roastery batching with roast shrinkage tracking, inter-store indents with STN dispatch & GRN variance detection, financial spoilage auditing, and automated supplier reorder points.
            </p>
          </div>
        </div>

        <div className="crm-orders-header-right">
          <button
            onClick={() => {
              if (activeTab === 'batches') fetchBatches();
              if (activeTab === 'indents') fetchIndents();
              if (activeTab === 'wastage') fetchWastage();
              if (activeTab === 'rop_orders') fetchRopAndPOs();
            }}
            disabled={loading}
            className="crm-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { id: 'batches', label: 'Roastery Production Batches', icon: Flame, badge: batches.length },
          { id: 'indents', label: 'Inter-Store Indents & STN/GRN', icon: Truck, badge: indents.length },
          { id: 'wastage', label: 'Spoilage & Wastage Auditing', icon: TrendingDown, badge: wastageSummary.totalEntries },
          { id: 'rop_orders', label: 'Reorder Point (ROP) & Purchase Orders', icon: Boxes, badge: ropAlerts.triggeredCount > 0 ? `${ropAlerts.triggeredCount} Alerts` : purchaseOrders.length, badgeWarn: ropAlerts.triggeredCount > 0 },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                borderRadius: '9999px',
                border: isActive ? '1px solid #176B50' : '1px solid #e5e7eb',
                background: isActive ? '#176B50' : '#ffffff',
                color: isActive ? '#ffffff' : '#4b5563',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                boxShadow: isActive ? '0 4px 12px rgba(23,107,80,0.25)' : '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span
                  style={{
                    background: t.badgeWarn ? '#dc2626' : (isActive ? 'rgba(255,255,255,0.25)' : '#e5e7eb'),
                    color: t.badgeWarn ? '#fff' : (isActive ? '#fff' : '#374151'),
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: ROASTERY PRODUCTION BATCHES & BOM
          ========================================================================= */}
      {activeTab === 'batches' && (
        <div>
          {/* Action Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                Master Production Runs & Roast Profiles
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>
                Converts green beans, packaging & raw ingredients into finished retail / espresso stock with moisture loss tracking.
              </p>
            </div>
            <button
              onClick={() => {
                setNewBatch({
                  recipeName: 'House Dark Espresso Roast 10kg',
                  outputInventoryItemId: '',
                  outputItemName: '',
                  plannedQuantity: 10,
                  unit: 'kg',
                  bomIngredients: [],
                  operatorName: 'Master Roaster',
                  roasterNotes: '',
                });
                setBatchModalOpen(true);
              }}
              style={{
                background: '#176B50',
                color: '#fff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '13px',
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(23,107,80,0.25)',
              }}
            >
              <Plus size={16} />
              <span>+ New Production Batch</span>
            </button>
          </div>

          {/* Batches Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
            {batches.map((b) => {
              const isCompleted = b.status === 'completed';
              const isInProgress = b.status === 'in_progress';
              return (
                <div
                  key={b.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 16,
                    padding: '20px',
                    position: 'relative',
                    boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <span
                        style={{
                          background: '#ecfdf5',
                          color: '#065f46',
                          border: '1px solid #a7f3d0',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                        }}
                      >
                        {b.batchNumber}
                      </span>
                      <h4 style={{ margin: '8px 0 2px', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                        {b.recipeName}
                      </h4>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        Yields: {b.outputItemName || 'Finished Stock Item'}
                      </span>
                    </div>

                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        background:
                          b.status === 'completed'
                            ? '#ecfdf5'
                            : b.status === 'in_progress'
                            ? '#eff6ff'
                            : '#f3f4f6',
                        color:
                          b.status === 'completed'
                            ? '#047857'
                            : b.status === 'in_progress'
                            ? '#1d4ed8'
                            : '#4b5563',
                        border:
                          b.status === 'completed'
                            ? '1px solid #a7f3d0'
                            : b.status === 'in_progress'
                            ? '1px solid #bfdbfe'
                            : '1px solid #e5e7eb',
                      }}
                    >
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Planned vs Produced Metrics */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '12px 14px',
                      marginBottom: 14,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 8,
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Planned Qty</span>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginTop: 2 }}>
                        {b.plannedQuantity} {b.unit}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Produced Yield</span>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: isCompleted ? '#059669' : '#9ca3af', marginTop: 2 }}>
                        {isCompleted ? `${b.producedQuantity} ${b.unit}` : '—'}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Roast Shrinkage</span>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: b.shrinkagePercent > 20 ? '#dc2626' : '#d97706', marginTop: 2 }}>
                        {isCompleted ? `${b.shrinkagePercent}%` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Cost & Operator details */}
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Raw Material Cost:</span>
                      <b style={{ color: '#111827' }}>₹{b.totalCost?.toFixed(2) || '0.00'}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Calculated COGS / Unit:</span>
                      <b style={{ color: '#176B50' }}>₹{b.costPerUnit?.toFixed(2) || '0.00'}/{b.unit}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Operator:</span>
                      <span style={{ color: '#111827', fontWeight: 500 }}>{b.operatorName || 'Master Roaster'}</span>
                    </div>
                  </div>

                  {b.roasterNotes && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 10px', borderRadius: 6, fontSize: '11px', color: '#4b5563', marginBottom: 14 }}>
                      <i>"{b.roasterNotes}"</i>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {b.status === 'planned' && (
                      <button
                        onClick={() => handleStartBatch(b.id)}
                        style={{
                          flex: 1,
                          background: '#ffffff',
                          color: '#176B50',
                          border: '1px solid #176B50',
                          padding: '8px',
                          borderRadius: 6,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Start Roasting / Production
                      </button>
                    )}
                    {b.status === 'in_progress' && (
                      <button
                        onClick={() => {
                          setSelectedBatchForCompletion(b);
                          setCompletionForm({
                            producedQuantity: b.plannedQuantity ? (b.plannedQuantity * 0.84).toFixed(2) : '',
                            shrinkagePercent: '16.0',
                            roasterNotes: 'Smooth second crack, rich chocolate aroma',
                            operatorName: b.operatorName || 'Master Roaster',
                          });
                          setCompleteBatchModalOpen(true);
                        }}
                        style={{
                          flex: 1,
                          background: '#059669',
                          color: '#fff',
                          border: 'none',
                          padding: '8px',
                          borderRadius: 6,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(5,150,105,0.25)',
                        }}
                      >
                        Complete Batch & Yield Output
                      </button>
                    )}
                    {b.status === 'completed' && (
                      <div style={{ width: '100%', textAlign: 'center', fontSize: '12px', color: '#059669', fontWeight: 600, padding: '6px 0' }}>
                        ✓ Stock Restocked & Ledger Logged
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {batches.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#6b7280', background: '#ffffff', border: '1px dashed #d1d5db', borderRadius: 16 }}>
                No commissary batches logged yet. Click "+ New Production Batch" above to start your first coffee roast or bakery prep batch.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: INTER-STORE INDENTS & STN / GRN
          ========================================================================= */}
      {activeTab === 'indents' && (
        <div>
          {/* Header Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['all', 'incoming', 'outgoing'].map((f) => (
                <button
                  key={f}
                  onClick={() => setIndentFilter(f)}
                  style={{
                    background: indentFilter === f ? '#176B50' : '#ffffff',
                    color: indentFilter === f ? '#fff' : '#4b5563',
                    border: indentFilter === f ? '1px solid #176B50' : '1px solid #e5e7eb',
                    padding: '8px 14px',
                    borderRadius: 6,
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: indentFilter === f ? '0 2px 6px rgba(23,107,80,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {f === 'all' ? 'All Indents' : f === 'incoming' ? 'Incoming (To Fulfill)' : 'Outgoing (Requested)'}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setNewIndent({
                  supplyingCafeId: (allCafes.find(c => c.id !== cafe?.id)?.id) || '',
                  priority: 'normal',
                  notes: '',
                  requestedBy: 'Store Manager',
                  items: [
                    {
                      itemName: 'GUESTORA Signature Espresso Roast',
                      category: 'Roasted Coffee',
                      unit: 'kg',
                      requestedQty: 5,
                    },
                  ],
                });
                setIndentModalOpen(true);
              }}
              style={{
                background: '#176B50',
                color: '#fff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '13px',
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(23,107,80,0.25)',
              }}
            >
              <Plus size={16} />
              <span>+ Raise Store Indent</span>
            </button>
          </div>

          {/* Indents List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {indents.map((ind) => {
              const isSupplyingStore = ind.supplyingCafeId === cafe?.id;
              const isRequestingStore = ind.requestingCafeId === cafe?.id;
              return (
                <div
                  key={ind.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 16,
                    padding: '20px',
                    boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            background: '#ecfdf5',
                            color: '#065f46',
                            border: '1px solid #a7f3d0',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                          }}
                        >
                          {ind.indentNumber}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            background: ind.priority === 'urgent' ? '#fef2f2' : ind.priority === 'high' ? '#fffbeb' : '#ecfdf5',
                            color: ind.priority === 'urgent' ? '#b91c1c' : ind.priority === 'high' ? '#b45309' : '#047857',
                            border: ind.priority === 'urgent' ? '1px solid #fecaca' : ind.priority === 'high' ? '1px solid #fde68a' : '1px solid #a7f3d0',
                          }}
                        >
                          {ind.priority} priority
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '13px', color: '#4b5563' }}>
                        <span><b style={{ color: '#111827' }}>Requesting:</b> {ind.requestingCafeName || 'Local Store'}</span>
                        <ArrowRight size={14} style={{ color: '#176B50' }} />
                        <span><b style={{ color: '#111827' }}>Supplying:</b> {ind.supplyingCafeName || 'Central Roastery'}</span>
                      </div>
                    </div>

                    {/* Stepper Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {['submitted', 'approved', 'dispatched', 'received'].map((step, idx) => {
                        const steps = ['submitted', 'approved', 'dispatched', 'received'];
                        const currentStepIdx = steps.indexOf(ind.status);
                        const isReached = currentStepIdx >= idx;
                        return (
                          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div
                              style={{
                                padding: '4px 10px',
                                borderRadius: 12,
                                fontSize: '11px',
                                fontWeight: 600,
                                textTransform: 'capitalize',
                                background: isReached ? '#176B50' : '#f3f4f6',
                                color: isReached ? '#fff' : '#9ca3af',
                              }}
                            >
                              {step}
                            </div>
                            {idx < 3 && <div style={{ width: 12, height: 2, background: isReached ? '#176B50' : '#e5e7eb' }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#4b5563', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '8px 12px' }}>Item Name</th>
                          <th style={{ padding: '8px 12px' }}>Category</th>
                          <th style={{ padding: '8px 12px' }}>Requested</th>
                          <th style={{ padding: '8px 12px' }}>Approved</th>
                          <th style={{ padding: '8px 12px' }}>Dispatched (STN)</th>
                          <th style={{ padding: '8px 12px' }}>Received (GRN)</th>
                          <th style={{ padding: '8px 12px' }}>Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ind.items || []).map((li) => (
                          <tr key={li.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#111827' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{li.itemName}</td>
                            <td style={{ padding: '8px 12px', color: '#6b7280' }}>{li.category}</td>
                            <td style={{ padding: '8px 12px' }}>{li.requestedQty} {li.unit}</td>
                            <td style={{ padding: '8px 12px' }}>{li.approvedQty} {li.unit}</td>
                            <td style={{ padding: '8px 12px' }}>{li.dispatchedQty} {li.unit}</td>
                            <td style={{ padding: '8px 12px' }}>{li.receivedQty} {li.unit}</td>
                            <td style={{ padding: '8px 12px' }}>
                              {li.varianceQty !== 0 ? (
                                <span style={{ color: li.varianceQty < 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>
                                  {li.varianceQty > 0 ? `+${li.varianceQty}` : li.varianceQty} {li.unit}
                                  {li.varianceReason ? ` (${li.varianceReason})` : ''}
                                </span>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>0 (Match)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* STN Logistics Details if Dispatched */}
                  {ind.transfer && (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: '10px 14px',
                        marginBottom: 14,
                        fontSize: '12px',
                        display: 'flex',
                        gap: 20,
                        color: '#4b5563',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span><b style={{ color: '#111827' }}>STN Note:</b> <span style={{ color: '#176B50', fontFamily: 'monospace', fontWeight: 600 }}>{ind.transfer.stnNumber}</span></span>
                      <span><b style={{ color: '#111827' }}>Transporter:</b> {ind.transfer.transporterName}</span>
                      <span><b style={{ color: '#111827' }}>Vehicle:</b> {ind.transfer.vehicleNumber}</span>
                      <span><b style={{ color: '#111827' }}>Driver Contact:</b> {ind.transfer.driverContact}</span>
                      <span><b style={{ color: '#111827' }}>Status:</b> <span style={{ color: '#059669', fontWeight: 600 }}>{ind.transfer.status.toUpperCase()}</span></span>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    {ind.status === 'submitted' && (
                      <button
                        onClick={() => handleApproveIndent(ind.id)}
                        style={{
                          background: '#176B50',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: 6,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(23,107,80,0.25)',
                        }}
                      >
                        Approve Indent Quantities
                      </button>
                    )}

                    {ind.status === 'approved' && (
                      <button
                        onClick={() => {
                          setSelectedIndent(ind);
                          setDispatchForm({
                            dispatchedBy: 'Commissary Dispatch Lead',
                            transporterName: 'GUESTORA Fleet Logistics',
                            vehicleNumber: 'MH-12-GF-4491',
                            driverContact: '+91 98200 44123',
                            dispatchQuantities: (ind.items || []).map(li => ({ id: li.id, dispatchedQty: li.approvedQty })),
                          });
                          setDispatchModalOpen(true);
                        }}
                        style={{
                          background: '#176B50',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: 6,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(23,107,80,0.25)',
                        }}
                      >
                        Issue STN & Dispatch Stock
                      </button>
                    )}

                    {ind.status === 'dispatched' && (
                      <button
                        onClick={() => {
                          setSelectedIndent(ind);
                          setReceiveForm({
                            receivedBy: 'Store Receiving Lead',
                            receivedQuantities: (ind.items || []).map(li => ({
                              id: li.id,
                              receivedQty: li.dispatchedQty,
                              varianceReason: '',
                            })),
                          });
                          setReceiveModalOpen(true);
                        }}
                        style={{
                          background: '#059669',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: 6,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(5,150,105,0.25)',
                        }}
                      >
                        Verify & Acknowledge GRN
                      </button>
                    )}

                    {ind.status === 'received' && (
                      <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={16} /> GRN Delivered & Replenished
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {indents.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', background: '#ffffff', border: '1px dashed #d1d5db', borderRadius: 16 }}>
                No inter-store indents found. Outlets can raise indent requests to commissary for fresh roasted beans and supplies.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: SPOILAGE & WASTAGE AUDITING
          ========================================================================= */}
      {activeTab === 'wastage' && (
        <div>
          {/* Top Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '18px', boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Financial Loss</span>
              <h3 style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>
                ₹{wastageSummary.totalLoss?.toFixed(2) || '0.00'}
              </h3>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Across all logged audit entries</span>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '18px', boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Logged Incidents</span>
              <h3 style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700, color: '#111827' }}>
                {wastageSummary.totalEntries || 0}
              </h3>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Verified by store management</span>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '18px', boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Top Waste Factor</span>
              <h3 style={{ margin: '8px 0 0', fontSize: '20px', fontWeight: 700, color: '#176B50' }}>
                {Object.keys(wastageSummary.byReason || {})[0]?.replace('_', ' ').toUpperCase() || 'NONE'}
              </h3>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Primary operational loss reason</span>
            </div>
          </div>

          {/* Action Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
              Wastage & Spoilage Log Entries
            </h3>
            <button
              onClick={() => {
                setNewWastage({
                  inventoryItemId: inventoryItems[0]?.id || '',
                  quantity: 1,
                  unit: inventoryItems[0]?.unit || 'kg',
                  reason: 'barista_spill',
                  notes: '',
                  loggedBy: 'Head Barista',
                  costPerUnit: inventoryItems[0]?.costPerUnit || '',
                });
                setWastageModalOpen(true);
              }}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                padding: '9px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '13px',
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(220,38,38,0.25)',
              }}
            >
              <Plus size={16} />
              <span>+ Log Spoilage / Wastage</span>
            </button>
          </div>

          {/* Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#4b5563', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Item</th>
                  <th style={{ padding: '12px 16px' }}>Quantity</th>
                  <th style={{ padding: '12px 16px' }}>Financial Loss</th>
                  <th style={{ padding: '12px 16px' }}>Reason</th>
                  <th style={{ padding: '12px 16px' }}>Logged By</th>
                  <th style={{ padding: '12px 16px' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {(wastageSummary.recentLogs || []).map((w) => (
                  <tr key={w.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#111827' }}>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                      {new Date(w.loggedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{w.itemName}</td>
                    <td style={{ padding: '12px 16px' }}>{w.quantity} {w.unit}</td>
                    <td style={{ padding: '12px 16px', color: '#dc2626', fontWeight: 700 }}>
                      ₹{w.totalCost?.toFixed(2) || '0.00'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          background: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {w.reason.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4b5563' }}>{w.loggedBy}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '12px' }}>{w.notes || '—'}</td>
                  </tr>
                ))}
                {(!wastageSummary.recentLogs || wastageSummary.recentLogs.length === 0) && (
                  <tr>
                    <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
                      No spoilage or wastage logged. Clean operations!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: AUTOMATED REORDER POINT (ROP) & PURCHASE ORDERS
          ========================================================================= */}
      {activeTab === 'rop_orders' && (
        <div>
          {/* Low Stock Warning Banner if ROP breached */}
          {ropAlerts.triggeredCount > 0 && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: 24,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                boxShadow: '0 2px 8px rgba(180,83,9,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <AlertTriangle size={28} style={{ color: '#b45309' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#92400e' }}>
                    {ropAlerts.triggeredCount} Item(s) Breached Reorder Point (ROP) Threshold
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#b45309' }}>
                    Current on-hand inventory is below critical buffer level. Generate supplier replenishment POs with 1 click.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                {Object.keys(ropAlerts.groupedBySupplier || {}).map((supp) => {
                  const sGroup = ropAlerts.groupedBySupplier[supp];
                  return (
                    <button
                      key={supp}
                      onClick={() => {
                        setNewPo({
                          supplierName: sGroup.supplierName,
                          supplierEmail: sGroup.supplierEmail || '',
                          supplierPhone: sGroup.supplierPhone || '',
                          expectedDeliveryDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
                          notes: 'Automated ROP replenishment order.',
                          createdByUser: 'Inventory Manager',
                          items: sGroup.items.map(it => ({
                            inventoryItemId: it.inventoryItemId,
                            itemName: it.itemName,
                            unit: it.unit,
                            currentStock: it.currentStock,
                            orderQty: it.suggestedOrderQty,
                            costPerUnit: it.costPerUnit,
                          })),
                        });
                        setPoModalOpen(true);
                      }}
                      style={{
                        background: '#f59e0b',
                        color: '#ffffff',
                        border: 'none',
                        padding: '8px 14px',
                        borderRadius: 6,
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 6px rgba(245,158,11,0.25)',
                      }}
                    >
                      <Plus size={14} />
                      <span>Draft PO for {supp} (₹{sGroup.totalEstimatedAmount})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
              Supplier Purchase Orders & Procurement
            </h3>
            <button
              onClick={() => {
                setNewPo({
                  supplierName: 'Western Ghats Planters Co.',
                  supplierEmail: 'orders@wghatsplanters.in',
                  supplierPhone: '+91 98200 11999',
                  expectedDeliveryDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
                  notes: '',
                  createdByUser: 'Inventory Manager',
                  items: [
                    {
                      itemName: inventoryItems[0]?.name || 'Specialty Green Coffee',
                      unit: inventoryItems[0]?.unit || 'kg',
                      orderQty: 25,
                      costPerUnit: inventoryItems[0]?.costPerUnit || 450,
                      inventoryItemId: inventoryItems[0]?.id || null,
                    },
                  ],
                });
                setPoModalOpen(true);
              }}
              style={{
                background: '#176B50',
                color: '#fff',
                border: 'none',
                padding: '9px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '13px',
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(23,107,80,0.25)',
              }}
            >
              <Plus size={16} />
              <span>+ New Purchase Order</span>
            </button>
          </div>

          {/* PO List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {purchaseOrders.map((po) => (
              <div
                key={po.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 16,
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 14,
                  boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        background: '#ecfdf5',
                        color: '#065f46',
                        border: '1px solid #a7f3d0',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    >
                      {po.poNumber}
                    </span>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                      {po.supplierName}
                    </h4>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        background:
                          po.status === 'fulfilled'
                            ? '#ecfdf5'
                            : po.status === 'sent'
                            ? '#eff6ff'
                            : '#f3f4f6',
                        color:
                          po.status === 'fulfilled'
                            ? '#047857'
                            : po.status === 'sent'
                            ? '#1d4ed8'
                            : '#4b5563',
                        border:
                          po.status === 'fulfilled'
                            ? '1px solid #a7f3d0'
                            : po.status === 'sent'
                            ? '1px solid #bfdbfe'
                            : '1px solid #e5e7eb',
                      }}
                    >
                      {po.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 6 }}>
                    {(po.items || []).length} items • Total Value: <b style={{ color: '#111827' }}>₹{po.totalAmount?.toFixed(2)}</b>
                    {po.expectedDeliveryDate && ` • Expected: ${po.expectedDeliveryDate}`}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handlePrintPo(po.id)}
                    style={{
                      background: '#ffffff',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      padding: '7px 12px',
                      borderRadius: 6,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Printer size={14} />
                    <span>View & Print PO</span>
                  </button>

                  {po.status === 'draft' && (
                    <button
                      onClick={() => handleUpdatePoStatus(po.id, 'sent')}
                      style={{
                        background: '#176B50',
                        color: '#fff',
                        border: 'none',
                        padding: '7px 12px',
                        borderRadius: 6,
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 6px rgba(23,107,80,0.25)',
                      }}
                    >
                      <Send size={14} />
                      <span>Mark as Sent</span>
                    </button>
                  )}

                  {po.status === 'sent' && (
                    <button
                      onClick={() => handleUpdatePoStatus(po.id, 'fulfilled', true)}
                      style={{
                        background: '#059669',
                        color: '#fff',
                        border: 'none',
                        padding: '7px 12px',
                        borderRadius: 6,
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 6px rgba(5,150,105,0.25)',
                      }}
                    >
                      <CheckCircle2 size={14} />
                      <span>Fulfill & Restock Inventory</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {purchaseOrders.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', background: '#ffffff', border: '1px dashed #d1d5db', borderRadius: 16 }}>
                No supplier purchase orders logged yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
          ========================================================================= */}

      {/* 1. Modal: New Production Batch */}
      {batchModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, width: '100%', maxWidth: 650, padding: 24, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Create Master Production Batch</h3>
              <button onClick={() => setBatchModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateBatch}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Recipe Name</label>
                <input
                  type="text"
                  required
                  value={newBatch.recipeName}
                  onChange={e => setNewBatch({ ...newBatch, recipeName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Planned Input Qty</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newBatch.plannedQuantity}
                    onChange={e => setNewBatch({ ...newBatch, plannedQuantity: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Unit</label>
                  <select
                    value={newBatch.unit}
                    onChange={e => setNewBatch({ ...newBatch, unit: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="g">g (Grams)</option>
                    <option value="l">L (Litres)</option>
                    <option value="ml">ml (Millilitres)</option>
                    <option value="pcs">pcs (Pieces)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Output Finished Good (To Restock on Completion)</label>
                <select
                  value={newBatch.outputInventoryItemId}
                  onChange={e => {
                    const sel = inventoryItems.find(i => i.id === e.target.value);
                    setNewBatch({
                      ...newBatch,
                      outputInventoryItemId: e.target.value,
                      outputItemName: sel?.name || '',
                    });
                  }}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                >
                  <option value="">Select Finished Inventory Item...</option>
                  {inventoryItems.map(it => (
                    <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>
                  ))}
                </select>
              </div>

              {/* BOM Selector */}
              <div style={{ marginBottom: 14, background: '#f8fafc', padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#176B50' }}>Raw Ingredients BOM</span>
                  <button
                    type="button"
                    onClick={() => {
                      const first = inventoryItems[0];
                      setNewBatch({
                        ...newBatch,
                        bomIngredients: [
                          ...newBatch.bomIngredients,
                          {
                            inventoryItemId: first?.id || '',
                            name: first?.name || '',
                            quantityRequired: newBatch.plannedQuantity,
                            unit: first?.unit || 'kg',
                            costPerUnit: first?.costPerUnit || 0,
                          },
                        ],
                      });
                    }}
                    style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '4px 10px', borderRadius: 6, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Add Ingredient
                  </button>
                </div>

                {newBatch.bomIngredients.map((bIng, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 24px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <select
                      value={bIng.inventoryItemId}
                      onChange={e => {
                        const sel = inventoryItems.find(i => i.id === e.target.value);
                        const arr = [...newBatch.bomIngredients];
                        arr[idx] = {
                          ...arr[idx],
                          inventoryItemId: sel?.id,
                          name: sel?.name,
                          costPerUnit: sel?.costPerUnit || 0,
                          unit: sel?.unit || 'kg',
                        };
                        setNewBatch({ ...newBatch, bomIngredients: arr });
                      }}
                      style={{ padding: '8px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: '12px' }}
                    >
                      {inventoryItems.map(it => (
                        <option key={it.id} value={it.id}>{it.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Qty"
                      step="any"
                      value={bIng.quantityRequired}
                      onChange={e => {
                        const arr = [...newBatch.bomIngredients];
                        arr[idx].quantityRequired = Number(e.target.value);
                        setNewBatch({ ...newBatch, bomIngredients: arr });
                      }}
                      style={{ padding: '8px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: '12px' }}
                    />
                    <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{bIng.unit}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const arr = newBatch.bomIngredients.filter((_, i) => i !== idx);
                        setNewBatch({ ...newBatch, bomIngredients: arr });
                      }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '16px', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Master Roaster / Operator Name</label>
                <input
                  type="text"
                  value={newBatch.operatorName}
                  onChange={e => setNewBatch({ ...newBatch, operatorName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Roasting Notes & Target Profile</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Target drop temp 216C, first crack 9m15s"
                  value={newBatch.roasterNotes}
                  onChange={e => setNewBatch({ ...newBatch, roasterNotes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setBatchModalOpen(false)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                <button type="submit" style={{ background: '#176B50', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 6px rgba(23,107,80,0.25)' }}>Create Batch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Complete Batch Yield */}
      {completeBatchModalOpen && selectedBatchForCompletion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, width: '100%', maxWidth: 500, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Complete Batch & Record Yield</h3>
              <button onClick={() => setCompleteBatchModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: 16 }}>
              Batch: <b style={{ color: '#111827' }}>{selectedBatchForCompletion.batchNumber}</b> • Planned Input: <b style={{ color: '#111827' }}>{selectedBatchForCompletion.plannedQuantity} {selectedBatchForCompletion.unit}</b>
            </p>

            <form onSubmit={handleCompleteBatch}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Actual Weighed Yield ({selectedBatchForCompletion.unit})</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={completionForm.producedQuantity}
                  onChange={e => {
                    const prod = Number(e.target.value);
                    const planned = Number(selectedBatchForCompletion.plannedQuantity);
                    let shrink = 0;
                    if (planned > 0 && prod > 0 && planned >= prod) {
                      shrink = (((planned - prod) / planned) * 100).toFixed(2);
                    }
                    setCompletionForm({
                      ...completionForm,
                      producedQuantity: e.target.value,
                      shrinkagePercent: shrink,
                    });
                  }}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Calculated Roast Shrinkage / Moisture Loss (%)</label>
                <input
                  type="number"
                  step="any"
                  value={completionForm.shrinkagePercent}
                  onChange={e => setCompletionForm({ ...completionForm, shrinkagePercent: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Roaster Profile Notes</label>
                <textarea
                  rows={2}
                  value={completionForm.roasterNotes}
                  onChange={e => setCompletionForm({ ...completionForm, roasterNotes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setCompleteBatchModalOpen(false)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                <button type="submit" style={{ background: '#059669', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 6px rgba(5,150,105,0.25)' }}>Finalize & Add to Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Raise Inter-Store Indent */}
      {indentModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, width: '100%', maxWidth: 600, padding: 24, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Raise Inter-Store Indent Request</h3>
              <button onClick={() => setIndentModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateIndent}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Fulfilling Commissary / Central Warehouse Outlet</label>
                <select
                  required
                  value={newIndent.supplyingCafeId}
                  onChange={e => setNewIndent({ ...newIndent, supplyingCafeId: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                >
                  <option value="">Select Supplying Outlet / Commissary...</option>
                  {allCafes.filter(c => c.id !== cafe?.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Priority</label>
                  <select
                    value={newIndent.priority}
                    onChange={e => setNewIndent({ ...newIndent, priority: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Requested By</label>
                  <input
                    type="text"
                    value={newIndent.requestedBy}
                    onChange={e => setNewIndent({ ...newIndent, requestedBy: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Items List */}
              <div style={{ marginBottom: 14, background: '#f8fafc', padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#176B50' }}>Requested Stock Items</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewIndent({
                        ...newIndent,
                        items: [
                          ...newIndent.items,
                          {
                            itemName: inventoryItems[0]?.name || 'Specialty Coffee Item',
                            category: 'Roastery',
                            unit: 'kg',
                            requestedQty: 5,
                            inventoryItemId: inventoryItems[0]?.id || null,
                          },
                        ],
                      });
                    }}
                    style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '4px 10px', borderRadius: 6, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Add Item
                  </button>
                </div>

                {newIndent.items.map((it, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 24px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Item name"
                      value={it.itemName}
                      onChange={e => {
                        const arr = [...newIndent.items];
                        arr[idx].itemName = e.target.value;
                        setNewIndent({ ...newIndent, items: arr });
                      }}
                      style={{ padding: '8px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: '12px' }}
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      step="any"
                      value={it.requestedQty}
                      onChange={e => {
                        const arr = [...newIndent.items];
                        arr[idx].requestedQty = Number(e.target.value);
                        setNewIndent({ ...newIndent, items: arr });
                      }}
                      style={{ padding: '8px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: '12px' }}
                    />
                    <select
                      value={it.unit}
                      onChange={e => {
                        const arr = [...newIndent.items];
                        arr[idx].unit = e.target.value;
                        setNewIndent({ ...newIndent, items: arr });
                      }}
                      style={{ padding: '8px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: '12px' }}
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="l">L</option>
                      <option value="pcs">pcs</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const arr = newIndent.items.filter((_, i) => i !== idx);
                        setNewIndent({ ...newIndent, items: arr });
                      }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '16px', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Notes / Reason</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Weekend roast replenishment for cold brew & retail shelves"
                  value={newIndent.notes}
                  onChange={e => setNewIndent({ ...newIndent, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setIndentModalOpen(false)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                <button type="submit" style={{ background: '#176B50', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 6px rgba(23,107,80,0.25)' }}>Submit Indent</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: Dispatch STN */}
      {dispatchModalOpen && selectedIndent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, width: '100%', maxWidth: 550, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.15)', color: '#111827' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Issue STN & Dispatch Stock</h3>
              <button onClick={() => setDispatchModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleDispatchSTN}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Transporter / Logistics Partner</label>
                <input
                  type="text"
                  required
                  value={dispatchForm.transporterName}
                  onChange={e => setDispatchForm({ ...dispatchForm, transporterName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Vehicle Number</label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.vehicleNumber}
                    onChange={e => setDispatchForm({ ...dispatchForm, vehicleNumber: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Driver Contact</label>
                  <input
                    type="text"
                    value={dispatchForm.driverContact}
                    onChange={e => setDispatchForm({ ...dispatchForm, driverContact: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setDispatchModalOpen(false)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                <button type="submit" style={{ background: '#176B50', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 6px rgba(23,107,80,0.25)' }}>Confirm Dispatch & Deduct Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Receive GRN */}
      {receiveModalOpen && selectedIndent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, width: '100%', maxWidth: 650, padding: 24, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', color: '#111827' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Verify Goods Received Note (GRN)</h3>
              <button onClick={() => setReceiveModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleReceiveGRN}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Received By (Staff Member)</label>
                <input
                  type="text"
                  required
                  value={receiveForm.receivedBy}
                  onChange={e => setReceiveForm({ ...receiveForm, receivedBy: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              {/* Items Verification */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Counted Received Quantities</label>
                {(selectedIndent.items || []).map((li, idx) => {
                  const currRec = receiveForm.receivedQuantities[idx] || { receivedQty: li.dispatchedQty, varianceReason: '' };
                  const variance = Number(currRec.receivedQty) - Number(li.dispatchedQty);
                  return (
                    <div key={li.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: 6 }}>
                        <span>{li.itemName}</span>
                        <span style={{ color: '#6b7280', fontWeight: 500 }}>Dispatched: {li.dispatchedQty} {li.unit}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, alignItems: 'center' }}>
                        <div>
                          <input
                            type="number"
                            step="any"
                            required
                            value={currRec.receivedQty}
                            onChange={e => {
                              const arr = [...receiveForm.receivedQuantities];
                              arr[idx] = { ...arr[idx], id: li.id, receivedQty: Number(e.target.value) };
                              setReceiveForm({ ...receiveForm, receivedQuantities: arr });
                            }}
                            style={{ width: '100%', padding: '8px 10px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: '12px' }}
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder={variance !== 0 ? 'Variance reason (e.g. transit spill, damage)' : 'Notes (optional)'}
                            value={currRec.varianceReason || ''}
                            onChange={e => {
                              const arr = [...receiveForm.receivedQuantities];
                              arr[idx] = { ...arr[idx], id: li.id, varianceReason: e.target.value };
                              setReceiveForm({ ...receiveForm, receivedQuantities: arr });
                            }}
                            style={{ width: '100%', padding: '8px 10px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: '12px' }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setReceiveModalOpen(false)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                <button type="submit" style={{ background: '#059669', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 6px rgba(5,150,105,0.25)' }}>Acknowledge GRN & Restock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Log Spoilage / Wastage */}
      {wastageModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, width: '100%', maxWidth: 500, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.15)', color: '#111827' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Record Spoilage / Wastage</h3>
              <button onClick={() => setWastageModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleLogWastage}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Inventory Item</label>
                <select
                  required
                  value={newWastage.inventoryItemId}
                  onChange={e => {
                    const sel = inventoryItems.find(i => i.id === e.target.value);
                    setNewWastage({
                      ...newWastage,
                      inventoryItemId: e.target.value,
                      unit: sel?.unit || 'kg',
                      costPerUnit: sel?.costPerUnit || 0,
                    });
                  }}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                >
                  <option value="">Select Item...</option>
                  {inventoryItems.map(it => (
                    <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Quantity</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newWastage.quantity}
                    onChange={e => setNewWastage({ ...newWastage, quantity: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Reason Category</label>
                  <select
                    value={newWastage.reason}
                    onChange={e => setNewWastage({ ...newWastage, reason: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                  >
                    <option value="barista_spill">Barista Spill</option>
                    <option value="expired">Expired Date</option>
                    <option value="machine_calibration">Machine Calibration / Dialing In</option>
                    <option value="test_roast">Test Roast Defect</option>
                    <option value="batch_defect">Batch Defect</option>
                    <option value="transit_damage">Transit Damage</option>
                    <option value="customer_complaint">Customer Complaint Remake</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Logged By (Staff)</label>
                <input
                  type="text"
                  value={newWastage.loggedBy}
                  onChange={e => setNewWastage({ ...newWastage, loggedBy: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Incident Notes</label>
                <textarea
                  rows={2}
                  value={newWastage.notes}
                  onChange={e => setNewWastage({ ...newWastage, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setWastageModalOpen(false)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                <button type="submit" style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 6px rgba(220,38,38,0.25)' }}>Log Wastage & Deduct Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Create Purchase Order */}
      {poModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, width: '100%', maxWidth: 650, padding: 24, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', color: '#111827' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Draft Supplier Purchase Order</h3>
              <button onClick={() => setPoModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreatePo}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Supplier Name</label>
                <input
                  type="text"
                  required
                  value={newPo.supplierName}
                  onChange={e => setNewPo({ ...newPo, supplierName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Supplier Email</label>
                  <input
                    type="email"
                    value={newPo.supplierEmail}
                    onChange={e => setNewPo({ ...newPo, supplierEmail: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Supplier Phone</label>
                  <input
                    type="text"
                    value={newPo.supplierPhone}
                    onChange={e => setNewPo({ ...newPo, supplierPhone: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Expected Delivery Date</label>
                <input
                  type="date"
                  value={newPo.expectedDeliveryDate}
                  onChange={e => setNewPo({ ...newPo, expectedDeliveryDate: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              {/* Items List */}
              <div style={{ marginBottom: 14, background: '#f8fafc', padding: '14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#176B50' }}>Order Line Items</span>
                  <button
                    type="button"
                    onClick={() => {
                      const first = inventoryItems[0];
                      setNewPo({
                        ...newPo,
                        items: [
                          ...newPo.items,
                          {
                            inventoryItemId: first?.id || null,
                            itemName: first?.name || 'Item',
                            unit: first?.unit || 'kg',
                            orderQty: 10,
                            costPerUnit: first?.costPerUnit || 100,
                          },
                        ],
                      });
                    }}
                    style={{ background: '#e6f4ea', color: '#176B50', border: '1px solid #b7e1cd', padding: '5px 10px', borderRadius: 6, fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    + Add Item
                  </button>
                </div>

                {newPo.items.map((it, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 24px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Item name"
                      value={it.itemName}
                      onChange={e => {
                        const arr = [...newPo.items];
                        arr[idx].itemName = e.target.value;
                        setNewPo({ ...newPo, items: arr });
                      }}
                      style={{ padding: '8px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: '12px' }}
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      step="any"
                      value={it.orderQty}
                      onChange={e => {
                        const arr = [...newPo.items];
                        arr[idx].orderQty = Number(e.target.value);
                        setNewPo({ ...newPo, items: arr });
                      }}
                      style={{ padding: '8px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: '12px' }}
                    />
                    <input
                      type="number"
                      placeholder="Rate ₹"
                      step="any"
                      value={it.costPerUnit}
                      onChange={e => {
                        const arr = [...newPo.items];
                        arr[idx].costPerUnit = Number(e.target.value);
                        setNewPo({ ...newPo, items: arr });
                      }}
                      style={{ padding: '8px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: '12px' }}
                    />
                    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{it.unit}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const arr = newPo.items.filter((_, i) => i !== idx);
                        setNewPo({ ...newPo, items: arr });
                      }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Instructions & Terms</label>
                <textarea
                  rows={2}
                  value={newPo.notes}
                  onChange={e => setNewPo({ ...newPo, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setPoModalOpen(false)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                <button type="submit" style={{ background: '#176B50', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 6px rgba(23,107,80,0.25)' }}>Create Purchase Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Modal: View & Print PO */}
      {printPoModalOpen && printablePoData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, width: '100%', maxWidth: 700, padding: 24, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', color: '#111827' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                Purchase Order Document ({printablePoData.po.poNumber})
              </h3>
              <button onClick={() => setPrintPoModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <pre
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '16px',
                borderRadius: 8,
                color: '#111827',
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: '1.4',
                overflowX: 'auto',
                whiteSpace: 'pre',
                marginBottom: 20,
              }}
            >
              {printablePoData.printableText}
            </pre>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(printablePoData.printableText);
                  setCopiedPrintText(true);
                  setTimeout(() => setCopiedPrintText(false), 2000);
                }}
                style={{
                  background: '#f3f4f6',
                  color: '#176B50',
                  border: '1px solid #d1d5db',
                  padding: '9px 16px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {copiedPrintText ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedPrintText ? 'Copied to Clipboard!' : 'Copy Document'}</span>
              </button>

              <button
                onClick={() => window.print()}
                style={{
                  background: '#176B50',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 16px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(23,107,80,0.25)',
                }}
              >
                <Printer size={16} />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

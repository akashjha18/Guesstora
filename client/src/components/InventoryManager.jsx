import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Layers,
  Sparkles,
  Trash2,
  Edit2,
  Coffee,
  DollarSign,
  PieChart,
  History,
  X,
  FileText,
  AlertCircle,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { api } from '../api';

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 1
  }).format(n || 0);

function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function InventoryManager({ cafe, token }) {
  // Main Tabs: 'stock' | 'recipes' | 'ledger'
  const [activeTab, setActiveTab] = useState('stock');

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Summary KPIs
  const [summary, setSummary] = useState({
    totalItems: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalValuation: 0,
    categoryCounts: {}
  });

  // Stock Master State
  const [inventoryItems, setInventoryItems] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [restockItem, setRestockItem] = useState(null);
  const [wasteItem, setWasteItem] = useState(null);

  // Form States
  const [itemForm, setItemForm] = useState({
    name: '',
    sku: '',
    category: 'Coffee',
    currentStock: '',
    unit: 'kg',
    lowStockThreshold: '',
    costPerUnit: '',
    supplier: ''
  });

  const [restockForm, setRestockForm] = useState({
    quantityAdded: '',
    unit: '',
    costPerUnit: '',
    supplier: '',
    notes: '',
    recordedBy: 'Store Manager'
  });

  const [wasteForm, setWasteForm] = useState({
    quantityWasted: '',
    unit: '',
    reason: 'Spoiled / Expired',
    notes: '',
    recordedBy: 'Barista / Chef'
  });

  // Recipe BOM State
  const [recipesList, setRecipesList] = useState([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [recipeDetail, setRecipeDetail] = useState(null);
  const [loadingRecipeDetail, setLoadingRecipeDetail] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    inventoryItemId: '',
    quantityRequired: '',
    unit: 'g',
    variantName: ''
  });

  // Movement Ledger State
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerFilterType, setLedgerFilterType] = useState('all');
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Categories list
  const categories = ['Coffee', 'Dairy', 'Syrups', 'Bakery', 'Packaging', 'Produce', 'Other'];

  // Clear messages timer
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // Load initial summary and stock items
  const fetchData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const [sumRes, itemsRes] = await Promise.all([
        api('/owner/inventory/summary'),
        api('/owner/inventory')
      ]);

      if (sumRes.summary) setSummary(sumRes.summary);
      if (itemsRes.items) setInventoryItems(itemsRes.items);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
      setError(err.message || 'Could not fetch inventory records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Load recipes list when recipe tab is opened
  const fetchRecipesList = async () => {
    try {
      const res = await api('/owner/inventory/recipes');
      if (res.menuItems) {
        setRecipesList(res.menuItems);
        if (!selectedMenuItem && res.menuItems.length > 0) {
          loadRecipeDetail(res.menuItems[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch recipes:', err);
    }
  };

  const loadRecipeDetail = async (menuItem) => {
    setSelectedMenuItem(menuItem);
    setLoadingRecipeDetail(true);
    try {
      const res = await api(`/owner/inventory/recipes/${menuItem.id}`);
      setRecipeDetail(res);
    } catch (err) {
      console.error('Failed to load recipe detail:', err);
    } finally {
      setLoadingRecipeDetail(false);
    }
  };

  // Load movement ledger entries
  const fetchLedger = async () => {
    setLoadingLedger(true);
    try {
      const res = await api('/owner/inventory/movements/all?limit=60');
      if (res.ledger) setLedgerEntries(res.ledger);
    } catch (err) {
      console.error('Failed to fetch stock ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'recipes') {
      fetchRecipesList();
    } else if (activeTab === 'ledger') {
      fetchLedger();
    }
  }, [activeTab]);

  // Filtered Stock Master Items
  const filteredItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchesCat = categoryFilter === 'all' || item.category?.toLowerCase() === categoryFilter.toLowerCase();
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesSearch = !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.supplier && item.supplier.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesStatus && matchesSearch;
    });
  }, [inventoryItems, categoryFilter, statusFilter, searchQuery]);

  // Filtered Ledger Entries
  const filteredLedger = useMemo(() => {
    if (ledgerFilterType === 'all') return ledgerEntries;
    return ledgerEntries.filter(entry => entry.changeType === ledgerFilterType);
  }, [ledgerEntries, ledgerFilterType]);

  // Handlers for Add/Edit Stock Item
  const handleSaveItem = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        const res = await api(`/owner/inventory/${editingItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(itemForm)
        });
        setSuccessMsg(`Updated ${res.item?.name || 'ingredient'} successfully!`);
      } else {
        const res = await api('/owner/inventory', {
          method: 'POST',
          body: JSON.stringify(itemForm)
        });
        setSuccessMsg(`Added ${res.item?.name || 'ingredient'} to inventory!`);
      }
      setShowAddModal(false);
      setEditingItem(null);
      fetchData(true);
    } catch (err) {
      setError(err.message || 'Failed to save inventory item');
    }
  };

  // Handler for Restock
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockItem) return;
    try {
      const res = await api(`/owner/inventory/${restockItem.id}/restock`, {
        method: 'POST',
        body: JSON.stringify(restockForm)
      });
      let msg = `Restocked ${restockItem.name} (+${restockForm.quantityAdded} ${restockItem.unit})!`;
      if (res.restoredMenuItems && res.restoredMenuItems.length > 0) {
        msg += ` Automatically restored ${res.restoredMenuItems.length} menu items back in stock!`;
      }
      setSuccessMsg(msg);
      setRestockItem(null);
      fetchData(true);
      if (activeTab === 'recipes') fetchRecipesList();
    } catch (err) {
      setError(err.message || 'Restock submission failed');
    }
  };

  // Handler for Log Wastage
  const handleWasteSubmit = async (e) => {
    e.preventDefault();
    if (!wasteItem) return;
    try {
      const res = await api(`/owner/inventory/${wasteItem.id}/waste`, {
        method: 'POST',
        body: JSON.stringify(wasteForm)
      });
      let msg = `Logged ${wasteForm.quantityWasted} ${wasteItem.unit} wastage for ${wasteItem.name}.`;
      if (res.outOfStockTriggered) {
        msg += ` Warning: Item is now depleted and related menu recipes auto-86'd!`;
      }
      setSuccessMsg(msg);
      setWasteItem(null);
      fetchData(true);
      if (activeTab === 'recipes') fetchRecipesList();
    } catch (err) {
      setError(err.message || 'Wastage logging failed');
    }
  };

  // Handler for Add Recipe Item
  const handleAddRecipeItem = async (e) => {
    e.preventDefault();
    if (!selectedMenuItem) return;
    try {
      await api(`/owner/inventory/recipes/${selectedMenuItem.id}`, {
        method: 'POST',
        body: JSON.stringify(recipeForm)
      });
      setSuccessMsg('Added ingredient to recipe BOM!');
      setShowAddRecipeModal(false);
      loadRecipeDetail(selectedMenuItem);
      fetchRecipesList();
    } catch (err) {
      setError(err.message || 'Failed to add recipe ingredient');
    }
  };

  // Handler for Delete Recipe Item
  const handleDeleteRecipeItem = async (recipeItemId) => {
    if (!confirm('Remove this ingredient requirement from recipe?')) return;
    try {
      await api(`/owner/inventory/recipes/${recipeItemId}`, {
        method: 'DELETE'
      });
      setSuccessMsg('Ingredient removed from recipe');
      loadRecipeDetail(selectedMenuItem);
      fetchRecipesList();
    } catch (err) {
      setError(err.message || 'Failed to remove recipe item');
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sku: item.sku || '',
      category: item.category,
      currentStock: item.currentStock,
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold,
      costPerUnit: item.costPerUnit,
      supplier: item.supplier || ''
    });
    setShowAddModal(true);
  };

  const openRestockModal = (item) => {
    setRestockItem(item);
    setRestockForm({
      quantityAdded: '',
      unit: item.unit,
      costPerUnit: item.costPerUnit || '',
      supplier: item.supplier || '',
      notes: '',
      recordedBy: 'Store Manager'
    });
  };

  const openWasteModal = (item) => {
    setWasteItem(item);
    setWasteForm({
      quantityWasted: '',
      unit: item.unit,
      reason: 'Spoiled / Expired',
      notes: '',
      recordedBy: 'Barista / Chef'
    });
  };

  return (
    <div className="inventory-dashboard" style={{ color: '#1A120C', paddingBottom: 40 }}>
      {/* Top Banner Alert / Toast Notifications */}
      {successMsg && (
        <div style={{
          background: '#dcfce7',
          color: '#15803d',
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: '1px solid #bbf7d0',
          fontWeight: 600,
          fontSize: 14
        }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div style={{
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: '1px solid #fecaca',
          fontWeight: 600,
          fontSize: 14
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '1px solid #e8dfd5'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#1A120C',
              color: '#EA7A33',
              display: 'grid',
              placeItems: 'center'
            }}>
              <Boxes size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1A120C', letterSpacing: '-0.02em' }}>
                Inventory & Recipe Ledger
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: '#7a6a5d' }}>
                Live ingredient stock control, Bill of Materials (BOM), per-cup COGS, and automatic 86 out-of-stock engine
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#FAF6F0',
              border: '1px solid #d4c8bc',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              color: '#4a3b32'
            }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin-icon' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setItemForm({
                name: '',
                sku: '',
                category: 'Coffee',
                currentStock: '',
                unit: 'kg',
                lowStockThreshold: '',
                costPerUnit: '',
                supplier: ''
              });
              setShowAddModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#EA7A33',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(234, 122, 51, 0.25)'
            }}
          >
            <Plus size={16} />
            <span>Add Raw Material</span>
          </button>
        </div>
      </div>

      {/* Top KPI Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {/* Total Ingredients */}
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: '16px 20px',
          border: '1px solid #e8dfd5',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#7a6a5d' }}>Total Ingredients</span>
            <div style={{ padding: 6, borderRadius: 8, background: '#f5efe8', color: '#1A120C' }}>
              <Layers size={16} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1A120C' }}>
            {summary.totalItems}
          </div>
          <div style={{ fontSize: 12, color: '#8a7b6f', marginTop: 4 }}>
            Raw materials across {Object.keys(summary.categoryCounts || {}).length} categories
          </div>
        </div>

        {/* Low Stock Warnings */}
        <div style={{
          background: summary.lowStockCount > 0 ? '#fffbeb' : '#fff',
          borderRadius: 12,
          padding: '16px 20px',
          border: summary.lowStockCount > 0 ? '1px solid #fde68a' : '1px solid #e8dfd5',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: summary.lowStockCount > 0 ? '#b45309' : '#7a6a5d' }}>
              Low Stock Warnings
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: '#fef3c7', color: '#b45309' }}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: summary.lowStockCount > 0 ? '#b45309' : '#1A120C' }}>
            {summary.lowStockCount}
          </div>
          <div style={{ fontSize: 12, color: summary.lowStockCount > 0 ? '#d97706' : '#8a7b6f', marginTop: 4 }}>
            {summary.lowStockCount > 0 ? 'Replenishment needed soon' : 'All items safely above threshold'}
          </div>
        </div>

        {/* 86'd Out-of-Stock */}
        <div style={{
          background: summary.outOfStockCount > 0 ? '#fef2f2' : '#fff',
          borderRadius: 12,
          padding: '16px 20px',
          border: summary.outOfStockCount > 0 ? '1px solid #fecaca' : '1px solid #e8dfd5',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: summary.outOfStockCount > 0 ? '#dc2626' : '#7a6a5d' }}>
              86 Out-of-Stock
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: '#fee2e2', color: '#dc2626' }}>
              <XCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: summary.outOfStockCount > 0 ? '#dc2626' : '#1A120C' }}>
            {summary.outOfStockCount}
          </div>
          <div style={{ fontSize: 12, color: summary.outOfStockCount > 0 ? '#ef4444' : '#8a7b6f', marginTop: 4 }}>
            {summary.outOfStockCount > 0 ? 'Triggering menu item pauses' : 'Zero items depleted'}
          </div>
        </div>

        {/* Total Stock Valuation */}
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: '16px 20px',
          border: '1px solid #e8dfd5',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#7a6a5d' }}>Stock Valuation</span>
            <div style={{ padding: 6, borderRadius: 8, background: '#f5efe8', color: '#1A120C' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1A120C' }}>
            {money(summary.totalValuation)}
          </div>
          <div style={{ fontSize: 12, color: '#8a7b6f', marginTop: 4 }}>
            Total wholesale capital on shelf
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '2px solid #e8dfd5',
        marginBottom: 20
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          style={{
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'stock' ? '3px solid #EA7A33' : '3px solid transparent',
            color: activeTab === 'stock' ? '#EA7A33' : '#6b5c51',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2
          }}
        >
          <Boxes size={17} />
          <span>Stock Master</span>
          <span style={{
            fontSize: 11,
            background: activeTab === 'stock' ? '#EA7A33' : '#e8dfd5',
            color: activeTab === 'stock' ? '#fff' : '#4a3b32',
            padding: '2px 7px',
            borderRadius: 10,
            fontWeight: 800
          }}>
            {inventoryItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recipes')}
          style={{
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'recipes' ? '3px solid #EA7A33' : '3px solid transparent',
            color: activeTab === 'recipes' ? '#EA7A33' : '#6b5c51',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2
          }}
        >
          <Coffee size={17} />
          <span>Recipe Book & BOM (COGS)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          style={{
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ledger' ? '3px solid #EA7A33' : '3px solid transparent',
            color: activeTab === 'ledger' ? '#EA7A33' : '#6b5c51',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2
          }}
        >
          <History size={17} />
          <span>Movement Audit Ledger</span>
        </button>
      </div>

      {/* ======================= TAB 1: STOCK MASTER ======================= */}
      {activeTab === 'stock' && (
        <div>
          {/* Filters & Search Row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#9a8b80' }} />
              <input
                type="text"
                placeholder="Search raw material name, SKU, or supplier..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 8,
                  border: '1px solid #d4c8bc',
                  background: '#fff',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: categoryFilter === 'all' ? '#1A120C' : '#d4c8bc',
                  background: categoryFilter === 'all' ? '#1A120C' : '#fff',
                  color: categoryFilter === 'all' ? '#fff' : '#6b5c51',
                  cursor: 'pointer'
                }}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: categoryFilter === cat ? '#1A120C' : '#d4c8bc',
                    background: categoryFilter === cat ? '#1A120C' : '#fff',
                    color: categoryFilter === cat ? '#fff' : '#6b5c51',
                    cursor: 'pointer'
                  }}
                >
                  {cat}
                </button>
              ))}

              {/* Status Select */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid #d4c8bc',
                  background: '#fff',
                  color: '#4a3b32',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Statuses</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock Alerts</option>
                <option value="out_of_stock">86 Out of Stock</option>
              </select>
            </div>
          </div>

          {/* Stock Table Card */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e8dfd5',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#FAF6F0', borderBottom: '1px solid #e8dfd5', color: '#6b5c51' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Ingredient / Material</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700 }}>Category</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Live Stock Level</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700 }}>Unit Cost</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700 }}>Total Value</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700 }}>Supplier</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700 }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#8a7b6f' }}>
                        <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 8px' }} />
                        <div>Loading raw materials catalog...</div>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#8a7b6f' }}>
                        <Boxes size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                        <div style={{ fontWeight: 600 }}>No ingredients match your criteria.</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>Add ingredients to begin recipe tracking.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(item => {
                      const pct = item.lowStockThreshold > 0
                        ? Math.min(100, Math.round((item.currentStock / (item.lowStockThreshold * 2.5)) * 100))
                        : 100;
                      const statusColor = item.status === 'out_of_stock'
                        ? '#dc2626'
                        : item.status === 'low_stock'
                        ? '#b45309'
                        : '#15803d';
                      const statusBg = item.status === 'out_of_stock'
                        ? '#fee2e2'
                        : item.status === 'low_stock'
                        ? '#fef3c7'
                        : '#dcfce7';

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f3ece4' }}>
                          {/* Name & SKU */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#1A120C' }}>{item.name}</div>
                            {item.sku && (
                              <div style={{ fontSize: 11, color: '#8a7b6f', fontFamily: 'monospace' }}>
                                SKU: {item.sku}
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td style={{ padding: '14px 14px' }}>
                            <span style={{
                              background: '#f4ede4',
                              color: '#554236',
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600
                            }}>
                              {item.category}
                            </span>
                          </td>

                          {/* Live Stock Level & Bar */}
                          <td style={{ padding: '14px 16px', minWidth: 170 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontWeight: 800, color: statusColor }}>
                                {item.currentStock} {item.unit}
                              </span>
                              <span style={{ fontSize: 11, color: '#8a7b6f' }}>
                                Min: {item.lowStockThreshold} {item.unit}
                              </span>
                            </div>
                            <div style={{
                              height: 6,
                              background: '#f0e6dc',
                              borderRadius: 4,
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: statusColor,
                                borderRadius: 4,
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </td>

                          {/* Unit Cost */}
                          <td style={{ padding: '14px 14px', color: '#4a3b32' }}>
                            {money(item.costPerUnit)} <span style={{ fontSize: 11, color: '#8a7b6f' }}>/{item.unit}</span>
                          </td>

                          {/* Total Value */}
                          <td style={{ padding: '14px 14px', fontWeight: 700, color: '#1A120C' }}>
                            {money(item.currentStock * item.costPerUnit)}
                          </td>

                          {/* Supplier */}
                          <td style={{ padding: '14px 14px', color: '#6b5c51', fontSize: 12 }}>
                            {item.supplier || '—'}
                          </td>

                          {/* Status Pill */}
                          <td style={{ padding: '14px 14px' }}>
                            <span style={{
                              background: statusBg,
                              color: statusColor,
                              padding: '4px 9px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              {item.status === 'out_of_stock' && <XCircle size={12} />}
                              {item.status === 'low_stock' && <AlertTriangle size={12} />}
                              {item.status === 'in_stock' && <CheckCircle2 size={12} />}
                              <span>
                                {item.status === 'out_of_stock' ? '86 Depleted' : item.status === 'low_stock' ? 'Low Stock' : 'In Stock'}
                              </span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              <button
                                type="button"
                                title="Quick Restock"
                                onClick={() => openRestockModal(item)}
                                style={{
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #bbf7d0',
                                  borderRadius: 6,
                                  padding: '5px 9px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <ArrowUpRight size={13} />
                                <span>Restock</span>
                              </button>

                              <button
                                type="button"
                                title="Log Wastage or Spoilage"
                                onClick={() => openWasteModal(item)}
                                style={{
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  border: '1px solid #fecaca',
                                  borderRadius: 6,
                                  padding: '5px 8px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <ArrowDownRight size={13} />
                                <span>Waste</span>
                              </button>

                              <button
                                type="button"
                                title="Edit Material"
                                onClick={() => openEditModal(item)}
                                style={{
                                  background: '#f5efe8',
                                  color: '#4a3b32',
                                  border: '1px solid #d4c8bc',
                                  borderRadius: 6,
                                  padding: '5px 8px',
                                  fontSize: 12,
                                  cursor: 'pointer'
                                }}
                              >
                                <Edit2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 2: RECIPE BOOK & BOM ======================= */}
      {activeTab === 'recipes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
          {/* Left Menu Items Selector */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e8dfd5',
            padding: 16,
            height: 'fit-content'
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1A120C' }}>
              Menu Items (BOM Recipes)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '600px', overflowY: 'auto' }}>
              {recipesList.map(item => {
                const isSelected = selectedMenuItem?.id === item.id;
                const canMake = item.canFulfill !== false;

                return (
                  <div
                    key={item.id}
                    onClick={() => loadRecipeDetail(item)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: isSelected ? '2px solid #EA7A33' : '1px solid #e8dfd5',
                      background: isSelected ? '#FAF6F0' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1A120C' }}>{item.name}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#EA7A33' }}>
                        {money(item.price)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: '#7a6a5d' }}>
                        {item.recipes?.length || 0} ingredients
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 10,
                        background: canMake ? '#dcfce7' : '#fee2e2',
                        color: canMake ? '#15803d' : '#b91c1c'
                      }}>
                        {canMake ? 'Stocked' : '86 Paused'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Selected Recipe BOM Detail */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e8dfd5',
            padding: 24
          }}>
            {loadingRecipeDetail ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#8a7b6f' }}>
                <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 8px' }} />
                <div>Loading recipe Bill of Materials...</div>
              </div>
            ) : !selectedMenuItem ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#8a7b6f' }}>
                Select a menu item on the left to inspect or configure its recipe.
              </div>
            ) : (
              <div>
                {/* Header with COGS Metrics */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: '1px solid #e8dfd5'
                }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1A120C' }}>
                      {selectedMenuItem.name}
                    </h2>
                    <div style={{ fontSize: 13, color: '#7a6a5d', marginTop: 4 }}>
                      Category: {selectedMenuItem.category} • Selling Price: {money(selectedMenuItem.price)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRecipeForm({
                        inventoryItemId: inventoryItems[0]?.id || '',
                        quantityRequired: '',
                        unit: 'g',
                        variantName: ''
                      });
                      setShowAddRecipeModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#1A120C',
                      color: '#FAF6F0',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={15} />
                    <span>Add Ingredient</span>
                  </button>
                </div>

                {/* Profit Margin & COGS Card */}
                {recipeDetail?.costAnalysis && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 12,
                    background: '#FAF6F0',
                    border: '1px solid #e8dfd5',
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 20
                  }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#7a6a5d', textTransform: 'uppercase' }}>
                        Per-Cup COGS
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#1A120C', marginTop: 2 }}>
                        {money(recipeDetail.costAnalysis.cogs)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#7a6a5d', textTransform: 'uppercase' }}>
                        Gross Margin (₹)
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d', marginTop: 2 }}>
                        {money(recipeDetail.costAnalysis.sellingPrice - recipeDetail.costAnalysis.cogs)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#7a6a5d', textTransform: 'uppercase' }}>
                        Profit Margin (%)
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#EA7A33', marginTop: 2 }}>
                        {recipeDetail.costAnalysis.profitMarginPct}%
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#7a6a5d', textTransform: 'uppercase' }}>
                        Can Fulfill
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 700,
                        marginTop: 4,
                        color: recipeDetail.costAnalysis.canFulfill ? '#15803d' : '#b91c1c'
                      }}>
                        {recipeDetail.costAnalysis.canFulfill ? 'Ready to Serve' : '86 Out-of-Stock'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ingredients Table */}
                <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#1A120C' }}>
                  Bill of Materials (Raw Ingredients Required)
                </h4>
                {(!recipeDetail?.recipe || recipeDetail.recipe.length === 0) ? (
                  <div style={{ padding: 30, textAlign: 'center', background: '#faf6f0', borderRadius: 8, color: '#8a7b6f' }}>
                    No ingredients mapped yet. Click "Add Ingredient" above to create this item's recipe!
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e8dfd5', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f5efe8', borderBottom: '1px solid #e8dfd5', color: '#6b5c51' }}>
                          <th style={{ padding: '10px 14px', fontWeight: 700 }}>Raw Material</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700 }}>Required / Serving</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700 }}>Unit Cost</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700 }}>Cost in Cup</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700 }}>Stock Availability</th>
                          <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipeDetail.recipe.map(item => {
                          const stockItem = item.InventoryItem;
                          const isLow = stockItem && stockItem.currentStock < (stockItem.lowStockThreshold || 0);

                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid #f3ece4' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1A120C' }}>
                                {stockItem?.name || item.inventoryItemId}
                              </td>
                              <td style={{ padding: '12px 12px', color: '#4a3b32', fontWeight: 700 }}>
                                {item.quantityRequired} {item.unit}
                              </td>
                              <td style={{ padding: '12px 12px', color: '#6b5c51' }}>
                                {money(stockItem?.costPerUnit)} / {stockItem?.unit}
                              </td>
                              <td style={{ padding: '12px 12px', fontWeight: 700, color: '#EA7A33' }}>
                                {money(item.costInCup || 0)}
                              </td>
                              <td style={{ padding: '12px 12px' }}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: isLow ? '#b45309' : '#15803d'
                                }}>
                                  {stockItem?.currentStock} {stockItem?.unit} available
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRecipeItem(item.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#b91c1c',
                                    cursor: 'pointer',
                                    padding: 4
                                  }}
                                  title="Remove from recipe"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================= TAB 3: MOVEMENT AUDIT LEDGER ======================= */}
      {activeTab === 'ledger' && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setLedgerFilterType('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: ledgerFilterType === 'all' ? '#1A120C' : '#d4c8bc',
                  background: ledgerFilterType === 'all' ? '#1A120C' : '#fff',
                  color: ledgerFilterType === 'all' ? '#fff' : '#6b5c51',
                  cursor: 'pointer'
                }}
              >
                All Movements
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilterType('purchase_restock')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: ledgerFilterType === 'purchase_restock' ? '#15803d' : '#d4c8bc',
                  background: ledgerFilterType === 'purchase_restock' ? '#dcfce7' : '#fff',
                  color: ledgerFilterType === 'purchase_restock' ? '#15803d' : '#6b5c51',
                  cursor: 'pointer'
                }}
              >
                Restocks & Purchases
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilterType('order_consumption')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: ledgerFilterType === 'order_consumption' ? '#1d4ed8' : '#d4c8bc',
                  background: ledgerFilterType === 'order_consumption' ? '#dbeafe' : '#fff',
                  color: ledgerFilterType === 'order_consumption' ? '#1d4ed8' : '#6b5c51',
                  cursor: 'pointer'
                }}
              >
                Order Depletions
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilterType('waste_spoilage')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: ledgerFilterType === 'waste_spoilage' ? '#b91c1c' : '#d4c8bc',
                  background: ledgerFilterType === 'waste_spoilage' ? '#fee2e2' : '#fff',
                  color: ledgerFilterType === 'waste_spoilage' ? '#b91c1c' : '#6b5c51',
                  cursor: 'pointer'
                }}
              >
                Wastage / Spoilage
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilterType('order_cancellation_restore')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: ledgerFilterType === 'order_cancellation_restore' ? '#6d28d9' : '#d4c8bc',
                  background: ledgerFilterType === 'order_cancellation_restore' ? '#ede9fe' : '#fff',
                  color: ledgerFilterType === 'order_cancellation_restore' ? '#6d28d9' : '#6b5c51',
                  cursor: 'pointer'
                }}
              >
                Cancellation Returns
              </button>
            </div>

            <button
              type="button"
              onClick={fetchLedger}
              disabled={loadingLedger}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#FAF6F0',
                border: '1px solid #d4c8bc',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                color: '#4a3b32'
              }}
            >
              <RefreshCw size={13} className={loadingLedger ? 'spin-icon' : ''} />
              <span>Refresh Ledger</span>
            </button>
          </div>

          <div style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e8dfd5',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#FAF6F0', borderBottom: '1px solid #e8dfd5', color: '#6b5c51' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Timestamp</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Ingredient</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Change Type</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Stock Delta</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Stock Transition</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Reference / Logged By</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Notes / Reason</th>
                </tr>
              </thead>
              <tbody>
                {loadingLedger ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8a7b6f' }}>
                      <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 8px' }} />
                      <div>Loading stock movement audit entries...</div>
                    </td>
                  </tr>
                ) : filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8a7b6f' }}>
                      <History size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600 }}>No stock movement logs recorded yet.</div>
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map(entry => {
                    const isPositive = entry.quantityDelta > 0;
                    const typeLabel = entry.changeType === 'purchase_restock'
                      ? 'Restock / Purchase'
                      : entry.changeType === 'order_consumption'
                      ? 'Order Depletion'
                      : entry.changeType === 'waste_spoilage'
                      ? 'Waste / Spoilage'
                      : entry.changeType === 'order_cancellation_restore'
                      ? 'Cancel Return'
                      : entry.changeType;

                    const typeBg = entry.changeType === 'purchase_restock'
                      ? '#dcfce7'
                      : entry.changeType === 'order_consumption'
                      ? '#dbeafe'
                      : entry.changeType === 'waste_spoilage'
                      ? '#fee2e2'
                      : '#ede9fe';

                    const typeColor = entry.changeType === 'purchase_restock'
                      ? '#15803d'
                      : entry.changeType === 'order_consumption'
                      ? '#1d4ed8'
                      : entry.changeType === 'waste_spoilage'
                      ? '#b91c1c'
                      : '#6d28d9';

                    return (
                      <tr key={entry.id} style={{ borderBottom: '1px solid #f3ece4' }}>
                        <td style={{ padding: '12px 16px', color: '#6b5c51', fontSize: 12 }}>
                          {formatTimestamp(entry.createdAt)}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1A120C' }}>
                          {entry.InventoryItem?.name || entry.inventoryItemId}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            background: typeBg,
                            color: typeColor,
                            padding: '3px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 700
                          }}>
                            {typeLabel}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: isPositive ? '#15803d' : '#b91c1c' }}>
                          {isPositive ? `+${entry.quantityDelta}` : entry.quantityDelta} {entry.InventoryItem?.unit}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: '#4a3b32' }}>
                          <span style={{ color: '#8a7b6f' }}>{entry.stockBefore}</span>
                          <span style={{ margin: '0 6px', color: '#c0b4a7' }}>→</span>
                          <span style={{ fontWeight: 700 }}>{entry.stockAfter}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12 }}>
                          {entry.referenceId && (
                            <div style={{ color: '#1A120C', fontWeight: 600 }}>Ref: {entry.referenceId}</div>
                          )}
                          <div style={{ color: '#8a7b6f' }}>{entry.recordedBy || 'System'}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b5c51' }}>
                          {entry.notes || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== MODAL: ADD / EDIT RAW MATERIAL ===================== */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f5efe8', display: 'grid', placeItems: 'center', color: '#EA7A33' }}>
                  <Boxes size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#1A120C' }}>
                    {editingItem ? 'Edit Raw Material' : 'Add New Raw Material'}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#7a6a5d' }}>
                    Define ingredient master properties and stock thresholds
                  </p>
                </div>
              </div>
              <button className="modal-close-icon" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                    Material / Ingredient Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Arabica Espresso Beans"
                    value={itemForm.name}
                    onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                    SKU Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. COF-BEANS-01"
                    value={itemForm.sku}
                    onChange={e => setItemForm({ ...itemForm, sku: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                    Category *
                  </label>
                  <select
                    value={itemForm.category}
                    onChange={e => setItemForm({ ...itemForm, category: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                    Current Stock *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 15.0"
                    value={itemForm.currentStock}
                    onChange={e => setItemForm({ ...itemForm, currentStock: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                    Unit of Measurement *
                  </label>
                  <select
                    value={itemForm.unit}
                    onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="g">g (Grams)</option>
                    <option value="L">L (Litres)</option>
                    <option value="ml">ml (Millilitres)</option>
                    <option value="pcs">pcs (Pieces)</option>
                    <option value="box">box (Boxes)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                    Low Stock Threshold *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 3.0"
                    value={itemForm.lowStockThreshold}
                    onChange={e => setItemForm({ ...itemForm, lowStockThreshold: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                    Cost Per Unit (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 950"
                    value={itemForm.costPerUnit}
                    onChange={e => setItemForm({ ...itemForm, costPerUnit: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                    Primary Supplier (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Roastery Supply Co."
                    value={itemForm.supplier}
                    onChange={e => setItemForm({ ...itemForm, supplier: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid #d4c8bc',
                    background: '#fff',
                    color: '#6b5c51',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#EA7A33',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {editingItem ? 'Save Changes' : 'Create Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: QUICK RESTOCK ===================== */}
      {restockItem && (
        <div className="modal-backdrop" onClick={() => setRestockItem(null)}>
          <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dcfce7', display: 'grid', placeItems: 'center', color: '#15803d' }}>
                  <ArrowUpRight size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#1A120C' }}>Restock Inventory</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#7a6a5d' }}>
                    Record incoming supplier shipment & auto-restore recipes
                  </p>
                </div>
              </div>
              <button className="modal-close-icon" onClick={() => setRestockItem(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} style={{ padding: 20 }}>
              <div style={{
                background: '#FAF6F0',
                padding: '12px 14px',
                borderRadius: 8,
                marginBottom: 16,
                border: '1px solid #e8dfd5'
              }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1A120C' }}>{restockItem.name}</div>
                <div style={{ fontSize: 12, color: '#7a6a5d', marginTop: 2 }}>
                  Current Stock: <b>{restockItem.currentStock} {restockItem.unit}</b> • Category: {restockItem.category}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                  Quantity to Add ({restockItem.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder={`e.g. 10 (${restockItem.unit})`}
                  value={restockForm.quantityAdded}
                  onChange={e => setRestockForm({ ...restockForm, quantityAdded: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 14, fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                    Cost per Unit (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 950"
                    value={restockForm.costPerUnit}
                    onChange={e => setRestockForm({ ...restockForm, costPerUnit: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                    Supplier / Source
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Coffee Roastery Inc."
                    value={restockForm.supplier}
                    onChange={e => setRestockForm({ ...restockForm, supplier: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                  Purchase Order Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Invoice #PO-9412, fresh batch"
                  value={restockForm.notes}
                  onChange={e => setRestockForm({ ...restockForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid #d4c8bc',
                    background: '#fff',
                    color: '#6b5c51',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#15803d',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: LOG WASTAGE / SPOILAGE ===================== */}
      {wasteItem && (
        <div className="modal-backdrop" onClick={() => setWasteItem(null)}>
          <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fee2e2', display: 'grid', placeItems: 'center', color: '#b91c1c' }}>
                  <ArrowDownRight size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#1A120C' }}>Log Spoilage / Wastage</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#7a6a5d' }}>
                    Record spills, expired stock, or quality discards
                  </p>
                </div>
              </div>
              <button className="modal-close-icon" onClick={() => setWasteItem(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleWasteSubmit} style={{ padding: 20 }}>
              <div style={{
                background: '#FAF6F0',
                padding: '12px 14px',
                borderRadius: 8,
                marginBottom: 16,
                border: '1px solid #e8dfd5'
              }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1A120C' }}>{wasteItem.name}</div>
                <div style={{ fontSize: 12, color: '#7a6a5d', marginTop: 2 }}>
                  Current Stock: <b>{wasteItem.currentStock} {wasteItem.unit}</b>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                  Quantity Wasted ({wasteItem.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder={`e.g. 0.5 (${wasteItem.unit})`}
                  value={wasteForm.quantityWasted}
                  onChange={e => setWasteForm({ ...wasteForm, quantityWasted: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 14, fontWeight: 700 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                  Reason for Wastage *
                </label>
                <select
                  value={wasteForm.reason}
                  onChange={e => setWasteForm({ ...wasteForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                >
                  <option value="Spoiled / Expired">Spoiled / Expired</option>
                  <option value="Spilled / Dropped">Spilled / Dropped</option>
                  <option value="Dial-in / Calibration">Grinder Dial-in / Espresso Calibration</option>
                  <option value="Quality Rejection">Quality / Taste Rejection</option>
                  <option value="Burnt / Kitchen Error">Kitchen Overcook / Error</option>
                  <option value="Damaged Packaging">Damaged Container / Packaging</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                  Additional Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Milk carton dropped during morning rush"
                  value={wasteForm.notes}
                  onChange={e => setWasteForm({ ...wasteForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setWasteItem(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid #d4c8bc',
                    background: '#fff',
                    color: '#6b5c51',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#b91c1c',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Record Wastage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: ADD RECIPE INGREDIENT ===================== */}
      {showAddRecipeModal && selectedMenuItem && (
        <div className="modal-backdrop" onClick={() => setShowAddRecipeModal(false)}>
          <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FAF6F0', display: 'grid', placeItems: 'center', color: '#EA7A33' }}>
                  <Coffee size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#1A120C' }}>Add Ingredient to Recipe</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#7a6a5d' }}>
                    Map a raw material to {selectedMenuItem.name}
                  </p>
                </div>
              </div>
              <button className="modal-close-icon" onClick={() => setShowAddRecipeModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddRecipeItem} style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                  Select Raw Ingredient *
                </label>
                <select
                  required
                  value={recipeForm.inventoryItemId}
                  onChange={e => {
                    const found = inventoryItems.find(i => i.id === e.target.value);
                    const defaultUnit = found?.unit === 'kg' ? 'g' : found?.unit === 'L' ? 'ml' : (found?.unit || 'g');
                    setRecipeForm({
                      ...recipeForm,
                      inventoryItemId: e.target.value,
                      unit: defaultUnit
                    });
                  }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                >
                  <option value="">-- Choose ingredient --</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category}) - In stock: {item.currentStock} {item.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                    Quantity Required *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 18"
                    value={recipeForm.quantityRequired}
                    onChange={e => setRecipeForm({ ...recipeForm, quantityRequired: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#332211', marginBottom: 4 }}>
                    Unit *
                  </label>
                  <select
                    value={recipeForm.unit}
                    onChange={e => setRecipeForm({ ...recipeForm, unit: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d4c8bc', fontSize: 13 }}
                  >
                    <option value="g">g (Grams)</option>
                    <option value="kg">kg (Kilograms)</option>
                    <option value="ml">ml (Millilitres)</option>
                    <option value="L">L (Litres)</option>
                    <option value="pcs">pcs (Pieces)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setShowAddRecipeModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid #d4c8bc',
                    background: '#fff',
                    color: '#6b5c51',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#EA7A33',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Save Ingredient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

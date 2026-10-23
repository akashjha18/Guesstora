import React, { useState, useEffect } from 'react';
import {
  Receipt,
  FileText,
  Database,
  Settings,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  Building,
  CreditCard,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  Plus,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Percent,
  Check,
  Shield,
  Layers,
  ArrowRightLeft,
  Calendar,
  Sparkles,
  HelpCircle,
  Sliders,
  DollarSign,
  Tag
} from 'lucide-react';
import { api, BASE } from '../api';

export default function GstTallyManager({ cafe, token }) {
  const [activeSubTab, setActiveSubTab] = useState('invoices'); // 'invoices' | 'gstr' | 'tally' | 'hsn' | 'settings'
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  // --- Sub-Tab 1: GST Invoices State ---
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [filterB2B, setFilterB2B] = useState('all'); // 'all' | 'b2b' | 'b2c'
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [targetOrderForIssue, setTargetOrderForIssue] = useState(null);
  const [issueGstin, setIssueGstin] = useState('');
  const [issueLegalName, setIssueLegalName] = useState('');
  const [issuingInvoice, setIssuingInvoice] = useState(false);

  // --- Sub-Tab 2: GSTR-1 & GSTR-3B State ---
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().slice(0, 10);
  });
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [gstr1Data, setGstr1Data] = useState(null);
  const [gstr3bData, setGstr3bData] = useState(null);
  const [reportType, setReportType] = useState('gstr1'); // 'gstr1' | 'gstr3b'
  const [loadingReports, setLoadingReports] = useState(false);

  // --- Sub-Tab 3: Tally ERP 9 / Prime Sync State ---
  const [tallyStartDate, setTallyStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [tallyEndDate, setTallyEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exportingTally, setExportingTally] = useState(false);

  // --- Sub-Tab 4: Menu Items HSN / Tax Master State ---
  const [menuItems, setMenuItems] = useState([]);
  const [hsnSearch, setHsnSearch] = useState('');
  const [editingItemHsn, setEditingItemHsn] = useState(null);
  const [editHsnCode, setEditHsnCode] = useState('996331');
  const [editGstRate, setEditGstRate] = useState(5.0);
  const [editTaxExempt, setEditTaxExempt] = useState(false);
  const [savingHsn, setSavingHsn] = useState(false);

  // --- Sub-Tab 5: GST Configuration State ---
  const [gstConfig, setGstConfig] = useState({
    gstin: '',
    legalBusinessName: '',
    stateCode: '27',
    stateName: 'Maharashtra',
    gstCompositionScheme: false,
    gstEnabled: true,
    taxInclusivePricing: true,
    defaultGstRate: 5.0,
    tallyCompany: '',
    tallySalesLedger: 'Food & Beverage Sales',
    tallyCgstLedger: 'CGST Output 2.5%',
    tallySgstLedger: 'SGST Output 2.5%',
    tallyIgstLedger: 'IGST Output 5%',
    invoicePrefix: 'GST-2627/',
    nextInvoiceSeq: 1,
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const showNotification = (msg, isErr = false) => {
    setNotice({ text: msg, isErr });
    setTimeout(() => setNotice(null), 4500);
  };

  useEffect(() => {
    fetchGstConfig();
    fetchOrdersList();
  }, [cafe?.id]);

  useEffect(() => {
    if (activeSubTab === 'gstr') {
      fetchTaxReports();
    } else if (activeSubTab === 'hsn') {
      fetchMenuItemsHsn();
    } else if (activeSubTab === 'invoices') {
      fetchOrdersList();
    }
  }, [activeSubTab, filterB2B, reportStartDate, reportEndDate]);

  /* =========================================================================
     API Integrations
     ========================================================================= */

  const fetchGstConfig = async () => {
    try {
      setLoading(true);
      const res = await api('/owner/gst/config');
      if (res) {
        setGstConfig(res);
      }
    } catch (err) {
      console.error('Error fetching GST config:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveGstConfig = async (e) => {
    if (e) e.preventDefault();
    try {
      setSavingConfig(true);
      const res = await api('/owner/gst/config', {
        method: 'PUT',
        body: JSON.stringify(gstConfig),
      });
      showNotification(res.message || 'GST configuration saved successfully');
      if (res.config) setGstConfig(res.config);
    } catch (err) {
      showNotification(err.message || 'Failed to save GST configuration', true);
    } finally {
      setSavingConfig(false);
    }
  };

  const fetchOrdersList = async () => {
    try {
      setLoading(true);
      const b2bQuery = filterB2B === 'b2b' ? '&isB2B=true' : filterB2B === 'b2c' ? '&isB2B=false' : '';
      const searchQuery = invoiceSearch ? `&search=${encodeURIComponent(invoiceSearch)}` : '';
      const res = await api(`/owner/gst/orders?limit=100${b2bQuery}${searchQuery}`);
      setOrders(res.orders || []);
      setOrdersTotal(res.total || 0);
    } catch (err) {
      console.error('Error fetching GST orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const openInvoiceView = async (orderId) => {
    try {
      setLoading(true);
      const invoiceData = await api(`/owner/gst/orders/${orderId}/invoice`);
      setSelectedInvoice(invoiceData);
      setInvoiceModalOpen(true);
    } catch (err) {
      showNotification(err.message || 'Failed to fetch tax invoice details', true);
    } finally {
      setLoading(false);
    }
  };

  const openIssueModal = (order) => {
    setTargetOrderForIssue(order);
    setIssueGstin(order.customerGstin || '');
    setIssueLegalName(order.customerLegalName || order.customerName || '');
    setIssueModalOpen(true);
  };

  const handleIssueInvoice = async (e) => {
    e.preventDefault();
    if (!targetOrderForIssue) return;

    try {
      setIssuingInvoice(true);
      const res = await api(`/owner/gst/orders/${targetOrderForIssue.id}/issue-invoice`, {
        method: 'POST',
        body: JSON.stringify({
          customerGstin: issueGstin.trim() || null,
          customerLegalName: issueLegalName.trim() || null,
        }),
      });

      showNotification(`Tax Invoice ${res.invoiceNumber} successfully issued!`);
      setIssueModalOpen(false);
      fetchOrdersList();
      // Optionally open the newly issued invoice
      openInvoiceView(targetOrderForIssue.id);
    } catch (err) {
      showNotification(err.message || 'Failed to issue tax invoice', true);
    } finally {
      setIssuingInvoice(false);
    }
  };

  const fetchTaxReports = async () => {
    try {
      setLoadingReports(true);
      const [gstr1Res, gstr3bRes] = await Promise.all([
        api(`/owner/gst/reports/gstr1?startDate=${reportStartDate}&endDate=${reportEndDate}`),
        api(`/owner/gst/reports/gstr3b?startDate=${reportStartDate}&endDate=${reportEndDate}`),
      ]);
      setGstr1Data(gstr1Res);
      setGstr3bData(gstr3bRes);
    } catch (err) {
      console.error('Error fetching tax reports:', err);
      showNotification('Failed to load tax returns data', true);
    } finally {
      setLoadingReports(false);
    }
  };

  const downloadGstr1Csv = () => {
    const url = `${BASE}/owner/gst/reports/gstr1?startDate=${reportStartDate}&endDate=${reportEndDate}&format=csv&token=${token}`;
    window.open(url, '_blank');
  };

  const downloadTallyXml = () => {
    try {
      setExportingTally(true);
      const url = `${BASE}/owner/gst/export/tally?startDate=${tallyStartDate}&endDate=${tallyEndDate}&token=${token}`;
      window.open(url, '_blank');
      showNotification('Tally Sales Voucher XML downloaded successfully!');
    } catch (err) {
      showNotification('Failed to download Tally XML', true);
    } finally {
      setTimeout(() => setExportingTally(false), 2000);
    }
  };

  const fetchMenuItemsHsn = async () => {
    try {
      setLoading(true);
      const res = await api('/owner/gst/menu-items');
      setMenuItems(res.items || []);
    } catch (err) {
      console.error('Error fetching menu items:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveItemHsn = async (e) => {
    e.preventDefault();
    if (!editingItemHsn) return;

    try {
      setSavingHsn(true);
      await api(`/owner/gst/menu-items/${editingItemHsn.id}/hsn`, {
        method: 'PUT',
        body: JSON.stringify({
          hsnCode: editHsnCode.trim(),
          gstRate: Number(editGstRate),
          taxExempt: editTaxExempt,
        }),
      });

      showNotification('Menu item GST & HSN updated successfully');
      setEditingItemHsn(null);
      fetchMenuItemsHsn();
    } catch (err) {
      showNotification(err.message || 'Failed to update item HSN', true);
    } finally {
      setSavingHsn(false);
    }
  };

  // Quick stats computed from fetched orders
  const totalTaxCalculated = orders.reduce((sum, o) => sum + (Number(o.totalTax) || 0), 0);
  const totalTaxableCalculated = orders.reduce((sum, o) => sum + (Number(o.taxableAmount) || 0), 0);
  const b2bInvoicesCount = orders.filter(o => o.isB2B).length;

  return (
    <div className="gst-tally-container" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: '#111827' }}>
      {/* 1. Header Banner */}
      <div className="crm-orders-header-card" style={{ marginBottom: 24 }}>
        <div className="crm-orders-header-left">
          <div className="crm-orders-brand-emblem">
            <Receipt size={24} color="#ffffff" />
          </div>
          <div className="crm-orders-brand-info">
            <div className="crm-orders-title-row">
              <h1 className="crm-orders-title">
                Indian GST Invoicing & Tally ERP Sync
              </h1>
              <span className="crm-orders-live-badge">
                <span className="crm-orders-live-pulse" />
                GSTN COMPLIANT
              </span>
            </div>
            <p className="crm-orders-subtitle">
              Full GSTN regulatory compliance, SAC/HSN Table 12, GSTR-1/3B audit summaries & Tally Prime XML import.
            </p>
          </div>
        </div>

        {/* Cafe GST Profile Badge */}
        <div className="gst-profile-badge" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          background: 'rgba(255, 255, 255, 0.12)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          padding: '10px 18px',
          borderRadius: '12px',
          color: '#ffffff'
        }}>
          <div className="gst-profile-details">
            <div className="gst-profile-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#86efac', fontWeight: 700 }}>
              Registered GSTIN
            </div>
            <div className="gst-profile-value" style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>
              {gstConfig.gstin || '27AABCU9603R1ZM'}
            </div>
            <div className="gst-profile-state" style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)' }}>
              State Code: {gstConfig.stateCode || '27'} ({gstConfig.stateName || 'Maharashtra'})
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveSubTab('settings')}
            className="crm-btn-secondary"
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Settings size={14} />
            <span>Config</span>
          </button>
        </div>
      </div>

      {/* Notice Toast */}
      {notice && (
        <div style={{
          background: notice.isErr ? '#ef4444' : '#10b981',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          animation: 'fadeIn 0.3s ease'
        }}>
          {notice.isErr ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* 2. Sub-Tabs Bar */}
      <div style={{
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        marginBottom: '24px'
      }}>
        {[
          { id: 'invoices', label: 'Tax Invoices & B2B Billing', icon: Receipt },
          { id: 'gstr', label: 'GSTR-1 & GSTR-3B Returns', icon: FileSpreadsheet },
          { id: 'tally', label: 'Tally ERP 9 / Prime Sync', icon: Database },
          { id: 'hsn', label: 'HSN & Tax Master', icon: Tag },
          { id: 'settings', label: 'GST Configuration', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: isActive ? '700' : '500',
                background: isActive ? '#176B50' : '#ffffff',
                color: isActive ? '#ffffff' : '#4b5563',
                border: isActive ? '1px solid #176B50' : '1px solid #e5e7eb',
                boxShadow: isActive ? '0 4px 12px rgba(23, 107, 80, 0.25)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          SUB-TAB 1: TAX INVOICES & B2B BILLING
          ========================================================================= */}
      {activeSubTab === 'invoices' && (
        <div>
          {/* Quick Stat Highlights */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Total Invoices Recorded</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>{ordersTotal}</div>
              <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px', fontWeight: 600 }}>B2B Corporate: {b2bInvoicesCount}</div>
            </div>

            <div style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Taxable Sales Turnover</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#176B50' }}>
                ₹{totalTaxableCalculated.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Net of GST Base</div>
            </div>

            <div style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Total GST Collected</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669' }}>
                ₹{totalTaxCalculated.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>CGST + SGST + IGST Output</div>
            </div>

            <div style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Next Sequential Invoice #</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#d97706', fontFamily: 'monospace' }}>
                {gstConfig.invoicePrefix}{String(gstConfig.nextInvoiceSeq).padStart(4, '0')}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Automated sequential counter</div>
            </div>
          </div>

          {/* Table Controls (Search & Filters) */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {['all', 'b2b', 'b2c'].map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterB2B(f)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: filterB2B === f ? 700 : 500,
                    background: filterB2B === f ? '#176B50' : '#ffffff',
                    color: filterB2B === f ? '#ffffff' : '#4b5563',
                    border: filterB2B === f ? '1px solid #176B50' : '1px solid #d1d5db',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  {f === 'all' ? 'All Orders' : f === 'b2b' ? 'B2B GSTIN Only' : 'B2C Retail'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
                <input
                  type="text"
                  placeholder="Search Order / Invoice / GSTIN..."
                  value={invoiceSearch}
                  onChange={e => setInvoiceSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') fetchOrdersList(); }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '8px 12px 8px 34px',
                    fontSize: '13px',
                    color: '#111827',
                    width: '260px'
                  }}
                />
              </div>
              <button
                type="button"
                onClick={fetchOrdersList}
                style={{
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  color: '#374151',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Orders / Invoices Table */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                  <th style={{ padding: '14px 16px' }}>Invoice / Order #</th>
                  <th style={{ padding: '14px 16px' }}>Date</th>
                  <th style={{ padding: '14px 16px' }}>Customer & GSTIN</th>
                  <th style={{ padding: '14px 16px' }}>Type</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Taxable Val</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>CGST / SGST</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Total Bill</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '36px', textAlign: 'center', color: '#6b7280' }}>
                      No GST invoices matching criteria found.
                    </td>
                  </tr>
                ) : (
                  orders.map(order => {
                    const isB2B = Boolean(order.isB2B);
                    const invNo = order.invoiceNumber || order.orderNo;
                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>{invNo}</div>
                          {order.invoiceNumber && (
                            <span style={{ fontSize: '10px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              Tax Invoice Issued
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#6b7280' }}>
                          {new Date(order.invoiceDate || order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>
                            {order.customerLegalName || order.customerName || 'Walk-in Diner'}
                          </div>
                          {order.customerGstin ? (
                            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#176B50', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>{order.customerGstin}</span>
                              <span style={{ fontSize: '9px', background: '#e5e7eb', color: '#374151', padding: '1px 4px', borderRadius: '3px' }}>
                                POS: {order.customerStateCode || '27'}
                              </span>
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>B2C Consumer</div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: isB2B ? '#ecfdf5' : '#eff6ff',
                            color: isB2B ? '#059669' : '#2563eb',
                            border: isB2B ? '1px solid #a7f3d0' : '1px solid #bfdbfe'
                          }}>
                            {isB2B ? 'B2B (ITC)' : 'B2C Retail'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#111827' }}>
                          ₹{Number(order.taxableAmount || (order.total / 1.05)).toFixed(2)}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontWeight: 600 }}>
                          {order.isInterState ? (
                            <span>IGST: ₹{Number(order.igstAmount || 0).toFixed(2)}</span>
                          ) : (
                            <span>₹{Number((order.cgstAmount || 0) + (order.sgstAmount || 0)).toFixed(2)}</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>
                          ₹{Number(order.total).toFixed(2)}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => openInvoiceView(order.id)}
                              title="View & Print Official Tax Invoice"
                              style={{
                                background: '#ffffff',
                                border: '1px solid #176B50',
                                color: '#176B50',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                fontWeight: 600
                              }}
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>

                            {!order.invoiceNumber && (
                              <button
                                type="button"
                                onClick={() => openIssueModal(order)}
                                title="Issue Official Tax Invoice with B2B GSTIN"
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #d1d5db',
                                  color: '#374151',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600
                                }}
                              >
                                <Plus size={13} />
                                <span>Issue</span>
                              </button>
                            )}
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
      )}

      {/* =========================================================================
          SUB-TAB 2: GSTR-1 & GSTR-3B RETURNS REPORTING
          ========================================================================= */}
      {activeSubTab === 'gstr' && (
        <div>
          {/* Period Selector & Report Switcher */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setReportType('gstr1')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: reportType === 'gstr1' ? 700 : 500,
                    background: reportType === 'gstr1' ? '#176B50' : '#f3f4f6',
                    color: reportType === 'gstr1' ? '#ffffff' : '#374151',
                    border: reportType === 'gstr1' ? '1px solid #176B50' : '1px solid #d1d5db',
                    cursor: 'pointer'
                  }}
                >
                  GSTR-1 Outward Supplies
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('gstr3b')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: reportType === 'gstr3b' ? 700 : 500,
                    background: reportType === 'gstr3b' ? '#176B50' : '#f3f4f6',
                    color: reportType === 'gstr3b' ? '#ffffff' : '#374151',
                    border: reportType === 'gstr3b' ? '1px solid #176B50' : '1px solid #d1d5db',
                    cursor: 'pointer'
                  }}
                >
                  GSTR-3B Tax Summary
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={15} color="#6b7280" />
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={e => setReportStartDate(e.target.value)}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    color: '#111827',
                    fontSize: '12px'
                  }}
                />
                <span style={{ color: '#6b7280' }}>to</span>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={e => setReportEndDate(e.target.value)}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    color: '#111827',
                    fontSize: '12px'
                  }}
                />
              </div>
            </div>

            {reportType === 'gstr1' && (
              <button
                type="button"
                onClick={downloadGstr1Csv}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                }}
              >
                <Download size={15} />
                <span>Download Table 4 (B2B) CSV</span>
              </button>
            )}
          </div>

          {/* GSTR-1 View */}
          {reportType === 'gstr1' && gstr1Data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Table 4: B2B Invoices</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#176B50', margin: '6px 0' }}>
                    {gstr1Data.table4_b2b?.length || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                    Taxable: ₹{(gstr1Data.table4_b2b?.reduce((s, i) => s + i.taxableValue, 0) || 0).toFixed(2)}
                  </div>
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Table 7: B2C Small Supplies</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb', margin: '6px 0' }}>
                    {gstr1Data.summary?.b2cCount || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                    Taxable: ₹{(gstr1Data.table7_b2c_small?.reduce((s, i) => s + i.taxableValue, 0) || 0).toFixed(2)}
                  </div>
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Taxable Turnover</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: '6px 0' }}>
                    ₹{(gstr1Data.summary?.totalTaxableValue || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#d97706', fontWeight: 600 }}>
                    Total GST: ₹{(gstr1Data.summary?.totalTax || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Table 12: HSN Summary */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
                boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: '#111827' }}>
                  Table 12: HSN/SAC Summary of Outward Supplies
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#4b5563', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '12px 16px' }}>HSN / SAC</th>
                      <th style={{ padding: '12px 16px' }}>Description</th>
                      <th style={{ padding: '12px 16px' }}>UQC</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Qty</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Taxable Value</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>CGST</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>SGST</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>IGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr1Data.table12_hsn?.map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#176B50' }}>
                          {h.hsnCode}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#111827', fontWeight: 600 }}>{h.description}</td>
                        <td style={{ padding: '12px 16px', color: '#6b7280' }}>{h.uqc || 'NOS'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111827' }}>{h.totalQuantity}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#111827' }}>₹{h.taxableValue.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#059669' }}>₹{h.cgstAmount.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#059669' }}>₹{h.sgstAmount.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#2563eb' }}>₹{h.igstAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table 13: Documents Issued */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
                boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: '#111827' }}>
                  Table 13: Documents Issued During the Tax Period
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#4b5563', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '12px 16px' }}>Nature of Document</th>
                      <th style={{ padding: '12px 16px' }}>From Serial No.</th>
                      <th style={{ padding: '12px 16px' }}>To Serial No.</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Number</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Cancelled</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Net Issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr1Data.table13_documents?.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', color: '#111827', fontWeight: 600 }}>{d.natureOfDocument}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#6b7280' }}>{d.fromSerial}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#6b7280' }}>{d.toSerial}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111827' }}>{d.totalNumber}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{d.cancelledNumber}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{d.netIssued}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GSTR-3B View */}
          {reportType === 'gstr3b' && gstr3bData && (
            <div style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>
                GSTR-3B: 3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge
              </h3>

              <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#4b5563', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '12px 16px' }}>Nature of Supplies</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Taxable Value</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Integrated Tax (IGST)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Central Tax (CGST)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>State Tax (SGST)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Tax Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px', color: '#111827', fontWeight: 600 }}>
                        (a) Outward taxable supplies (other than zero rated, nil rated and exempted)
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#111827' }}>
                        ₹{gstr3bData.table3_1_a.taxableValue.toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#2563eb' }}>
                        ₹{gstr3bData.table3_1_a.integratedTax.toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#059669' }}>
                        ₹{gstr3bData.table3_1_a.centralTax.toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#059669' }}>
                        ₹{gstr3bData.table3_1_a.stateTax.toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>
                        ₹{gstr3bData.table3_1_a.totalTaxLiability.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Net Payment Summary Card */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '16px',
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#176B50', fontWeight: 700 }}>Total Net GST Liability</div>
                  <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '2px' }}>
                    Central Tax: ₹{gstr3bData.netPayable.centralTax.toFixed(2)} | State Tax: ₹{gstr3bData.netPayable.stateTax.toFixed(2)}
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#176B50', fontFamily: 'monospace' }}>
                  ₹{gstr3bData.netPayable.totalTaxPayable.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 3: TALLY ERP 9 / TALLY PRIME SYNC
          ========================================================================= */}
      {activeSubTab === 'tally' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
            {/* Export Card */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Database size={20} color="#176B50" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>
                  Tally Prime & Tally ERP 9 Direct XML Export
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5', marginBottom: '20px' }}>
                Export sales vouchers formatted with strict Tally XML schemas. Automatically balances Debits (Cash/Bank) and Credits (Sales + CGST + SGST + IGST) for instant ingestion without manual bookkeeping.
              </p>

              {/* Date Filter */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '8px' }}>
                  Select Sales Date Range:
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="date"
                    value={tallyStartDate}
                    onChange={e => setTallyStartDate(e.target.value)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#111827',
                      fontSize: '13px',
                      flex: 1
                    }}
                  />
                  <input
                    type="date"
                    value={tallyEndDate}
                    onChange={e => setTallyEndDate(e.target.value)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#111827',
                      fontSize: '13px',
                      flex: 1
                    }}
                  />
                </div>
              </div>

              {/* Export Action */}
              <button
                type="button"
                onClick={downloadTallyXml}
                disabled={exportingTally}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #176B50 0%, #123D32 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 16px rgba(23, 107, 80, 0.25)'
                }}
              >
                <Download size={16} />
                <span>{exportingTally ? 'Generating Tally XML...' : 'Download Tally Sales Vouchers XML'}</span>
              </button>
            </div>

            {/* Configured Tally Ledgers Review */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#111827' }}>
                  Target Tally Ledger Accounts
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('settings')}
                  style={{ fontSize: '12px', fontWeight: 600, color: '#176B50', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Settings size={12} />
                  <span>Edit Mappings</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <span style={{ color: '#6b7280' }}>Company Name:</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{gstConfig.tallyCompany || 'GUESTORA Roasters'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <span style={{ color: '#6b7280' }}>Sales Credit Ledger:</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{gstConfig.tallySalesLedger}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <span style={{ color: '#6b7280' }}>CGST 2.5% Ledger:</span>
                  <span style={{ fontWeight: 600, color: '#059669' }}>{gstConfig.tallyCgstLedger}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <span style={{ color: '#6b7280' }}>SGST 2.5% Ledger:</span>
                  <span style={{ fontWeight: 600, color: '#059669' }}>{gstConfig.tallySgstLedger}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <span style={{ color: '#6b7280' }}>IGST 5% Ledger:</span>
                  <span style={{ fontWeight: 600, color: '#2563eb' }}>{gstConfig.tallyIgstLedger}</span>
                </div>
              </div>

              {/* Instructions Guide */}
              <div style={{ marginTop: '20px', padding: '14px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '12px', color: '#1e40af', lineHeight: '1.5' }}>
                <b>How to import into Tally Prime:</b>
                <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li>Open Tally Prime and select company "{gstConfig.tallyCompany || 'GUESTORA Roasters'}".</li>
                  <li>Press <b>Alt + O (Import)</b> &gt; <b>Transactions (Vouchers)</b>.</li>
                  <li>Select the downloaded <code>tally_sales_vouchers.xml</code> file and press Enter.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 4: HSN & TAX MASTER
          ========================================================================= */}
      {activeSubTab === 'hsn' && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', color: '#111827' }}>
                Menu Item HSN / SAC & GST Rates
              </h3>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                Map HSN codes (e.g., 996331 for Food/Beverage dining, 21011120 for packaged retail coffee) and individual tax rates.
              </p>
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '11px', color: '#6b7280' }} />
              <input
                type="text"
                placeholder="Filter items..."
                value={hsnSearch}
                onChange={e => setHsnSearch(e.target.value)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '8px 12px 8px 34px',
                  fontSize: '13px',
                  color: '#111827',
                  width: '240px'
                }}
              />
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: 600 }}>
                  <th style={{ padding: '14px 16px' }}>Item Name</th>
                  <th style={{ padding: '14px 16px' }}>Category</th>
                  <th style={{ padding: '14px 16px' }}>HSN / SAC</th>
                  <th style={{ padding: '14px 16px' }}>GST Rate</th>
                  <th style={{ padding: '14px 16px' }}>Tax Exemption</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {menuItems
                  .filter(i => !hsnSearch || i.name?.toLowerCase().includes(hsnSearch.toLowerCase()))
                  .map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#111827' }}>{item.name}</td>
                      <td style={{ padding: '14px 16px', color: '#6b7280' }}>{item.category}</td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#176B50', fontWeight: 700 }}>
                        {item.hsnCode || '996331'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          background: item.gstRate > 0 ? '#ecfdf5' : '#f3f4f6',
                          color: item.gstRate > 0 ? '#059669' : '#6b7280',
                          border: item.gstRate > 0 ? '1px solid #a7f3d0' : '1px solid #e5e7eb',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '11px'
                        }}>
                          {item.taxExempt ? '0%' : `${item.gstRate}%`}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {item.taxExempt ? (
                          <span style={{ color: '#d97706', fontSize: '12px', fontWeight: 600 }}>Exempted</span>
                        ) : (
                          <span style={{ color: '#6b7280', fontSize: '12px' }}>Standard Tax</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemHsn(item);
                            setEditHsnCode(item.hsnCode || '996331');
                            setEditGstRate(item.gstRate || 5.0);
                            setEditTaxExempt(Boolean(item.taxExempt));
                          }}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #d1d5db',
                            color: '#374151',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          Edit Tax
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 5: GST CONFIGURATION & REGISTRATION
          ========================================================================= */}
      {activeSubTab === 'settings' && (
        <form onSubmit={saveGstConfig} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* GSTIN & Business Details */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Shield size={20} color="#176B50" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>
                GSTIN & Legal Entity Setup
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                  GSTIN (Goods and Services Tax Identification Number) *
                </label>
                <input
                  type="text"
                  value={gstConfig.gstin}
                  onChange={e => setGstConfig({ ...gstConfig, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g. 27AABCU9603R1ZM"
                  maxLength={15}
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#111827',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    fontWeight: 700
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                  Legal Business Name (as per GST Certificate)
                </label>
                <input
                  type="text"
                  value={gstConfig.legalBusinessName}
                  onChange={e => setGstConfig({ ...gstConfig, legalBusinessName: e.target.value })}
                  placeholder="GUESTORA Roasters LLP"
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#111827',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                    State Code (First 2 Digits)
                  </label>
                  <input
                    type="text"
                    value={gstConfig.stateCode}
                    onChange={e => setGstConfig({ ...gstConfig, stateCode: e.target.value })}
                    placeholder="27"
                    maxLength={2}
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#111827',
                      fontSize: '13px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                    State Name
                  </label>
                  <input
                    type="text"
                    value={gstConfig.stateName}
                    onChange={e => setGstConfig({ ...gstConfig, stateName: e.target.value })}
                    placeholder="Maharashtra"
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#111827',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={gstConfig.taxInclusivePricing}
                    onChange={e => setGstConfig({ ...gstConfig, taxInclusivePricing: e.target.checked })}
                    style={{ accentColor: '#176B50', width: '16px', height: '16px' }}
                  />
                  <span><b>Tax-Inclusive Menu Pricing:</b> Menu prices already include 5% GST (Recommended for Indian Dining)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={gstConfig.gstCompositionScheme}
                    onChange={e => setGstConfig({ ...gstConfig, gstCompositionScheme: e.target.checked })}
                    style={{ accentColor: '#176B50', width: '16px', height: '16px' }}
                  />
                  <span>Composition Scheme (Flat rate without tax invoice credit)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Sequential Invoicing & Tally Mappings */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Database size={20} color="#176B50" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>
                Sequential Invoicing & Tally Prime Ledgers
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                    Invoice Prefix
                  </label>
                  <input
                    type="text"
                    value={gstConfig.invoicePrefix}
                    onChange={e => setGstConfig({ ...gstConfig, invoicePrefix: e.target.value })}
                    placeholder="GST-2627/"
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#111827',
                      fontSize: '13px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                    Next Sequence #
                  </label>
                  <input
                    type="number"
                    value={gstConfig.nextInvoiceSeq}
                    onChange={e => setGstConfig({ ...gstConfig, nextInvoiceSeq: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#111827',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                  Tally Company Name
                </label>
                <input
                  type="text"
                  value={gstConfig.tallyCompany}
                  onChange={e => setGstConfig({ ...gstConfig, tallyCompany: e.target.value })}
                  placeholder="GUESTORA Roasters"
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#111827',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                  Tally Sales Ledger
                </label>
                <input
                  type="text"
                  value={gstConfig.tallySalesLedger}
                  onChange={e => setGstConfig({ ...gstConfig, tallySalesLedger: e.target.value })}
                  placeholder="Food & Beverage Sales"
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#111827',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                    CGST Output Ledger (2.5%)
                  </label>
                  <input
                    type="text"
                    value={gstConfig.tallyCgstLedger}
                    onChange={e => setGstConfig({ ...gstConfig, tallyCgstLedger: e.target.value })}
                    placeholder="CGST Output 2.5%"
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#111827',
                      fontSize: '13px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                    SGST Output Ledger (2.5%)
                  </label>
                  <input
                    type="text"
                    value={gstConfig.tallySgstLedger}
                    onChange={e => setGstConfig({ ...gstConfig, tallySgstLedger: e.target.value })}
                    placeholder="SGST Output 2.5%"
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#111827',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <button
                  type="submit"
                  disabled={savingConfig}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #176B50 0%, #123D32 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '14px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(23, 107, 80, 0.25)'
                  }}
                >
                  {savingConfig ? 'Saving Configuration...' : 'Save GST & Tally Configuration'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* =========================================================================
          MODAL: VIEW & PRINT OFFICIAL TAX INVOICE
          ========================================================================= */}
      {invoiceModalOpen && selectedInvoice && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            color: '#111827',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            position: 'relative'
          }}>
            {/* Modal Controls Bar */}
            <div className="no-print" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 24px',
              borderBottom: '1px solid #e5e7eb',
              background: '#f9fafb'
            }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>
                GST Tax Invoice Preview
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    background: '#176B50',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  <Printer size={14} />
                  <span>Print Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  style={{
                    background: '#e5e7eb',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} color="#374151" />
                </button>
              </div>
            </div>

            {/* Printable Invoice Sheet */}
            <div style={{ padding: '36px' }}>
              {/* Header: Seller Details & Tax Invoice Title */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #111827', paddingBottom: '20px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800, color: '#111827' }}>
                    {selectedInvoice.seller.legalName}
                  </h2>
                  <div style={{ fontSize: '13px', color: '#4b5563' }}>{selectedInvoice.seller.tradeName}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{selectedInvoice.seller.address}</div>
                  <div style={{ fontSize: '12px', color: '#111827', fontWeight: 700, marginTop: '4px' }}>
                    GSTIN: {selectedInvoice.seller.gstin}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    State Code: {selectedInvoice.seller.stateCode} ({selectedInvoice.seller.stateName})
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: '#176B50',
                    marginBottom: '8px'
                  }}>
                    TAX INVOICE
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>
                    Invoice No: <span style={{ fontFamily: 'monospace' }}>{selectedInvoice.invoiceNumber}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#4b5563' }}>
                    Date: {new Date(selectedInvoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '12px', color: '#4b5563' }}>
                    POS (Place of Supply): {selectedInvoice.buyer.placeOfSupply}
                  </div>
                </div>
              </div>

              {/* Buyer / Recipient Details */}
              <div style={{
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '14px 18px',
                marginBottom: '24px'
              }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6b7280', fontWeight: 700, marginBottom: '4px' }}>
                  Billed To (Recipient)
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                  {selectedInvoice.buyer.customerLegalName || selectedInvoice.buyer.customerName || 'Walk-in Customer'}
                </div>
                {selectedInvoice.buyer.customerGstin && (
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#176B50', fontFamily: 'monospace', marginTop: '2px' }}>
                    GSTIN: {selectedInvoice.buyer.customerGstin}
                  </div>
                )}
                {selectedInvoice.buyer.phone && (
                  <div style={{ fontSize: '12px', color: '#4b5563' }}>Phone: {selectedInvoice.buyer.phone}</div>
                )}
              </div>

              {/* Line Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '24px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>#</th>
                    <th style={{ padding: '10px 12px' }}>Description of Service / Goods</th>
                    <th style={{ padding: '10px 12px' }}>HSN/SAC</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Taxable Val</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>CGST</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>SGST</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.lineItems.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px 12px' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{item.hsnCode}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{item.price.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{item.taxableAmount.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{item.cgstAmount.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{item.sgstAmount.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                        ₹{(item.taxableAmount + item.cgstAmount + item.sgstAmount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary Breakdown */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                {/* HSN Table 12 Snapshot */}
                <div style={{ width: '55%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: '8px' }}>
                    HSN / SAC Tax Breakup Summary
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', color: '#6b7280', textAlign: 'left' }}>
                        <th style={{ padding: '4px 6px' }}>HSN</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right' }}>Taxable</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right' }}>CGST</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right' }}>SGST</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right' }}>Total Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.hsnSummary.map((h, i) => (
                        <tr key={i}>
                          <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{h.hsnCode}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right' }}>₹{h.taxableValue.toFixed(2)}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right' }}>₹{h.cgstAmount.toFixed(2)}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right' }}>₹{h.sgstAmount.toFixed(2)}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>
                            ₹{(h.cgstAmount + h.sgstAmount + (h.igstAmount || 0)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Final Bill Totals */}
                <div style={{ width: '38%', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#4b5563' }}>Taxable Amount:</span>
                    <span style={{ fontWeight: 600 }}>₹{selectedInvoice.taxDetails.taxableAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#4b5563' }}>CGST (2.5%):</span>
                    <span style={{ fontWeight: 600 }}>₹{selectedInvoice.taxDetails.cgstAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#4b5563' }}>SGST (2.5%):</span>
                    <span style={{ fontWeight: 600 }}>₹{selectedInvoice.taxDetails.sgstAmount.toFixed(2)}</span>
                  </div>
                  {selectedInvoice.taxDetails.igstAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#4b5563' }}>IGST (5%):</span>
                      <span style={{ fontWeight: 600 }}>₹{selectedInvoice.taxDetails.igstAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111827', paddingTop: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800 }}>Invoice Total:</span>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>
                      ₹{selectedInvoice.taxDetails.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Declaration & E-Invoice QR preview */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', maxWidth: '65%' }}>
                  <b>Declaration:</b> We declare that this invoice shows the actual price of the goods or services described and that all particulars are true and correct. Output tax is payable under Section 9 of the CGST Act.
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>For {selectedInvoice.seller.legalName}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '24px' }}>Authorised Signatory</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ISSUE OFFICIAL TAX INVOICE (B2B CAPTURE)
          ========================================================================= */}
      {issueModalOpen && targetOrderForIssue && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            color: '#111827'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Receipt size={20} color="#176B50" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                  Issue Official GST Tax Invoice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIssueModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px', lineHeight: 1.5 }}>
              Assigns sequential Tax Invoice number <b style={{ color: '#111827' }}>{gstConfig.invoicePrefix}{String(gstConfig.nextInvoiceSeq).padStart(4, '0')}</b> to Order #{targetOrderForIssue.orderNo} (Amount: ₹{targetOrderForIssue.total}).
            </p>

            <form onSubmit={handleIssueInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                  Customer GSTIN (Optional for B2B Input Tax Credit)
                </label>
                <input
                  type="text"
                  value={issueGstin}
                  onChange={e => setIssueGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 27AAECU9603R1ZO"
                  maxLength={15}
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#111827',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    fontWeight: 700
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                  Customer Legal Registered Name
                </label>
                <input
                  type="text"
                  value={issueLegalName}
                  onChange={e => setIssueLegalName(e.target.value)}
                  placeholder="Infosys Technologies Ltd"
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#111827',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIssueModalOpen(false)}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    color: '#374151',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issuingInvoice}
                  style={{
                    background: 'linear-gradient(135deg, #176B50 0%, #123D32 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 22px',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(23, 107, 80, 0.25)'
                  }}
                >
                  {issuingInvoice ? 'Issuing Invoice...' : 'Generate Tax Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT MENU ITEM HSN & TAX RATE
          ========================================================================= */}
      {editingItemHsn && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            color: '#111827'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Tag size={20} color="#176B50" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                  Edit Tax: {editingItemHsn.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItemHsn(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveItemHsn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                  HSN / SAC Code (6-8 digits)
                </label>
                <input
                  type="text"
                  value={editHsnCode}
                  onChange={e => setEditHsnCode(e.target.value)}
                  placeholder="996331"
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#111827',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    fontWeight: 700
                  }}
                />
                <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
                  Common: 996331 (Restaurant dining/drinks), 21011120 (Packaged coffee beans)
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>
                  GST Slab Rate (%)
                </label>
                <select
                  value={editGstRate}
                  onChange={e => setEditGstRate(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#111827',
                    fontSize: '13px'
                  }}
                >
                  <option value={0}>0% (Tax Exempt / Nil Rated)</option>
                  <option value={5.0}>5.0% (Standard Restaurant Dining & Beverages)</option>
                  <option value={12.0}>12.0% (Processed Food / Commercial)</option>
                  <option value={18.0}>18.0% (Packaged Luxury & Merchandise)</option>
                  <option value={28.0}>28.0% (Caffeinated / Aerated Drinks)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={editTaxExempt}
                    onChange={e => setEditTaxExempt(e.target.checked)}
                    style={{ accentColor: '#176B50', width: '16px', height: '16px' }}
                  />
                  <span>Mark as Tax-Exempt Item (Zero GST)</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setEditingItemHsn(null)}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    color: '#374151',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingHsn}
                  style={{
                    background: 'linear-gradient(135deg, #176B50 0%, #123D32 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 22px',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(23, 107, 80, 0.25)'
                  }}
                >
                  {savingHsn ? 'Saving...' : 'Update Item Tax'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

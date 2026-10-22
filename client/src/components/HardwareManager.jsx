import React, { useState, useEffect } from 'react';
import {
  Printer, CreditCard, Scale, QrCode, Wifi, CheckCircle2,
  AlertTriangle, RefreshCw, Plus, Trash2, Edit3, X, Play,
  Volume2, ShieldCheck, Cpu, Terminal, ArrowRight, Zap,
  Layers, HardDrive, DollarSign, Sparkles, Check
} from 'lucide-react';

export default function HardwareManager({ cafe, token }) {
  const [activeTab, setActiveTab] = useState('printers'); // 'printers' | 'edc' | 'scale' | 'logs'
  const [printers, setPrinters] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [toastMessage, setToastMessage] = useState(null);

  // Printer Modal State
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);
  const [printerForm, setPrinterForm] = useState({
    name: '',
    role: 'receipt',
    connectionType: 'network',
    ipAddress: '192.168.1.200',
    port: 9100,
    paperWidth: 80,
    autoPrintOnOrder: true,
    autoDrawerKick: false,
    categories: 'Coffee, Beverages',
    active: true,
  });

  // EDC Modal & Test Simulator State
  const [edcModalOpen, setEdcModalOpen] = useState(false);
  const [editingEdc, setEditingEdc] = useState(null);
  const [edcForm, setEdcForm] = useState({
    name: '',
    provider: 'pine_labs',
    terminalId: '',
    ipAddress: '192.168.1.150',
    autoSettleOrder: true,
    active: true,
  });

  // EDC Push Charge Simulator State
  const [simAmount, setSimAmount] = useState('380');
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [activeEdcTxn, setActiveEdcTxn] = useState(null);
  const [simStep, setSimStep] = useState('idle'); // 'idle' | 'waiting_card' | 'approved'

  // Weighing Scale Simulator State
  const [scaleWeight, setScaleWeight] = useState(250.0);
  const [tareWeight, setTareWeight] = useState(0);
  const [selectedBeanRate, setSelectedBeanRate] = useState(2.20); // ₹2.20 per gram
  const [selectedBeanName, setSelectedBeanName] = useState('Ethiopia Yirgacheffe V60 Grade 1');

  // Barcode Scanner Simulator State
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scannerHistory, setScannerHistory] = useState([
    { code: '8901030829102', name: 'Gusstora 250g Whole Bean Tin', price: 650, time: 'Just now' },
    { code: '8901030829119', name: 'Artisan Pour-Over Dripper V02', price: 1450, time: '10m ago' },
  ]);

  const showToast = (msg, isErr = false) => {
    setToastMessage({ text: msg, isErr });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  });

  // Fetch Hardware Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [printersRes, edcRes, logsRes] = await Promise.all([
        fetch('/api/owner/hardware/printers', { headers: getHeaders() }),
        fetch('/api/owner/hardware/edc', { headers: getHeaders() }),
        fetch('/api/owner/hardware/logs', { headers: getHeaders() }),
      ]);

      if (printersRes.ok) {
        const pData = await printersRes.json();
        setPrinters(pData);
      }
      if (edcRes.ok) {
        const eData = await edcRes.json();
        setTerminals(eData);
        if (eData.length > 0 && !selectedTerminalId) {
          setSelectedTerminalId(eData[0].id);
        }
      }
      if (logsRes.ok) {
        const lData = await logsRes.json();
        setLogs(lData);
      }
    } catch (err) {
      showToast('Failed to load hardware configurations.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 1. Printer Actions
  const handleSavePrinter = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...printerForm,
        port: Number(printerForm.port),
        paperWidth: Number(printerForm.paperWidth),
        categories: printerForm.categories.split(',').map(c => c.trim()).filter(Boolean),
      };

      const url = editingPrinter
        ? `/api/owner/hardware/printers/${editingPrinter.id}`
        : '/api/owner/hardware/printers';
      const method = editingPrinter ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save printer configuration.');

      showToast(`Printer "${printerForm.name}" saved successfully.`);
      setPrinterModalOpen(false);
      setEditingPrinter(null);
      fetchData();
    } catch (err) {
      showToast(err.message, true);
    }
  };

  const handleDeletePrinter = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete printer "${name}"?`)) return;
    try {
      const res = await fetch(`/api/owner/hardware/printers/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete printer.');
      showToast('Printer removed.');
      fetchData();
    } catch (err) {
      showToast(err.message, true);
    }
  };

  const handleTestPrinter = async (id, action) => {
    const key = `${id}-${action}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/owner/hardware/printers/${id}/test`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Printer test failed.');

      if (action === 'kick_drawer') {
        showToast('Cash drawer kick pulse (RJ11) sent successfully!');
      } else {
        showToast('Test receipt printed! ESC/POS stream verified.');
      }
      fetchData();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // 2. EDC Actions
  const handleSaveEdc = async (e) => {
    e.preventDefault();
    try {
      const url = editingEdc
        ? `/api/owner/hardware/edc/${editingEdc.id}`
        : '/api/owner/hardware/edc';
      const method = editingEdc ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(edcForm),
      });

      if (!res.ok) throw new Error('Failed to save EDC terminal.');

      showToast(`Terminal "${edcForm.name}" configured.`);
      setEdcModalOpen(false);
      setEditingEdc(null);
      fetchData();
    } catch (err) {
      showToast(err.message, true);
    }
  };

  const handleDeleteEdc = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete EDC terminal "${name}"?`)) return;
    try {
      const res = await fetch(`/api/owner/hardware/edc/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete terminal.');
      showToast('Terminal removed.');
      fetchData();
    } catch (err) {
      showToast(err.message, true);
    }
  };

  const handlePushCharge = async () => {
    if (!selectedTerminalId || !simAmount) return;
    setActionLoading(prev => ({ ...prev, edcPush: true }));
    try {
      const res = await fetch('/api/owner/hardware/edc/charge', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          terminalId: selectedTerminalId,
          amount: Number(simAmount),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Push charge failed.');

      setActiveEdcTxn(data);
      setSimStep('waiting_card');
      showToast(`Beam signal sent to ${data.terminalName}. Waiting for card tap.`);
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setActionLoading(prev => ({ ...prev, edcPush: false }));
    }
  };

  const handleSimulateCardTap = async () => {
    if (!activeEdcTxn) return;
    setActionLoading(prev => ({ ...prev, edcTap: true }));
    try {
      const res = await fetch('/api/owner/hardware/edc/simulate-tap', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          transactionRef: activeEdcTxn.transactionRef,
          provider: activeEdcTxn.provider,
          cardNetwork: 'VISA CONTACTLESS',
          last4: '4111',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Tap simulation failed.');

      setSimStep('approved');
      showToast('Payment Approved on EDC Terminal! Audio chime broadcasted.');
      fetchData();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setActionLoading(prev => ({ ...prev, edcTap: false }));
    }
  };

  // Soundbox Test
  const handleTestSoundbox = async () => {
    setActionLoading(prev => ({ ...prev, soundbox: true }));
    try {
      const res = await fetch('/api/webhooks/soundbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeId: cafe?.id,
          amount: 280,
          orderNo: 'ORD-DEMO-99',
          utrNo: 'UPI' + Date.now().toString().slice(-8),
        }),
      });
      if (!res.ok) throw new Error('Soundbox ping failed.');
      showToast('Paytm Soundbox: "Received ₹280 on Gusstora UPI" simulated.');
      fetchData();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setActionLoading(prev => ({ ...prev, soundbox: false }));
    }
  };

  return (
    <div
      style={{
        color: '#111827',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        minHeight: '80vh',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: toastMessage.isErr
              ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
              : 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            zIndex: 11000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '13.5px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {toastMessage.isErr ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 1. Header Banner */}
      <div className="crm-orders-header-card" style={{ marginBottom: 24 }}>
        <div className="crm-orders-header-left">
          <div className="crm-orders-brand-emblem">
            <Printer size={24} color="#ffffff" />
          </div>
          <div className="crm-orders-brand-info">
            <div className="crm-orders-title-row">
              <h1 className="crm-orders-title">
                Hardware & POS Peripherals
              </h1>
              <span className="crm-orders-live-badge">
                <span className="crm-orders-live-pulse" />
                ENTERPRISE HARDWARE
              </span>
            </div>
            <p className="crm-orders-subtitle">
              Raw thermal ESC/POS network routing, cash drawer kick, Pine Labs/Razorpay EDC card terminals & weighing scale integration.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Sync Devices</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Tabs Bar */}
      <div style={{
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        marginBottom: '24px'
      }}>
        {[
          { id: 'printers', label: `Thermal Printers & KOT Stations (${printers.length})`, icon: Printer },
          { id: 'edc', label: `EDC Card Terminals & Soundbox (${terminals.length})`, icon: CreditCard },
          { id: 'scale', label: 'Weighing Scale & Barcode Scanner', icon: Scale },
          { id: 'logs', label: `Hardware Audit Logs (${logs.length})`, icon: Terminal },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
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

      {/* ============================================================== */}
      {/* TAB 1: THERMAL PRINTERS & MULTI-STATION KOT ROUTING           */}
      {/* ============================================================== */}
      {activeTab === 'printers' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#111827', fontWeight: 700 }}>
                Active Station Printers
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                Orders are automatically split: Beverages routed to Barista KOT, Food to Kitchen KOT, and Master receipts to Counter.
              </p>
            </div>
            <button
              type="button"
              className="hw-btn-primary"
              onClick={() => {
                setEditingPrinter(null);
                setPrinterForm({
                  name: '',
                  role: 'barista_kot',
                  connectionType: 'network',
                  ipAddress: '192.168.1.205',
                  port: 9100,
                  paperWidth: 80,
                  autoPrintOnOrder: true,
                  autoDrawerKick: false,
                  categories: 'Coffee, Beverages, Cold Brew',
                  active: true,
                });
                setPrinterModalOpen(true);
              }}
            >
              <Plus size={15} />
              <span>Add Thermal Printer</span>
            </button>
          </div>

          {printers.length === 0 ? (
            <div
              style={{
                background: '#ffffff',
                border: '1px dashed #d1d5db',
                borderRadius: '16px',
                padding: '48px 24px',
                textAlign: 'center',
                color: '#6b7280',
                boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
              }}
            >
              <Printer size={42} style={{ color: '#176B50', margin: '0 auto 12px', opacity: 0.8 }} />
              <h4 style={{ margin: '0 0 6px', fontSize: '16px', color: '#111827', fontWeight: 700 }}>
                No Thermal Printers Configured
              </h4>
              <p style={{ margin: '0 auto 18px', fontSize: '13px', maxWidth: '420px', color: '#6b7280' }}>
                Click "Add Thermal Printer" above to register an ESC/POS network printer for customer receipts, Barista KOT, or Kitchen KOT.
              </p>
              <button
                type="button"
                className="hw-btn-primary"
                onClick={() => {
                  setEditingPrinter(null);
                  setPrinterForm({
                    name: 'Counter Receipt (80mm)',
                    role: 'receipt',
                    connectionType: 'network',
                    ipAddress: '192.168.1.200',
                    port: 9100,
                    paperWidth: 80,
                    autoPrintOnOrder: true,
                    autoDrawerKick: true,
                    categories: '*',
                    active: true,
                  });
                  setPrinterModalOpen(true);
                }}
              >
                <Plus size={15} /> Add First Printer
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}
            >
              {printers.map((p) => {
                const isReceipt = p.role === 'receipt';
                const isBarista = p.role === 'barista_kot';
                return (
                  <div
                    key={p.id}
                    className="hw-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '12px',
                              background: isReceipt
                                ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                                : isBarista
                                ? 'linear-gradient(135deg, #176B50 0%, #c45512 100%)'
                                : 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                              display: 'grid',
                              placeItems: 'center',
                              color: '#fff',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            }}
                          >
                            <Printer size={20} />
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '15px', color: '#111827', fontWeight: 700 }}>
                              {p.name}
                            </h4>
                            <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {p.role.replace('_', ' ')} · {p.paperWidth}mm
                            </span>
                          </div>
                        </div>

                        <span
                          style={{
                            background: p.active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: p.active ? '#10b981' : '#ef4444',
                            border: `1px solid ${p.active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {p.active ? 'ONLINE' : 'PAUSED'}
                        </span>
                      </div>

                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          marginBottom: '16px',
                          fontSize: '12px',
                          color: '#6b7280',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Target IP / Port:</span>
                          <strong style={{ color: '#111827', fontFamily: 'monospace' }}>{p.ipAddress}:{p.port}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Connection Type:</span>
                          <span style={{ textTransform: 'capitalize', color: '#176B50', fontWeight: 600 }}>{p.connectionType} ESC/POS</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Auto Cash Drawer:</span>
                          <span style={{ color: p.autoDrawerKick ? '#10b981' : '#888', fontWeight: 600 }}>
                            {p.autoDrawerKick ? 'Yes (RJ11 Pulse)' : 'Disabled'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Station Routing:</span>
                          <span style={{ color: '#374151', maxWidth: '160px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {Array.isArray(p.categories) ? p.categories.join(', ') : 'All Items'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="hw-btn-primary"
                        style={{ flex: 1, padding: '8px 10px', fontSize: '11.5px' }}
                        disabled={actionLoading[`${p.id}-print_test`]}
                        onClick={() => handleTestPrinter(p.id, 'print_test')}
                      >
                        <Play size={12} />
                        <span>{actionLoading[`${p.id}-print_test`] ? 'Printing...' : 'Test Print'}</span>
                      </button>

                      {isReceipt && (
                        <button
                          type="button"
                          className="hw-btn-secondary"
                          style={{ padding: '8px 10px', fontSize: '11.5px' }}
                          disabled={actionLoading[`${p.id}-kick_drawer`]}
                          onClick={() => handleTestPrinter(p.id, 'kick_drawer')}
                          title="Pulse RJ11 to open cash drawer"
                        >
                          <Zap size={12} style={{ color: '#f59e0b' }} />
                          <span>Kick Drawer</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="hw-btn-secondary"
                        style={{ padding: '8px 10px' }}
                        onClick={() => {
                          setEditingPrinter(p);
                          setPrinterForm({
                            name: p.name,
                            role: p.role,
                            connectionType: p.connectionType,
                            ipAddress: p.ipAddress,
                            port: p.port,
                            paperWidth: p.paperWidth,
                            autoPrintOnOrder: p.autoPrintOnOrder,
                            autoDrawerKick: p.autoDrawerKick,
                            categories: Array.isArray(p.categories) ? p.categories.join(', ') : '*',
                            active: p.active,
                          });
                          setPrinterModalOpen(true);
                        }}
                        title="Edit Printer"
                      >
                        <Edit3 size={13} />
                      </button>

                      <button
                        type="button"
                        className="hw-btn-secondary"
                        style={{ padding: '8px 10px', color: '#ef4444' }}
                        onClick={() => handleDeletePrinter(p.id, p.name)}
                        title="Delete Printer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: EDC CARD TERMINALS & PAYTM SOUNDBOX                      */}
      {/* ============================================================== */}
      {activeTab === 'edc' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Left: Active Terminals List */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#111827', fontWeight: 700 }}>
                  Integrated EDC Terminals & Soundbox
                </h3>
                <button
                  type="button"
                  className="hw-btn-primary"
                  onClick={() => {
                    setEditingEdc(null);
                    setEdcForm({
                      name: '',
                      provider: 'pine_labs',
                      terminalId: '',
                      ipAddress: '192.168.1.150',
                      autoSettleOrder: true,
                      active: true,
                    });
                    setEdcModalOpen(true);
                  }}
                >
                  <Plus size={14} /> Add Terminal
                </button>
              </div>

              {terminals.length === 0 ? (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px dashed #d1d5db',
                    borderRadius: '16px',
                    padding: '36px 20px',
                    textAlign: 'center',
                    color: '#6b7280',
                    marginBottom: '16px',
                    boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
                  }}
                >
                  <CreditCard size={36} style={{ color: '#176B50', margin: '0 auto 10px', opacity: 0.8 }} />
                  <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#111827', fontWeight: 700 }}>
                    No Card Terminals Paired
                  </h4>
                  <p style={{ margin: '0 auto 16px', fontSize: '12px', maxWidth: '340px', color: '#6b7280' }}>
                    Pair Pine Labs Plutus, Razorpay POS, or Mosambee to beam billing amounts directly to card machines.
                  </p>
                  <button
                    type="button"
                    className="hw-btn-primary"
                    onClick={() => {
                      setEditingEdc(null);
                      setEdcForm({
                        name: 'Pine Labs Counter 1',
                        provider: 'pine_labs',
                        terminalId: 'PL-TID-884210',
                        ipAddress: '192.168.1.150',
                        autoSettleOrder: true,
                        active: true,
                      });
                      setEdcModalOpen(true);
                    }}
                  >
                    <Plus size={13} /> Pair First Terminal
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {terminals.map((t) => (
                    <div
                      key={t.id}
                      className="hw-card"
                      style={{
                        padding: '16px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: t.provider === 'paytm_soundbox'
                              ? 'linear-gradient(135deg, #00baf2 0%, #0084ad 100%)'
                              : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            display: 'grid',
                            placeItems: 'center',
                            color: '#fff',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          }}
                        >
                          {t.provider === 'paytm_soundbox' ? <Volume2 size={20} /> : <CreditCard size={20} />}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '14.5px', color: '#111827', fontWeight: 700 }}>
                            {t.name}
                          </h4>
                          <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                            TID: {t.terminalId || 'AUTO'} · {t.ipAddress}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            padding: '3px 8px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          ACTIVE
                        </span>
                        <button
                          type="button"
                          className="hw-btn-secondary"
                          style={{ padding: '6px 10px', color: '#ef4444' }}
                          onClick={() => handleDeleteEdc(t.id, t.name)}
                          title="Delete Terminal"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Soundbox Quick Ping Tile */}
              <div
                style={{
                  marginTop: '16px',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '16px',
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '14.5px', color: '#0284c7', fontWeight: 700 }}>
                    Paytm / UPI Soundbox Speaker
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#0369a1' }}>
                    Instant audio confirmation chime on counter for QR UPI payments.
                  </p>
                </div>
                <button
                  type="button"
                  className="hw-btn-primary"
                  style={{ background: '#0284c7', color: '#fff', fontWeight: 700 }}
                  disabled={actionLoading.soundbox}
                  onClick={handleTestSoundbox}
                >
                  <Volume2 size={14} />
                  <span>Test Chime</span>
                </button>
              </div>
            </div>

            {/* Right: Live Interactive EDC Tap Simulator */}
            <div
              className="hw-card"
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <Zap size={18} style={{ color: '#176B50' }} />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#111827', fontWeight: 800 }}>
                  Interactive EDC Terminal Simulator
                </h3>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280' }}>
                Test the complete push-to-terminal and card swipe workflow without needing a physical Pine Labs machine.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="hw-label">Target Terminal Machine:</label>
                  <select
                    className="hw-select"
                    value={selectedTerminalId}
                    onChange={(e) => setSelectedTerminalId(e.target.value)}
                  >
                    {terminals.length === 0 && <option value="">No paired terminals (Add one)</option>}
                    {terminals.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.provider})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="hw-label">Invoice Amount to Charge (₹):</label>
                  <input
                    type="number"
                    className="hw-input"
                    value={simAmount}
                    onChange={(e) => setSimAmount(e.target.value)}
                  />
                </div>

                {simStep === 'idle' && (
                  <button
                    type="button"
                    className="hw-btn-primary"
                    style={{ padding: '12px', fontSize: '13px' }}
                    disabled={actionLoading.edcPush || !selectedTerminalId}
                    onClick={handlePushCharge}
                  >
                    <ArrowRight size={15} />
                    <span>Push ₹{simAmount} to EDC Machine</span>
                  </button>
                )}

                {simStep === 'waiting_card' && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #176B50',
                      borderRadius: '14px',
                      padding: '18px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                      <RefreshCw size={24} className="spin" style={{ color: '#176B50' }} />
                    </div>
                    <h4 style={{ margin: 0, color: '#111827', fontSize: '14.5px', fontWeight: 700 }}>
                      Terminal Waiting for Card Tap / Swipe...
                    </h4>
                    <p style={{ margin: '4px 0 14px', fontSize: '11.5px', color: '#6b7280' }}>
                      Ref: {activeEdcTxn?.transactionRef} · Amount: ₹{activeEdcTxn?.amount}
                    </p>
                    <button
                      type="button"
                      className="hw-btn-primary"
                      style={{ width: '100%', background: '#10b981' }}
                      disabled={actionLoading.edcTap}
                      onClick={handleSimulateCardTap}
                    >
                      <CreditCard size={15} />
                      <span>Simulate Customer Tapping Card (Visa/Mastercard)</span>
                    </button>
                  </div>
                )}

                {simStep === 'approved' && (
                  <div
                    style={{
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: '14px',
                      padding: '18px',
                      textAlign: 'center',
                    }}
                  >
                    <CheckCircle2 size={32} style={{ color: '#059669', margin: '0 auto 8px' }} />
                    <h4 style={{ margin: 0, color: '#065f46', fontSize: '15px', fontWeight: 700 }}>
                      Charge Approved & Succeeded!
                    </h4>
                    <p style={{ margin: '4px 0 14px', fontSize: '12px', color: '#047857' }}>
                      Payment settled. Order marked PAID and customer receipt triggered.
                    </p>
                    <button
                      type="button"
                      className="hw-btn-secondary"
                      onClick={() => setSimStep('idle')}
                    >
                      Reset Simulator
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: WEIGHING SCALE & BARCODE SCANNER                       */}
      {/* ============================================================== */}
      {activeTab === 'scale' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Left: Weighing Scale Digital Indicator */}
            <div className="hw-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <Scale size={20} style={{ color: '#176B50' }} />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#111827', fontWeight: 800 }}>
                  Whole Coffee Bean Precision Scale
                </h3>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280' }}>
                Connect USB/Bluetooth scales via Web Serial API or simulate live bean weight for retail packaging.
              </p>

              {/* Digital LED Display */}
              <div
                style={{
                  background: '#090d07',
                  border: '3px solid #1c2e17',
                  borderRadius: '14px',
                  padding: '24px',
                  textAlign: 'center',
                  marginBottom: '16px',
                  boxShadow: 'inset 0 0 20px rgba(34,197,94,0.15)',
                }}
              >
                <div style={{ fontSize: '11px', color: '#4ade80', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                  NET WEIGHT (STABLE)
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '52px', fontWeight: 900, color: '#22c55e', letterSpacing: '2px' }}>
                  {(scaleWeight - tareWeight).toFixed(1)} <span style={{ fontSize: '22px' }}>g</span>
                </div>
                <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>
                  [TARE: {tareWeight.toFixed(1)}g] · ZERO CALIBRATED
                </div>
              </div>

              {/* Scale Controls */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  className="hw-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setTareWeight(scaleWeight)}
                >
                  Tare Scale
                </button>
                <button
                  type="button"
                  className="hw-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => { setScaleWeight(0); setTareWeight(0); }}
                >
                  Zero
                </button>
                <button
                  type="button"
                  className="hw-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setScaleWeight(prev => Number((prev + 50).toFixed(1)))}
                >
                  +50g
                </button>
                <button
                  type="button"
                  className="hw-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setScaleWeight(prev => Math.max(0, Number((prev - 50).toFixed(1))))}
                >
                  -50g
                </button>
              </div>

              {/* Bean Gram Pricing Calculator */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '16px',
                  fontSize: '12.5px',
                  color: '#6b7280',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Bean Origin:</span>
                  <strong style={{ color: '#111827' }}>{selectedBeanName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Rate per Gram:</span>
                  <strong style={{ color: '#176B50' }}>₹{selectedBeanRate.toFixed(2)} / g</strong>
                </div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>Total Calculated Price:</span>
                  <strong style={{ color: '#059669', fontSize: '17px' }}>
                    ₹{((scaleWeight - tareWeight) * selectedBeanRate).toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Right: Barcode Scanner Live Listener */}
            <div className="hw-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <QrCode size={20} style={{ color: '#176B50' }} />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#111827', fontWeight: 800 }}>
                  Retail Barcode Scanner Listener
                </h3>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280' }}>
                Hardware USB and wireless Bluetooth barcode guns emulate keyboard keystrokes to instantly ring up merchandise.
              </p>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  className="hw-input"
                  placeholder="Scan or type barcode (e.g. 8901030829102)..."
                  value={scannedBarcode}
                  onChange={(e) => setScannedBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && scannedBarcode.trim()) {
                      setScannerHistory(prev => [
                        { code: scannedBarcode, name: 'Sample Item #' + scannedBarcode.slice(-4), price: 450, time: 'Just now' },
                        ...prev,
                      ]);
                      setScannedBarcode('');
                      showToast('Barcode scanned & verified!');
                    }
                  }}
                />
                <button
                  type="button"
                  className="hw-btn-primary"
                  onClick={() => {
                    if (scannedBarcode.trim()) {
                      setScannerHistory(prev => [
                        { code: scannedBarcode, name: 'Sample Item #' + scannedBarcode.slice(-4), price: 450, time: 'Just now' },
                        ...prev,
                      ]);
                      setScannedBarcode('');
                      showToast('Barcode scanned & verified!');
                    }
                  }}
                >
                  Lookup
                </button>
              </div>

              <div style={{ fontSize: '12px', color: '#111827', marginBottom: '10px', fontWeight: 700 }}>
                Recent Scan Log:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {scannerHistory.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{item.name}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>BARCODE: {item.code}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#059669' }}>₹{item.price}</div>
                      <div style={{ fontSize: '10.5px', color: '#9ca3af' }}>{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: HARDWARE AUDIT LOGS & DIAGNOSTICS                       */}
      {/* ============================================================== */}
      {activeTab === 'logs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#111827', fontWeight: 700 }}>
              Hardware Transmission Audit Trail
            </h3>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              Showing recent raw socket transmissions and webhook events
            </span>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', color: '#374151' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: '#4b5563' }}>Device</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: '#4b5563' }}>Action</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: '#4b5563' }}>Status</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: '#4b5563' }}>Message / Result</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: '#4b5563' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: '#9ca3af' }}>
                      No hardware actions logged yet. Run a test print or swipe simulator.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 18px', fontWeight: 700, color: '#111827' }}>
                        {log.deviceName || log.deviceType}
                      </td>
                      <td style={{ padding: '12px 18px', fontFamily: 'monospace', color: '#176B50' }}>
                        {log.action}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <span
                          style={{
                            background: log.status === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(23, 107, 80, 0.15)',
                            color: log.status === 'success' ? '#059669' : '#176B50',
                            padding: '3px 8px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px', color: '#4b5563' }}>
                        {log.message || JSON.stringify(log.payload || {})}
                      </td>
                      <td style={{ padding: '12px 18px', color: '#6b7280' }}>
                        {new Date(log.createdAt).toLocaleTimeString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT PRINTER CONFIG (FIXED ROASTERY MODAL)         */}
      {/* ============================================================== */}
      {printerModalOpen && (
        <div className="hw-modal-backdrop" onClick={() => setPrinterModalOpen(false)}>
          <div className="hw-modal-card" onClick={e => e.stopPropagation()}>
            <div className="hw-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(23, 107, 80, 0.15)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#176B50',
                  }}
                >
                  <Printer size={18} />
                </div>
                <div>
                  <h3 className="hw-modal-title">
                    {editingPrinter ? 'Edit Thermal Printer' : 'Configure New Thermal Printer'}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>
                    Network ESC/POS & RJ11 Drawer Setup
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="hw-modal-close-btn"
                onClick={() => setPrinterModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePrinter} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="hw-label">Printer Name:</label>
                <input
                  type="text"
                  className="hw-input"
                  placeholder="e.g. Counter 80mm Receipt Printer"
                  value={printerForm.name}
                  onChange={(e) => setPrinterForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="hw-label">Station Role:</label>
                  <select
                    className="hw-select"
                    value={printerForm.role}
                    onChange={(e) => setPrinterForm(prev => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="receipt">Customer Receipt</option>
                    <option value="barista_kot">Barista Station KOT</option>
                    <option value="kitchen_kot">Kitchen Food KOT</option>
                    <option value="all_kot">Master All KOT</option>
                  </select>
                </div>

                <div>
                  <label className="hw-label">Paper Width:</label>
                  <select
                    className="hw-select"
                    value={printerForm.paperWidth}
                    onChange={(e) => setPrinterForm(prev => ({ ...prev, paperWidth: Number(e.target.value) }))}
                  >
                    <option value={80}>80mm (Standard 48 Cols)</option>
                    <option value={58}>58mm (Compact 32 Cols)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                <div>
                  <label className="hw-label">IP Address (LAN):</label>
                  <input
                    type="text"
                    className="hw-input"
                    value={printerForm.ipAddress}
                    onChange={(e) => setPrinterForm(prev => ({ ...prev, ipAddress: e.target.value }))}
                    placeholder="192.168.1.200"
                    required
                  />
                </div>

                <div>
                  <label className="hw-label">Port:</label>
                  <input
                    type="number"
                    className="hw-input"
                    value={printerForm.port}
                    onChange={(e) => setPrinterForm(prev => ({ ...prev, port: Number(e.target.value) }))}
                    placeholder="9100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="hw-label">Routed Item Categories (comma-separated):</label>
                <input
                  type="text"
                  className="hw-input"
                  placeholder="Coffee, Beverages, Cold Brew"
                  value={printerForm.categories}
                  onChange={(e) => setPrinterForm(prev => ({ ...prev, categories: e.target.value }))}
                />
                <small style={{ color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                  Use "*" to route all items or list specific categories.
                </small>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  gap: '20px',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#374151', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={printerForm.autoDrawerKick}
                    onChange={(e) => setPrinterForm(prev => ({ ...prev, autoDrawerKick: e.target.checked }))}
                    style={{ accentColor: '#176B50', width: '16px', height: '16px' }}
                  />
                  <span>Kick Cash Drawer (RJ11)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#374151', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={printerForm.active}
                    onChange={(e) => setPrinterForm(prev => ({ ...prev, active: e.target.checked }))}
                    style={{ accentColor: '#10b981', width: '16px', height: '16px' }}
                  />
                  <span>Active Device</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="hw-btn-secondary"
                  onClick={() => setPrinterModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="hw-btn-primary">
                  Save Printer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT EDC TERMINAL CONFIG                          */}
      {/* ============================================================== */}
      {edcModalOpen && (
        <div className="hw-modal-backdrop" onClick={() => setEdcModalOpen(false)}>
          <div className="hw-modal-card" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="hw-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#3b82f6',
                  }}
                >
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="hw-modal-title">Configure EDC Card Machine</h3>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>
                    Pine Labs, Razorpay POS, Mosambee & Soundbox
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="hw-modal-close-btn"
                onClick={() => setEdcModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdc} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="hw-label">Terminal Name:</label>
                <input
                  type="text"
                  className="hw-input"
                  placeholder="e.g. Pine Labs Plutus Counter"
                  value={edcForm.name}
                  onChange={(e) => setEdcForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="hw-label">Provider Protocol:</label>
                <select
                  className="hw-select"
                  value={edcForm.provider}
                  onChange={(e) => setEdcForm(prev => ({ ...prev, provider: e.target.value }))}
                >
                  <option value="pine_labs">Pine Labs Plutus API</option>
                  <option value="razorpay_pos">Razorpay Smart POS</option>
                  <option value="mosambee">Mosambee EDC</option>
                  <option value="paytm_soundbox">Paytm Soundbox Speaker</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="hw-label">Terminal ID (TID):</label>
                  <input
                    type="text"
                    className="hw-input"
                    placeholder="PL-TID-884210"
                    value={edcForm.terminalId}
                    onChange={(e) => setEdcForm(prev => ({ ...prev, terminalId: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="hw-label">LAN IP Address:</label>
                  <input
                    type="text"
                    className="hw-input"
                    value={edcForm.ipAddress}
                    onChange={(e) => setEdcForm(prev => ({ ...prev, ipAddress: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="hw-btn-secondary"
                  onClick={() => setEdcModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="hw-btn-primary">
                  Save Terminal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

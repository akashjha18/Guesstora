import React, { useState, useEffect } from 'react';
import {
  Globe,
  Radio,
  Send,
  Building2,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  ExternalLink,
  Plus,
  Play,
  Layers,
  ArrowRightLeft,
  ChevronRight,
  TrendingUp,
  Percent,
  Check,
  Phone,
  MessageSquare,
  Shield,
  Smartphone,
  Sparkles,
  ShoppingBag,
  Store,
  Sliders,
  DollarSign,
  Clock,
  UserCheck
} from 'lucide-react';
import { api, BASE, setAuthSession } from '../api';

export default function OmnichannelManager({ cafe, token, onCafeSwitch }) {
  const [subTab, setSubTab] = useState('channels'); // 'channels' | 'whatsapp' | 'chain'
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  // --- Sub-Tab 1: Channels State ---
  const [channels, setChannels] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simChannel, setSimChannel] = useState('zomato');
  const [simCustomerName, setSimCustomerName] = useState('Ananya Sen');
  const [simCustomerPhone, setSimCustomerPhone] = useState('9876543210');
  const [simRiderName, setSimRiderName] = useState('Rajesh Sharma');
  const [simRiderPhone, setSimRiderPhone] = useState('9811223344');
  const [simItemName, setSimItemName] = useState('Signature Cold Brew');
  const [simItemPrice, setSimItemPrice] = useState('280');
  const [simQuantity, setSimQuantity] = useState('2');
  const [updatingChannel, setUpdatingChannel] = useState(null);

  // --- Sub-Tab 2: WhatsApp Cloud State ---
  const [waConfig, setWaConfig] = useState({
    phoneNumberId: '',
    wabaId: '',
    accessToken: '',
    webhookVerifyToken: '',
    status: 'mock',
    autoOrderConfirmation: true,
    autoOrderReady: true,
    autoLoyaltyAlerts: true
  });
  const [waSaving, setWaSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('9876543210');
  const [testTemplate, setTestTemplate] = useState('order_confirmed');
  const [testingWa, setTestingWa] = useState(false);
  const [waTestResult, setWaTestResult] = useState(null);
  const [waAuditLogs, setWaAuditLogs] = useState([]);

  // --- Sub-Tab 3: Chain / Brand Hierarchy State ---
  const [brandOverview, setBrandOverview] = useState(null);
  const [syncingMenu, setSyncingMenu] = useState(false);
  const [outletModalOpen, setOutletModalOpen] = useState(false);
  const [newOutletName, setNewOutletName] = useState('');
  const [newOutletSlug, setNewOutletSlug] = useState('');
  const [newOutletTables, setNewOutletTables] = useState('12');
  const [creatingOutlet, setCreatingOutlet] = useState(false);
  const [switchingOutletId, setSwitchingOutletId] = useState(null);

  // Initial Data Fetching
  useEffect(() => {
    fetchChannelsData();
    fetchWhatsAppData();
    fetchBrandData();
  }, [cafe?.id]);

  const showNotification = (msg, isErr = false) => {
    setNotice({ text: msg, isErr });
    setTimeout(() => setNotice(null), 4500);
  };

  /* =========================================================================
     1. Delivery Aggregators API Calls
     ========================================================================= */
  const fetchChannelsData = async () => {
    try {
      setLoading(true);
      const res = await api('/owner/channels');
      setChannels(res.channels || []);
      const ordRes = await api('/owner/channels/orders');
      setDeliveryOrders(ordRes.orders || []);
    } catch (err) {
      console.warn('Channels load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateChannel = async (channelKey, patch) => {
    try {
      setUpdatingChannel(channelKey);
      const res = await api(`/owner/channels/${channelKey}`, {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      setChannels(prev => prev.map(c => c.channel === channelKey ? res.channel : c));
      showNotification(`${channelKey.toUpperCase()} settings updated successfully!`);
    } catch (err) {
      showNotification(err.message || 'Failed to update channel', true);
    } finally {
      setUpdatingChannel(null);
    }
  };

  const handleSimulateAggregatorOrder = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const extId = `${simChannel.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const payload = {
        externalOrderId: extId,
        customer: {
          name: simCustomerName,
          phone: simCustomerPhone,
          address: '42, Ocean View Apts, Bandra West'
        },
        rider: {
          name: simRiderName,
          phone: simRiderPhone
        },
        items: [
          {
            name: simItemName,
            price: Number(simItemPrice) || 250,
            quantity: Number(simQuantity) || 1,
            notes: 'Extra hot, zero sugar'
          }
        ],
        subtotal: (Number(simItemPrice) || 250) * (Number(simQuantity) || 1),
        taxes: 25,
        deliveryFee: 40,
        total: ((Number(simItemPrice) || 250) * (Number(simQuantity) || 1)) + 65,
        storeId: `STORE-${cafe?.slug || 'MAIN'}`
      };

      const res = await api(`/webhooks/delivery/${simChannel}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showNotification(`Order ${extId} ingested via ${simChannel.toUpperCase()} webhook! KDS updated.`);
      setSimModalOpen(false);
      fetchChannelsData();
    } catch (err) {
      showNotification(err.message || 'Webhook simulation rejected', true);
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================================
     2. WhatsApp Cloud API Calls
     ========================================================================= */
  const fetchWhatsAppData = async () => {
    try {
      const res = await api('/owner/whatsapp/config');
      if (res.config) {
        setWaConfig(res.config);
      }
    } catch (err) {
      console.warn('WhatsApp config error:', err);
    }
  };

  const handleSaveWhatsAppConfig = async (e) => {
    e.preventDefault();
    try {
      setWaSaving(true);
      const res = await api('/owner/whatsapp/config', {
        method: 'POST',
        body: JSON.stringify(waConfig)
      });
      setWaConfig(res.config);
      showNotification('WhatsApp Cloud API configuration saved!');
    } catch (err) {
      showNotification(err.message || 'Failed to save WhatsApp config', true);
    } finally {
      setWaSaving(false);
    }
  };

  const handleDispatchTestWhatsApp = async () => {
    try {
      setTestingWa(true);
      setWaTestResult(null);
      const res = await api('/owner/whatsapp/test', {
        method: 'POST',
        body: JSON.stringify({
          phone: testPhone,
          templateName: testTemplate
        })
      });
      setWaTestResult(res);
      showNotification(`WhatsApp alert sent via ${res.provider?.toUpperCase()}! Message ID: ${res.messageId}`);
      // Record to local audit log state
      setWaAuditLogs(prev => [
        {
          id: res.messageId,
          phone: testPhone,
          template: testTemplate,
          status: 'delivered',
          timestamp: new Date().toLocaleTimeString(),
          provider: res.provider
        },
        ...prev
      ]);
    } catch (err) {
      showNotification(err.message || 'WhatsApp dispatch test failed', true);
    } finally {
      setTestingWa(false);
    }
  };

  /* =========================================================================
     3. Brand & Multi-Outlet API Calls
     ========================================================================= */
  const fetchBrandData = async () => {
    try {
      const res = await api('/owner/brand');
      setBrandOverview(res);
    } catch (err) {
      console.warn('Brand overview error:', err);
    }
  };

  const handleSyncMasterMenu = async () => {
    if (!window.confirm('Replicate master menu catalogue from this outlet to all sister outlets in the brand chain? Existing items will be synchronized.')) {
      return;
    }
    try {
      setSyncingMenu(true);
      const res = await api('/owner/brand/sync-menu', {
        method: 'POST',
        body: JSON.stringify({ sourceCafeId: cafe?.id })
      });
      showNotification(`Master menu synced: ${res.syncedItemsCount || 0} items replicated across sister outlets.`);
    } catch (err) {
      showNotification(err.message || 'Menu sync failed', true);
    } finally {
      setSyncingMenu(false);
    }
  };

  const handleCreateSisterOutlet = async (e) => {
    e.preventDefault();
    try {
      setCreatingOutlet(true);
      const res = await api('/owner/brand/outlets', {
        method: 'POST',
        body: JSON.stringify({
          name: newOutletName,
          slug: newOutletSlug || newOutletName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          tables: Number(newOutletTables) || 10,
          currency: cafe?.currency || 'INR',
          brandColor: cafe?.brandColor || '#176B50'
        })
      });
      showNotification(`Outlet "${res.outlet.name}" provisioned and linked to brand chain!`);
      setOutletModalOpen(false);
      setNewOutletName('');
      setNewOutletSlug('');
      fetchBrandData();
    } catch (err) {
      showNotification(err.message || 'Failed to create outlet', true);
    } finally {
      setCreatingOutlet(false);
    }
  };

  const handleSwitchOutletContext = async (targetCafeId) => {
    if (targetCafeId === cafe?.id) return;
    try {
      setSwitchingOutletId(targetCafeId);
      const res = await api(`/owner/brand/switch/${targetCafeId}`, {
        method: 'POST'
      });
      if (res.token) {
        setAuthSession({ token: res.token });
        showNotification(`Switched active context to ${res.cafe?.name}! Reloading workspace...`);
        if (onCafeSwitch) {
          onCafeSwitch(res.cafe);
        } else {
          window.location.reload();
        }
      }
    } catch (err) {
      showNotification(err.message || 'Failed to switch outlet context', true);
    } finally {
      setSwitchingOutletId(null);
    }
  };

  return (
    <div className="crm-orders-wrapper" style={{
      padding: '0 0 40px 0',
      color: '#1f2937',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* Toast Notification */}
      {notice && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          padding: '12px 20px',
          borderRadius: 10,
          background: notice.isErr ? '#7F1D1D' : '#14532D',
          border: `1px solid ${notice.isErr ? '#EF4444' : '#22C55E'}`,
          color: '#F1F7F2',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          {notice.isErr ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Main Header Banner - Staff & Roles Theme */}
      <div className="crm-orders-header-card" style={{ marginBottom: 24 }}>
        <div className="crm-orders-header-left">
          <div className="crm-orders-brand-emblem">
            <Globe size={24} style={{ color: '#DCEFE4' }} />
          </div>
          <div className="crm-orders-brand-info">
            <div className="crm-orders-title-row">
              <h2 className="crm-orders-title">Enterprise & Omnichannel Network</h2>
              <span className="crm-orders-live-badge">
                <span className="crm-orders-live-pulse"></span>
                Active Outlet: {cafe?.name || 'Main Roastery'}
              </span>
            </div>
            <p className="crm-orders-subtitle">
              Zomato & Swiggy aggregator sync, automated WhatsApp Cloud API, and multi-outlet roastery chain portal
            </p>
          </div>
        </div>

        {/* Global Action Pills */}
        <div className="crm-orders-header-actions">
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => {
              fetchChannelsData();
              fetchWhatsAppData();
              fetchBrandData();
              showNotification('Enterprise metrics refreshed');
            }}
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation Bar */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 24,
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => setSubTab('channels')}
          style={{
            background: subTab === 'channels' ? '#176B50' : '#ffffff',
            color: subTab === 'channels' ? '#ffffff' : '#4b5563',
            border: subTab === 'channels' ? '1px solid #176B50' : '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: subTab === 'channels' ? '0 4px 12px rgba(23, 107, 80, 0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <ShoppingBag size={16} />
          <span>Delivery Aggregators</span>
          <span style={{
            background: subTab === 'channels' ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
            color: subTab === 'channels' ? '#ffffff' : '#374151',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700
          }}>
            {channels.filter(c => c.status === 'online').length}/3 Online
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('whatsapp')}
          style={{
            background: subTab === 'whatsapp' ? '#176B50' : '#ffffff',
            color: subTab === 'whatsapp' ? '#ffffff' : '#4b5563',
            border: subTab === 'whatsapp' ? '1px solid #176B50' : '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: subTab === 'whatsapp' ? '0 4px 12px rgba(23, 107, 80, 0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <MessageSquare size={16} />
          <span>WhatsApp Cloud API</span>
          <span style={{
            background: subTab === 'whatsapp' ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
            color: subTab === 'whatsapp' ? '#ffffff' : '#374151',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700
          }}>
            {waConfig?.status?.toUpperCase()}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('chain')}
          style={{
            background: subTab === 'chain' ? '#176B50' : '#ffffff',
            color: subTab === 'chain' ? '#ffffff' : '#4b5563',
            border: subTab === 'chain' ? '1px solid #176B50' : '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: subTab === 'chain' ? '0 4px 12px rgba(23, 107, 80, 0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <Building2 size={16} />
          <span>Brand Chain & Sister Outlets</span>
          <span style={{
            background: subTab === 'chain' ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
            color: subTab === 'chain' ? '#ffffff' : '#374151',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700
          }}>
            {brandOverview?.outlets?.length || 1} Outlets
          </span>
        </button>
      </div>

      {/* =========================================================================
         TAB 1: DELIVERY AGGREGATORS (ZOMATO / SWIGGY / URBANPIPER)
         ========================================================================= */}
      {subTab === 'channels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Top Actions Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
                Aggregator Channel Matrix
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                Incoming orders auto-inject into KDS, deplete raw stock, and deduct aggregator commissions.
              </p>
            </div>
            <button
              type="button"
              className="crm-btn-primary"
              onClick={() => setSimModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Play size={15} />
              <span>Simulate Inbound Aggregator Webhook</span>
            </button>
          </div>

          {/* 3 Channels Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20
          }}>
            {channels.map((chan) => {
              const isZomato = chan.channel === 'zomato';
              const isSwiggy = chan.channel === 'swiggy';
              const isUrbanPiper = chan.channel === 'urbanpiper';
              const themeColor = isZomato ? '#E23744' : isSwiggy ? '#FC8019' : '#3B82F6';

              return (
                <div key={chan.id || chan.channel} style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 16,
                  padding: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
                }}>
                  {/* Channel Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: `${themeColor}15`,
                        border: `1.5px solid ${themeColor}30`,
                        display: 'grid',
                        placeItems: 'center',
                        color: themeColor,
                        fontWeight: 800,
                        fontSize: 16
                      }}>
                        {isZomato ? 'Z' : isSwiggy ? 'S' : 'UP'}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                          {chan.channel.toUpperCase()}
                        </h4>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                          Store ID: <code style={{ color: '#176B50', fontWeight: 600 }}>{chan.storeId || `STORE-${cafe?.slug || 'DEMO'}`}</code>
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: chan.status === 'online' ? 'rgba(34, 197, 94, 0.15)' : chan.status === 'paused' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                      color: chan.status === 'online' ? '#16a34a' : chan.status === 'paused' ? '#d97706' : '#6b7280',
                      border: `1px solid ${chan.status === 'online' ? '#22C55E40' : chan.status === 'paused' ? '#EAB30840' : '#d1d5db'}`
                    }}>
                      ● {chan.status}
                    </span>
                  </div>

                  {/* Settings Control Strip */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: 12,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    border: '1px solid #e2e8f0'
                  }}>
                    {/* Status Toggle Switcher */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>Channel State:</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {['online', 'paused', 'offline'].map(st => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleUpdateChannel(chan.channel, { status: st })}
                            disabled={updatingChannel === chan.channel}
                            style={{
                              background: chan.status === st ? themeColor : '#ffffff',
                              color: chan.status === st ? '#ffffff' : '#6b7280',
                              border: `1px solid ${chan.status === st ? themeColor : '#d1d5db'}`,
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              cursor: 'pointer',
                              boxShadow: chan.status === st ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                            }}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Commission Rate */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>Aggregator Commission:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number"
                          defaultValue={chan.commissionRate || 18}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val !== chan.commissionRate) {
                              handleUpdateChannel(chan.channel, { commissionRate: val });
                            }
                          }}
                          style={{
                            width: 58,
                            background: '#ffffff',
                            border: '1px solid #d1d5db',
                            color: '#111827',
                            borderRadius: 6,
                            padding: '4px 8px',
                            textAlign: 'right',
                            fontSize: 12,
                            fontWeight: 700
                          }}
                        />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>%</span>
                      </div>
                    </div>

                    {/* Auto-Accept Orders */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>Auto-Accept to KDS:</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateChannel(chan.channel, { autoAccept: !chan.autoAccept })}
                        style={{
                          background: chan.autoAccept ? '#22C55E15' : '#f3f4f6',
                          color: chan.autoAccept ? '#16a34a' : '#6b7280',
                          border: `1px solid ${chan.autoAccept ? '#22C55E40' : '#d1d5db'}`,
                          borderRadius: 6,
                          padding: '4px 12px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {chan.autoAccept ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>
                  </div>

                  {/* Webhook Endpoint snippet */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px dashed #cbd5e1'
                  }}>
                    <span style={{ color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <code style={{ color: '#0f172a' }}>{`/api/webhooks/delivery/${chan.channel}`}</code>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/delivery/${chan.channel}`);
                        showNotification(`Webhook endpoint copied for ${chan.channel.toUpperCase()}`);
                      }}
                      style={{ background: 'none', border: 'none', color: '#176B50', cursor: 'pointer', padding: 2 }}
                      title="Copy webhook URL"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inbound Delivery Orders Feed */}
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: 24,
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={18} color="#176B50" />
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                  Live Aggregator Order Feed & Commission Ledger
                </h4>
              </div>
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
                {deliveryOrders.length} Recent Aggregator Deliveries
              </span>
            </div>

            {deliveryOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                <ShoppingBag size={36} style={{ color: '#d1d5db', marginBottom: 12 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151' }}>No aggregator orders recorded yet.</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Click "Simulate Inbound Aggregator Webhook" above to trigger a live test order.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '12px 14px' }}>Ext Order #</th>
                      <th style={{ padding: '12px 14px' }}>Channel</th>
                      <th style={{ padding: '12px 14px' }}>Customer / Diner</th>
                      <th style={{ padding: '12px 14px' }}>Rider Info</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Gross Total</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Commission</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Net Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryOrders.map(order => {
                      const comm = order.channelCommission || 0;
                      const net = (order.total || 0) - comm;
                      const isZomato = order.channel === 'zomato';
                      const isSwiggy = order.channel === 'swiggy';
                      const chanColor = isZomato ? '#E23744' : isSwiggy ? '#FC8019' : '#3B82F6';

                      return (
                        <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                            <code style={{ color: '#0f172a' }}>{order.externalOrderId || `#${order.orderNo}`}</code>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: `${chanColor}15`,
                              color: chanColor,
                              textTransform: 'uppercase'
                            }}>
                              {order.channel}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#111827' }}>{order.customerName || 'Delivery Guest'}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{order.phone || 'Phone hidden'}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {order.riderName ? (
                              <div>
                                <div style={{ color: '#111827', fontWeight: 500 }}>{order.riderName}</div>
                                <div style={{ fontSize: 11, color: '#6b7280' }}>{order.riderPhone}</div>
                              </div>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: 11 }}>Assigning rider...</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 10,
                              fontWeight: 700,
                              background: '#22C55E15',
                              color: '#16a34a',
                              textTransform: 'uppercase'
                            }}>
                              {order.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                            ₹{order.total?.toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#dc2626', fontWeight: 500 }}>
                            -₹{comm.toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                            ₹{net.toFixed(2)}
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

      {/* =========================================================================
         TAB 2: WHATSAPP CLOUD API (DIRECT META + DETERMINISTIC MOCK)
         ========================================================================= */}
      {subTab === 'whatsapp' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          {/* Left Column: API Configuration & Automated Triggers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Connection Credentials Form */}
            <form onSubmit={handleSaveWhatsAppConfig} style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 24,
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MessageSquare size={20} color="#16a34a" />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                    Meta WhatsApp Cloud Settings
                  </h3>
                </div>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 12,
                  fontSize: 10,
                  fontWeight: 700,
                  background: waConfig.status === 'active' ? '#22C55E15' : '#EAB30815',
                  color: waConfig.status === 'active' ? '#16a34a' : '#d97706',
                  border: `1px solid ${waConfig.status === 'active' ? '#22C55E40' : '#EAB30840'}`,
                  textTransform: 'uppercase'
                }}>
                  {waConfig.status === 'active' ? '● Live Meta Cloud' : '● Deterministic Simulator'}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>
                  Phone Number ID (Meta Graph API)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 104829104819401"
                  value={waConfig.phoneNumberId || ''}
                  onChange={e => setWaConfig({ ...waConfig, phoneNumberId: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    color: '#111827',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>
                  WhatsApp Business Account (WABA) ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 981248194810291"
                  value={waConfig.wabaId || ''}
                  onChange={e => setWaConfig({ ...waConfig, wabaId: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    color: '#111827',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>
                  System User Access Token
                </label>
                <input
                  type="password"
                  placeholder="EAAG... (Meta Graph Permanent Token)"
                  value={waConfig.accessToken || ''}
                  onChange={e => setWaConfig({ ...waConfig, accessToken: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    color: '#111827',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13
                  }}
                />
                <span style={{ fontSize: 11, color: '#6b7280', marginTop: 4, display: 'block' }}>
                  Leave empty to operate in zero-latency sandbox simulator mode with verified delivery receipts.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>
                  Webhook Verification Token
                </label>
                <input
                  type="text"
                  placeholder="e.g. gusstora_wa_verify_2026"
                  value={waConfig.webhookVerifyToken || ''}
                  onChange={e => setWaConfig({ ...waConfig, webhookVerifyToken: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    color: '#111827',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13
                  }}
                />
              </div>

              {/* Automated Event Triggers */}
              <div style={{
                background: '#f8fafc',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                border: '1px solid #e2e8f0'
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#176B50', textTransform: 'uppercase' }}>
                  Automated Customer Triggers
                </span>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, color: '#1f2937', fontWeight: 500 }}>⚡ Order Confirmation & Receipt</span>
                  <input
                    type="checkbox"
                    checked={waConfig.autoOrderConfirmation !== false}
                    onChange={e => setWaConfig({ ...waConfig, autoOrderConfirmation: e.target.checked })}
                    style={{ accentColor: '#176B50', width: 16, height: 16 }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, color: '#1f2937', fontWeight: 500 }}>🔔 Kitchen Order Ready & Table Alert</span>
                  <input
                    type="checkbox"
                    checked={waConfig.autoOrderReady !== false}
                    onChange={e => setWaConfig({ ...waConfig, autoOrderReady: e.target.checked })}
                    style={{ accentColor: '#176B50', width: 16, height: 16 }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, color: '#1f2937', fontWeight: 500 }}>🎁 Loyalty Reward Unlocked Notification</span>
                  <input
                    type="checkbox"
                    checked={waConfig.autoLoyaltyAlerts !== false}
                    onChange={e => setWaConfig({ ...waConfig, autoLoyaltyAlerts: e.target.checked })}
                    style={{ accentColor: '#176B50', width: 16, height: 16 }}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={waSaving}
                className="crm-btn-primary"
                style={{
                  padding: '12px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                {waSaving ? <RefreshCw size={15} className="spin" /> : <Check size={15} />}
                <span>Save WhatsApp Gateway Config</span>
              </button>
            </form>
          </div>

          {/* Right Column: Live Test Dispatcher & Audit Log */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Live Test Dispatcher Box */}
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 24,
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Send size={18} color="#176B50" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                  Live WhatsApp Dispatcher Simulator
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                Dispatch a real-time transactional WhatsApp message using templated dynamic placeholders.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>
                  Recipient Mobile (10-Digit India)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    padding: '9px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#4b5563'
                  }}>
                    +91
                  </span>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={e => setTestPhone(e.target.value)}
                    placeholder="9876543210"
                    style={{
                      flex: 1,
                      background: '#ffffff',
                      border: '1px solid #d1d5db',
                      color: '#111827',
                      borderRadius: 8,
                      padding: '9px 12px',
                      fontSize: 13
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>
                  Message Template
                </label>
                <select
                  value={testTemplate}
                  onChange={e => setTestTemplate(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    color: '#111827',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13
                  }}
                >
                  <option value="order_confirmed">order_confirmed (Order Placed & Total ₹)</option>
                  <option value="order_ready">order_ready (Kitchen Ready & Table Pickup)</option>
                  <option value="loyalty_reward">loyalty_reward (Free Drink Coupon Code)</option>
                </select>
              </div>

              {/* Template Preview Box */}
              <div style={{
                background: '#f8fafc',
                borderRadius: 8,
                padding: 12,
                border: '1px dashed #cbd5e1',
                fontSize: 12,
                color: '#4b5563',
                lineHeight: 1.5
              }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>Preview: </span>
                {testTemplate === 'order_confirmed' && (
                  <span>☕ Gusstora: Your order #PB-9012 for ₹480 has been placed! Our roastery baristas are brewing it now.</span>
                )}
                {testTemplate === 'order_ready' && (
                  <span>🔔 Hot & Ready! Your order #PB-9012 is ready for Table 4. Enjoy your artisanal brew!</span>
                )}
                {testTemplate === 'loyalty_reward' && (
                  <span>🎉 Congratulations! You unlocked a Free Coffee reward! Show code CLM-ROAST8 to redeem.</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleDispatchTestWhatsApp}
                disabled={testingWa}
                className="crm-btn-primary"
                style={{
                  padding: '11px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                {testingWa ? <RefreshCw size={15} className="spin" /> : <Send size={15} />}
                <span>Send WhatsApp Test Dispatch</span>
              </button>

              {waTestResult && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 12,
                  color: '#166534'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>✓ Dispatched Successfully!</div>
                  <div>Message ID: <code style={{ color: '#14532d' }}>{waTestResult.messageId}</code></div>
                  <div>Mode: <b>{waTestResult.provider?.toUpperCase()}</b></div>
                </div>
              )}
            </div>

            {/* Audit Log Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 24,
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
            }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111827' }}>
                Recent WhatsApp Dispatches
              </h4>
              {waAuditLogs.length === 0 ? (
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  No test dispatches sent during this session.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {waAuditLogs.map((log, idx) => (
                    <div key={idx} style={{
                      background: '#f8fafc',
                      borderRadius: 8,
                      padding: '8px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 11,
                      border: '1px solid #e2e8f0'
                    }}>
                      <div>
                        <b style={{ color: '#111827' }}>+91 {log.phone}</b>
                        <span style={{ color: '#6b7280', marginLeft: 8 }}>{log.template}</span>
                      </div>
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>{log.provider} • {log.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         TAB 3: MULTI-OUTLET BRAND CHAIN HIERARCHY
         ========================================================================= */}
      {subTab === 'chain' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Brand Header Overview */}
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: 24,
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #176B50, #123D32)',
                display: 'grid',
                placeItems: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 20
              }}>
                <Store size={26} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>
                    {brandOverview?.brand?.name || 'Gusstora Roasters Chain'}
                  </h2>
                  <span style={{
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    borderRadius: 20,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 700
                  }}>
                    CHAIN ACTIVE
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  Headquarters: <b style={{ color: '#111827' }}>{brandOverview?.brand?.headquarters || 'Bandra West, Mumbai'}</b> • {brandOverview?.outlets?.length || 1} Outlets Connected
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={handleSyncMasterMenu}
                disabled={syncingMenu}
                style={{
                  background: '#ffffff',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Layers size={15} color="#176B50" />
                <span>{syncingMenu ? 'Syncing...' : 'Sync Master Menu to All Outlets'}</span>
              </button>

              <button
                type="button"
                onClick={() => setOutletModalOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #176B50, #123D32)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(23, 107, 80, 0.25)'
                }}
              >
                <Plus size={15} />
                <span>Add Sister Outlet</span>
              </button>
            </div>
          </div>

          {/* Aggregated Brand Chain Metrics (3 Cards) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 20,
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: 14
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: '#ecfdf5',
                color: '#059669',
                display: 'grid',
                placeItems: 'center'
              }}>
                <DollarSign size={22} />
              </div>
              <div>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Chain Gross Revenue</span>
                <h3 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 800, color: '#111827' }}>
                  ₹{(brandOverview?.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 20,
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: 14
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: '#e6f4ea',
                color: '#176B50',
                display: 'grid',
                placeItems: 'center'
              }}>
                <ShoppingBag size={22} />
              </div>
              <div>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Total Chain Orders</span>
                <h3 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 800, color: '#111827' }}>
                  {brandOverview?.totalOrders || 0}
                </h3>
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 20,
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: 14
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: '#eff6ff',
                color: '#2563eb',
                display: 'grid',
                placeItems: 'center'
              }}>
                <Store size={22} />
              </div>
              <div>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Active Operating Outlets</span>
                <h3 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 800, color: '#111827' }}>
                  {brandOverview?.outlets?.length || 1}
                </h3>
              </div>
            </div>
          </div>

          {/* Outlets Matrix Table */}
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: 24,
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)'
          }}>
            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>
              Outlets Performance & One-Click Context Switch
            </h4>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 14px' }}>Outlet Name</th>
                    <th style={{ padding: '10px 14px' }}>Slug / Domain</th>
                    <th style={{ padding: '10px 14px' }}>Tables</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Revenue</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Orders</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>AOV</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Context</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(brandOverview?.outlets || []).map(ot => {
                    const isActive = ot.id === cafe?.id;
                    const aov = ot.ordersCount > 0 ? (ot.revenue / ot.ordersCount).toFixed(2) : '0.00';

                    return (
                      <tr key={ot.id} style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isActive ? '#f0fdf4' : 'transparent'
                      }}>
                        <td style={{ padding: '14px', fontWeight: 700, color: '#111827' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: isActive ? '#10b981' : '#9ca3af'
                            }} />
                            <span>{ot.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px', color: '#6b7280' }}>
                          <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, color: '#374151' }}>/c/{ot.slug}</code>
                        </td>
                        <td style={{ padding: '14px', color: '#111827' }}>
                          {ot.tables || 10}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                          ₹{ot.revenue?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'right', color: '#6b7280' }}>
                          {ot.ordersCount}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'right', color: '#176B50', fontWeight: 600 }}>
                          ₹{aov}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'center' }}>
                          {isActive ? (
                            <span style={{
                              background: '#ecfdf5',
                              color: '#059669',
                              border: '1px solid #a7f3d0',
                              borderRadius: 20,
                              padding: '2px 10px',
                              fontSize: 10,
                              fontWeight: 800
                            }}>
                              ACTIVE OUTLET
                            </span>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: 11 }}>Sister Outlet</span>
                          )}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'right' }}>
                          {isActive ? (
                            <span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
                              Currently Managing
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSwitchOutletContext(ot.id)}
                              disabled={switchingOutletId === ot.id}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #176B50',
                                color: '#176B50',
                                borderRadius: 6,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6
                              }}
                            >
                              <ArrowRightLeft size={13} />
                              <span>{switchingOutletId === ot.id ? 'Switching...' : 'Switch Outlet'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         SIMULATOR MODAL: INBOUND AGGREGATOR ORDER
         ========================================================================= */}
      {simModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'grid',
          placeItems: 'center',
          padding: 20
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            width: '100%',
            maxWidth: 520,
            padding: 28,
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            color: '#111827'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Play size={20} color="#176B50" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
                  Simulate Delivery Aggregator Order
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSimModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulateAggregatorOrder} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  Delivery Platform
                </label>
                <select
                  value={simChannel}
                  onChange={e => setSimChannel(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    color: '#111827',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13
                  }}
                >
                  <option value="zomato">Zomato (Red)</option>
                  <option value="swiggy">Swiggy (Orange)</option>
                  <option value="urbanpiper">UrbanPiper (Blue)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={simCustomerName}
                    onChange={e => setSimCustomerName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      color: '#111827',
                      borderRadius: 8,
                      padding: '9px 12px',
                      fontSize: 13
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Customer Phone
                  </label>
                  <input
                    type="text"
                    value={simCustomerPhone}
                    onChange={e => setSimCustomerPhone(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      color: '#111827',
                      borderRadius: 8,
                      padding: '9px 12px',
                      fontSize: 13
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Rider Name
                  </label>
                  <input
                    type="text"
                    value={simRiderName}
                    onChange={e => setSimRiderName(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      color: '#111827',
                      borderRadius: 8,
                      padding: '9px 12px',
                      fontSize: 13
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Rider Phone
                  </label>
                  <input
                    type="text"
                    value={simRiderPhone}
                    onChange={e => setSimRiderPhone(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      color: '#111827',
                      borderRadius: 8,
                      padding: '9px 12px',
                      fontSize: 13
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Dish / Drink
                  </label>
                  <input
                    type="text"
                    value={simItemName}
                    onChange={e => setSimItemName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      color: '#111827',
                      borderRadius: 8,
                      padding: '9px 12px',
                      fontSize: 13
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    value={simItemPrice}
                    onChange={e => setSimItemPrice(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      color: '#111827',
                      borderRadius: 8,
                      padding: '9px 12px',
                      fontSize: 13
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Qty
                  </label>
                  <input
                    type="number"
                    value={simQuantity}
                    onChange={e => setSimQuantity(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      color: '#111827',
                      borderRadius: 8,
                      padding: '9px 12px',
                      fontSize: 13
                    }}
                  />
                </div>
              </div>

              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                color: '#6b7280'
              }}>
                Calculated Gross: <b style={{ color: '#111827' }}>₹{((Number(simItemPrice) || 250) * (Number(simQuantity) || 1)) + 65}</b> (incl. tax & fees).
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setSimModalOpen(false)}
                  style={{
                    flex: 1,
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    color: '#374151',
                    borderRadius: 8,
                    padding: '10px',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 2,
                    background: 'linear-gradient(135deg, #176B50, #123D32)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(23, 107, 80, 0.25)'
                  }}
                >
                  Send Inbound Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL: ADD SISTER OUTLET TO BRAND CHAIN
         ========================================================================= */}
      {outletModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'grid',
          placeItems: 'center',
          padding: 20
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            width: '100%',
            maxWidth: 480,
            padding: 28,
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            color: '#111827'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Plus size={20} color="#176B50" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
                  Add Sister Roastery Outlet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOutletModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSisterOutlet} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  Outlet Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Gusstora Express - Airport Terminal 2"
                  value={newOutletName}
                  onChange={e => setNewOutletName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    color: '#111827',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  Custom URL Slug
                </label>
                <input
                  type="text"
                  placeholder="e.g. gusstora-airport-t2"
                  value={newOutletSlug}
                  onChange={e => setNewOutletSlug(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    color: '#111827',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  Number of Dine-In Tables
                </label>
                <input
                  type="number"
                  value={newOutletTables}
                  onChange={e => setNewOutletTables(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #d1d5db',
                    color: '#111827',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setOutletModalOpen(false)}
                  style={{
                    flex: 1,
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    color: '#374151',
                    borderRadius: 8,
                    padding: '10px',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingOutlet}
                  style={{
                    flex: 2,
                    background: 'linear-gradient(135deg, #176B50, #123D32)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(23, 107, 80, 0.25)'
                  }}
                >
                  {creatingOutlet ? 'Provisioning...' : 'Provision Sister Outlet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

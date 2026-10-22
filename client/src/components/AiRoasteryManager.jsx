import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  TrendingUp,
  Brain,
  Coffee,
  Croissant,
  Sun,
  CloudRain,
  Flame,
  Cloud,
  CheckCircle2,
  Clock,
  Users,
  Target,
  Send,
  Plus,
  RefreshCw,
  Sliders,
  DollarSign,
  ArrowUpRight,
  ShieldAlert,
  Percent,
  MessageSquare,
  Gift,
  Search,
  ChevronRight,
  Zap,
  BarChart3,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { BASE } from '../api';

export default function AiRoasteryManager({ cafe, token }) {
  const [activeTab, setActiveTab] = useState('menu-matrix'); // 'menu-matrix', 'prep-forecast', 'affinity-rules', 'winback-agent'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Tab 1: Menu Matrix State
  const [menuMatrix, setMenuMatrix] = useState(null);
  const [matrixFilter, setMatrixFilter] = useState('all'); // 'all', 'star', 'plowhorse', 'puzzle', 'dog'
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simAdjustments, setSimAdjustments] = useState({});
  const [simulationResult, setSimulationResult] = useState(null);

  // Tab 2: Predictive Prep State
  const [prepForecast, setPrepForecast] = useState(null);
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weatherCondition, setWeatherCondition] = useState('Sunny');
  const [isHoliday, setIsHoliday] = useState(false);
  const [acknowledgedStaples, setAcknowledgedStaples] = useState({});

  // Tab 3: Affinity Rules State
  const [affinityRules, setAffinityRules] = useState([]);
  const [miningLoading, setMiningLoading] = useState(false);
  const [selectedUpsellItem, setSelectedUpsellItem] = useState('');
  const [liveUpsellSuggestions, setLiveUpsellSuggestions] = useState([]);

  // Tab 4: Win-Back Campaigns & RFM State
  const [rfmSegments, setRfmSegments] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState('all');
  const [newCampaignModal, setNewCampaignModal] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: 'Churn Win-Back Special',
    campaignType: 'churn_winback',
    targetSegment: 'at_risk',
    channel: 'whatsapp',
    discountPercent: 20,
    customTemplate: '',
  });
  const [sendingBroadcastId, setSendingBroadcastId] = useState(null);
  const [selectedCampaignDetails, setSelectedCampaignDetails] = useState(null);

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  // Load active tab data
  useEffect(() => {
    if (activeTab === 'menu-matrix') {
      fetchMenuMatrix();
    } else if (activeTab === 'prep-forecast') {
      fetchPrepForecast();
    } else if (activeTab === 'affinity-rules') {
      fetchAffinityRules();
    } else if (activeTab === 'winback-agent') {
      fetchRfmAndCampaigns();
    }
  }, [activeTab]);

  function notify(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  // ==========================================================================
  // TAB 1 API CALLS: MENU MATRIX
  // ==========================================================================
  async function fetchMenuMatrix() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${BASE}/owner/ai-roastery/menu-matrix`, { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to load menu matrix analysis');
      const data = await res.json();
      setMenuMatrix(data);

      // Pre-seed simulator with plowhorse items
      const initialAdjustments = {};
      (data.itemsData || []).forEach(item => {
        if (item.classification === 'plowhorse' || item.classification === 'puzzle') {
          initialAdjustments[item.menuItemId] = item.suggestedPrice || item.price;
        } else {
          initialAdjustments[item.menuItemId] = item.price;
        }
      });
      setSimAdjustments(initialAdjustments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runSimulation(newAdjustments) {
    if (!menuMatrix?.itemsData) return;
    try {
      const adjList = Object.entries(newAdjustments).map(([menuItemId, newPrice]) => ({
        menuItemId,
        newPrice: Number(newPrice),
      }));

      const res = await fetch(`${BASE}/owner/ai-roastery/menu-matrix/simulate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          items: menuMatrix.itemsData,
          adjustments: adjList,
        }),
      });
      if (!res.ok) throw new Error('Simulation failed');
      const data = await res.json();
      setSimulationResult(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function applySinglePrice(menuItemId, newPrice) {
    try {
      setLoading(true);
      const res = await fetch(`${BASE}/owner/menu/${menuItemId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ price: Number(newPrice) }),
      });
      if (!res.ok) throw new Error('Failed to update price');
      notify(`Price updated to ₹${newPrice}!`);
      await fetchMenuMatrix();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================================
  // TAB 2 API CALLS: PREDICTIVE PREP & RUSH
  // ==========================================================================
  async function fetchPrepForecast(customDate, customWeather, customHoliday) {
    try {
      setLoading(true);
      setError(null);
      const dateVal = customDate || targetDate;
      const weatherVal = customWeather || weatherCondition;
      const holidayVal = customHoliday !== undefined ? customHoliday : isHoliday;

      const url = `${BASE}/owner/ai-roastery/prep-forecast?targetDate=${dateVal}&weatherCondition=${encodeURIComponent(weatherVal)}&isHoliday=${holidayVal}`;
      const res = await fetch(url, { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch prep forecast');
      const data = await res.json();
      setPrepForecast(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function acknowledgePrepForecast() {
    try {
      setLoading(true);
      const res = await fetch(`${BASE}/owner/ai-roastery/prep-forecast/acknowledge`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          targetDate: prepForecast?.targetDate || targetDate,
          acknowledgedBy: 'Head Barista (AI Verified)',
        }),
      });
      if (!res.ok) throw new Error('Failed to acknowledge prep forecast');
      notify('Morning prep batch acknowledged and locked for service!');
      await fetchPrepForecast();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================================
  // TAB 3 API CALLS: AFFINITY BASKET RULES
  // ==========================================================================
  async function fetchAffinityRules() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${BASE}/owner/ai-roastery/affinity-rules`, { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch affinity rules');
      const data = await res.json();
      setAffinityRules(data.rules || []);

      if (menuMatrix?.itemsData?.length > 0 && !selectedUpsellItem) {
        const first = menuMatrix.itemsData[0];
        setSelectedUpsellItem(first.menuItemId);
        fetchLiveUpsellPreview(first.menuItemId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMineRules() {
    try {
      setMiningLoading(true);
      setError(null);
      const res = await fetch(`${BASE}/owner/ai-roastery/affinity-rules/mine`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ minSupport: 0.01, minConfidence: 0.2 }),
      });
      if (!res.ok) throw new Error('Failed to mine association rules');
      const data = await res.json();
      notify(data.message || 'Apriori rules mined successfully!');
      await fetchAffinityRules();
    } catch (err) {
      setError(err.message);
    } finally {
      setMiningLoading(false);
    }
  }

  async function toggleRuleActive(ruleId, currentStatus) {
    try {
      const res = await fetch(`${BASE}/owner/ai-roastery/affinity-rules/${ruleId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (!res.ok) throw new Error('Failed to toggle rule');
      setAffinityRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive: !currentStatus } : r));
      notify(`Rule ${!currentStatus ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function fetchLiveUpsellPreview(itemId) {
    if (!itemId) return;
    try {
      const res = await fetch(`${BASE}/ai-roastery/upsell?cafeId=${cafe?.id || ''}&itemIds=${itemId}&limit=3`);
      if (!res.ok) return;
      const data = await res.json();
      setLiveUpsellSuggestions(data.suggestions || []);
    } catch (e) {
      console.warn('Upsell preview error:', e);
    }
  }

  // ==========================================================================
  // TAB 4 API CALLS: RFM & AUTONOMOUS GUEST WIN-BACK
  // ==========================================================================
  async function fetchRfmAndCampaigns() {
    try {
      setLoading(true);
      setError(null);
      const [rfmRes, campRes] = await Promise.all([
        fetch(`${BASE}/owner/ai-roastery/rfm-segments`, { headers: authHeaders }),
        fetch(`${BASE}/owner/ai-roastery/campaigns`, { headers: authHeaders }),
      ]);

      if (rfmRes.ok) {
        const rfmData = await rfmRes.json();
        setRfmSegments(rfmData);
      }
      if (campRes.ok) {
        const campData = await campRes.json();
        setCampaigns(campData.campaigns || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCampaign(e) {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${BASE}/owner/ai-roastery/campaigns`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(campaignForm),
      });
      if (!res.ok) throw new Error('Failed to create win-back campaign');
      const data = await res.json();
      notify(`Campaign "${data.campaign.name}" created with code ${data.promoCode}!`);
      setNewCampaignModal(false);
      await fetchRfmAndCampaigns();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunchBroadcast(campaignId) {
    try {
      setSendingBroadcastId(campaignId);
      const res = await fetch(`${BASE}/owner/ai-roastery/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error('Failed to launch broadcast');
      const data = await res.json();
      notify(`Broadcast dispatched to ${data.dispatchedCount} guests successfully!`);
      await fetchRfmAndCampaigns();
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingBroadcastId(null);
    }
  }

  async function viewCampaignDetails(campaignId) {
    try {
      const res = await fetch(`${BASE}/owner/ai-roastery/campaigns/${campaignId}`, { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch campaign details');
      const data = await res.json();
      setSelectedCampaignDetails(data.campaign);
    } catch (err) {
      setError(err.message);
    }
  }

  // Filtered menu items for Tab 1
  const filteredMenuItems = useMemo(() => {
    if (!menuMatrix?.itemsData) return [];
    if (matrixFilter === 'all') return menuMatrix.itemsData;
    return menuMatrix.itemsData.filter(i => i.classification === matrixFilter);
  }, [menuMatrix, matrixFilter]);

  return (
    <div className="ai-roastery-container" style={{ color: '#111827' }}>
      {/* ====================================================================
          TOP BANNER / HEADER
          ==================================================================== */}
      <div
        className="ai-roastery-header"
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          padding: '24px 28px',
          marginBottom: '24px',
          boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #176B50, #047857)',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sparkles size={14} />
                AI ROASTERY INTELLIGENCE
              </div>
              <span style={{ color: '#6b7280', fontSize: '13px' }}>Autonomous Roastery & Menu Operating System</span>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: '#111827' }}>
              Intelligent Roastery & Menu Brain
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
              BCG Menu Matrix, Predictive Prep & Rush Forecasting, Dynamic POS Upselling, and Autonomous Win-Back Agent.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => {
                if (activeTab === 'menu-matrix') fetchMenuMatrix();
                if (activeTab === 'prep-forecast') fetchPrepForecast();
                if (activeTab === 'affinity-rules') fetchAffinityRules();
                if (activeTab === 'winback-agent') fetchRfmAndCampaigns();
              }}
              disabled={loading}
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                color: '#4b5563',
                padding: '10px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              Refresh Intelligence
            </button>
          </div>
        </div>

        {/* Global Alert messages */}
        {error && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              borderRadius: '8px',
              color: '#6ee7b7',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Sub-Tabs Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '20px',
            borderTop: '1px solid #e5e7eb',
            paddingTop: '16px',
            flexWrap: 'wrap',
          }}
        >
          {[
            { id: 'menu-matrix', label: 'Menu Matrix & BCG Matrix', icon: BarChart3, badge: 'Profit Optimizer' },
            { id: 'prep-forecast', label: 'Predictive Prep & Rush Hour', icon: Croissant, badge: 'Batch Advisor' },
            { id: 'affinity-rules', label: 'Smart POS Upsell & Pairs', icon: Zap, badge: 'Apriori Lift' },
            { id: 'winback-agent', label: 'Autonomous Win-Back Agent', icon: Target, badge: 'RFM Retargeting' },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: active ? '#176B50' : '#ffffff',
                  color: active ? '#ffffff' : '#4b5563',
                  border: active ? '1px solid #176B50' : '1px solid #e5e7eb',
                  padding: '8px 18px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                  fontWeight: active ? '700' : '600',
                  transition: 'all 0.2s ease',
                  boxShadow: active ? '0 4px 12px rgba(23, 107, 80, 0.25)' : 'none',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '12px',
                    background: active ? 'rgba(255,255,255,0.25)' : '#f3f4f6',
                    color: active ? '#fff' : '#176B50',
                    fontWeight: '700',
                  }}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ====================================================================
          TAB 1: MENU MATRIX & PROFITABILITY (BCG MATRIX)
          ==================================================================== */}
      {activeTab === 'menu-matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span style={cardLabelStyle}>Menu Health Score</span>
                <Brain size={18} color="#176B50" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '32px', fontWeight: '800', color: '#10b981' }}>
                  {menuMatrix?.healthScore || 85}
                </span>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>/ 100</span>
              </div>
              <span style={{ fontSize: '12px', color: '#6ee7b7', marginTop: '4px' }}>
                High profit density across roastery catalog
              </span>
            </div>

            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span style={cardLabelStyle}>Average Item Margin</span>
                <DollarSign size={18} color="#10b981" />
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#111827' }}>
                ₹{menuMatrix?.averageMargin || 0}
              </div>
              <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Benchmark threshold for Star & Puzzle status
              </span>
            </div>

            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span style={cardLabelStyle}>Analyzed Items</span>
                <BarChart3 size={18} color="#38bdf8" />
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#111827' }}>
                {menuMatrix?.totalItemsAnalyzed || 0}
              </div>
              <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Avg Vol: {menuMatrix?.averageVolume || 0} units / window
              </span>
            </div>

            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span style={cardLabelStyle}>What-If Simulator</span>
                <Sliders size={18} color="#a855f7" />
              </div>
              <button
                onClick={() => {
                  setSimulatorOpen(true);
                  runSimulation(simAdjustments);
                }}
                style={{
                  background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '13px',
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                Launch Price Simulator
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          {/* 4 Quadrants Visual BCG Matrix Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Stars */}
            <div
              style={{
                ...quadrantCardStyle,
                borderLeft: '4px solid #10b981',
                background: matrixFilter === 'star' ? 'rgba(16, 185, 129, 0.1)' : '#ffffff',
              }}
              onClick={() => setMatrixFilter(matrixFilter === 'star' ? 'all' : 'star')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🌟</span>
                  <span style={{ fontWeight: '800', fontSize: '16px', color: '#34d399' }}>STARS</span>
                </div>
                <span style={{ background: '#064e3b', color: '#6ee7b7', padding: '3px 9px', borderRadius: '12px', fontWeight: '700', fontSize: '12px' }}>
                  {menuMatrix?.starsCount || 0} Items
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>High Margin • High Volume</div>
              <div style={{ fontSize: '12px', color: '#d1fae5', lineHeight: '1.4' }}>
                Core revenue anchors. Protect recipe consistency and give top visual placement on QR menu and Dual CFD.
              </div>
            </div>

            {/* Plowhorses */}
            <div
              style={{
                ...quadrantCardStyle,
                borderLeft: '4px solid #f59e0b',
                background: matrixFilter === 'plowhorse' ? 'rgba(245, 158, 11, 0.1)' : '#ffffff',
              }}
              onClick={() => setMatrixFilter(matrixFilter === 'plowhorse' ? 'all' : 'plowhorse')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🐎</span>
                  <span style={{ fontWeight: '800', fontSize: '16px', color: '#fbbf24' }}>PLOWHORSES</span>
                </div>
                <span style={{ background: '#78350f', color: '#fde68a', padding: '3px 9px', borderRadius: '12px', fontWeight: '700', fontSize: '12px' }}>
                  {menuMatrix?.plowhorsesCount || 0} Items
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Low Margin • High Volume</div>
              <div style={{ fontSize: '12px', color: '#fef3c7', lineHeight: '1.4' }}>
                High popularity with profit leak. Ready for +8% to +10% price bump or ingredient cost re-engineering.
              </div>
            </div>

            {/* Puzzles */}
            <div
              style={{
                ...quadrantCardStyle,
                borderLeft: '4px solid #a855f7',
                background: matrixFilter === 'puzzle' ? 'rgba(168, 85, 247, 0.1)' : '#ffffff',
              }}
              onClick={() => setMatrixFilter(matrixFilter === 'puzzle' ? 'all' : 'puzzle')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>❓</span>
                  <span style={{ fontWeight: '800', fontSize: '16px', color: '#c084fc' }}>PUZZLES</span>
                </div>
                <span style={{ background: '#581c87', color: '#e9d5ff', padding: '3px 9px', borderRadius: '12px', fontWeight: '700', fontSize: '12px' }}>
                  {menuMatrix?.puzzlesCount || 0} Items
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>High Margin • Low Volume</div>
              <div style={{ fontSize: '12px', color: '#f3e8ff', lineHeight: '1.4' }}>
                High-profit hidden gems. Feature in cashier POS upsell prompts and dynamic combo pairings to lift volume.
              </div>
            </div>

            {/* Dogs */}
            <div
              style={{
                ...quadrantCardStyle,
                borderLeft: '4px solid #ef4444',
                background: matrixFilter === 'dog' ? 'rgba(239, 68, 68, 0.1)' : '#ffffff',
              }}
              onClick={() => setMatrixFilter(matrixFilter === 'dog' ? 'all' : 'dog')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🐕</span>
                  <span style={{ fontWeight: '800', fontSize: '16px', color: '#f87171' }}>DOGS</span>
                </div>
                <span style={{ background: '#7f1d1d', color: '#fecaca', padding: '3px 9px', borderRadius: '12px', fontWeight: '700', fontSize: '12px' }}>
                  {menuMatrix?.dogsCount || 0} Items
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Low Margin • Low Volume</div>
              <div style={{ fontSize: '12px', color: '#fee2e2', lineHeight: '1.4' }}>
                Underperformers adding prep drag. Prime candidates for menu trimming, ingredient cleanup, or recipe revamp.
              </div>
            </div>
          </div>

          {/* Actionable Insights Panel */}
          {menuMatrix?.actionableInsights?.length > 0 && (
            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <Sparkles size={18} color="#176B50" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>AI Strategic Recommendations</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {menuMatrix.actionableInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#176B50' }}>{insight.title}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: insight.urgency === 'high' ? '#7f1d1d' : '#78350f',
                          color: '#fff',
                        }}
                      >
                        {insight.urgency}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', lineHeight: '1.4' }}>
                      {insight.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items Classification Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                  Menu Item Profitability Ledger ({filteredMenuItems.length})
                </h3>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  Filtered by: <strong style={{ color: '#176B50' }}>{matrixFilter.toUpperCase()}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {['all', 'star', 'plowhorse', 'puzzle', 'dog'].map(filterKey => (
                  <button
                    key={filterKey}
                    onClick={() => setMatrixFilter(filterKey)}
                    style={{
                      background: matrixFilter === filterKey ? '#176B50' : '#ffffff',
                      color: matrixFilter === filterKey ? '#fff' : '#4b5563',
                      border: `1px solid ${matrixFilter === filterKey ? '#176B50' : '#e5e7eb'}`,
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {filterKey}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 18px' }}>Menu Item</th>
                    <th style={{ padding: '12px 18px' }}>Category</th>
                    <th style={{ padding: '12px 18px' }}>Price</th>
                    <th style={{ padding: '12px 18px' }}>Food Cost</th>
                    <th style={{ padding: '12px 18px' }}>Margin %</th>
                    <th style={{ padding: '12px 18px' }}>Volume</th>
                    <th style={{ padding: '12px 18px' }}>Classification</th>
                    <th style={{ padding: '12px 18px' }}>AI Recommended Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMenuItems.map(item => {
                    const isStar = item.classification === 'star';
                    const isPlowhorse = item.classification === 'plowhorse';
                    const isPuzzle = item.classification === 'puzzle';

                    return (
                      <tr key={item.menuItemId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 18px', fontWeight: '700', color: '#111827' }}>
                          {item.name}
                        </td>
                        <td style={{ padding: '12px 18px', color: '#6b7280' }}>{item.category}</td>
                        <td style={{ padding: '12px 18px', fontWeight: '600' }}>₹{item.price}</td>
                        <td style={{ padding: '12px 18px', color: '#f87171' }}>₹{item.foodCost}</td>
                        <td style={{ padding: '12px 18px', color: item.marginPercent >= 70 ? '#34d399' : '#fbbf24', fontWeight: '700' }}>
                          {item.marginPercent}% (₹{item.margin})
                        </td>
                        <td style={{ padding: '12px 18px' }}>{item.volume} sold</td>
                        <td style={{ padding: '12px 18px' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '800',
                              textTransform: 'uppercase',
                              background: isStar ? '#064e3b' : isPlowhorse ? '#78350f' : isPuzzle ? '#581c87' : '#7f1d1d',
                              color: isStar ? '#6ee7b7' : isPlowhorse ? '#fde68a' : isPuzzle ? '#e9d5ff' : '#fecaca',
                            }}
                          >
                            {item.classification}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          {item.recommendations?.[0] ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', color: '#4b5563' }}>
                                {item.recommendations[0].text}
                              </span>
                              {isPlowhorse && item.suggestedPrice && item.suggestedPrice !== item.price && (
                                <button
                                  onClick={() => applySinglePrice(item.menuItemId, item.suggestedPrice)}
                                  style={{
                                    background: '#176B50',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Apply ₹{item.suggestedPrice}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#6ee7b7', fontSize: '12px' }}>Optimal performance</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* WHAT-IF PRICE SIMULATOR MODAL */}
          {simulatorOpen && (
            <div style={modalOverlayStyle}>
              <div style={{ ...modalContentStyle, maxWidth: '850px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sliders size={20} color="#a855f7" />
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
                      What-If Price & Margin Simulator
                    </h3>
                  </div>
                  <button onClick={() => setSimulatorOpen(false)} style={closeBtnStyle}>✕</button>
                </div>

                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                  Simulate price increases across your Plowhorse and Puzzle items. The AI automatically models demand elasticity (-0.35 elasticity) to project your true net monthly profit gain.
                </p>

                {/* Simulation Summary Scorecard */}
                {simulationResult && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Projected Revenue</span>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827', marginTop: '4px' }}>
                        ₹{simulationResult.simulatedRevenue}
                      </div>
                      <span style={{ fontSize: '11px', color: simulationResult.revenueDelta >= 0 ? '#10b981' : '#ef4444' }}>
                        {simulationResult.revenueDelta >= 0 ? '+' : ''}₹{simulationResult.revenueDelta} delta
                      </span>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Projected Net Profit</span>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#176B50', marginTop: '4px' }}>
                        ₹{simulationResult.simulatedProfit}
                      </div>
                      <span style={{ fontSize: '11px', color: '#059669' }}>
                        +{Math.round((simulationResult.profitDelta / (simulationResult.originalProfit || 1)) * 100)}% lift
                      </span>
                    </div>

                    <div style={{ background: '#ecfdf5', padding: '14px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                      <span style={{ fontSize: '11px', color: '#047857', textTransform: 'uppercase', fontWeight: '800' }}>Gross Margin Gain</span>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: '#176B50', marginTop: '4px' }}>
                        +₹{simulationResult.profitDelta}
                      </div>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>Pure bottom-line expansion</span>
                    </div>
                  </div>
                )}

                {/* Adjustment Sliders */}
                <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '6px' }}>
                  {(menuMatrix?.itemsData || [])
                    .filter(i => i.classification === 'plowhorse' || i.classification === 'puzzle')
                    .map(it => {
                      const curPrice = simAdjustments[it.menuItemId] || it.price;
                      return (
                        <div
                          key={it.menuItemId}
                          style={{
                            background: '#f8fafc',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                          }}
                        >
                          <div style={{ flex: '1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: '700', fontSize: '14px' }}>{it.name}</span>
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: it.classification === 'plowhorse' ? '#78350f' : '#581c87',
                                  color: '#fff',
                                }}
                              >
                                {it.classification}
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>
                              Current: ₹{it.price} | Food Cost: ₹{it.foodCost} | Vol: {it.volume}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input
                              type="range"
                              min={Math.max(10, it.price - 20)}
                              max={it.price + 80}
                              step={5}
                              value={curPrice}
                              onChange={e => {
                                const updated = { ...simAdjustments, [it.menuItemId]: Number(e.target.value) };
                                setSimAdjustments(updated);
                                runSimulation(updated);
                              }}
                              style={{ width: '130px', accentColor: '#a855f7' }}
                            />
                            <div style={{ minWidth: '70px', textAlign: 'right' }}>
                              <span style={{ fontSize: '16px', fontWeight: '800', color: '#111827' }}>
                                ₹{curPrice}
                              </span>
                              <div style={{ fontSize: '10px', color: curPrice > it.price ? '#34d399' : '#a89f91' }}>
                                {curPrice > it.price ? `+₹${curPrice - it.price}` : 'unchanged'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => setSimulatorOpen(false)} style={btnSecondaryStyle}>
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setSimulatorOpen(false);
                      notify('Simulation saved to memory. You can apply individual prices from the table.');
                    }}
                    style={btnPrimaryStyle}
                  >
                    Accept Projection
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 2: PREDICTIVE PREP & RUSH HOUR FORECASTING
          ==================================================================== */}
      {activeTab === 'prep-forecast' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Controls Bar */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '18px 24px',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Target Prep Date
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={e => {
                    setTargetDate(e.target.value);
                    fetchPrepForecast(e.target.value, weatherCondition, isHoliday);
                  }}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Weather Condition Modifier
                </label>
                <select
                  value={weatherCondition}
                  onChange={e => {
                    setWeatherCondition(e.target.value);
                    fetchPrepForecast(targetDate, e.target.value, isHoliday);
                  }}
                  style={selectStyle}
                >
                  <option value="Sunny">☀️ Sunny / Warm (High Cold Brew Demand)</option>
                  <option value="High Heat">🔥 High Heat (+25% Iced & Cascara)</option>
                  <option value="Rainy">🌧️ Rainy / Monsoon (+30% Hot Lattes)</option>
                  <option value="Cold">❄️ Cold / Winter (+35% Hot Drinks)</option>
                  <option value="Pleasant">⛅ Pleasant (Normal Distribution)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Holiday / Festival Rush
                </label>
                <button
                  onClick={() => {
                    const nextVal = !isHoliday;
                    setIsHoliday(nextVal);
                    fetchPrepForecast(targetDate, weatherCondition, nextVal);
                  }}
                  style={{
                    background: isHoliday ? '#176B50' : '#ffffff',
                    color: isHoliday ? '#fff' : '#4b5563',
                    border: `1px solid ${isHoliday ? '#176B50' : '#e5e7eb'}`,
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  {isHoliday ? '🎉 Holiday Booster (+25%)' : 'Standard Day'}
                </button>
              </div>
            </div>

            <div>
              <button
                onClick={acknowledgePrepForecast}
                style={{
                  ...btnPrimaryStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} />
                Acknowledge Morning Prep
              </button>
            </div>
          </div>

          {/* Forecast Summary Scorecard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={cardStyle}>
              <span style={cardLabelStyle}>Expected Day Orders</span>
              <div style={{ fontSize: '30px', fontWeight: '800', color: '#111827' }}>
                {prepForecast?.expectedTotalOrders || 0} Orders
              </div>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {prepForecast?.dayOfWeek} Profile
              </span>
            </div>

            <div style={cardStyle}>
              <span style={cardLabelStyle}>Projected Day Revenue</span>
              <div style={{ fontSize: '30px', fontWeight: '800', color: '#10b981' }}>
                ₹{prepForecast?.expectedRevenue || 0}
              </div>
              <span style={{ fontSize: '12px', color: '#6ee7b7' }}>
                Based on historical AOV ₹410
              </span>
            </div>

            <div style={cardStyle}>
              <span style={cardLabelStyle}>Peak Rush Window</span>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#176B50' }}>
                08:30 – 10:30 AM
              </div>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                Morning Caffeine Rush (4 Baristas Recommended)
              </span>
            </div>

            <div style={cardStyle}>
              <span style={cardLabelStyle}>Prep Batch Status</span>
              <div style={{ fontSize: '24px', fontWeight: '800', color: prepForecast?.status === 'acknowledged' ? '#34d399' : '#fbbf24', textTransform: 'capitalize' }}>
                {prepForecast?.status || 'Draft'}
              </div>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {prepForecast?.acknowledgedBy ? `By ${prepForecast.acknowledgedBy}` : 'Pending barista sign-off'}
              </span>
            </div>
          </div>

          {/* Morning Prep Batch Checklist (9 Core Roastery Staples) */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Coffee size={20} color="#176B50" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>
                  Morning Roastery Prep Guide ({prepForecast?.prepRecommendations?.length || 9} Staples)
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: '#6ee7b7', background: '#064e3b', padding: '4px 10px', borderRadius: '12px', fontWeight: '700' }}>
                Includes 12% Safety Stock Buffer
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              {(prepForecast?.prepRecommendations || []).map((prep, idx) => {
                const isChecked = acknowledgedStaples[prep.itemName];
                return (
                  <div
                    key={idx}
                    style={{
                      background: isChecked ? 'rgba(16, 185, 129, 0.08)' : '#f8fafc',
                      border: isChecked ? '1px solid #10b981' : '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '16px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#176B50', fontWeight: '700', textTransform: 'uppercase' }}>
                          {prep.category}
                        </span>
                        <h4 style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: '700', color: '#111827' }}>
                          {prep.itemName}
                        </h4>
                      </div>

                      <div
                        onClick={() => setAcknowledgedStaples(p => ({ ...p, [prep.itemName]: !isChecked }))}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: isChecked ? '#34d399' : '#6b7280',
                        }}
                      >
                        <CheckCircle2 size={20} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0' }}>
                      <span style={{ fontSize: '26px', fontWeight: '800', color: '#111827' }}>
                        {prep.suggestedBatchQty}
                      </span>
                      <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600' }}>{prep.unit}</span>
                      <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: 'auto' }}>
                        (Base: {prep.baseAverage} {prep.unit} + {prep.safetyBufferPercent}%)
                      </span>
                    </div>

                    <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#6b7280', lineHeight: '1.4' }}>
                      💡 {prep.notes}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 24-Hour Hourly Rush Heatmap */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={20} color="#176B50" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>
                  24-Hour Hourly Rush Curve & Staff Allocation
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }} />
                  Rush Peak
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px' }} />
                  Peak
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }} />
                  Moderate
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: '6px', overflowX: 'auto', paddingBottom: '10px' }}>
              {(prepForecast?.hourlyRushHeatmap || []).slice(6, 22).map((slot, idx) => {
                const isRush = slot.rushLevel === 'rush';
                const isPeak = slot.rushLevel === 'peak';
                const isModerate = slot.rushLevel === 'moderate';

                return (
                  <div
                    key={idx}
                    style={{
                      background: '#f8fafc',
                      border: isRush ? '1px solid #ef4444' : isPeak ? '1px solid #f59e0b' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '10px 6px',
                      textAlign: 'center',
                      minWidth: '55px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '700', display: 'block' }}>
                      {slot.label}
                    </span>

                    <div
                      style={{
                        height: '60px',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        margin: '8px 0',
                      }}
                    >
                      <div
                        style={{
                          width: '18px',
                          height: `${Math.min(100, (slot.predictedOrders / 12) * 100)}%`,
                          background: isRush ? '#ef4444' : isPeak ? '#f59e0b' : isModerate ? '#10b981' : '#4b5563',
                          borderRadius: '4px',
                          transition: 'height 0.3s ease',
                        }}
                      />
                    </div>

                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#111827', display: 'block' }}>
                      {slot.predictedOrders}
                    </span>
                    <span style={{ fontSize: '10px', color: '#6b7280', display: 'block' }}>orders</span>

                    <div
                      style={{
                        marginTop: '6px',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        background: '#ecfdf5',
                        fontSize: '10px',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                        fontWeight: '700',
                      }}
                    >
                      {slot.recommendedStaffCount} Staff
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 3: SMART POS UPSELL & AFFINITY PAIRS (APRIORI LIFT)
          ==================================================================== */}
      {activeTab === 'affinity-rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header Action Bar */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '18px 24px',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>
                Market Basket Affinity Rules ({affinityRules.length} Pairs Mined)
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                Apriori association algorithm scans completed orders to surface pairings with Lift &gt; 1.0 for cashiers &amp; QR diners.
              </p>
            </div>

            <button
              onClick={handleMineRules}
              disabled={miningLoading}
              style={{
                ...btnPrimaryStyle,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Zap size={16} className={miningLoading ? 'spin' : ''} />
              {miningLoading ? 'Mining Basket Data...' : 'Mine Fresh Association Rules'}
            </button>
          </div>

          {/* Interactive Live POS Upsell Simulator */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #176B50',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Zap size={18} color="#176B50" />
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#176B50' }}>
                Live POS &amp; Customer CFD Dynamic Upsell Preview
              </h4>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>When cashier rings up / diner taps:</span>
              <select
                value={selectedUpsellItem}
                onChange={e => {
                  setSelectedUpsellItem(e.target.value);
                  fetchLiveUpsellPreview(e.target.value);
                }}
                style={selectStyle}
              >
                {(menuMatrix?.itemsData || []).map(it => (
                  <option key={it.menuItemId} value={it.menuItemId}>
                    {it.name} (₹{it.price})
                  </option>
                ))}
              </select>
            </div>

            {/* Display Simulated Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {liveUpsellSuggestions.map((sug, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ background: '#78350f', color: '#fde68a', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '10px' }}>
                      {sug.badge}
                    </span>
                    <span style={{ color: '#34d399', fontSize: '12px', fontWeight: '700' }}>
                      {sug.lift}x Lift
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                    {sug.name}
                  </h4>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '6px 0' }}>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>
                      ₹{sug.comboPrice}
                    </span>
                    {sug.pairingDiscount > 0 && (
                      <span style={{ fontSize: '12px', color: '#6b7280', textDecoration: 'line-through' }}>
                        ₹{sug.originalPrice}
                      </span>
                    )}
                    {sug.pairingDiscount > 0 && (
                      <span style={{ fontSize: '11px', color: '#6ee7b7' }}>Save ₹{sug.pairingDiscount} combo</span>
                    )}
                  </div>

                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#4b5563', fontStyle: 'italic', background: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    "{sug.pitchText}"
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Association Rules Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                Active Market Basket Rules
              </h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 18px' }}>Primary Trigger Item</th>
                    <th style={{ padding: '12px 18px' }}>Recommended Pair</th>
                    <th style={{ padding: '12px 18px' }}>Support</th>
                    <th style={{ padding: '12px 18px' }}>Confidence</th>
                    <th style={{ padding: '12px 18px' }}>Lift Metric</th>
                    <th style={{ padding: '12px 18px' }}>Combo Discount</th>
                    <th style={{ padding: '12px 18px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {affinityRules.map(rule => (
                    <tr key={rule.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 18px', fontWeight: '700', color: '#111827' }}>
                        {rule.primaryItemName}
                      </td>
                      <td style={{ padding: '12px 18px', color: '#176B50', fontWeight: '700' }}>
                        + {rule.pairedItemName}
                      </td>
                      <td style={{ padding: '12px 18px', color: '#6b7280' }}>
                        {(rule.support * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: '12px 18px', color: '#38bdf8', fontWeight: '600' }}>
                        {(rule.confidence * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: '12px 18px', color: rule.lift >= 2.0 ? '#34d399' : '#fbbf24', fontWeight: '800' }}>
                        {rule.lift}x
                      </td>
                      <td style={{ padding: '12px 18px' }}>₹{rule.pairingDiscount} OFF</td>
                      <td style={{ padding: '12px 18px' }}>
                        <button
                          onClick={() => toggleRuleActive(rule.id, rule.isActive)}
                          style={{
                            background: rule.isActive ? '#ecfdf5' : '#f3f4f6',
                            color: rule.isActive ? '#047857' : '#6b7280',
                            border: `1px solid ${rule.isActive ? '#a7f3d0' : '#e5e7eb'}`,
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          {rule.isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {affinityRules.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                        No mined rules yet. Click "Mine Fresh Association Rules" to process historical orders.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 4: AUTONOMOUS GUEST WIN-BACK AGENT (RFM RETARGETING)
          ==================================================================== */}
      {activeTab === 'winback-agent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header with New Campaign Button */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '18px 24px',
              boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>
                Autonomous Customer Retention &amp; RFM Churn Defense
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                AI analyzes recency, frequency, and monetary values to detect churning regulars and trigger high-converting win-back incentives.
              </p>
            </div>

            <button
              onClick={() => setNewCampaignModal(true)}
              style={{
                ...btnPrimaryStyle,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Plus size={16} />
              Draft AI Win-Back Campaign
            </button>
          </div>

          {/* 5 RFM Cohort Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div
              style={{
                ...rfmCardStyle,
                borderTop: '3px solid #34d399',
                background: selectedSegmentFilter === 'champions' ? 'rgba(52, 211, 153, 0.15)' : '#ffffff',
              }}
              onClick={() => setSelectedSegmentFilter(selectedSegmentFilter === 'champions' ? 'all' : 'champions')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span>👑</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#34d399' }}>Champions</span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827' }}>
                {rfmSegments?.championsCount || 0}
              </div>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>High spend • Frequent (&lt;14d)</span>
            </div>

            <div
              style={{
                ...rfmCardStyle,
                borderTop: '3px solid #38bdf8',
                background: selectedSegmentFilter === 'loyal_regulars' ? 'rgba(56, 189, 248, 0.15)' : '#ffffff',
              }}
              onClick={() => setSelectedSegmentFilter(selectedSegmentFilter === 'loyal_regulars' ? 'all' : 'loyal_regulars')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span>☕</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#38bdf8' }}>Loyal Regulars</span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827' }}>
                {rfmSegments?.loyalRegularsCount || 0}
              </div>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>Consistent (&lt;30d)</span>
            </div>

            <div
              style={{
                ...rfmCardStyle,
                borderTop: '3px solid #f59e0b',
                background: selectedSegmentFilter === 'at_risk' ? 'rgba(245, 158, 11, 0.15)' : '#ffffff',
              }}
              onClick={() => setSelectedSegmentFilter(selectedSegmentFilter === 'at_risk' ? 'all' : 'at_risk')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span>⚠️</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#fbbf24' }}>At-Risk Guests</span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827' }}>
                {rfmSegments?.atRiskCount || 0}
              </div>
              <span style={{ fontSize: '11px', color: '#fde68a' }}>No visit 21–60 days</span>
            </div>

            <div
              style={{
                ...rfmCardStyle,
                borderTop: '3px solid #ef4444',
                background: selectedSegmentFilter === 'hibernating' ? 'rgba(239, 68, 68, 0.15)' : '#ffffff',
              }}
              onClick={() => setSelectedSegmentFilter(selectedSegmentFilter === 'hibernating' ? 'all' : 'hibernating')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span>🧊</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#f87171' }}>Hibernating</span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827' }}>
                {rfmSegments?.hibernatingCount || 0}
              </div>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>Inactive &gt;60 days</span>
            </div>

            <div
              style={{
                ...rfmCardStyle,
                borderTop: '3px solid #a855f7',
                background: selectedSegmentFilter === 'new_explorers' ? 'rgba(168, 85, 247, 0.15)' : '#ffffff',
              }}
              onClick={() => setSelectedSegmentFilter(selectedSegmentFilter === 'new_explorers' ? 'all' : 'new_explorers')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span>🌱</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#c084fc' }}>New Explorers</span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827' }}>
                {rfmSegments?.newExplorersCount || 0}
              </div>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>1 Visit • Nudge for Habit</span>
            </div>
          </div>

          {/* Active Campaigns Performance Ledger */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                Automated Marketing Campaigns &amp; Conversion ROI
              </h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 18px' }}>Campaign Name</th>
                    <th style={{ padding: '12px 18px' }}>Target Segment</th>
                    <th style={{ padding: '12px 18px' }}>Promo Code</th>
                    <th style={{ padding: '12px 18px' }}>Audience</th>
                    <th style={{ padding: '12px 18px' }}>Delivered</th>
                    <th style={{ padding: '12px 18px' }}>Redeemed</th>
                    <th style={{ padding: '12px 18px' }}>Attributed Revenue</th>
                    <th style={{ padding: '12px 18px' }}>Status &amp; Action</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(camp => (
                    <tr key={camp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 18px', fontWeight: '700', color: '#111827' }}>
                        {camp.name}
                      </td>
                      <td style={{ padding: '12px 18px', textTransform: 'capitalize', color: '#6b7280' }}>
                        {camp.targetSegment.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '12px 18px', fontWeight: '800', color: '#176B50' }}>
                        {camp.promoCode} ({camp.discountPercent}% OFF)
                      </td>
                      <td style={{ padding: '12px 18px' }}>{camp.targetAudienceCount} guests</td>
                      <td style={{ padding: '12px 18px', color: '#38bdf8' }}>{camp.deliveredCount}</td>
                      <td style={{ padding: '12px 18px', color: '#10b981', fontWeight: '800' }}>
                        {camp.redeemedCount} orders
                      </td>
                      <td style={{ padding: '12px 18px', color: '#34d399', fontWeight: '800' }}>
                        ₹{camp.attributedRevenue}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {camp.status === 'draft' ? (
                            <button
                              onClick={() => handleLaunchBroadcast(camp.id)}
                              disabled={sendingBroadcastId === camp.id}
                              style={{
                                background: '#176B50',
                                color: '#fff',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Send size={12} className={sendingBroadcastId === camp.id ? 'spin' : ''} />
                              Dispatch Blast
                            </button>
                          ) : (
                            <span
                              style={{
                                background: '#064e3b',
                                color: '#6ee7b7',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                              }}
                            >
                              Dispatched
                            </span>
                          )}
                          <button
                            onClick={() => viewCampaignDetails(camp.id)}
                            style={{
                              background: '#ffffff',
                              color: '#4b5563',
                              border: '1px solid #e5e7eb',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                        No campaigns drafted yet. Click "Draft AI Win-Back Campaign" to configure.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DRAFT NEW CAMPAIGN MODAL */}
          {newCampaignModal && (
            <div style={modalOverlayStyle}>
              <div style={{ ...modalContentStyle, maxWidth: '600px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Target size={20} color="#176B50" />
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
                      Configure Autonomous Retention Campaign
                    </h3>
                  </div>
                  <button onClick={() => setNewCampaignModal(false)} style={closeBtnStyle}>✕</button>
                </div>

                <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                      Campaign Name
                    </label>
                    <input
                      type="text"
                      value={campaignForm.name}
                      onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })}
                      required
                      style={{ ...inputStyle, width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Target RFM Cohort
                      </label>
                      <select
                        value={campaignForm.targetSegment}
                        onChange={e => setCampaignForm({ ...campaignForm, targetSegment: e.target.value })}
                        style={{ ...selectStyle, width: '100%' }}
                      >
                        <option value="at_risk">⚠️ At-Risk Guests (Inactive 21–60d)</option>
                        <option value="hibernating">🧊 Hibernating (Lapsed &gt;60d)</option>
                        <option value="champions">👑 Champions &amp; VIPs</option>
                        <option value="loyal_regulars">☕ Loyal Regulars</option>
                        <option value="new_explorers">🌱 New Explorers (1 Visit)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Incentive Discount (%)
                      </label>
                      <select
                        value={campaignForm.discountPercent}
                        onChange={e => setCampaignForm({ ...campaignForm, discountPercent: Number(e.target.value) })}
                        style={{ ...selectStyle, width: '100%' }}
                      >
                        <option value={10}>10% OFF Voucher</option>
                        <option value={15}>15% OFF Voucher</option>
                        <option value={20}>20% OFF Voucher (High Conversion)</option>
                        <option value={25}>25% OFF Voucher (Aggressive Win-Back)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                      Delivery Channel
                    </label>
                    <select
                      value={campaignForm.channel}
                      onChange={e => setCampaignForm({ ...campaignForm, channel: e.target.value })}
                      style={{ ...selectStyle, width: '100%' }}
                    >
                      <option value="whatsapp">WhatsApp Cloud API (Direct Push + Rich Card)</option>
                      <option value="sms">Transactional SMS (High Open Rate)</option>
                      <option value="omnichannel">Omnichannel (WhatsApp with SMS Fallback)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                      Message Template (Leave blank for AI auto-personalized copy)
                    </label>
                    <textarea
                      rows={3}
                      value={campaignForm.customTemplate}
                      onChange={e => setCampaignForm({ ...campaignForm, customTemplate: e.target.value })}
                      placeholder="Hey {{customerName}}! We miss you at Gusstora. Your favorite {{favoriteItem}} is roasted fresh and waiting! Enjoy {{discountPercent}}% OFF with code {{promoCode}}..."
                      style={{
                        ...inputStyle,
                        width: '100%',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" onClick={() => setNewCampaignModal(false)} style={btnSecondaryStyle}>
                      Cancel
                    </button>
                    <button type="submit" disabled={loading} style={btnPrimaryStyle}>
                      Generate Campaign &amp; Promo Code
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* VIEW CAMPAIGN RECIPIENTS MODAL */}
          {selectedCampaignDetails && (
            <div style={modalOverlayStyle}>
              <div style={{ ...modalContentStyle, maxWidth: '750px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
                      {selectedCampaignDetails.name} — Delivery &amp; Conversion Logs
                    </h3>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      Promo: <strong style={{ color: '#176B50' }}>{selectedCampaignDetails.promoCode}</strong> | Attributed: <strong style={{ color: '#34d399' }}>₹{selectedCampaignDetails.attributedRevenue}</strong>
                    </span>
                  </div>
                  <button onClick={() => setSelectedCampaignDetails(null)} style={closeBtnStyle}>✕</button>
                </div>

                <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 12px' }}>Guest Name</th>
                        <th style={{ padding: '8px 12px' }}>Phone</th>
                        <th style={{ padding: '8px 12px' }}>Segment</th>
                        <th style={{ padding: '8px 12px' }}>Delivery</th>
                        <th style={{ padding: '8px 12px' }}>Redeemed</th>
                        <th style={{ padding: '8px 12px' }}>Order Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedCampaignDetails.recipients || []).map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px 12px', color: '#111827', fontWeight: '600' }}>{r.customerName}</td>
                          <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.phone}</td>
                          <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{r.rfmSegment}</td>
                          <td style={{ padding: '8px 12px', color: '#38bdf8' }}>{r.deliveryStatus}</td>
                          <td style={{ padding: '8px 12px', color: r.redeemed ? '#34d399' : '#6b7280', fontWeight: '700' }}>
                            {r.redeemed ? 'Yes (Ordered)' : 'Not yet'}
                          </td>
                          <td style={{ padding: '8px 12px', color: r.redeemed ? '#34d399' : '#a89f91' }}>
                            {r.orderAmount > 0 ? `₹${r.orderAmount}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '16px', textAlign: 'right' }}>
                  <button onClick={() => setSelectedCampaignDetails(null)} style={btnSecondaryStyle}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STYLES OBJECTS
// ============================================================================

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '16px',
  padding: '18px 20px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
};

const cardHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px',
};

const cardLabelStyle = {
  fontSize: '12px',
  color: '#6b7280',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const quadrantCardStyle = {
  borderRadius: '16px',
  padding: '18px 20px',
  cursor: 'pointer',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
  border: '1px solid #e5e7eb',
};

const rfmCardStyle = {
  borderRadius: '16px',
  padding: '16px 18px',
  border: '1px solid #e5e7eb',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: '0 2px 10px rgba(35, 23, 15, 0.04)',
};

const inputStyle = {
  background: '#f8fafc',
  border: '1px solid #d1d5db',
  color: '#111827',
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '13px',
  outline: 'none',
};

const selectStyle = {
  background: '#f8fafc',
  border: '1px solid #d1d5db',
  color: '#111827',
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '13px',
  outline: 'none',
  cursor: 'pointer',
};

const btnPrimaryStyle = {
  background: '#176B50',
  color: '#ffffff',
  border: 'none',
  padding: '10px 18px',
  borderRadius: '10px',
  fontWeight: '700',
  fontSize: '13px',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(23, 107, 80, 0.25)',
};

const btnSecondaryStyle = {
  background: '#ffffff',
  color: '#4b5563',
  border: '1px solid #e5e7eb',
  padding: '10px 18px',
  borderRadius: '10px',
  fontWeight: '600',
  fontSize: '13px',
  cursor: 'pointer',
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.75)',
  backdropFilter: 'blur(5px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
  padding: '16px',
};

const modalContentStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '16px',
  padding: '24px',
  width: '100%',
  boxShadow: '0 20px 48px rgba(0,0,0,0.15)',
  color: '#111827',
};

const closeBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: '#6b7280',
  fontSize: '18px',
  cursor: 'pointer',
  padding: '4px',
};

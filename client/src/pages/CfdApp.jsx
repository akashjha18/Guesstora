import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Coffee,
  CheckCircle2,
  Sparkles,
  Wifi,
  QrCode,
  Maximize2,
  Minimize2,
  Clock,
  Award,
  ChevronRight,
  ShieldCheck,
  ShoppingBag,
  Volume2,
} from 'lucide-react';
import { api } from '../api';
import { subscribeToCfd } from '../utils/cfdChannel';

export default function CfdApp() {
  const { slug: routeSlug } = useParams();
  const slug = routeSlug || 'demo-cafe';

  const [cafeConfig, setCafeConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  // CFD Live State: IDLE | CART_UPDATE | ORDER_COMPLETED
  const [cfdState, setCfdState] = useState({
    type: 'IDLE',
    payload: {},
  });

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Cafe CFD Configuration
  useEffect(() => {
    let mounted = true;
    async function loadConfig() {
      try {
        const res = await api(`/public/cafes/${slug}/cfd-config`);
        if (mounted && res) {
          setCafeConfig(res);
        }
      } catch (err) {
        console.warn('Failed to load CFD config, using defaults:', err);
        if (mounted) {
          setCafeConfig({
            name: 'Gusstora Artisan Roastery',
            slug,
            brandColor: '#ea580c',
            currency: 'INR',
            cfdWelcomeTitle: 'Gusstora Specialty Coffee',
            cfdWelcomeSubtitle: 'Handcrafted Roasts & Fresh Sourdough Bakes',
            cfdPromoBanner: 'Ask our Barista about our Seasonal Ethiopian Pour-over!',
            cfdUpiVpa: 'gusstora@okaxis',
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadConfig();
    return () => { mounted = false; };
  }, [slug]);

  // Subscribe to local BroadcastChannel and cross-window events
  useEffect(() => {
    const unsubscribe = subscribeToCfd((event) => {
      if (event && event.type) {
        setCfdState(event);
      }
    });

    // Also listen to server-side SSE for wireless tablets
    let es = null;
    try {
      const sseUrl = `/api/cafes/${slug}/events`;
      es = new EventSource(sseUrl);
      es.addEventListener('cfd_event', (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && parsed.eventType) {
            setCfdState({
              type: parsed.eventType,
              payload: parsed.payload || {},
            });
          }
        } catch (_) {}
      });
      es.addEventListener('cfd_config_updated', (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed) {
            setCafeConfig(prev => ({ ...prev, ...parsed }));
          }
        } catch (_) {}
      });
    } catch (_) {}

    return () => {
      unsubscribe();
      if (es) es.close();
    };
  }, [slug]);

  // Auto-reset completed order back to IDLE after 9 seconds
  useEffect(() => {
    if (cfdState.type === 'ORDER_COMPLETED') {
      const timer = setTimeout(() => {
        setCfdState({ type: 'IDLE', payload: {} });
      }, 9000);
      return () => clearTimeout(timer);
    }
  }, [cfdState.type]);

  // Fullscreen Handler
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  }

  // UPI Dynamic Payload
  const upiQrData = useMemo(() => {
    if (cfdState.type !== 'CART_UPDATE') return null;
    const vpa = cafeConfig?.cfdUpiVpa || 'gusstora@okaxis';
    const payeeName = encodeURIComponent(cafeConfig?.name || 'Gusstora Coffee');
    const amount = Number(cfdState.payload?.total || 0).toFixed(2);
    const note = encodeURIComponent(`Order Bill`);
    return `upi://pay?pa=${vpa}&pn=${payeeName}&am=${amount}&cu=INR&tn=${note}`;
  }, [cfdState, cafeConfig]);

  const activeCart = cfdState.payload || {};
  const cartItems = Array.isArray(activeCart.items) ? activeCart.items : [];
  const hasItems = cartItems.length > 0;

  return (
    <div className="cfd-root">
      {/* Top Ambient Bar */}
      <header className="cfd-header">
        <div className="cfd-header-brand">
          <div className="cfd-logo-badge">
            <Coffee size={24} className="cfd-brand-icon" />
          </div>
          <div>
            <h1 className="cfd-cafe-name">{cafeConfig?.name || 'Gusstora Coffee Roasters'}</h1>
            <p className="cfd-cafe-tagline">{cafeConfig?.tagline || 'Specialty Roastery & Espresso Bar'}</p>
          </div>
        </div>

        <div className="cfd-header-meta">
          {cafeConfig?.wifiSsid && (
            <div className="cfd-wifi-badge">
              <Wifi size={16} />
              <span>Wi-Fi: <strong>{cafeConfig.wifiSsid}</strong> {cafeConfig.wifiPassword ? `(${cafeConfig.wifiPassword})` : ''}</span>
            </div>
          )}
          <div className="cfd-clock-badge">
            <Clock size={16} />
            <span>{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <button
            type="button"
            className="cfd-fullscreen-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="cfd-main">
        {/* ============================================================== */}
        {/* CASE 1: ORDER COMPLETED CELEBRATION                            */}
        {/* ============================================================== */}
        {cfdState.type === 'ORDER_COMPLETED' ? (
          <div className="cfd-completed-card">
            <div className="cfd-completed-glow" />
            <div className="cfd-completed-icon-wrapper">
              <CheckCircle2 size={72} className="cfd-completed-icon" />
            </div>
            <h2 className="cfd-completed-title">Payment Received!</h2>
            <p className="cfd-completed-subtitle">
              Thank you for visiting {cafeConfig?.name || 'Gusstora'}. Your handcrafted order is being prepared with precision.
            </p>

            <div className="cfd-completed-summary-pill">
              <div className="cfd-pill-item">
                <span className="cfd-pill-label">Bill Total</span>
                <span className="cfd-pill-val">₹{Number(activeCart.total || 0).toLocaleString('en-IN')}</span>
              </div>
              {activeCart.changeDue !== undefined && Number(activeCart.changeDue) > 0 && (
                <div className="cfd-pill-item cfd-pill-highlight">
                  <span className="cfd-pill-label">Cash Change Due</span>
                  <span className="cfd-pill-val">₹{Number(activeCart.changeDue).toLocaleString('en-IN')}</span>
                </div>
              )}
              {activeCart.orderNo && (
                <div className="cfd-pill-item">
                  <span className="cfd-pill-label">Order Token</span>
                  <span className="cfd-pill-val">#{activeCart.orderNo}</span>
                </div>
              )}
            </div>

            <div className="cfd-barista-note">
              <Sparkles size={18} className="cfd-sparkle-amber" />
              <span>Listen for your token number at the Barista Pick-Up Station.</span>
            </div>
          </div>
        ) : cfdState.type === 'CART_UPDATE' && hasItems ? (
          /* ============================================================== */
          /* CASE 2: ACTIVE CART & INSTANT DYNAMIC UPI QR                   */
          /* ============================================================== */
          <div className="cfd-active-grid">
            {/* Left 50%: Payment QR & Guest Recognition */}
            <div className="cfd-panel cfd-left-panel">
              {/* Diner Recognition Badge */}
              {activeCart.customerName ? (
                <div className="cfd-diner-badge">
                  <Award size={20} className="cfd-award-icon" />
                  <div>
                    <h3 className="cfd-diner-greeting">
                      Welcome back, <strong>{activeCart.customerName}</strong>!
                    </h3>
                    <p className="cfd-diner-sub">
                      {activeCart.loyaltyTier || 'Roastery Patron Member'} • Registered Guest
                    </p>
                  </div>
                </div>
              ) : (
                <div className="cfd-welcome-card">
                  <Sparkles size={20} className="cfd-sparkle-amber" />
                  <span>Welcome! Watch your items ring up live on the right.</span>
                </div>
              )}

              {/* Dynamic Instant UPI QR Card */}
              <div className="cfd-upi-card">
                <div className="cfd-upi-header">
                  <div className="cfd-upi-title-box">
                    <QrCode size={22} className="cfd-qr-icon" />
                    <span className="cfd-upi-title">Scan & Pay via UPI</span>
                  </div>
                  <span className="cfd-live-tag">LIVE TICKET</span>
                </div>

                <div className="cfd-qr-container">
                  {upiQrData ? (
                    <div className="cfd-qr-frame">
                      <QRCodeSVG
                        value={upiQrData}
                        size={210}
                        bgColor="#ffffff"
                        fgColor="#120B07"
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                  ) : (
                    <div className="cfd-qr-placeholder">Generating Payment QR...</div>
                  )}
                </div>

                <div className="cfd-upi-amount-box">
                  <span className="cfd-amount-label">Payable Amount</span>
                  <span className="cfd-amount-val">₹{Number(activeCart.total || 0).toLocaleString('en-IN')}</span>
                </div>

                <div className="cfd-upi-badges">
                  <span className="cfd-app-badge">GPay</span>
                  <span className="cfd-app-badge">PhonePe</span>
                  <span className="cfd-app-badge">Paytm</span>
                  <span className="cfd-app-badge">BHIM</span>
                  <span className="cfd-app-badge">Any Bank UPI</span>
                </div>

                <p className="cfd-upi-helper">
                  Supports zero-touch instant soundbox confirmation & digital receipt.
                </p>
              </div>

              {/* Specialty Coffee Origin Card */}
              <div className="cfd-origin-card">
                <Coffee size={20} className="cfd-coffee-icon" />
                <div>
                  <h4 className="cfd-origin-title">100% Arabica Single-Origin & Estate Blends</h4>
                  <p className="cfd-origin-desc">
                    Slow roasted in small batches to preserve intrinsic tasting notes of stone fruits, dark chocolate, and almond praline.
                  </p>
                </div>
              </div>
            </div>

            {/* Right 50%: Live Itemized Cart View */}
            <div className="cfd-panel cfd-right-panel">
              <div className="cfd-cart-header">
                <div className="cfd-cart-title-box">
                  <ShoppingBag size={20} />
                  <span>Your Current Order</span>
                </div>
                <span className="cfd-item-count">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</span>
              </div>

              <div className="cfd-cart-items-list">
                {cartItems.map((item, idx) => (
                  <div key={item.id || idx} className="cfd-item-row">
                    <div className="cfd-item-left">
                      <div className="cfd-item-qty">{item.quantity || 1}x</div>
                      <div className="cfd-item-info">
                        <div className="cfd-item-name">{item.name}</div>
                        {item.selectedVariant && (
                          <div className="cfd-item-variant">
                            Size/Type: {item.selectedVariant.name || item.selectedVariant}
                          </div>
                        )}
                        {Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                          <div className="cfd-item-mods">
                            {item.selectedModifiers.map((m, mIdx) => (
                              <span key={mIdx} className="cfd-mod-chip">
                                +{typeof m === 'string' ? m : m.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.notes && <div className="cfd-item-notes">Note: {item.notes}</div>}
                      </div>
                    </div>
                    <div className="cfd-item-price">
                      ₹{((Number(item.price) || 0) * (Number(item.quantity) || 1)).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Calculations */}
              <div className="cfd-cart-summary">
                <div className="cfd-summary-row">
                  <span>Subtotal</span>
                  <span>₹{Number(activeCart.subtotal || 0).toLocaleString('en-IN')}</span>
                </div>
                {Number(activeCart.discount || 0) > 0 && (
                  <div className="cfd-summary-row cfd-discount-row">
                    <span>Discount / Member Reward</span>
                    <span>-₹{Number(activeCart.discount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {Number(activeCart.tax || 0) > 0 && (
                  <div className="cfd-summary-row">
                    <span>GST (CGST + SGST 5%)</span>
                    <span>₹{Number(activeCart.tax).toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="cfd-total-row">
                  <div className="cfd-total-label">Grand Total</div>
                  <div className="cfd-total-val">
                    ₹{Number(activeCart.total || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* CASE 3: IDLE AMBIENT ROASTERY SHOWCASE                         */
          /* ============================================================== */
          <div className="cfd-idle-container">
            <div className="cfd-idle-hero">
              <div className="cfd-coffee-steam-anim">
                <Coffee size={64} className="cfd-idle-logo-icon" />
              </div>
              <h2 className="cfd-idle-title">
                {cafeConfig?.cfdWelcomeTitle || 'Welcome to Gusstora'}
              </h2>
              <p className="cfd-idle-subtitle">
                {cafeConfig?.cfdWelcomeSubtitle || 'Artisan Coffee Roasters • Handcrafted with Passion'}
              </p>
            </div>

            {/* Promotional Banner */}
            {cafeConfig?.cfdPromoBanner && (
              <div className="cfd-idle-promo-strip">
                <Sparkles size={20} className="cfd-sparkle-amber" />
                <span>{cafeConfig.cfdPromoBanner}</span>
              </div>
            )}

            {/* Roastery Feature Cards */}
            <div className="cfd-idle-cards-grid">
              <div className="cfd-feature-card">
                <div className="cfd-feature-icon-circle">
                  <Coffee size={24} />
                </div>
                <h3 className="cfd-feature-title">Micro-Lot Roasted In-House</h3>
                <p className="cfd-feature-desc">
                  Curated green beans directly sourced from Chikmagalur & Coorg high-altitude shade-grown estates.
                </p>
              </div>

              <div className="cfd-feature-card">
                <div className="cfd-feature-icon-circle">
                  <Sparkles size={24} />
                </div>
                <h3 className="cfd-feature-title">Artisan Viennoiserie</h3>
                <p className="cfd-feature-desc">
                  Flaky French butter croissants, pain au chocolat, and sourdough toast baked fresh every morning.
                </p>
              </div>

              <div className="cfd-feature-card">
                <div className="cfd-feature-icon-circle">
                  <Award size={24} />
                </div>
                <h3 className="cfd-feature-title">Gusstora Loyalty Club</h3>
                <p className="cfd-feature-desc">
                  Share your phone number at the counter to collect digital stamps on every visit and earn free pour-overs.
                </p>
              </div>
            </div>

            {/* Footer Prompt */}
            <div className="cfd-idle-footer">
              <div className="cfd-idle-hint">
                <ShoppingBag size={18} />
                <span>Please place your order with our cashier</span>
              </div>
              {cafeConfig?.googleReviewUrl && (
                <div className="cfd-idle-hint">
                  <ShieldCheck size={18} />
                  <span>Loved your visit? Review us on Google Maps</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

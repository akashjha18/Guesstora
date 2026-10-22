import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Coffee,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  QrCode,
  ShieldCheck,
  Store,
  Palette,
  User,
  Rocket,
  AlertCircle,
  Wifi,
  MapPin,
  Phone,
  Eye,
  EyeOff,
  RefreshCw,
  Sliders,
  DollarSign,
  HeartHandshake,
  Star,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api, BASE, setAuthSession } from '../api';

const COLOR_PRESETS = [
  { name: 'Forest Emerald', hex: '#176B50', bg: '#F1F7F2', border: '#DCEFE4', label: 'Artisan Sage & Forest' },
  { name: 'Cognac & Chestnut', hex: '#7b3d22', bg: '#fbf5ef', border: '#ebd9c8', label: 'Artisan Coffee Bar' },
  { name: 'Dark Roast Espresso', hex: '#241b14', bg: '#fbf8f5', border: '#ded4c9', label: 'Heritage Espresso' },
  { name: 'Golden Crema', hex: '#d4af37', bg: '#fefce8', border: '#fef08a', label: 'Specialty & Honey' },
  { name: 'Botanical Sage', hex: '#4a6741', bg: '#f0fdf4', border: '#bbf7d0', label: 'Tea & Brunch Garden' },
  { name: 'Obsidian Velvet', hex: '#1a120c', bg: '#f5f5f5', border: '#d4d4d4', label: 'Minimalist Lounge' }
];

const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (INR ₹)' },
  { code: 'USD', symbol: '$', label: 'US Dollar (USD $)' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR €)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (GBP £)' },
  { code: 'AED', symbol: 'AED', label: 'UAE Dirham (AED)' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar (CAD $)' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (AUD $)' }
];

export default function Onboard() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Cafe Identity
  const [cafeName, setCafeName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: null, message: '' });
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [tables, setTables] = useState(12);

  // Step 2: Branding & Social
  const [brandColor, setBrandColor] = useState('#176B50');
  const [tagline, setTagline] = useState('Specialty Brews, Artisanal Bakes & Warm Moments');
  const [logo, setLogo] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');

  // Step 3: Owner Credentials
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 4: Launch Settings
  const [seedSampleMenu, setSeedSampleMenu] = useState(true);

  // Auto-slug generation from Cafe Name
  function handleNameChange(e) {
    const val = e.target.value;
    setCafeName(val);
    const autoSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(autoSlug);
  }

  // Check slug availability with debouncing
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugStatus({ checking: false, available: null, message: '' });
      return;
    }

    const timer = setTimeout(async () => {
      setSlugStatus({ checking: true, available: null, message: 'Checking availability…' });
      try {
        const res = await fetch(`${BASE}/public/cafes/check-slug/${encodeURIComponent(slug)}`);
        const json = await res.json();
        setSlugStatus({
          checking: false,
          available: json.available,
          message: json.message || (json.available ? 'URL is available!' : 'Slug is taken.')
        });
      } catch (err) {
        setSlugStatus({ checking: false, available: null, message: 'Could not verify slug' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug]);

  // Validation per step
  function canProceedStep1() {
    return (
      cafeName.trim().length >= 2 &&
      slug.trim().length >= 3 &&
      slugStatus.available === true &&
      tables > 0
    );
  }

  function canProceedStep2() {
    return brandColor.trim().length >= 4;
  }

  function canProceedStep3() {
    return (
      ownerName.trim().length >= 2 &&
      ownerEmail.includes('@') &&
      ownerEmail.includes('.') &&
      ownerPassword.length >= 6
    );
  }

  async function handleRegister(e) {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        cafeName: cafeName.trim(),
        slug: slug.trim(),
        phone: phone.trim(),
        address: address.trim(),
        currency,
        tables: Number(tables) || 12,
        brandColor,
        tagline: tagline.trim(),
        logo: logo.trim(),
        wifiSsid: wifiSsid.trim(),
        wifiPassword: wifiPassword.trim(),
        googleReviewUrl: googleReviewUrl.trim(),
        instagramUrl: instagramUrl.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim().toLowerCase(),
        ownerPassword,
        seedSampleMenu
      };

      const res = await fetch(`${BASE}/auth/register-cafe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed. Please check details.');
      }

      // Store auth credentials
      setAuthSession({
        accessToken: data.accessToken || data.token,
        refreshToken: data.refreshToken,
      });
      if (data.user) {
        localStorage.setItem('gusstora_user', JSON.stringify(data.user));
      }

      // Navigate to Owner Control Centre directly into QR Table Kit tab
      nav('/owner?tab=qr-kit&welcome=1');
    } catch (err) {
      setError(err.message || 'Something went wrong during onboarding.');
    } finally {
      setLoading(false);
    }
  }

  const selectedCurrency = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];

  return (
    <div className="onboard-viewport">
      {/* Background ambient lighting */}
      <div className="onboard-orb onboard-orb-1" style={{ background: `radial-gradient(circle, ${brandColor}22 0%, transparent 70%)` }} />
      <div className="onboard-orb onboard-orb-2" />

      {/* Top Header */}
      <header className="onboard-header">
        <div className="onboard-header-inner">
          <div className="onboard-logo-group">
            <img src="/gusstora_logo_transparent.png" alt="PerkByte" className="onboard-header-logo" />
            <div className="onboard-header-text">
              <span className="onboard-brand-name">Gusstora / PerkByte</span>
              <span className="onboard-brand-badge">Partner Self-Onboarding</span>
            </div>
          </div>
          <div className="onboard-header-actions">
            <span className="onboard-login-hint">Already have a café account?</span>
            <Link to="/owner/login" className="onboard-login-btn">
              <span>Sign In</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Multi-step Container */}
      <main className="onboard-main-container">
        <div className="onboard-split-layout">
          
          {/* Left Column: Form & Stepper */}
          <div className="onboard-form-column">
            
            {/* Step Progress Tracker */}
            <div className="onboard-stepper-bar">
              {[
                { num: 1, label: 'Café Details', icon: Store },
                { num: 2, label: 'Brand & Vibe', icon: Palette },
                { num: 3, label: 'Owner Account', icon: User },
                { num: 4, label: 'Ready to Launch', icon: Rocket }
              ].map(s => {
                const isActive = step === s.num;
                const isDone = step > s.num;
                const Icon = s.icon;
                return (
                  <div
                    key={s.num}
                    className={`onboard-step-pill ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                    onClick={() => {
                      if (isDone) setStep(s.num);
                    }}
                  >
                    <div className="step-pill-number">
                      {isDone ? <CheckCircle2 size={14} /> : <Icon size={13} />}
                    </div>
                    <span className="step-pill-label">{s.label}</span>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="onboard-error-banner" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: CAFE DETAILS */}
            {step === 1 && (
              <div className="onboard-step-card animate-fade-in">
                <div className="step-card-header">
                  <div className="step-icon-wrap" style={{ color: brandColor, background: `${brandColor}15` }}>
                    <Store size={22} />
                  </div>
                  <div>
                    <h2 className="step-card-title">Let's set up your café identity</h2>
                    <p className="step-card-subtitle">
                      Enter your café name, scannable table capacity, and custom guest ordering web link.
                    </p>
                  </div>
                </div>

                <div className="onboard-fields-grid">
                  <div className="onboard-field-full">
                    <label className="onboard-label">
                      <span>Café Name *</span>
                      <span className="onboard-label-tip">Displayed on menu, receipts & table standees</span>
                    </label>
                    <input
                      type="text"
                      className="onboard-input"
                      placeholder="e.g. Blue Lagoon Roastery & Cafe"
                      value={cafeName}
                      onChange={handleNameChange}
                      required
                    />
                  </div>

                  <div className="onboard-field-full">
                    <label className="onboard-label">
                      <span>Live Diner Web URL Slug *</span>
                      <span className="onboard-label-tip">Your diners will scan this to open your menu</span>
                    </label>
                    <div className="slug-input-wrapper">
                      <span className="slug-prefix">perkbyte.app/c/</span>
                      <input
                        type="text"
                        className="onboard-input slug-input"
                        placeholder="blue-lagoon-cafe"
                        value={slug}
                        onChange={e => {
                          const clean = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                          setSlug(clean);
                        }}
                      />
                    </div>
                    {slugStatus.message && (
                      <div className={`slug-status-note ${slugStatus.available ? 'success' : slugStatus.checking ? 'info' : 'error'}`}>
                        {slugStatus.checking && <RefreshCw size={12} className="spin" />}
                        {slugStatus.available === true && <CheckCircle2 size={13} />}
                        {slugStatus.available === false && <AlertCircle size={13} />}
                        <span>{slugStatus.message}</span>
                      </div>
                    )}
                  </div>

                  <div className="onboard-field-half">
                    <label className="onboard-label">Contact Phone</label>
                    <div className="input-with-icon">
                      <Phone size={14} className="input-inner-icon" />
                      <input
                        type="tel"
                        className="onboard-input with-icon"
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="onboard-field-half">
                    <label className="onboard-label">Operating Currency *</label>
                    <select
                      className="onboard-input onboard-select"
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="onboard-field-half">
                    <label className="onboard-label">
                      <span>Total Dining Tables *</span>
                      <span className="onboard-label-tip">We generate QR standees for each</span>
                    </label>
                    <div className="tables-counter-wrap">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="onboard-input"
                        value={tables}
                        onChange={e => setTables(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                      />
                      <span className="tables-counter-badge">{tables} Table QRs</span>
                    </div>
                  </div>

                  <div className="onboard-field-half">
                    <label className="onboard-label">Café City / Location</label>
                    <div className="input-with-icon">
                      <MapPin size={14} className="input-inner-icon" />
                      <input
                        type="text"
                        className="onboard-input with-icon"
                        placeholder="Indiranagar, Bengaluru"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="step-card-actions">
                  <div className="step-tip-box">
                    <Sparkles size={14} />
                    <span>You can edit table counts and details anytime in Settings.</span>
                  </div>
                  <button
                    type="button"
                    className="onboard-btn-primary"
                    disabled={!canProceedStep1()}
                    onClick={() => setStep(2)}
                  >
                    <span>Proceed to Brand Styling</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: BRANDING & SOCIAL */}
            {step === 2 && (
              <div className="onboard-step-card animate-fade-in">
                <div className="step-card-header">
                  <div className="step-icon-wrap" style={{ color: brandColor, background: `${brandColor}15` }}>
                    <Palette size={22} />
                  </div>
                  <div>
                    <h2 className="step-card-title">Brand styling & guest amenities</h2>
                    <p className="step-card-subtitle">
                      Personalize your diner interface colors, tagline, and optional Wi-Fi printed on table standees.
                    </p>
                  </div>
                </div>

                <div className="onboard-fields-grid">
                  {/* Color Palette Selector */}
                  <div className="onboard-field-full">
                    <label className="onboard-label">
                      <span>Primary Brand Accent Color *</span>
                      <span className="onboard-label-tip">Tints mobile diner view, badges & QR headers</span>
                    </label>
                    <div className="palette-preset-grid">
                      {COLOR_PRESETS.map(p => {
                        const isSelected = brandColor === p.hex;
                        return (
                          <button
                            key={p.hex}
                            type="button"
                            className={`color-preset-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => setBrandColor(p.hex)}
                          >
                            <span className="preset-color-dot" style={{ backgroundColor: p.hex }} />
                            <div className="preset-text">
                              <span className="preset-name">{p.name}</span>
                              <span className="preset-label">{p.label}</span>
                            </div>
                            {isSelected && <CheckCircle2 size={14} className="preset-check" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="custom-color-inline">
                      <span className="custom-color-label">Or Custom HEX Color:</span>
                      <input
                        type="color"
                        value={brandColor}
                        onChange={e => setBrandColor(e.target.value)}
                        className="custom-color-picker"
                      />
                      <input
                        type="text"
                        value={brandColor}
                        onChange={e => setBrandColor(e.target.value)}
                        className="onboard-input hex-input"
                        placeholder="#176B50"
                      />
                    </div>
                  </div>

                  <div className="onboard-field-full">
                    <label className="onboard-label">
                      <span>Café Welcome Tagline</span>
                      <span className="onboard-label-tip">Displayed prominently under café title</span>
                    </label>
                    <input
                      type="text"
                      className="onboard-input"
                      placeholder="e.g. Specialty Roastery & Wood-Fired Pastries"
                      value={tagline}
                      onChange={e => setTagline(e.target.value)}
                    />
                  </div>

                  {/* Wi-Fi Details */}
                  <div className="onboard-field-half">
                    <label className="onboard-label">
                      <span>Guest Wi-Fi Network (SSID)</span>
                      <span className="onboard-label-tip">Printed on QR standee</span>
                    </label>
                    <div className="input-with-icon">
                      <Wifi size={14} className="input-inner-icon" />
                      <input
                        type="text"
                        className="onboard-input with-icon"
                        placeholder="e.g. BlueLagoon_Guest_5G"
                        value={wifiSsid}
                        onChange={e => setWifiSsid(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="onboard-field-half">
                    <label className="onboard-label">
                      <span>Wi-Fi Password</span>
                      <span className="onboard-label-tip">Convenient for diners</span>
                    </label>
                    <input
                      type="text"
                      className="onboard-input"
                      placeholder="e.g. coffeebreak2026"
                      value={wifiPassword}
                      onChange={e => setWifiPassword(e.target.value)}
                    />
                  </div>

                  {/* Social Booster Links */}
                  <div className="onboard-field-half">
                    <label className="onboard-label">
                      <span>Google Maps Review URL</span>
                      <span className="onboard-label-tip">For Automated Review Booster</span>
                    </label>
                    <input
                      type="url"
                      className="onboard-input"
                      placeholder="https://g.page/r/your-cafe/review"
                      value={googleReviewUrl}
                      onChange={e => setGoogleReviewUrl(e.target.value)}
                    />
                  </div>

                  <div className="onboard-field-half">
                    <label className="onboard-label">
                      <span>Instagram Handle / URL</span>
                      <span className="onboard-label-tip">Social discovery badge</span>
                    </label>
                    <input
                      type="text"
                      className="onboard-input"
                      placeholder="https://instagram.com/yourcafe"
                      value={instagramUrl}
                      onChange={e => setInstagramUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div className="step-card-actions">
                  <button
                    type="button"
                    className="onboard-btn-secondary"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    className="onboard-btn-primary"
                    disabled={!canProceedStep2()}
                    onClick={() => setStep(3)}
                  >
                    <span>Proceed to Owner Account</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: OWNER CREDENTIALS */}
            {step === 3 && (
              <div className="onboard-step-card animate-fade-in">
                <div className="step-card-header">
                  <div className="step-icon-wrap" style={{ color: brandColor, background: `${brandColor}15` }}>
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h2 className="step-card-title">Create owner administrator account</h2>
                    <p className="step-card-subtitle">
                      You will use these credentials to log in to your Owner Control Centre, POS, and KDS.
                    </p>
                  </div>
                </div>

                <div className="onboard-fields-grid">
                  <div className="onboard-field-full">
                    <label className="onboard-label">Owner Full Name *</label>
                    <div className="input-with-icon">
                      <User size={14} className="input-inner-icon" />
                      <input
                        type="text"
                        className="onboard-input with-icon"
                        placeholder="e.g. Arjun Kapoor"
                        value={ownerName}
                        onChange={e => setOwnerName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="onboard-field-full">
                    <label className="onboard-label">
                      <span>Business Work Email *</span>
                      <span className="onboard-label-tip">Used as your login username</span>
                    </label>
                    <input
                      type="email"
                      className="onboard-input"
                      placeholder="e.g. arjun@bluelagooncafe.com"
                      value={ownerEmail}
                      onChange={e => setOwnerEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="onboard-field-full">
                    <label className="onboard-label">
                      <span>Secure Password *</span>
                      <span className="onboard-label-tip">Minimum 6 characters</span>
                    </label>
                    <div className="auth-input-wrapper">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="onboard-input has-action"
                        placeholder="Create strong account password"
                        value={ownerPassword}
                        onChange={e => setOwnerPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="step-card-actions">
                  <button
                    type="button"
                    className="onboard-btn-secondary"
                    onClick={() => setStep(2)}
                  >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    className="onboard-btn-primary"
                    disabled={!canProceedStep3()}
                    onClick={() => setStep(4)}
                  >
                    <span>Review & Launch</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & LAUNCH */}
            {step === 4 && (
              <div className="onboard-step-card animate-fade-in">
                <div className="step-card-header">
                  <div className="step-icon-wrap" style={{ color: brandColor, background: `${brandColor}15` }}>
                    <Rocket size={22} />
                  </div>
                  <div>
                    <h2 className="step-card-title">Everything is ready to launch!</h2>
                    <p className="step-card-subtitle">
                      Confirm your setup summary below. We will immediately configure your café and generate your printable table QR standee kit.
                    </p>
                  </div>
                </div>

                {/* Summary Card */}
                <div className="onboard-summary-box">
                  <div className="summary-item">
                    <span className="summary-label">Café Name</span>
                    <span className="summary-value font-bold">{cafeName}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Guest URL</span>
                    <span className="summary-value text-accent">perkbyte.app/c/{slug}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Table Standees</span>
                    <span className="summary-value">{tables} Table QRs (T-01 to T-{String(tables).padStart(2, '0')})</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Operating Currency</span>
                    <span className="summary-value">{selectedCurrency.label}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Owner Account</span>
                    <span className="summary-value">{ownerEmail}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Brand Color</span>
                    <div className="summary-color-preview">
                      <span className="summary-dot" style={{ backgroundColor: brandColor }} />
                      <span>{brandColor}</span>
                    </div>
                  </div>
                </div>

                {/* Seed Menu Checkbox */}
                <div className="starter-seed-checkbox-card">
                  <label className="starter-seed-label">
                    <input
                      type="checkbox"
                      checked={seedSampleMenu}
                      onChange={e => setSeedSampleMenu(e.target.checked)}
                      className="starter-checkbox"
                    />
                    <div className="starter-seed-text">
                      <span className="starter-seed-title">Pre-populate 5 popular coffee & bakery starter items</span>
                      <span className="starter-seed-desc">
                        Includes Signature Espresso, Cappuccino, Spanish Iced Latte, Artisan Croissant & Panini so your menu is immediately ready to take orders. You can edit or delete them anytime.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="step-card-actions">
                  <button
                    type="button"
                    className="onboard-btn-secondary"
                    onClick={() => setStep(3)}
                    disabled={loading}
                  >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    className="onboard-launch-btn"
                    style={{ backgroundColor: brandColor }}
                    disabled={loading}
                    onClick={handleRegister}
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={18} className="spin" />
                        <span>Provisioning your café & QR kit…</span>
                      </>
                    ) : (
                      <>
                        <Rocket size={18} />
                        <span>Launch Café & Open QR Table Kit</span>
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Mobile Diner Preview */}
          <div className="onboard-preview-column">
            <div className="live-preview-container">
              <div className="live-preview-header">
                <div className="preview-badge">
                  <Smartphone size={14} />
                  <span>LIVE DINER MOBILE PREVIEW</span>
                </div>
                <span className="preview-hint">Updates live as you type</span>
              </div>

              {/* Mobile Phone Mockup */}
              <div className="preview-phone-mockup">
                <div className="phone-speaker-notch" />
                
                <div className="phone-screen-content">
                  {/* Cafe Hero Header */}
                  <div className="phone-cafe-hero" style={{ background: `linear-gradient(135deg, ${brandColor}, #2b1810)` }}>
                    <div className="phone-hero-top">
                      <div className="phone-cafe-badge">Table T-03</div>
                      <div className="phone-wifi-chip">
                        <Wifi size={10} />
                        <span>{wifiSsid || 'Guest Wi-Fi'}</span>
                      </div>
                    </div>
                    <div className="phone-cafe-identity">
                      <h3 className="phone-cafe-name">{cafeName || 'Your Café Name'}</h3>
                      <p className="phone-cafe-tagline">{tagline || 'Specialty Coffee & Artisan Bakes'}</p>
                    </div>
                    <div className="phone-loyalty-pill">
                      <Sparkles size={11} />
                      <span>Scan & Earn 1 Stamp for Free Coffee!</span>
                    </div>
                  </div>

                  {/* Menu Category Bar */}
                  <div className="phone-menu-tabs">
                    <span className="phone-tab active" style={{ color: brandColor, borderColor: brandColor }}>Coffee</span>
                    <span className="phone-tab">Brews</span>
                    <span className="phone-tab">Bakery</span>
                    <span className="phone-tab">Bites</span>
                  </div>

                  {/* Sample Menu Items */}
                  <div className="phone-items-list">
                    <div className="phone-item-card">
                      <div className="phone-item-info">
                        <span className="phone-item-name">Signature Espresso</span>
                        <span className="phone-item-desc">Double-shot extraction, golden crema</span>
                        <span className="phone-item-price">{selectedCurrency.symbol} {currency === 'INR' ? '140' : '3.50'}</span>
                      </div>
                      <button className="phone-item-add-btn" style={{ background: brandColor }}>+ Add</button>
                    </div>

                    <div className="phone-item-card">
                      <div className="phone-item-info">
                        <span className="phone-item-name">Classic Cappuccino</span>
                        <span className="phone-item-desc">Velvety micro-foamed textured milk</span>
                        <span className="phone-item-price">{selectedCurrency.symbol} {currency === 'INR' ? '190' : '4.50'}</span>
                      </div>
                      <button className="phone-item-add-btn" style={{ background: brandColor }}>+ Add</button>
                    </div>

                    <div className="phone-item-card">
                      <div className="phone-item-info">
                        <span className="phone-item-name">Artisan Butter Croissant</span>
                        <span className="phone-item-desc">Flaky 72-layer European butter</span>
                        <span className="phone-item-price">{selectedCurrency.symbol} {currency === 'INR' ? '160' : '4.00'}</span>
                      </div>
                      <button className="phone-item-add-btn" style={{ background: brandColor }}>+ Add</button>
                    </div>
                  </div>

                  {/* Floating Cart Button Preview */}
                  <div className="phone-bottom-cart-bar">
                    <div className="phone-cart-badge">
                      <span>2 Items</span>
                      <span className="phone-cart-total">{selectedCurrency.symbol} {currency === 'INR' ? '330' : '8.00'}</span>
                    </div>
                    <button className="phone-view-order-btn" style={{ backgroundColor: brandColor }}>
                      <span>View Order</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>

                <div className="phone-home-indicator" />
              </div>

              {/* Scannable Sample Standee Preview Note */}
              <div className="standee-mini-preview-card">
                <div className="standee-mini-left">
                  <div className="qr-mini-frame">
                    <QRCodeSVG
                      value={`${window.location.origin}/c/${slug || 'demo-cafe'}?table=T-01`}
                      size={60}
                      level="M"
                      fgColor={brandColor}
                    />
                  </div>
                </div>
                <div className="standee-mini-right">
                  <div className="standee-mini-title">Auto-Generated Table Standee #1</div>
                  <div className="standee-mini-desc">
                    Ready-to-print for Table 01 to {tables}. Diners scan this to load the interactive menu shown above!
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

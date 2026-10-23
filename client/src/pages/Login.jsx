import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Coffee,
  CheckCircle2,
  RefreshCw,
  Crown,
  ClipboardList,
  CreditCard,
  ChefHat,
} from 'lucide-react';
import { api, setAuthSession } from '../api';

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: 'owner@perkbyte.demo', password: 'Demo@123' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const demoAccounts = [
    {
      id: 'owner',
      label: 'Owner',
      icon: Crown,
      badge: 'Full Access',
      desc: 'Sovereign Control',
      email: 'owner@perkbyte.demo',
      password: 'Demo@123',
    },
    {
      id: 'manager',
      label: 'Manager',
      icon: ClipboardList,
      badge: 'Operations',
      desc: 'Floor & Staff Hub',
      email: 'manager@perkbyte.demo',
      password: 'Demo@123',
    },
    {
      id: 'cashier',
      label: 'Cashier',
      icon: CreditCard,
      badge: 'Front-of-House',
      desc: 'POS, CRM & Loyalty',
      email: 'cashier@perkbyte.demo',
      password: 'Demo@123',
    },
    {
      id: 'kitchen',
      label: 'Kitchen',
      icon: ChefHat,
      badge: 'Back-of-House',
      desc: 'KDS Prep Display',
      email: 'kitchen@perkbyte.demo',
      password: 'Demo@123',
    },
  ];

  async function submit(e) {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Please enter both your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify(form) });
      setAuthSession({
        accessToken: r.accessToken || r.token,
        refreshToken: r.refreshToken,
      });
      if (r.user) {
        localStorage.setItem('gusstora_user', JSON.stringify(r.user));
      }
      nav('/owner');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-viewport">
      {/* Ambient background decoration */}
      <div className="auth-glow-orb auth-glow-1" />
      <div className="auth-glow-orb auth-glow-2" />
      <div className="auth-glow-orb auth-glow-3" />

      <main className="auth-container">
        <div className="auth-card-wrapper">
          {/* Card Header */}
          <div className="auth-brand-section">
            <div className="auth-badge-pill">
              <ShieldCheck size={13} className="auth-badge-icon" />
              <span>Staff Management Portal</span>
            </div>

            <div className="auth-logo-wrap">
              <img
                src="/gusstora_logo_transparent.png"
                alt="GUESTORA Coffee Logo"
                className="auth-logo-img"
              />
            </div>

            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">
              Sign in to manage your café floor, live orders, kitchen display, and loyalty guests.
            </p>
          </div>

          {/* Quick 1-Tap Demo Switcher */}
          <div className="auth-demo-section">
            <div className="auth-demo-header">
              <span className="auth-demo-label">
                <Sparkles size={12} />
                <span>1-TAP DEMO ROLE SELECT</span>
              </span>
              <span className="auth-demo-hint">Prefills credentials</span>
            </div>

            <div className="auth-role-grid">
              {demoAccounts.map(acc => {
                const isSelected = form.email === acc.email;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    className={`auth-role-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setForm({ email: acc.email, password: acc.password });
                      setError('');
                    }}
                  >
                    <div className="role-card-top">
                      <span className="role-card-icon-wrap">
                        <acc.icon size={15} />
                      </span>
                      <span className="role-card-name">{acc.label}</span>
                      {isSelected && <CheckCircle2 size={14} className="role-card-check" />}
                    </div>
                    <div className="role-card-desc">{acc.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Login Form */}
          <form className="auth-form" onSubmit={submit} noValidate>
            {error && (
              <div className="auth-error-banner" role="alert">
                <AlertCircle size={16} className="auth-error-icon" />
                <span className="auth-error-text">{error}</span>
              </div>
            )}

            <div className="auth-field-group">
              <label htmlFor="auth-email" className="auth-label">
                <Mail size={14} className="auth-label-icon" />
                <span>Work Email</span>
              </label>
              <div className="auth-input-wrapper">
                <input
                  id="auth-email"
                  type="email"
                  required
                  placeholder="e.g. staff@gusstora.com"
                  className="auth-input"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="auth-password" className="auth-label">
                <Lock size={14} className="auth-label-icon" />
                <span>Password</span>
              </label>
              <div className="auth-input-wrapper">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your account password"
                  className="auth-input has-action"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={17} className="spin" />
                  <span>Verifying credentials…</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Card Footer */}
          <div className="auth-footer-section">
            <div className="auth-onboard-cta">
              <span className="auth-onboard-text">New café partner?</span>
              <Link to="/onboard" className="auth-onboard-link">
                <Sparkles size={13} className="auth-onboard-sparkle" />
                <span>Register your café in 2 minutes</span>
                <ArrowRight size={13} className="auth-onboard-arrow" />
              </Link>
            </div>
            <Link to="/c/demo-cafe" className="auth-guest-link">
              <Coffee size={14} />
              <span>Looking for diner menu? Open Guest Ordering View</span>
              <ArrowRight size={13} />
            </Link>
            <div className="auth-security-note">
              <ShieldCheck size={13} />
              <span>Protected by GUESTORA Multi-Tenant RBAC Security</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  Trash2,
  X,
  Clock,
  User,
  ShoppingBag,
  AlertCircle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import {
  getPendingOfflineOrders,
  syncOfflineOrders,
  clearAllOfflineOrders,
  removeOfflineOrder,
} from '../utils/offlineStore';

export default function OfflineSyncModal({ isOpen, onClose, api, isOnline, onSyncSuccess }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadPending();
      setSyncResult(null);
      setError(null);
    }
  }, [isOpen]);

  async function loadPending() {
    setLoading(true);
    try {
      const pending = await getPendingOfflineOrders();
      setOrders(pending || []);
    } catch (err) {
      setError('Failed to load pending queue: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await syncOfflineOrders(api);
      setSyncResult(res);
      await loadPending();
      if (onSyncSuccess) onSyncSuccess(res);
    } catch (err) {
      setError(err.message || 'Offline sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleClear() {
    if (!window.confirm('Are you sure you want to discard all queued offline orders? This cannot be undone.')) {
      return;
    }
    await clearAllOfflineOrders();
    await loadPending();
  }

  async function handleRemove(id) {
    await removeOfflineOrder(id);
    await loadPending();
  }

  if (!isOpen) return null;

  return (
    <div className="hw-modal-backdrop" onClick={onClose}>
      <div
        className="hw-modal-card"
        style={{ maxWidth: '680px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="hw-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isOnline ? '#10b981' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
            </div>
            <div>
              <h2 className="hw-modal-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                Offline POS Outbox Reconciler
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#a39082' }}>
                {isOnline ? 'Online Reconnected • Ready for Cloud Sync' : 'Operating Offline • Stored in Register IndexedDB'}
              </span>
            </div>
          </div>
          <button type="button" className="hw-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Sync Summary Result Banner */}
        {syncResult && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: '16px 20px 0 20px',
              fontSize: '13px',
            }}
          >
            <CheckCircle2 size={18} />
            <span>Successfully synced {syncResult.syncedCount || 0} order(s) to cloud database!</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: '16px 20px 0 20px',
              fontSize: '13px',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Orders List */}
        <div style={{ padding: '20px', maxHeight: '50vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#8c786a' }}>
              Loading queue...
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8c786a' }}>
              <Layers size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#d1c2b5' }}>
                All Outbox Orders Synced
              </div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>
                No pending offline orders in browser storage. Every ticket has been reconciled with the server.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {orders.map((o) => (
                <div
                  key={o.offlineId}
                  style={{
                    background: '#1a110b',
                    border: '1px solid #362217',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          background: 'rgba(23, 107, 80, 0.2)',
                          color: '#176B50',
                          fontWeight: '700',
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        {o.orderNo || o.offlineId}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#f5ede4' }}>
                        {o.customerName || 'Walk-in Guest'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#8c786a' }}>
                        ({o.table || 'Counter'})
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#a39082', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ShoppingBag size={12} />
                        {(o.items || []).length} items
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ textTransform: 'capitalize', color: '#d1c2b5' }}>
                        Mode: {o.paymentMethod || 'cash'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#176B50' }}>
                        ₹{Number(o.total || 0).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '10px', color: '#10b981', textTransform: 'uppercase' }}>
                        Queued
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(o.offlineId)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#6b5749',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '6px',
                      }}
                      title="Discard single order"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #362217',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#160e09',
            borderRadius: '0 0 20px 20px',
          }}
        >
          {orders.length > 0 ? (
            <button
              type="button"
              className="hw-btn-secondary"
              onClick={handleClear}
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              <Trash2 size={15} />
              <span>Clear Outbox</span>
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="hw-btn-secondary" onClick={onClose}>
              Close
            </button>

            {orders.length > 0 && (
              <button
                type="button"
                className="hw-btn-primary"
                onClick={handleSync}
                disabled={syncing || !isOnline}
                title={!isOnline ? 'Connect to internet to sync' : undefined}
              >
                <RefreshCw size={15} className={syncing ? 'hw-spin' : ''} />
                <span>{syncing ? 'Syncing...' : `Sync All (${orders.length})`}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

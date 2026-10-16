import React from 'react';
import { Coins, Lock, Receipt, History, X, Check, RefreshCw, Printer } from 'lucide-react';

export default function ShiftModals({
  shiftModalMode,
  setShiftModalMode,
  currentShiftData,
  currentUser,
  openingFloatInput,
  setOpeningFloatInput,
  closingCountedInput,
  setClosingCountedInput,
  shiftNotesInput,
  setShiftNotesInput,
  savingShiftAction,
  handleOpenShift,
  handleCloseShift,
  zReportModalData,
  setZReportModalData,
  shiftsHistoryList,
  loadingShiftsHistory,
  fetchZReport,
  cafe,
  money
}) {
  return (
    <>
      {/* ===================== OPEN REGISTER SHIFT MODAL ===================== */}
      {shiftModalMode === 'open' && (
        <div className="modal-backdrop" onClick={() => setShiftModalMode(null)}>
          <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef3c7', display: 'grid', placeItems: 'center', color: '#b45309' }}>
                  <Coins size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#1a120c' }}>Open Register Shift</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#777' }}>Initialize register cash float & begin sales tracking</p>
                </div>
              </div>
              <button className="modal-close-icon" onClick={() => setShiftModalMode(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleOpenShift} style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                  Cashier on Duty
                </label>
                <input
                  type="text"
                  disabled
                  value={currentUser?.name || 'Current Cashier'}
                  style={{ background: '#f8f4ee', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                  Opening Cash Float (₹) <span style={{ color: '#ea7a33' }}>*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  required
                  value={openingFloatInput}
                  onChange={e => setOpeningFloatInput(e.target.value)}
                  placeholder="Enter opening drawer cash amount"
                  style={{ fontSize: 16, fontWeight: 700 }}
                />
                <div className="quick-float-chips">
                  {[500, 1000, 2000, 3000, 5000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      className="quick-amount-chip"
                      onClick={() => setOpeningFloatInput(amt)}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
                <small style={{ color: '#888', marginTop: 4, display: 'block' }}>
                  Physical cash in drawer before accepting diner orders.
                </small>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                  Shift Opening Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={shiftNotesInput}
                  onChange={e => setShiftNotesInput(e.target.value)}
                  placeholder="e.g. Morning opening shift, clean drawer, change loaded."
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setShiftModalMode(null)}
                  disabled={savingShiftAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary"
                  disabled={savingShiftAction}
                >
                  <Check size={16} />
                  <span>{savingShiftAction ? 'Opening Shift…' : 'Start Register Shift'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== CASH DRAWER RECONCILIATION & CLOSE SHIFT ===================== */}
      {shiftModalMode === 'close' && currentShiftData && (
        <div className="modal-backdrop" onClick={() => setShiftModalMode(null)}>
          <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fee2e2', display: 'grid', placeItems: 'center', color: '#b91c1c' }}>
                  <Lock size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#1a120c' }}>Close Shift & Day-End Z-Report</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#777' }}>Count drawer cash, reconcile variances, & produce Day-End report</p>
                </div>
              </div>
              <button className="modal-close-icon" onClick={() => setShiftModalMode(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCloseShift} style={{ padding: '20px' }}>
              <div className="drawer-reconcile-card">
                <div style={{ fontSize: 12, fontWeight: 700, color: '#553e2e', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Live Drawer Financials (Shift #{currentShiftData.shiftCode || 'Active'})
                </div>
                <div className="drawer-stat-grid">
                  <div className="drawer-stat-box">
                    <span className="drawer-stat-label">Opening Float</span>
                    <span className="drawer-stat-val">₹{(currentShiftData.openingFloat || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="drawer-stat-box">
                    <span className="drawer-stat-label">Cash Collected</span>
                    <span className="drawer-stat-val">₹{(currentShiftData.summary?.cashCollected || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="drawer-stat-box">
                    <span className="drawer-stat-label">UPI / Online</span>
                    <span className="drawer-stat-val">₹{(currentShiftData.summary?.onlineCollected || (currentShiftData.summary?.netSales || 0) - (currentShiftData.summary?.cashCollected || 0)).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="drawer-stat-box" style={{ background: '#fff7ed', borderColor: '#fdba74' }}>
                    <span className="drawer-stat-label" style={{ color: '#ea7a33' }}>Expected in Drawer</span>
                    <span className="drawer-stat-val" style={{ color: '#ea7a33' }}>
                      ₹{((currentShiftData.openingFloat || 0) + (currentShiftData.summary?.cashCollected || 0)).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#332211', margin: 0 }}>
                    Counted Physical Cash (₹) <span style={{ color: '#ea7a33' }}>*</span>
                  </label>
                  {closingCountedInput !== '' && (() => {
                    const expected = (currentShiftData.openingFloat || 0) + (currentShiftData.summary?.cashCollected || 0);
                    const counted = Number(closingCountedInput) || 0;
                    const diff = counted - expected;
                    if (diff === 0) {
                      return <span className="variance-badge balanced">✓ BALANCED (₹0)</span>;
                    } else if (diff < 0) {
                      return <span className="variance-badge shortage">⚠ SHORTAGE (-₹{Math.abs(diff).toLocaleString('en-IN')})</span>;
                    } else {
                      return <span className="variance-badge surplus">▲ SURPLUS (+₹{diff.toLocaleString('en-IN')})</span>;
                    }
                  })()}
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={closingCountedInput}
                  onChange={e => setClosingCountedInput(e.target.value)}
                  placeholder="Enter physical cash counted in drawer"
                  style={{ fontSize: 18, fontWeight: 800, padding: '12px' }}
                />
                <small style={{ color: '#888', marginTop: 4, display: 'block' }}>
                  Count all bank notes and coins physically present in the till.
                </small>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                  Closing / Handover Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={shiftNotesInput}
                  onChange={e => setShiftNotesInput(e.target.value)}
                  placeholder="e.g. Handover to evening shift, ₹50 shortage due to loose coins."
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setShiftModalMode(null)}
                  disabled={savingShiftAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary"
                  disabled={savingShiftAction || closingCountedInput === ''}
                  style={{ background: '#b91c1c', borderColor: '#b91c1c' }}
                >
                  <Lock size={16} />
                  <span>{savingShiftAction ? 'Closing Shift…' : 'Close Shift & Print Z-Report'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== THERMAL DAY-END Z-REPORT MODAL ===================== */}
      {zReportModalData && (
        <div className="kot-receipt-preview-modal-backdrop" onClick={() => setZReportModalData(null)}>
          <div className="kot-receipt-preview-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="kot-preview-header">
              <div className="kot-preview-title">
                <Receipt size={16} />
                <span>Day-End Z-Report (Shift Close)</span>
              </div>
              <button
                className="customizer-close-btn"
                onClick={() => setZReportModalData(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="z-report-thermal-receipt">
              <div className="kot-head-brand">
                <h2 className="kot-cafe-name">{zReportModalData.cafeName || cafe?.name || 'GUSSTORA ARTISAN ROASTERY'}</h2>
                <div style={{ fontSize: 11, color: '#444', marginBottom: 4 }}>
                  {cafe?.tagline || 'Craft Coffee & Artisanal Kitchen'}
                </div>
                <div className="kot-doc-type">
                  *** DAY-END Z-REPORT (SHIFT CLOSE) ***
                </div>
              </div>

              <table className="kot-meta-table">
                <tbody>
                  <tr>
                    <td><strong>SHIFT CODE:</strong></td>
                    <td className="td-right">#{zReportModalData.shiftCode || 'Z-001'}</td>
                  </tr>
                  <tr>
                    <td><strong>CASHIER:</strong></td>
                    <td className="td-right">{zReportModalData.cashierName || 'Cashier'}</td>
                  </tr>
                  <tr>
                    <td><strong>OPENED AT:</strong></td>
                    <td className="td-right">
                      {new Date(zReportModalData.openedAt || Date.now()).toLocaleDateString('en-IN')}{' '}
                      {new Date(zReportModalData.openedAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>CLOSED AT:</strong></td>
                    <td className="td-right">
                      {new Date(zReportModalData.closedAt || Date.now()).toLocaleDateString('en-IN')}{' '}
                      {new Date(zReportModalData.closedAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>DURATION:</strong></td>
                    <td className="td-right">
                      {Math.round(((new Date(zReportModalData.closedAt || Date.now())) - (new Date(zReportModalData.openedAt || Date.now()))) / 60000)} mins
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="kot-divider-dashed" />

              <div style={{ fontSize: 12, fontWeight: 700, margin: '6px 0 4px', textTransform: 'uppercase' }}>
                SALES & REVENUE SUMMARY
              </div>
              <table className="kot-meta-table">
                <tbody>
                  <tr>
                    <td>Gross Orders Count:</td>
                    <td className="td-right">{zReportModalData.ordersCount || 0}</td>
                  </tr>
                  <tr>
                    <td>Gross Sales:</td>
                    <td className="td-right">₹{(zReportModalData.grossSales || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td>Discounts / Promos:</td>
                    <td className="td-right" style={{ color: '#b91c1c' }}>-₹{(zReportModalData.totalDiscounts || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td>GST / Tax Collected:</td>
                    <td className="td-right">₹{(zReportModalData.gstCollected || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr style={{ fontSize: 14, fontWeight: 800, borderTop: '1px solid #000' }}>
                    <td style={{ paddingTop: 4 }}>NET REVENUE:</td>
                    <td className="td-right" style={{ paddingTop: 4 }}>₹{(zReportModalData.netSales || 0).toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>

              <div className="kot-divider-dashed" />

              <div style={{ fontSize: 12, fontWeight: 700, margin: '6px 0 4px', textTransform: 'uppercase' }}>
                PAYMENT TENDER BREAKDOWN
              </div>
              <table className="kot-meta-table">
                <tbody>
                  <tr>
                    <td>Cash Sales:</td>
                    <td className="td-right">₹{(zReportModalData.cashCollected || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td>UPI / Digital:</td>
                    <td className="td-right">₹{(zReportModalData.upiCollected || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td>Card / Debit:</td>
                    <td className="td-right">₹{(zReportModalData.cardCollected || 0).toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>

              <div className="kot-divider-dashed" />

              <div style={{ fontSize: 12, fontWeight: 700, margin: '6px 0 4px', textTransform: 'uppercase' }}>
                CASH DRAWER RECONCILIATION
              </div>
              <table className="kot-meta-table">
                <tbody>
                  <tr>
                    <td>Opening Float:</td>
                    <td className="td-right">₹{(zReportModalData.openingFloat || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td>+ Cash Sales Collected:</td>
                    <td className="td-right">₹{(zReportModalData.cashCollected || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr style={{ fontWeight: 700 }}>
                    <td>= Expected Drawer Cash:</td>
                    <td className="td-right">₹{(zReportModalData.expectedCash || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr style={{ fontWeight: 800 }}>
                    <td>Actual Counted Cash:</td>
                    <td className="td-right">₹{(zReportModalData.countedCash || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr style={{ fontWeight: 900, fontSize: 13, borderTop: '1px dashed #000' }}>
                    <td style={{ paddingTop: 4 }}>CASH VARIANCE:</td>
                    <td className="td-right" style={{ paddingTop: 4 }}>
                      {zReportModalData.variance === 0
                        ? 'BALANCED (₹0)'
                        : zReportModalData.variance < 0
                          ? `SHORTAGE (-₹${Math.abs(zReportModalData.variance).toLocaleString('en-IN')})`
                          : `SURPLUS (+₹${zReportModalData.variance.toLocaleString('en-IN')})`}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="kot-divider-dashed" />

              {zReportModalData.categorySales && Object.keys(zReportModalData.categorySales).length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, margin: '6px 0 4px', textTransform: 'uppercase' }}>
                    CATEGORY TALLY
                  </div>
                  <table className="kot-meta-table">
                    <tbody>
                      {Object.entries(zReportModalData.categorySales).map(([cat, val]) => (
                        <tr key={cat}>
                          <td>{cat}:</td>
                          <td className="td-right">₹{Number(val).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="kot-divider-dashed" />
                </>
              )}

              {zReportModalData.notes && (
                <div style={{ marginTop: 8, fontSize: 11, fontStyle: 'italic' }}>
                  Shift Note: {zReportModalData.notes}
                </div>
              )}

              <div className="z-report-signatures">
                <div>
                  <div>___________________</div>
                  <div style={{ marginTop: 2 }}>Cashier Signature</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>___________________</div>
                  <div style={{ marginTop: 2 }}>Manager Signature</div>
                </div>
              </div>

              <div className="kot-receipt-footer" style={{ marginTop: 12 }}>
                <div>Official System Generated Z-Report</div>
                <div style={{ marginTop: 2 }}>Non-Resettable Register Totals Sealed</div>
              </div>
            </div>

            <div className="kot-actions-bar">
              <button
                type="button"
                className="kot-print-btn"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>Print ESC/POS (80mm)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PAST SHIFTS HISTORY MODAL ===================== */}
      {shiftModalMode === 'history' && (
        <div className="modal-backdrop" onClick={() => setShiftModalMode(null)}>
          <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f5ebe0', display: 'grid', placeItems: 'center', color: '#ea7a33' }}>
                  <History size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#1a120c' }}>Past Register Shifts & Z-Reports</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#777' }}>Audited shift closures, cash variance records, and printable Z-reports</p>
                </div>
              </div>
              <button className="modal-close-icon" onClick={() => setShiftModalMode(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px', maxHeight: '520px', overflowY: 'auto' }}>
              {loadingShiftsHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                  <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
                  <p>Loading shifts history…</p>
                </div>
              ) : shiftsHistoryList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                  <Lock size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p>No past closed shifts recorded yet.</p>
                </div>
              ) : (
                <table className="shifts-history-table">
                  <thead>
                    <tr>
                      <th>Shift Code</th>
                      <th>Cashier</th>
                      <th>Date & Time</th>
                      <th>Sales</th>
                      <th>Variance</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftsHistoryList.map(s => (
                      <tr key={s._id}>
                        <td><strong>#{s.shiftCode || 'SHF'}</strong></td>
                        <td>{s.cashierName}</td>
                        <td>
                          {new Date(s.openedAt).toLocaleDateString('en-IN')}{' '}
                          <small style={{ color: '#888' }}>
                            ({new Date(s.openedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})
                          </small>
                        </td>
                        <td><strong>₹{(s.summary?.netSales || 0).toLocaleString('en-IN')}</strong></td>
                        <td>
                          {s.summary?.varianceStatus === 'BALANCED' ? (
                            <span className="variance-badge balanced" style={{ padding: '2px 8px', fontSize: 11 }}>Balanced</span>
                          ) : s.summary?.varianceStatus === 'SHORTAGE' ? (
                            <span className="variance-badge shortage" style={{ padding: '2px 8px', fontSize: 11 }}>-₹{Math.abs(s.summary?.variance || 0)}</span>
                          ) : s.summary?.varianceStatus === 'SURPLUS' ? (
                            <span className="variance-badge surplus" style={{ padding: '2px 8px', fontSize: 11 }}>+₹{s.summary?.variance || 0}</span>
                          ) : (
                            '--'
                          )}
                        </td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: s.status === 'open' ? '#dcfce7' : '#f3f4f6',
                            color: s.status === 'open' ? '#15803d' : '#4b5563'
                          }}>
                            {s.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="crm-btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            onClick={() => fetchZReport(s._id)}
                          >
                            <Receipt size={13} />
                            <span>Z-Report</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

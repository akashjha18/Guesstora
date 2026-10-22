import React from 'react';
import { Armchair, Scissors, Percent, Tag, X, Check } from 'lucide-react';

export default function BillOperationsModals({
  transferOrderModal,
  setTransferOrderModal,
  transferTargetTable,
  setTransferTargetTable,
  submittingTransfer,
  handleTransferTable,
  splitOrderModal,
  setSplitOrderModal,
  splitDinerCount,
  setSplitDinerCount,
  submittingSplit,
  handleSplitBill,
  payingSplitId,
  handlePaySplit,
  discountOrderModal,
  setDiscountOrderModal,
  discountTypeInput,
  setDiscountTypeInput,
  discountValueInput,
  setDiscountValueInput,
  discountPromoInput,
  setDiscountPromoInput,
  validatingPromo,
  handleValidatePromo,
  promoValidationResult,
  discountReasonInput,
  setDiscountReasonInput,
  discountAuthorizedBy,
  setDiscountAuthorizedBy,
  submittingDiscount,
  handleApplyDiscount,
  showAddPromoModal,
  setShowAddPromoModal,
  promoCodeForm,
  setPromoCodeForm,
  savingPromoCode,
  handleCreatePromoCode,
  currentUser
}) {
  return (
    <>
      {/* ===================== TRANSFER TABLE MODAL ===================== */}
      {transferOrderModal && (
        <div className="modal-backdrop" onClick={() => setTransferOrderModal(null)}>
          <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ffedd5', display: 'grid', placeItems: 'center', color: '#176B50' }}>
                  <Armchair size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#1a120c' }}>Transfer Order #{transferOrderModal.orderNo}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#777' }}>
                    Currently at: <b>Table {transferOrderModal.table || 'Takeaway'}</b>
                  </p>
                </div>
              </div>
              <button className="modal-close-icon" onClick={() => setTransferOrderModal(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleTransferTable} style={{ padding: '20px' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 8 }}>
                  Select Destination Table
                </label>
                <div className="table-transfer-grid">
                  {['Takeaway', 'Counter', ...Array.from({ length: 12 }, (_, i) => String(i + 1))].map(tbl => (
                    <button
                      key={tbl}
                      type="button"
                      className={`table-transfer-btn ${transferTargetTable === tbl ? 'active' : ''}`}
                      onClick={() => setTransferTargetTable(tbl)}
                    >
                      {tbl === 'Takeaway' || tbl === 'Counter' ? tbl : `Table ${tbl}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                  Or Custom Destination
                </label>
                <input
                  type="text"
                  value={transferTargetTable}
                  onChange={e => setTransferTargetTable(e.target.value)}
                  placeholder="e.g. Table 14, Garden Gazebo, Bar Stool 3"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setTransferOrderModal(null)}
                  disabled={submittingTransfer}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary"
                  disabled={submittingTransfer || !transferTargetTable}
                >
                  <Check size={16} />
                  <span>{submittingTransfer ? 'Transferring…' : 'Confirm Transfer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== BILL SPLIT MODAL ===================== */}
      {splitOrderModal && (
        <div className="modal-backdrop" onClick={() => setSplitOrderModal(null)}>
          <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ede9fe', display: 'grid', placeItems: 'center', color: '#6d28d9' }}>
                  <Scissors size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#1a120c' }}>Split Bill - #{splitOrderModal.orderNo}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#777' }}>Total Payable: <b>₹{(splitOrderModal.total || 0).toLocaleString('en-IN')}</b></p>
                </div>
              </div>
              <button className="modal-close-icon" onClick={() => setSplitOrderModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 8 }}>
                  Number of Diners (Equal Split)
                </label>
                <div className="split-diners-grid">
                  {[2, 3, 4, 5, 6].map(num => (
                    <button
                      key={num}
                      type="button"
                      className={`split-diners-btn ${splitDinerCount === num ? 'active' : ''}`}
                      onClick={() => setSplitDinerCount(num)}
                    >
                      {num} Diners
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="crm-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
                  onClick={handleSplitBill}
                  disabled={submittingSplit}
                >
                  <Scissors size={14} />
                  <span>
                    {submittingSplit ? 'Calculating Split…' : `Generate Split (${splitDinerCount} Shares × ₹${Math.ceil((splitOrderModal.total || 0) / splitDinerCount)})`}
                  </span>
                </button>
              </div>

              {/* Render Shares */}
              {Array.isArray(splitOrderModal.splitBills) && splitOrderModal.splitBills.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#4a3424', marginBottom: 10 }}>
                    Individual Diner Shares ({splitOrderModal.splitBills.filter(s => s.paymentStatus === 'paid').length} / {splitOrderModal.splitBills.length} Settled)
                  </div>
                  <div className="split-shares-container">
                    {splitOrderModal.splitBills.map((s, idx) => (
                      <div key={s.id || idx} className={`split-share-card ${s.paymentStatus === 'paid' ? 'paid' : ''}`}>
                        <div>
                          <div className="split-share-name">{s.label}</div>
                          <div className="split-share-amount">₹{s.amount.toLocaleString('en-IN')}</div>
                          {s.paymentMethod && (
                            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                              Paid via {(s.paymentMethod).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div>
                          {s.paymentStatus === 'paid' ? (
                            <span className="variance-badge balanced" style={{ padding: '4px 10px', fontSize: 12 }}>
                              ✓ Settled
                            </span>
                          ) : (
                            <div className="split-pay-actions">
                              <button
                                type="button"
                                className="split-pay-mini-btn"
                                disabled={payingSplitId === s.id}
                                onClick={() => handlePaySplit(splitOrderModal._id, s.id, 'cash')}
                              >
                                Cash
                              </button>
                              <button
                                type="button"
                                className="split-pay-mini-btn"
                                disabled={payingSplitId === s.id}
                                onClick={() => handlePaySplit(splitOrderModal._id, s.id, 'upi')}
                              >
                                UPI
                              </button>
                              <button
                                type="button"
                                className="split-pay-mini-btn"
                                disabled={payingSplitId === s.id}
                                onClick={() => handlePaySplit(splitOrderModal._id, s.id, 'card')}
                              >
                                Card
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setSplitOrderModal(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== APPLY DISCOUNT & PROMO MODAL ===================== */}
      {discountOrderModal && (
        <div className="modal-backdrop" onClick={() => setDiscountOrderModal(null)}>
          <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dcfce7', display: 'grid', placeItems: 'center', color: '#16a34a' }}>
                  <Percent size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#1a120c' }}>Apply Discount - #{discountOrderModal.orderNo}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#777' }}>
                    Subtotal: <b>₹{(discountOrderModal.subtotal || discountOrderModal.total || 0).toLocaleString('en-IN')}</b>
                  </p>
                </div>
              </div>
              <button className="modal-close-icon" onClick={() => setDiscountOrderModal(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyDiscount} style={{ padding: '20px' }}>
              <div className="discount-type-tabs">
                <button
                  type="button"
                  className={`discount-tab-btn ${discountTypeInput === 'percent' ? 'active' : ''}`}
                  onClick={() => setDiscountTypeInput('percent')}
                >
                  Percentage (%)
                </button>
                <button
                  type="button"
                  className={`discount-tab-btn ${discountTypeInput === 'flat' ? 'active' : ''}`}
                  onClick={() => setDiscountTypeInput('flat')}
                >
                  Flat Rupee (₹)
                </button>
                <button
                  type="button"
                  className={`discount-tab-btn ${discountTypeInput === 'promo' ? 'active' : ''}`}
                  onClick={() => setDiscountTypeInput('promo')}
                >
                  Promo Code
                </button>
              </div>

              {discountTypeInput === 'percent' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                    Quick Discount Presets
                  </label>
                  <div className="discount-preset-chips">
                    {[5, 10, 15, 20, 25].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        className={`discount-chip ${Number(discountValueInput) === pct ? 'active' : ''}`}
                        onClick={() => setDiscountValueInput(pct)}
                      >
                        {pct}% Off
                      </button>
                    ))}
                  </div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                    Custom Discount Percentage
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={discountValueInput}
                    onChange={e => setDiscountValueInput(e.target.value)}
                    placeholder="e.g. 10"
                    required
                  />
                </div>
              )}

              {discountTypeInput === 'flat' && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                    Flat Discount Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={discountValueInput}
                    onChange={e => setDiscountValueInput(e.target.value)}
                    placeholder="e.g. 50"
                    required
                  />
                </div>
              )}

              {discountTypeInput === 'promo' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                    Enter Promo Code
                  </label>
                  <div className="promo-verify-row">
                    <input
                      type="text"
                      value={discountPromoInput}
                      onChange={e => setDiscountPromoInput(e.target.value)}
                      placeholder="e.g. ROAST20, WELCOME10"
                      required
                    />
                    <button
                      type="button"
                      className="crm-btn-secondary"
                      onClick={() => handleValidatePromo(discountPromoInput)}
                      disabled={validatingPromo || !discountPromoInput}
                    >
                      {validatingPromo ? 'Checking…' : 'Verify'}
                    </button>
                  </div>

                  {promoValidationResult && (
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      marginBottom: 10,
                      background: promoValidationResult.valid ? '#ecfdf5' : '#fef2f2',
                      color: promoValidationResult.valid ? '#047857' : '#b91c1c',
                      border: `1px solid ${promoValidationResult.valid ? '#a7f3d0' : '#fecaca'}`
                    }}>
                      {promoValidationResult.valid
                        ? `✓ Valid Code! ${promoValidationResult.promo?.discountType === 'percent' ? `${promoValidationResult.promo?.discountValue}% off` : `₹${promoValidationResult.promo?.discountValue} off`} (Saved ₹${promoValidationResult.discountAmount})`
                        : `✕ ${promoValidationResult.message || 'Invalid promo code'}`}
                    </div>
                  )}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                  Discount Reason <span style={{ color: '#176B50' }}>*</span>
                </label>
                <input
                  type="text"
                  value={discountReasonInput}
                  onChange={e => setDiscountReasonInput(e.target.value)}
                  placeholder="e.g. Happy Hour, Owner Courtesy, Regular Customer"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                  Authorized By
                </label>
                <input
                  type="text"
                  value={discountAuthorizedBy}
                  onChange={e => setDiscountAuthorizedBy(e.target.value)}
                  placeholder={currentUser?.name || 'Manager'}
                />
              </div>

              {(() => {
                const sub = discountOrderModal.subtotal || discountOrderModal.total || 0;
                let dAmt = 0;
                if (discountTypeInput === 'percent') {
                  dAmt = Math.round(sub * (Number(discountValueInput) || 0) / 100);
                } else if (discountTypeInput === 'flat') {
                  dAmt = Number(discountValueInput) || 0;
                } else if (promoValidationResult?.valid) {
                  dAmt = promoValidationResult.discountAmount || 0;
                }
                const final = Math.max(0, sub - dAmt);
                return (
                  <div className="discount-preview-summary">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Original Subtotal:</span>
                      <span>₹{sub.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 700 }}>
                      <span>Discount Applied:</span>
                      <span>- ₹{dAmt.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, borderTop: '1px solid #ddd', paddingTop: 6 }}>
                      <span>Final Bill Amount:</span>
                      <span style={{ color: '#176B50' }}>₹{final.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setDiscountOrderModal(null)}
                  disabled={submittingDiscount}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary"
                  disabled={submittingDiscount}
                >
                  <Check size={16} />
                  <span>{submittingDiscount ? 'Applying…' : 'Apply Discount'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== CREATE PROMO CODE MODAL ===================== */}
      {showAddPromoModal && (
        <div className="modal-backdrop" onClick={() => setShowAddPromoModal(false)}>
          <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef3c7', display: 'grid', placeItems: 'center', color: '#b45309' }}>
                  <Tag size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#1a120c' }}>Create New Promo Code</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#777' }}>Discount voucher for marketing & cashier POS</p>
                </div>
              </div>
              <button className="modal-close-icon" onClick={() => setShowAddPromoModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreatePromoCode} style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                  Promo Code Voucher <span style={{ color: '#176B50' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={promoCodeForm.code}
                  onChange={e => setPromoCodeForm({ ...promoCodeForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. ROAST20, FESTIVE50"
                  style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                    Discount Type
                  </label>
                  <select
                    value={promoCodeForm.discountType}
                    onChange={e => setPromoCodeForm({ ...promoCodeForm, discountType: e.target.value })}
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Flat Rupee (₹)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                    Discount Value <span style={{ color: '#176B50' }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={promoCodeForm.discountValue}
                    onChange={e => setPromoCodeForm({ ...promoCodeForm, discountValue: e.target.value })}
                    placeholder="e.g. 15 or 50"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                    Min Order Value (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={promoCodeForm.minOrderValue}
                    onChange={e => setPromoCodeForm({ ...promoCodeForm, minOrderValue: e.target.value })}
                    placeholder="e.g. 200"
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#332211', marginBottom: 6 }}>
                    Max Cap Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={promoCodeForm.maxDiscount}
                    onChange={e => setPromoCodeForm({ ...promoCodeForm, maxDiscount: e.target.value })}
                    placeholder="e.g. 100 (0 = no limit)"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setShowAddPromoModal(false)}
                  disabled={savingPromoCode}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary"
                  disabled={savingPromoCode}
                >
                  <Check size={16} />
                  <span>{savingPromoCode ? 'Creating…' : 'Save Promo Code'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

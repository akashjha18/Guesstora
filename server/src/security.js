export function createRateLimiter({ maxRequests = 20, windowMs = 60000 } = {}) {
  const state = { calls: [], maxRequests, windowMs };

  return function checkLimit() {
    const now = Date.now();
    state.calls = state.calls.filter(ts => now - ts < state.windowMs);
    if (state.calls.length >= state.maxRequests) {
      return false;
    }
    state.calls.push(now);
    return true;
  };
}

export function validatePublicOrderPayload(payload) {
  const name = String(payload?.name || '').trim();
  const phone = String(payload?.phone || '').replace(/\D/g, '').slice(-10);
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (!name || phone.length !== 10 || !items.length) {
    throw new Error('Name, valid mobile and items are required.');
  }

  const validItems = items.filter(item => item && Number(item.quantity) > 0 && item.menuItemId);
  if (!validItems.length) {
    throw new Error('At least one valid item is required.');
  }

  return { name, phone, items: validItems };
}

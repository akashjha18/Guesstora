export function createRateLimiter({ maxRequests = 20, windowMs = 60000 } = {}) {
  const callsByKey = new Map();
  let requestsSinceCleanup = 0;

  return function checkLimit(key = 'global') {
    const now = Date.now();
    const normalizedKey = String(key || 'unknown');
    const calls = (callsByKey.get(normalizedKey) || []).filter(ts => now - ts < windowMs);
    if (calls.length >= maxRequests) {
      callsByKey.set(normalizedKey, calls);
      return false;
    }
    calls.push(now);
    callsByKey.set(normalizedKey, calls);

    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= 1000) {
      requestsSinceCleanup = 0;
      for (const [storedKey, timestamps] of callsByKey) {
        const activeCalls = timestamps.filter(ts => now - ts < windowMs);
        if (activeCalls.length) callsByKey.set(storedKey, activeCalls);
        else callsByKey.delete(storedKey);
      }
    }
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

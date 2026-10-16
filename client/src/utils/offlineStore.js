/**
 * Gusstora Offline-First PWA Storage & Reconciler
 * Uses browser IndexedDB with fallback to localStorage.
 * Enables zero-downtime offline billing, local ticket generation, and automated sync reconciliation.
 */

const DB_NAME = 'gusstora_offline_db';
const DB_VERSION = 1;
const FALLBACK_MENU_KEY = 'gusstora_cached_menu';
const FALLBACK_QUEUE_KEY = 'gusstora_offline_order_queue';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('menu_cache')) {
        db.createObjectStore('menu_cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('offline_orders')) {
        const store = db.createObjectStore('offline_orders', { keyPath: 'offlineId' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ----------------------------------------------------
// 1. Menu Catalog Cache
// ----------------------------------------------------

export async function cacheMenuCatalog(menu = []) {
  try {
    const db = await openDb();
    const tx = db.transaction('menu_cache', 'readwrite');
    const store = tx.objectStore('menu_cache');
    store.put({ id: 'active_menu', menu, cachedAt: Date.now() });
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch (err) {
    // LocalStorage fallback
    try {
      localStorage.setItem(FALLBACK_MENU_KEY, JSON.stringify({ menu, cachedAt: Date.now() }));
    } catch (_) {}
  }
}

export async function getCachedMenuCatalog() {
  try {
    const db = await openDb();
    const tx = db.transaction('menu_cache', 'readonly');
    const store = tx.objectStore('menu_cache');
    const req = store.get('active_menu');
    const result = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = rej;
    });
    if (result && Array.isArray(result.menu)) return result.menu;
  } catch (err) {
    // LocalStorage fallback
    try {
      const raw = localStorage.getItem(FALLBACK_MENU_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.menu || [];
      }
    } catch (_) {}
  }
  return [];
}

// ----------------------------------------------------
// 2. Offline Orders Queue
// ----------------------------------------------------

export async function queueOfflineOrder(orderPayload) {
  const shortTimestamp = Date.now().toString().slice(-6);
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const offlineId = `OFF-${shortTimestamp}-${randomSuffix}`;
  const humanOrderNo = `OFF-${shortTimestamp.slice(-4)}`;

  const offlineEntry = {
    offlineId,
    orderNo: humanOrderNo,
    ...orderPayload,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  try {
    const db = await openDb();
    const tx = db.transaction('offline_orders', 'readwrite');
    const store = tx.objectStore('offline_orders');
    store.put(offlineEntry);
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch (err) {
    // LocalStorage fallback
    try {
      const raw = localStorage.getItem(FALLBACK_QUEUE_KEY);
      const queue = raw ? JSON.parse(raw) : [];
      queue.push(offlineEntry);
      localStorage.setItem(FALLBACK_QUEUE_KEY, JSON.stringify(queue));
    } catch (_) {}
  }

  // Notify UI
  window.dispatchEvent(new CustomEvent('gusstora:offline_queue_changed', { detail: { offlineEntry } }));
  return offlineEntry;
}

export async function getPendingOfflineOrders() {
  try {
    const db = await openDb();
    const tx = db.transaction('offline_orders', 'readonly');
    const store = tx.objectStore('offline_orders');
    const req = store.getAll();
    const results = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = rej;
    });
    if (Array.isArray(results)) {
      return results.filter(o => o.status === 'pending');
    }
  } catch (err) {
    try {
      const raw = localStorage.getItem(FALLBACK_QUEUE_KEY);
      if (raw) {
        const queue = JSON.parse(raw);
        return queue.filter(o => o.status === 'pending');
      }
    } catch (_) {}
  }
  return [];
}

export async function removeOfflineOrder(offlineId) {
  try {
    const db = await openDb();
    const tx = db.transaction('offline_orders', 'readwrite');
    tx.objectStore('offline_orders').delete(offlineId);
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch (err) {
    try {
      const raw = localStorage.getItem(FALLBACK_QUEUE_KEY);
      if (raw) {
        const queue = JSON.parse(raw).filter(o => o.offlineId !== offlineId);
        localStorage.setItem(FALLBACK_QUEUE_KEY, JSON.stringify(queue));
      }
    } catch (_) {}
  }
  window.dispatchEvent(new CustomEvent('gusstora:offline_queue_changed', { detail: { removedId: offlineId } }));
}

export async function clearAllOfflineOrders() {
  try {
    const db = await openDb();
    const tx = db.transaction('offline_orders', 'readwrite');
    tx.objectStore('offline_orders').clear();
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch (_) {
    localStorage.removeItem(FALLBACK_QUEUE_KEY);
  }
  window.dispatchEvent(new CustomEvent('gusstora:offline_queue_changed', { detail: { cleared: true } }));
}

// ----------------------------------------------------
// 3. Batch Synchronization Reconciler
// ----------------------------------------------------

export async function syncOfflineOrders(apiFn) {
  const pending = await getPendingOfflineOrders();
  if (!pending.length) {
    return { syncedCount: 0, totalSubmitted: 0, results: [] };
  }

  try {
    const response = await apiFn('/owner/orders/offline-sync', {
      method: 'POST',
      body: JSON.stringify({ orders: pending }),
    });

    if (response && response.success) {
      // Remove successfully synced or already_synced orders
      for (const resItem of response.results || []) {
        if (resItem.status === 'synced' || resItem.status === 'already_synced') {
          await removeOfflineOrder(resItem.offlineId);
        }
      }

      window.dispatchEvent(new CustomEvent('gusstora:offline_sync_completed', {
        detail: { count: response.syncedCount, results: response.results },
      }));

      return response;
    }
  } catch (err) {
    console.warn('Sync attempt failed, orders remain safely queued locally:', err);
    throw err;
  }
}

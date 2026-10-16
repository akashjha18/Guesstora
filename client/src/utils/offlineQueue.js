/**
 * PerkBite Offline POS Queue & Network Resilience Engine
 * Provides persistent local queueing for cashier operations during intermittent internet drops.
 */

const STORAGE_KEY = 'perkbyte_offline_pos_queue';

export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse offline queue:', err);
    return [];
  }
}

export function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('pos:queue_updated', { detail: { queue, count: queue.length } }));
  } catch (err) {
    console.error('Failed to persist offline queue:', err);
  }
}

export function enqueueOfflineOperation({ type, endpoint, method = 'POST', body, optimisticOrder }) {
  const queue = getOfflineQueue();
  const queueItem = {
    id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    endpoint,
    method,
    body,
    optimisticOrder,
    createdAt: new Date().toISOString()
  };

  queue.push(queueItem);
  saveOfflineQueue(queue);
  return queueItem;
}

export function removeQueueItem(id) {
  const queue = getOfflineQueue().filter(item => item.id !== id);
  saveOfflineQueue(queue);
}

export function clearOfflineQueue() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('pos:queue_updated', { detail: { queue: [], count: 0 } }));
  } catch {}
}

/**
 * Flush and replay all queued operations sequentially
 */
export async function flushOfflineQueue(apiFn) {
  const queue = getOfflineQueue();
  if (!queue.length) return { processed: 0, failed: 0, results: [] };

  const results = [];
  const remaining = [];
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await apiFn(item.endpoint, {
        method: item.method,
        body: JSON.stringify(item.body)
      });
      processed++;
      results.push({ item, success: true, res });
    } catch (err) {
      console.error(`Failed to replay offline operation ${item.id}:`, err);
      failed++;
      results.push({ item, success: false, error: err.message });
      // Keep in queue for next sync if server error
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  window.dispatchEvent(new CustomEvent('pos:queue_synced', { detail: { processed, failed, results } }));
  return { processed, failed, results };
}

/**
 * Gusstora Customer Facing Display (CFD) Synchronization Channel
 * Utilizes the HTML5 BroadcastChannel API for zero-latency local dual-screen communication,
 * with localStorage fallback for cross-process synchronization.
 */

const CHANNEL_NAME = 'gusstora_cfd_sync';
const STORAGE_STATE_KEY = 'gusstora_cfd_current_state';

let activeChannel = null;

function getChannel() {
  if (!activeChannel && typeof BroadcastChannel !== 'undefined') {
    activeChannel = new BroadcastChannel(CHANNEL_NAME);
  }
  return activeChannel;
}

/**
 * Broadcast event to customer screen
 * @param {Object} event - { type: 'CART_UPDATE' | 'ORDER_COMPLETED' | 'IDLE', payload: Object }
 */
export function broadcastToCfd(event) {
  const envelope = {
    ...event,
    timestamp: Date.now(),
  };

  try {
    const ch = getChannel();
    if (ch) {
      ch.postMessage(envelope);
    }
  } catch (err) {
    console.warn('BroadcastChannel error:', err);
  }

  // Cross-tab/window fallback
  try {
    localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(envelope));
  } catch (_) {}
}

/**
 * Subscribe to live CFD events on the customer screen
 * @param {Function} onEvent - callback receiving event envelope
 * @returns {Function} unsubscribe cleanup function
 */
export function subscribeToCfd(onEvent) {
  // 1. Initial hydrate from storage if available
  try {
    const raw = localStorage.getItem(STORAGE_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) onEvent(parsed);
    }
  } catch (_) {}

  // 2. BroadcastChannel listener
  const ch = getChannel();
  const handleBcMessage = (e) => {
    if (e.data) onEvent(e.data);
  };

  if (ch) {
    ch.addEventListener('message', handleBcMessage);
  }

  // 3. Storage event listener (fires across windows/tabs)
  const handleStorage = (e) => {
    if (e.key === STORAGE_STATE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed) onEvent(parsed);
      } catch (_) {}
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    if (ch) {
      ch.removeEventListener('message', handleBcMessage);
    }
    window.removeEventListener('storage', handleStorage);
  };
}

export function getCfdCurrentState() {
  try {
    const raw = localStorage.getItem(STORAGE_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

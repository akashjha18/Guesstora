/**
 * Real-Time Event Bus for Server-Sent Events (SSE)
 * Scoped by cafeId for multi-tenant isolation.
 */

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<{ id: string, res: import('express').Response, req: import('express').Request, role: string, createdAt: Date }>>} */
    this.cafeClients = new Map();
    this.keepaliveInterval = null;
  }

  /**
   * Set up SSE response headers and register client
   * @param {string} cafeId
   * @param {import('express').Response} res
   * @param {import('express').Request} req
   * @param {{ role?: string, label?: string }} [metadata]
   * @returns {string} clientId
   */
  subscribe(cafeId, res, req, metadata = {}) {
    const normCafeId = String(cafeId);
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    if (!this.cafeClients.has(normCafeId)) {
      this.cafeClients.set(normCafeId, new Set());
    }

    const client = {
      id: clientId,
      res,
      req,
      role: metadata.role || 'guest',
      label: metadata.label || 'client',
      createdAt: new Date(),
    };

    this.cafeClients.get(normCafeId).add(client);

    // Initial handshake message
    this.sendToResponse(res, 'connected', {
      status: 'connected',
      cafeId: normCafeId,
      clientId,
      timestamp: new Date().toISOString(),
    });

    const cleanup = () => {
      this.unsubscribe(normCafeId, clientId);
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('error', cleanup);

    return clientId;
  }

  /**
   * Unsubscribe a client
   * @param {string} cafeId
   * @param {string} clientId
   */
  unsubscribe(cafeId, clientId) {
    const normCafeId = String(cafeId);
    const clients = this.cafeClients.get(normCafeId);
    if (!clients) return;

    for (const client of clients) {
      if (client.id === clientId) {
        clients.delete(client);
        break;
      }
    }

    if (clients.size === 0) {
      this.cafeClients.delete(normCafeId);
    }
  }

  /**
   * Send SSE-formatted message to a single response stream
   * @param {import('express').Response} res
   * @param {string} event
   * @param {any} data
   */
  sendToResponse(res, event, data) {
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(payload);
    } catch {
      // Stream may have closed abruptly
    }
  }

  /**
   * Broadcast an event to all clients of a cafe
   * @param {string} cafeId
   * @param {string} event
   * @param {any} data
   * @returns {number} count of notified clients
   */
  broadcast(cafeId, event, data) {
    const normCafeId = String(cafeId);
    const clients = this.cafeClients.get(normCafeId);
    if (!clients || clients.size === 0) return 0;

    let delivered = 0;
    const deadClients = [];

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of clients) {
      try {
        client.res.write(payload);
        delivered++;
      } catch {
        deadClients.push(client.id);
      }
    }

    // Clean up any failed sockets
    for (const id of deadClients) {
      this.unsubscribe(normCafeId, id);
    }

    return delivered;
  }

  /**
   * Broadcast to all connected clients across all cafes
   * @param {string} event
   * @param {any} data
   * @returns {number} count of notified clients
   */
  broadcastGlobal(event, data) {
    let total = 0;
    for (const cafeId of this.cafeClients.keys()) {
      total += this.broadcast(cafeId, event, data);
    }
    return total;
  }

  /**
   * Returns active connection count
   * @param {string} [cafeId]
   * @returns {number}
   */
  getClientCount(cafeId) {
    if (cafeId) {
      return this.cafeClients.get(String(cafeId))?.size || 0;
    }
    let total = 0;
    for (const clients of this.cafeClients.values()) {
      total += clients.size;
    }
    return total;
  }

  /**
   * Send ping/keepalive comment to prevent reverse proxy timeouts
   */
  pingAll() {
    for (const [cafeId, clients] of this.cafeClients.entries()) {
      const dead = [];
      for (const client of clients) {
        try {
          client.res.write(': keepalive\n\n');
        } catch {
          dead.push(client.id);
        }
      }
      for (const id of dead) {
        this.unsubscribe(cafeId, id);
      }
    }
  }

  /**
   * Start keepalive interval
   * @param {number} [intervalMs=25000]
   */
  startKeepalive(intervalMs = 25000) {
    if (this.keepaliveInterval) return;
    this.keepaliveInterval = setInterval(() => {
      this.pingAll();
    }, intervalMs);
    if (this.keepaliveInterval.unref) {
      this.keepaliveInterval.unref();
    }
  }

  /**
   * Stop keepalive interval
   */
  stopKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }

  /**
   * Clear all active clients (useful for testing)
   */
  reset() {
    this.stopKeepalive();
    this.cafeClients.clear();
  }
}

export const eventBus = new EventBus();
// Auto start keepalive
eventBus.startKeepalive(25000);

export const subscribeClient = (cafeId, res, req, metadata) => eventBus.subscribe(cafeId, res, req, metadata);
export const broadcastEvent = (cafeId, event, data) => eventBus.broadcast(cafeId, event, data);

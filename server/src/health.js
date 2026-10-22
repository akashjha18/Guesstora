export function createHealthHandlers({ authenticate }) {
  return {
    live(_req, res) {
      return res.json({ ok: true });
    },
    async ready(_req, res) {
      try {
        await authenticate();
        return res.json({ ok: true, checks: { database: 'ok' } });
      } catch {
        return res.status(503).json({ ok: false, checks: { database: 'unavailable' } });
      }
    },
  };
}

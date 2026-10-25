// Transport only: native engine messages and seat credentials are unchanged.
export function createRelaySocket(code, token, epoch, wake) {
  let socket, opening;
  const requests = new Map();
  function disconnected(current, error = new Error('即時連線中斷')) {
    // A late close/error from an old socket must not cancel the new socket's
    // requests or connection attempt after Safari restores this same page.
    if (opening?.socket === current) {
      clearTimeout(opening.timer);
      opening.reject(error);
      opening = null;
    }
    if (socket === current) socket = null;
    for (const [id, pending] of requests) if (pending.connection === current) {
      clearTimeout(pending.timer); pending.reject(error); requests.delete(id);
    }
  }
  async function connect() {
    if (socket?.readyState === WebSocket.OPEN) return socket;
    if (opening) return opening.promise;
    const url = new URL('/api/full-room/socket', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('code', code);
    const current = socket = new WebSocket(url, ['grail-v1', 'seat-' + token, 'connection-' + epoch]);
    const attempt = { socket: current };
    attempt.promise = new Promise((resolve, reject) => {
      attempt.reject = reject;
      attempt.timer = setTimeout(() => { disconnected(current, new Error('即時連線逾時')); current.close(); }, 5000);
      current.onopen = () => {
        if (socket !== current) return;
        clearTimeout(attempt.timer);
        if (opening === attempt) opening = null;
        resolve(current);
      };
      current.onerror = () => { disconnected(current, new Error('即時連線失敗')); current.close(); };
      current.onclose = () => { disconnected(current); };
      current.onmessage = event => {
        if (socket !== current) return;
        let packet;
        try { packet = JSON.parse(event.data); } catch { return; }
        if (packet.wake) { wake(); return; }
        const pending = requests.get(packet.id);
        if (!pending || pending.connection !== current) return;
        requests.delete(packet.id); clearTimeout(pending.timer);
        if (packet.status !== 200) pending.reject(Object.assign(new Error(packet.data?.error || '同步失敗'), { status: packet.status }));
        else pending.resolve(packet.data);
      };
    });
    opening = attempt;
    return attempt.promise;
  }
  return {
    async request(body) {
      const id = crypto.randomUUID();
      const payload = JSON.stringify({ ...body, id });
      // Cloudflare limits incoming WebSocket frames to 1 MiB. Larger native
      // reinitialization batches keep the authenticated HTTP fallback.
      if (new TextEncoder().encode(payload).byteLength > 950_000) throw new Error('改用大型批次傳輸');
      const connection = await connect();
      if (socket !== connection || connection.readyState !== WebSocket.OPEN) throw new Error('即時連線中斷');
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { disconnected(connection, new Error('同步逾時')); connection.close(); }, 15_000);
        requests.set(id, { resolve, reject, timer, connection });
        try { connection.send(payload); } catch (error) { clearTimeout(timer); requests.delete(id); reject(error); }
      });
    },
    close() { const current = socket; if (current) { disconnected(current); current.close(); } },
  };
}

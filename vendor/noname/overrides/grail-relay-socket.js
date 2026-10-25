// Transport only: native engine messages and seat credentials are unchanged.
export function createRelaySocket(code, token, epoch, wake) {
  let socket, opening;
  const requests = new Map();
  function disconnected() {
    for (const { reject, timer } of requests.values()) { clearTimeout(timer); reject(new Error('即時連線中斷')); }
    requests.clear();
  }
  async function connect() {
    if (socket?.readyState === WebSocket.OPEN) return socket;
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      const url = new URL('/api/full-room/socket', location.href);
      url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      url.searchParams.set('code', code);
      const current = socket = new WebSocket(url, ['grail-v1', 'seat-' + token, 'connection-' + epoch]);
      const timer = setTimeout(() => { current.close(); reject(new Error('即時連線逾時')); }, 5000);
      current.onopen = () => { clearTimeout(timer); resolve(current); };
      current.onerror = () => { clearTimeout(timer); reject(new Error('即時連線失敗')); };
      current.onclose = () => { clearTimeout(timer); reject(new Error('即時連線中斷')); disconnected(); };
      current.onmessage = event => {
        let packet;
        try { packet = JSON.parse(event.data); } catch { return; }
        if (packet.wake) { wake(); return; }
        const pending = requests.get(packet.id);
        if (!pending) return;
        requests.delete(packet.id); clearTimeout(pending.timer);
        if (packet.status !== 200) pending.reject(Object.assign(new Error(packet.data?.error || '同步失敗'), { status: packet.status }));
        else pending.resolve(packet.data);
      };
    }).finally(() => { opening = null; });
    return opening;
  }
  return {
    async request(body) {
      const id = crypto.randomUUID();
      const payload = JSON.stringify({ ...body, id });
      // Cloudflare limits incoming WebSocket frames to 1 MiB. Larger native
      // reinitialization batches keep the authenticated HTTP fallback.
      if (new TextEncoder().encode(payload).byteLength > 950_000) throw new Error('改用大型批次傳輸');
      const connection = await connect();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { requests.delete(id); reject(new Error('同步逾時')); }, 15_000);
        requests.set(id, { resolve, reject, timer });
        try { connection.send(payload); } catch (error) { clearTimeout(timer); requests.delete(id); reject(error); }
      });
    },
    close() { socket?.close(); disconnected(); },
  };
}

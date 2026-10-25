/* GPL-3.0: HTTP transport only. Rules, private hands and online choices remain
 * in the pinned noname engine's native Client/NodeWS/message implementation. */
import { lib, game, ui, _status } from './noname.js';
import security from './noname/util/security.js';

const packs = ['shiZhouNian', 'yiDuanYeHuo', 'shenZiChuangLin', 'zhongMoDaoZhu', 'teDian'];
function onlineConfig(capacity) {
  const config = {};
  for (const [key, setting] of Object.entries(lib.mode.xingBei.connect)) {
    if (key.startsWith('connect_') && setting.init !== undefined) config[key.slice(8)] = setting.init;
  }
  return Object.assign(config, { mode: 'xingBei', versus_mode: `${capacity / 2}v${capacity / 2}`, number: capacity,
    player_number: capacity, choose_mode: '多選1', choose_number: 5, team_sequence: 'crossed',
    characterPack: packs, cardPack: ['xingBei'], banned: [], bannedcards: [], zhinang_tricks: [],
    choose_timeout: 120, observe: false, viewHandcard: false, phaseswap: false, chooseSide: false,
    shiQiMax: capacity === 8 ? 18 : 15, zhanJiMax: 5, xingBeiMax: 5, hasPassword: false, onlyChooseCharacter: false });
}
export async function startRelay() {
  const code = new URLSearchParams(location.search).get('online');
  const token = sessionStorage.getItem('grail-full-seat-' + code);
  const connection = crypto.randomUUID();
  const status = document.createElement('div');
  status.id = 'grail-online-status'; status.setAttribute('role', 'status');
  document.body.append(status);
  const tell = (message, fatal = false) => {
    status.textContent = message; status.hidden = !message;
    status.classList.toggle('fatal', fatal);
  };
  let stopped = false, ack = 0, started = false, pending = [], failures = 0;
  const peers = new Map();
  const queue = (to, data) => pending.push({ id: crypto.randomUUID(), to, data });
  async function request(type, extra = {}) {
    const response = await fetch('/api/full-room', { method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ type, code, token, connection, ...extra }) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || '連線暫時中斷'), { status: response.status });
    return data;
  }
  try {
    tell('正在連接完整角色房間…');
    const attached = await request('attach');
    const room = attached.room;
    if (room.status === 'closed') throw Object.assign(new Error('房主已離開牌局。請返回大廳建立新房間。'), { status: 410 });
    ack = attached.sequence;
    _status.connectMode = true;
    lib.config.connect_nickname = room.nickname;
    lib.config.connect_avatar = 'fengYinShi';
    lib.config.recentIP ||= [];
    game.onlineKey = room.me;
    game.ip = code;
    game.roomId = code;
    _status.ip = code;
    game.requireSandboxOn(code);
    game.sandbox = security.createSandbox();
    // Preserve the native message parser and its sandbox, replacing only
    // WebSocket IO. No public upstream hall or third-party relay is contacted.
    game.ws = { readyState: 1, close() { stopped = true; }, send(serialized) {
      if (!room.isHost) { queue('1', serialized); return; }
      const command = JSON.parse(serialized);
      if (command[0] !== 'server') return;
      if (command[1] === 'send') queue(command[2], command[3]);
      if (command[1] === 'config' && command[2]?.gameStarted) started = true;
      if (command[1] === 'close') {
        lib.message.client.onclose(command[2]); peers.delete(command[2]);
      }
    } };
    if (room.isHost) {
      lib.node = {};
      game.onlineroom = true;
      game.switchMode('xingBei', onlineConfig(room.capacity));
    } else {
      game.onlineID = room.me;
      // The host sends the native "opened" handshake after discovering this
      // authenticated seat; the existing init/reinit flow does everything else.
    }
    window.addEventListener('pagehide', () => { stopped = true; });
    async function poll() {
      if (stopped) return;
      let delay = 600;
      try {
        // Do not acknowledge a handshake until createServer installed wsOL.
        if (room.isHost && !lib.wsOL) { setTimeout(poll, 100); return; }
        const batch = pending.slice(0, 60);
        const data = await request('sync', { ack, messages: batch, started });
        pending.splice(0, batch.length);
        if (room.isHost) {
          for (const [id, epoch] of peers) {
            if (!data.peers.some(peer => peer.id === id && peer.connection === epoch)) {
              lib.message.client.onclose(id); peers.delete(id);
              pending = pending.filter(message => message.to !== id);
            }
          }
          for (const peer of data.peers) if (!peers.has(peer.id)) {
            peers.set(peer.id, peer.connection);
            lib.message.client.onconnection(peer.id);
          }
        }
        for (const message of data.messages) {
          if (message.seq <= ack) continue;
          if (room.isHost) lib.message.client.onmessage(message.from, message.data);
          else lib.element.ws.onmessage.call(game.ws, { data: message.data });
          ack = message.seq;
        }
        ack = Math.max(ack, data.sequence);
        failures = 0;
        tell(!room.isHost && !data.hostAlive ? '房主暫時離線，等待恢復連線…' : '');
        if (ui.connectShareButton) ui.connectShareButton.style.display = 'none';
        if (!room.isHost && ui.connectStartButton) ui.connectStartButton.style.display = 'none';
        if (pending.length) delay = 80;
      } catch (error) {
        failures++;
        const fatal = [400, 401, 403, 409, 410, 413].includes(error.status);
        tell(fatal ? error.message + ' 請使用上方的返回按鈕。' : '網路同步中斷，正在重試…', fatal);
        if (fatal) { stopped = true; return; }
        delay = Math.min(5000, 600 * 2 ** failures);
      }
      setTimeout(poll, delay);
    }
    poll();
  } catch (error) {
    tell(error.message || '無法連接房間，請返回大廳重試。', true);
    document.getElementById('grail-loading')?.remove();
  }
}

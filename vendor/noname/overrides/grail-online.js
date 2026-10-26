/* GPL-3.0: Relay transport only. Rules, private hands and online choices remain
 * in the pinned noname engine's native Client/NodeWS/message implementation. */
import { lib, game, ui, _status } from './noname.js';
import security from './noname/util/security.js';
import { freeDraftMethods } from './grail-free-draft.js';
import { characterFamily, availableCharacters } from './grail-characters.js';
import { createRelaySocket } from './grail-relay-socket.js';
import { createRelayLifecycle } from './grail-relay-lifecycle.js';

const packs = ['shiZhouNian', 'yiDuanYeHuo', 'shenZiChuangLin', 'zhongMoDaoZhu', 'teDian'];
function onlineConfig(capacity) {
  const config = {};
  for (const [key, setting] of Object.entries(lib.mode.xingBei.connect)) {
    if (key.startsWith('connect_') && setting.init !== undefined) config[key.slice(8)] = setting.init;
  }
  return Object.assign(config, { mode: 'xingBei', versus_mode: `${capacity / 2}v${capacity / 2}`, number: capacity,
    player_number: capacity, choose_mode: 'freeChoose', choose_number: 5, team_sequence: 'crossed',
    characterPack: packs, cardPack: ['xingBei'], banned: [], bannedcards: [], zhinang_tricks: [],
    choose_timeout: 120, observe: false, viewHandcard: false, phaseswap: false, chooseSide: false,
    shiQiMax: capacity === 8 ? 18 : 15, zhanJiMax: 5, xingBeiMax: 5, hasPassword: false, onlyChooseCharacter: false });
}
export async function startRelay() {
  game.grailEmbeddedRoom = true;
  // Native guests copy only a small allowlist of mode.game methods during
  // init/reinit. Install our shared UI helpers before the first handshake.
  Object.assign(game, freeDraftMethods, {
    grailCharacterFamily: characterFamily, grailAvailableCharacters: availableCharacters,
  });
  const params = new URLSearchParams(location.search);
  const code = params.get('online');
  const token = sessionStorage.getItem('grail-full-seat-' + code);
  const connection = crypto.randomUUID();
  const status = document.createElement('div');
  status.id = 'grail-online-status'; status.setAttribute('role', 'status');
  document.body.append(status);
  const tell = (message, fatal = false) => {
    status.textContent = message; status.hidden = !message;
    status.classList.toggle('fatal', fatal);
  };
  let stopped = false, rejoining = false, ack = 0, started = false, pending = [], failures = 0;
  let useSocket = false, wake = () => {};
  let socket, lifecycle;
  const activeFetches = new Set();
  const disconnect = () => { socket?.close(); for (const controller of activeFetches) controller.abort(); };
  const peers = new Map();
  const queue = (to, data) => {
    if (stopped || rejoining) return;
    pending.push({ id: crypto.randomUUID(), to, data, connection: peers.get(to) }); wake(40);
  };
  const finish = () => {
    stopped = true;
    pending = [];
    peers.clear();
    if (game.ws) game.ws.readyState = 3;
  };
  const closeRelay = () => {
    finish();
    if (lifecycle) lifecycle.stop();
    else disconnect();
  };
  async function request(type, extra = {}) {
    const body = { type, code, token, connection, ...extra };
    if (useSocket && type === 'sync') {
      try { return await socket.request(body); }
      catch (error) { if (error.status || stopped || lifecycle?.inactive) throw error; }
    }
    if (stopped || lifecycle?.inactive) throw new Error('頁面暫停同步');
    const controller = new AbortController();
    activeFetches.add(controller);
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch('/api/full-room', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error || '連線暫時中斷'), { status: response.status });
      return data;
    } finally { clearTimeout(timeout); activeFetches.delete(controller); }
  }
  try {
    tell('正在連接完整角色房間…');
    const attached = await request('attach', { protocol: 2, recover: params.get('recover') === 'lobby' });
    useSocket = attached.transport === 'websocket';
    if (useSocket) socket = createRelaySocket(code, token, connection, () => wake(40));
    const room = attached.room;
    if (room.status === 'closed') throw Object.assign(new Error('房主已離開牌局。請返回大廳建立新房間。'), { status: 410 });
    ack = attached.sequence;
    // A guest view cannot safely replay an inbox after a long suspension:
    // peers age out at 60s and relay messages expire at 120s. Rejoin using the
    // original seat and native init/reinit before replaying partial state.
    // The browser host must keep its existing event stack instead of reloading.
    let lastSyncAt = Date.now();
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
    game.ws = { readyState: 1, close: closeRelay, send(serialized) {
      if (stopped) return;
      if (!room.isHost) { queue('1', serialized); return; }
      const command = JSON.parse(serialized);
      if (command[0] !== 'server') return;
      if (command[1] === 'send') queue(command[2], command[3]);
      if (command[1] === 'config' && command[2]?.gameStarted) { started = true; wake(40); }
      if (command[1] === 'close') {
        lib.message.client.onclose(command[2]); peers.delete(command[2]);
      }
    } };
    if (room.isHost) {
      // Commit the no-restart boundary before native waitForPlayer resumes.
      // A failed/lost reply keeps the button usable for an idempotent retry.
      game.grailRequestStart = async () => {
        if (stopped || lifecycle?.inactive) return false;
        try {
          tell('正在確認開局…');
          const result = await request('start');
          if (stopped || lifecycle?.inactive) return false;
          if (result.room?.status !== 'playing') throw new Error('開局尚未確認，請再試一次。');
          started = true;
          tell('');
          return true;
        } catch (error) {
          if (!stopped) tell(error.message || '開局連線中斷，請再按一次「開始遊戲」。');
          return false;
        }
      };
      lib.node = {};
      game.onlineroom = true;
      game.switchMode('xingBei', onlineConfig(room.capacity));
    } else {
      game.onlineID = room.me;
      // The host sends the native "opened" handshake after discovering this
      // authenticated seat; the existing init/reinit flow does everything else.
    }
    lifecycle = createRelayLifecycle({ poll,
      disconnect,
      onStop: finish,
      onError(error) { console.warn('Full room resume:', error.name); },
    });
    wake = delay => { if (!stopped) lifecycle.wake(delay); };
    async function poll() {
      if (stopped) return null;
      let delay = useSocket ? 10_000 : 600;
      try {
        // Do not acknowledge a handshake until createServer installed wsOL.
        if (room.isHost && !lib.wsOL) return 100;
        const needsRejoin = () => !room.isHost && Date.now() - lastSyncAt >= 90_000;
        rejoining ||= needsRejoin();
        if (rejoining) {
          pending = [];
          status.classList.toggle('recovering', true);
          tell('正在恢復連線，暫停送出操作…');
        }
        const batch = [];
        let bytes = 0;
        for (const message of pending) {
          if (batch.length && (bytes + message.data.length > 400_000 || batch.length >= 60)) break;
          batch.push(message); bytes += message.data.length;
        }
        const data = await request('sync', { ack, messages: batch, started });
        if (stopped) return null;
        if (lifecycle.inactive) return delay;
        if (!room.isHost && data.rejoinLobby) {
          // The new host is still the same authenticated owner, rebuilding
          // only an unstarted lobby. Never replay old choices into that lobby.
          tell('房主已恢復等待房間，正在重新入座…');
          closeRelay();
          _status.reloading = true;
          location.reload();
          return null;
        }
        // A response can also arrive after the browser has frozen an in-flight
        // request. Do not apply that response to the stale local arena.
        rejoining ||= needsRejoin();
        if (rejoining) {
          pending = [];
          status.classList.toggle('recovering', true);
          tell(data.hostAlive ? '連線已恢復，正在重新取得本場牌局…' : '正在等待房主回到原本的分頁，恢復後會自動重新連線。');
          if (data.hostAlive) {
            closeRelay();
            _status.reloading = true; // native confirm_exit exempts intentional reconnects
            location.reload(); // this guest iframe only; retain its sessionStorage seat
            return null;
          }
          return delay;
        }
        lastSyncAt = Date.now();
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
          // A host may have an in-flight broadcast when a guest reconnects.
          // Until the native handshake creates playerOL, old exec messages
          // refer to players that do not exist on this new page yet.
          if (!room.isHost && !game.online && !['opened', 'init', 'reinit', 'denied'].includes(JSON.parse(message.data)[0])) {
            ack = message.seq; continue;
          }
          if (room.isHost) lib.message.client.onmessage(message.from, message.data);
          else lib.element.ws.onmessage.call(game.ws, { data: message.data });
          ack = message.seq;
        }
        ack = Math.max(ack, data.sequence);
        failures = 0;
        tell(!room.isHost && !data.hostAlive ? '房主連線中斷，請讓房主回到原本的分頁恢復連線。' : '');
        if (ui.connectShareButton) ui.connectShareButton.style.display = 'none';
        if (!room.isHost && ui.connectStartButton) ui.connectStartButton.style.display = 'none';
        if (ui.cardPileButton && matchMedia('(max-width: 600px)').matches) ui.cardPileButton.style.display = 'none';
        if (pending.length) delay = 80;
      } catch (error) {
        if (lifecycle.inactive) return delay;
        console.warn('Full room synchronization:', error.name, error.message);
        failures++;
        const fatal = [400, 401, 403, 409, 410, 413, 429].includes(error.status);
        tell(fatal ? error.message + ' 請使用上方的返回按鈕。' : '網路同步中斷，正在重試…', fatal);
        if (fatal) { stopped = true; return null; }
        delay = Math.min(5000, 600 * 2 ** failures);
      }
      return delay;
    }
    wake(0);
  } catch (error) {
    closeRelay();
    tell(error.message || '無法連接房間，請返回大廳重試。', true);
    document.getElementById('grail-loading')?.remove();
  }
}

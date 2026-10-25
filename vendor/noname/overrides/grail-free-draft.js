/* GPL-3.0: use native chooseButton/wait/online events; serialize only role
 * claims at the browser host. Card rules and battle events are unchanged. */
import { lib, game, ui, get, _status } from './noname.js';
import { claimCharacter } from './grail-characters.js';

export const freeDraftMethods = {
  grailClaimCharacter: claimCharacter,
  grailDraftSnapshot() {
    const draft = game.grailFreeDraftState;
    return { id: draft.id, pool: draft.pool.slice(), claims: { ...draft.claims }, seats: draft.seats.slice() };
  },
  grailPublishDraft() {
    const snapshot = game.grailDraftSnapshot();
    _status.onreconnect = [function (view) { game.grailRenderFreeDraft(view); }, snapshot];
    game.broadcastAll(function (view) { game.grailRenderFreeDraft(view); }, snapshot);
  },
  grailRenderFreeDraft(view, notice) {
    game.grailFreeDraftView = view;
    ui.arena.classList.add('choose-character');
    let dialog = get.idDialog(view.id);
    if (!dialog) {
      dialog = ui.create.dialog('自由選角 · 全角色', [view.pool, 'character']);
      dialog.videoId = view.id;
      dialog.classList.add('grail-free-draft');
      const status = document.createElement('p');
      status.className = 'grail-draft-status';
      status.setAttribute('role', 'status');
      dialog.content.insertBefore(status, dialog.content.querySelector('.buttons'));
    }
    dialog.open();
    const mine = view.claims[game.me.playerid];
    dialog.content.querySelector('.grail-draft-status').textContent = mine
      ? `已選定「${get.translation(mine)}」，等待其他玩家確認。`
      : notice || '選擇角色後按「確定」。已被選走的角色不能重複選取。';
    for (const button of dialog.buttons) {
      const owner = Object.entries(view.claims).find(([, id]) => game.grailCharacterFamily(id) === game.grailCharacterFamily(button.link))?.[0];
      const taken = !!owner;
      button.classList.toggle('grail-taken', taken);
      button.setAttribute('aria-disabled', String(taken || !!mine));
      button.dataset.draftCharacter = button.link;
      button.dataset.draftTaken = String(taken);
      button.title = taken ? `${get.translation(button.link)}：已被選取` : get.translation(button.link);
      if ((taken || mine) && ui.selected.buttons.includes(button)) {
        ui.selected.buttons.remove(button);
        button.classList.remove('selected');
      }
    }
    if (_status.event?.dialog === dialog && _status.imchoosing) game.check();
  },
  grailPromptFreeDraft(view, notice) {
    game.grailRenderFreeDraft(view, notice);
    if (view.claims[game.me.playerid]) return;
    const next = game.me.chooseButton(1, true);
    next.set('dialog', view.id);
    next.set('filterButton', function (button) {
      const current = game.grailFreeDraftView;
      return !current.claims[game.me.playerid] && game.grailAvailableCharacters([button.link], Object.values(current.claims)).length > 0;
    });
    next.set('ai', function () { return Math.random(); });
    next.set('callback', function (player, result) {
      if (result && typeof result === 'object') result.grailDraftId = game.grailFreeDraftView.id;
    });
    if (game.online) game.resume();
    return next;
  },
  // Called before native player.unwait, so rejected choices keep their seat
  // pending and cannot finish the selection event or replace another claim.
  grailAcceptDraftResult(player, result) {
    const draft = game.grailFreeDraftState;
    if (!draft) return result?.grailDraftId === undefined;
    if (!draft.humans.includes(player.playerid) || Object.hasOwn(draft.claims, player.playerid)) return false;
    if (result === 'ai') return true;
    if (result?.grailDraftId === draft.id && result?.links?.length === 1 &&
      game.grailClaimCharacter(draft, player.playerid, result.links[0])) {
      game.grailPublishDraft();
      return true;
    }
    if (player !== game.me) player.send(function (view) {
      game.grailPromptFreeDraft(view, '這名角色已被選走或無法選取，請重新選擇。');
    }, game.grailDraftSnapshot());
    return false;
  },
  grailDraftReconnected(id) {
    const draft = game.grailFreeDraftState;
    if (!draft || !draft.humans.includes(id)) return;
    const player = lib.playerOL[id];
    player.send(function (view) { game.grailPromptFreeDraft(view); }, game.grailDraftSnapshot());
  },
  grailDraftPending(id) {
    const draft = game.grailFreeDraftState;
    return !!draft && draft.humans.includes(id) && !Object.hasOwn(draft.claims, id);
  },
  grailDraftSendback(result, player) {
    const draft = game.grailFreeDraftState;
    if (!draft || draft.claims[player.playerid]) return;
    // Native timeout/disconnect/auto results still draw only from unused roles.
    const available = game.grailAvailableCharacters(draft.pool, Object.values(draft.claims));
    game.grailClaimCharacter(draft, player.playerid, available.randomGet());
    game.grailPublishDraft();
  },
  grailChooseCharacterOLFree() {
    const next = game.createEvent('chooseCharacterOL');
    next.setContent(function () {
      'step 0'
      game.initSideAndPosition(false);
      'step 1'
      const pool = get.charactersOL();
      const humans = game.players.filter(player => player === game.me || player.isOnline());
      game.grailFreeDraftState = {
        id: lib.status.videoId++, pool, claims: {},
        seats: game.players.map(player => player.playerid), humans: humans.map(player => player.playerid),
      };
      game.grailPublishDraft();
      for (const player of humans) {
        player.wait(function (result, current) { game.grailDraftSendback(result, current); });
        if (player !== game.me) player.send(function (view) {
          game.grailPromptFreeDraft(view);
        }, game.grailDraftSnapshot());
      }
      'step 2'
      game.grailPromptFreeDraft(game.grailDraftSnapshot(), event.retry ? '這名角色已被選走，請重新選擇。' : undefined);
      'step 3'
      if (!game.grailAcceptDraftResult(game.me, result)) {
        event.retry = true;
        event.goto(2);
        return;
      }
      game.me.unwait(result);
      'step 4'
      if (!game.grailFreeDraftState.humans.every(id => game.grailFreeDraftState.claims[id])) game.pause();
      'step 5'
      if (!game.grailFreeDraftState.humans.every(id => game.grailFreeDraftState.claims[id])) { event.goto(4); return; }
      const draft = game.grailFreeDraftState;
      for (const player of game.players) {
        if (!draft.claims[player.playerid]) {
          const available = game.grailAvailableCharacters(draft.pool, Object.values(draft.claims));
          game.grailClaimCharacter(draft, player.playerid, available.randomGet());
        }
      }
      game.broadcastAll(function (view) {
        _status.characterList = [view.claims[game.me.playerid]];
        for (const [id, role] of Object.entries(view.claims)) {
          const player = lib.playerOL[id];
          if (!player.name1) player.init(role);
          player.update();
          player.hideTimer();
        }
        get.idDialog(view.id)?.close();
        ui.arena.classList.remove('choose-character');
        delete game.grailFreeDraftView;
      }, game.grailDraftSnapshot());
      delete game.grailFreeDraftState;
      delete _status.onreconnect;
      if (lib.configOL.viewHandcard) game.addGlobalSkill('viewHandcard');
    });
  },
};

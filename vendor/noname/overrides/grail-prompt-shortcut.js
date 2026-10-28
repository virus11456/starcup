/* GPL-3.0: an opt-in, per-page shortcut for the local player's native Cancel.
 * Never change skill eligibility, priority, costs, choices or network replies. */
const pursuits = Object.freeze({
  fengNuZhuiJi: { name: '風怒追擊', element: 'feng' },
  xiuLuoLianZhan: { name: '修羅連斬', element: 'huo' },
  jiZhiJianYi: { name: '技之劍意', fate: 'ji' },
  erChongJianYing: { name: '二重劍影', same: true },
  jianYing: { name: '劍影' },
});

function hasUnknownCardSource(player, lib) {
  if (typeof player.getSkills !== 'function') return true;
  // Native attacks also admit special-zone cards. Do not guess whether those
  // or a virtual/hidden card can provide the required attack.
  const special = player.getCards('s');
  if (!Array.isArray(special) || special.length) return true;
  const hidden = player.getSkills(true), invisible = player.getSkills(false);
  if (!Array.isArray(hidden) || !Array.isArray(invisible)) return true;
  const ids = [...new Set([...hidden, ...invisible, ...(lib.skill.global || [])])];
  const seen = new Set(ids);
  for (const id of ids) {
    const info = lib.skill[id];
    if (!info || info.inherit || info.viewAs || info.hiddenCard || info.viewAsFilter) return true;
    if (info.mod && Object.keys(info.mod).some(key =>
      ['cardname', 'cardnature', 'cardXiBie', 'cardMingGe'].includes(key))) return true;
    // Native expandSkills expands a single group level. Follow nested groups
    // too, since a conversion may live in a grandchild or global helper.
    for (const entry of [info.group, info.global]) {
      const linked = typeof entry === 'string' ? [entry] : Array.isArray(entry) ? entry : [];
      for (const child of linked) if (!seen.has(child)) { seen.add(child); ids.push(child); }
    }
  }
  return false;
}

function lacksAttack(id, event, player, lib, get) {
  const spec = pursuits[id], info = lib.skill[id];
  if (!spec || !info || info.forced || info.direct || info.cost || info.oncancel || !info.trigger) return false;
  const cards = player.getCards('h');
  if (!Array.isArray(cards)) return false;
  let element = spec.element;
  if (spec.same) {
    const card = event.getTrigger?.()?.card;
    if (!card) return false;
    element = get.xiBie(card, player);
    if (!['feng', 'huo', 'shui', 'lei', 'di', 'an', 'guang'].includes(element)) return false;
  }
  for (const card of cards) {
    if (!card || Array.isArray(card.cards)) return false;
    const type = get.type(card);
    if (!['gongJi', 'faShu'].includes(type)) return false;
    if (type !== 'gongJi') continue;
    if (element) {
      const actual = get.xiBie(card, player);
      if (!['feng', 'huo', 'shui', 'lei', 'di', 'an', 'guang'].includes(actual) || actual === element) return false;
    } else if (spec.fate) {
      const fate = get.mingGe(card, player);
      if (typeof fate !== 'string' || !fate || fate === 'unsure' || fate === spec.fate) return false;
    } else return false;
  }
  return true;
}

function visible(button, doc) {
  if (!button || !button.isConnected || !button.getClientRects?.().length) return false;
  for (let node = button; node && node !== doc.body; node = node.parentNode) {
    if (node.hidden || ['hidden', 'removing', 'disabled'].some(cls => node.classList?.contains(cls))) return false;
  }
  return true;
}

export function pendingEmptyPursuit({ game, ui, lib, get, status, document: doc }) {
  const event = status.event, player = game.me;
  if (game.grailEmbeddedRoom || game.online || status.connectMode || status.over || status.auto ||
      !status.paused || status.paused2 || status.dragged || doc.visibilityState !== 'visible' ||
      !player || status.currentPhase !== player || event?.player !== player ||
      event.choosing !== true || event.isMine?.() !== true || event.result?.bool !== undefined ||
      event.result?.control !== undefined || typeof ui.click?.control !== 'function') return null;
  try {
    if (hasUnknownCardSource(player, lib)) return null;
    let ids, candidates;
    if (event.name === 'chooseBool') {
      const parent = event.getParent?.();
      if (parent?.name !== 'trigger' || parent.player !== player || event.skill || event.forced ||
          event.custom?.replace?.confirm || event.custom?.add?.confirm) return null;
      ids = [parent.skill];
      candidates = [...(ui.confirm?.children || [])].filter(node => node.link === 'cancel');
    } else if (event.name === 'chooseControl' && event.arrangeSkill === true) {
      if (!Array.isArray(event.controls) || !event.controls.includes('cancel2') || event.dialogcontrol) return null;
      ids = event.controls.filter(id => id !== 'cancel2');
      // Cancel here declines the WHOLE batch; never do that just because one
      // of its skills lacks a card. Keep all unknown/multi-effect choices.
      const bars = event.controlbars || [event.controlbar];
      candidates = bars.flatMap(bar => [...(bar?.children || [])]).filter(node => node.link === 'cancel2');
    } else return null;
    if (!ids.length || !ids.every(id => lacksAttack(id, event, player, lib, get))) return null;
    if (candidates.length !== 1 || !visible(candidates[0], doc) || candidates[0].parentNode?.custom) return null;
    return { event, button: candidates[0], names: ids.map(id => pursuits[id].name) };
  } catch {
    // Incomplete engine state must preserve the original manual question.
    return null;
  }
}

export function createPursuitShortcut(context) {
  let enabled = false, nextManual = false, stopped = false;
  const handled = new WeakSet(), manual = new WeakSet();
  return {
    get enabled() { return enabled; },
    setEnabled(value) { enabled = value === true; if (!enabled) nextManual = false; },
    keepNextManual() { nextManual = true; },
    update() {
      if (stopped || !enabled || context.panelOpen?.()) return null;
      const pending = pendingEmptyPursuit(context);
      if (!pending || handled.has(pending.event) || manual.has(pending.event)) return null;
      if (nextManual) { nextManual = false; manual.add(pending.event); return null; }
      // No timer/await between this state check and the original native click.
      if (context.status.event !== pending.event) return null;
      handled.add(pending.event);
      try { context.ui.click.control.call(pending.button); } catch { return null; }
      const result = pending.event.result;
      const accepted = pending.button.link === 'cancel2' ? result?.control === 'cancel2' :
        result?.bool === false && result?.confirm === 'cancel';
      if (!accepted) { handled.delete(pending.event); return null; }
      return pending.names;
    },
    stop() { stopped = true; enabled = false; },
  };
}

export function createPursuitPreference({ panel, ...context }) {
  const doc = context.document;
  const details = doc.createElement('details');
  details.id = 'grail-pursuit-preference';
  const summary = doc.createElement('summary');
  summary.textContent = '追擊快捷（關閉）';
  const label = doc.createElement('label');
  const input = doc.createElement('input');
  input.type = 'checkbox'; input.checked = false;
  label.append(input, doc.createTextNode('單人：自動略過缺牌追擊'));
  const note = doc.createElement('p');
  note.textContent = '只在目前沒有對應牌、且整組都是純追擊時取消。可隨時關閉；重新載入會關閉。多人仍逐次詢問。';
  const manual = doc.createElement('button');
  manual.type = 'button'; manual.textContent = '下一次保留詢問';
  const state = doc.createElement('p');
  state.setAttribute('role', 'status');
  const controller = createPursuitShortcut({ ...context,
    panelOpen: () => panel.querySelector('#grail-help-toggle')?.getAttribute('aria-expanded') === 'true',
  });
  input.addEventListener('change', () => {
    controller.setEnabled(input.checked);
    summary.textContent = controller.enabled ? '追擊快捷（已開啟）' : '追擊快捷（關閉）';
    manual.disabled = !controller.enabled;
    state.textContent = controller.enabled ? '關閉說明面板後生效；轉換牌或不明情況仍會詢問。' : '已恢復逐次詢問。';
  });
  manual.disabled = true;
  manual.addEventListener('click', () => {
    controller.keepNextManual(); state.textContent = '下一次符合快捷條件的追擊仍由你決定。';
  });
  details.append(summary, label, note, manual, state);
  panel.querySelector('#grail-help-body')?.append(details);
  return {
    update() {
      const online = Boolean(context.game.grailEmbeddedRoom || context.game.online || context.status.connectMode);
      input.disabled = online;
      if (online && controller.enabled) {
        controller.setEnabled(false); input.checked = false;
        summary.textContent = '追擊快捷（關閉）'; manual.disabled = true;
        state.textContent = '多人模式保留逐次詢問。';
      }
      const names = controller.update();
      if (names) state.textContent = '已略過' + names.join('、') + '；關閉快捷可恢復後續逐次詢問。';
    },
    stop() { controller.stop(); details.remove(); },
  };
}

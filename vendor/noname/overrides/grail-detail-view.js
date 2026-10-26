/* Read-only focus viewer for a public role or one of our own physical cards.
   Do not touch the native hand/character elements, selection or private data. */
import { inspectionPlayers, inspectionText, readInspection } from './grail-inspection.js';
import { isOwnSpecialAttack } from './grail-card-skin.js';

const artPath = (kind, id) => typeof id === 'string' && /^[a-zA-Z0-9_]+$/.test(id)
  ? `image/${kind}/${id}.${kind === 'character' ? 'jpg' : 'png'}` : '';

export function readQuickDetail(kind, subject, context) {
  const { game, get, lib } = context;
  if (kind === 'card') {
    const hand = game.me?.getCards?.('h') || [];
    const index = hand.indexOf(subject);
    if (index < 0 || subject.classList?.contains('infohidden')) return null;
    const entry = readInspection('hand', game.me, context)[index];
    return entry && { ...entry, image: artPath('card', subject.name), kind: 'card',
      ownSpecial: isOwnSpecialAttack(subject, game.me, { lib, get }) };
  }
  if (kind === 'draft-role') {
    // Character draft entries are public choices, not player seats. Reading
    // their printed skills must never call the live player's private getters.
    if (!subject?.closest?.('#arena.choose-character') ||
        !subject.classList?.contains('character') || subject.classList?.contains('hidden')) return null;
    const id = typeof subject.link === 'string' ? subject.link : '';
    const character = lib.character?.[id];
    if (!character || !Array.isArray(character[3])) return null;
    const title = inspectionText(get.translation(id));
    const intro = inspectionText(lib.characterIntro?.[id]);
    const sections = [
      ...(intro ? [{ title: '角色介紹', text: intro }] : []),
      ...character[3].filter(skill => lib.translate?.[skill + '_info'] && !lib.skill?.[skill]?.nopop)
        .map(skill => ({ title: inspectionText(get.translation(skill)),
          text: inspectionText(lib.translate[skill + '_info']) })),
    ];
    return { kind: 'role', title, image: artPath('character', id),
      subtitle: '選角預覽 · 一般點擊選取角色', sections };
  }
  if (kind !== 'role' || !inspectionPlayers(context).some(({ player }) => player === subject)) return null;
  const id = subject.name1 || subject.name;
  const title = inspectionText(get.translation(id));
  if (!title) return null;
  const skills = readInspection('roles', subject, context);
  const marks = readInspection('marks', subject, context);
  const hp = Number.isFinite(subject.hp) && Number.isFinite(subject.maxHp)
    ? `生命 ${subject.hp} / ${subject.maxHp}` : '';
  const intro = inspectionText(lib.characterIntro?.[id]);
  return {
    kind: 'role', title, image: artPath('character', id),
    subtitle: [subject === game.me ? '你的角色' : '場上公開角色', hp].filter(Boolean).join(' · '),
    sections: [
      ...(intro ? [{ title: '角色介紹', text: intro }] : []),
      ...skills.map(skill => ({ title: skill.title, text: skill.sections[0]?.text || '', badge: skill.status })),
      ...marks.map(mark => ({ title: mark.title + ' · ' + mark.count, text: mark.sections.map(s => s.text).join('\n') })),
    ],
  };
}

export function createQuickDetailView({ hud, context, document: doc = document }) {
  const node = (tag, className = '', text = '') => {
    const el = doc.createElement(tag); el.className = className;
    if (text) el.textContent = text;
    if (tag === 'button') el.type = 'button';
    return el;
  };
  const overlay = node('div', 'grail-detail-overlay');
  overlay.id = 'grail-detail-overlay';
  overlay.hidden = true;
  const sheet = node('section', 'grail-detail-sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', '完整角色或卡牌說明');
  const header = node('header', 'grail-detail-header');
  const title = node('h2');
  const closeButton = node('button', 'grail-detail-close', '關閉 ×');
  closeButton.setAttribute('aria-label', '關閉放大說明');
  header.append(title, closeButton);
  const layout = node('div', 'grail-detail-layout');
  const picture = node('div', 'grail-detail-picture');
  const image = node('img'); image.alt = '';
  const imageFallback = node('p', 'grail-detail-art-fallback', '此張卡的圖片尚未提供');
  const artTitle = node('strong', 'grail-detail-picture-title');
  imageFallback.hidden = true;
  picture.append(image, imageFallback, artTitle);
  const description = node('div', 'grail-detail-description');
  layout.append(picture, description);
  sheet.append(header, layout); overlay.append(sheet); hud.append(overlay);

  let openedFrom = null;
  let press = null;
  let ignoreClickUntil = 0;
  let suppressedSubject = null;
  let movedSubject = null;
  // Safari may synthesize touchend/contextmenu/click for the same long press.
  // Fence ONLY that original target; blocking unrelated cards or players for
  // 850ms makes quick combat choices appear unresponsive.
  const pressedAt = target => target?.closest?.('#arena #handcards1 .handcards > .card')
    || target?.closest?.('#arena > .player')
    || target?.closest?.('#arena.choose-character .dialog .button.character');
  const suppresses = target => suppressedSubject !== null && Date.now() < ignoreClickUntil
    && pressedAt(target) === suppressedSubject;
  const clearPress = () => { if (press?.timer) clearTimeout(press.timer); press = null; };
  const stop = event => { event.stopPropagation(); };
  function close() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    image.removeAttribute('src');
    description.replaceChildren();
    const trigger = openedFrom; openedFrom = null;
    if (trigger?.isConnected && trigger?.focus) trigger.focus({ preventScroll: true });
  }
  function open(kind, subject, trigger) {
    const entry = readQuickDetail(kind, subject, context);
    if (!entry) return false;
    clearPress();
    openedFrom = trigger;
    title.textContent = entry.title;
    picture.dataset.kind = entry.kind;
    picture.dataset.ownSpecial = String(entry.kind === 'card' && entry.ownSpecial === true);
    artTitle.textContent = entry.kind === 'card' ? entry.title : '';
    imageFallback.hidden = true;
    image.hidden = !entry.image;
    if (entry.image) image.src = entry.image;
    else imageFallback.hidden = false;
    description.replaceChildren();
    if (entry.subtitle) description.append(node('p', 'grail-detail-subtitle', entry.subtitle));
    if (entry.status) description.append(node('p', 'grail-detail-subtitle', entry.status));
    for (const section of entry.sections) {
      const block = node('section', 'grail-detail-section');
      if (section.badge) block.append(node('small', 'grail-detail-badge', section.badge));
      if (section.title) block.append(node('h3', '', section.title));
      block.append(node('p', '', section.text));
      description.append(block);
    }
    if (!entry.sections.length) description.append(node('p', '', '這名角色目前沒有可公開的技能說明。'));
    overlay.hidden = false;
    closeButton.focus();
    return true;
  }
  image.addEventListener('error', () => { image.hidden = true; imageFallback.hidden = false; });
  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') {
      // This is a single-action read-only dialog: keep focus on Close.
      event.preventDefault(); closeButton.focus();
    }
    stop(event);
  });
  for (const type of ['pointerdown', 'touchend', 'click']) overlay.addEventListener(type, stop);

  const playerAt = target => target?.closest?.('#arena > .player');
  const cardAt = target => target?.closest?.('#arena #handcards1 .handcards > .card');
  const draftAt = target => target?.closest?.('#arena.choose-character .dialog .button.character');
  function onClick(event) {
    if (suppresses(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (!overlay.hidden) return;
    const player = playerAt(event.target);
    if (!player || player.classList.contains('selectable') || player.classList.contains('selected')) return;
    if (open('role', player, player)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }
  function onPointerDown(event) {
    if (!overlay.hidden || event.button !== 0 || event.isPrimary === false) return;
    const player = playerAt(event.target);
    const card = cardAt(event.target);
    const draft = draftAt(event.target);
    if (!card && !player && !draft) return;
    // The draft's normal click still selects. Only a genuine long press opens
    // a read-only role preview and suppresses the subsequent native click.
    clearPress();
    const subject = card || player || draft;
    const kind = card ? 'card' : player ? 'role' : 'draft-role';
    movedSubject = null;
    press = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, subject, kind, timer: null };
    press.timer = setTimeout(() => {
      if (!press || press.subject !== subject || !overlay.hidden) return;
      if (open(kind, subject, subject)) {
        suppressedSubject = subject;
        ignoreClickUntil = Date.now() + 850;
      }
    }, 580);
  }
  function onPointerMove(event) {
    if (press?.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) {
      movedSubject = press.subject;
      clearPress();
    }
  }
  function onPointerEnd(event) {
    if (press?.pointerId === event.pointerId) clearPress();
    // A long press must not subsequently play or select the touched card.
    if (suppresses(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation();
      return;
    }
    if (event.type === 'touchend' && overlay.hidden) {
      const player = playerAt(event.target);
      if (player && player !== movedSubject && !player.classList.contains('selectable') && !player.classList.contains('selected') && open('role', player, player)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
      movedSubject = null;
    }
  }
  function onContextMenu(event) {
    // Prevent Safari's native long-press context menu from covering our
    // existing enlarged viewer, without disabling context menus elsewhere.
    if (suppresses(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (!overlay.hidden) return;
    const card = cardAt(event.target);
    const draft = draftAt(event.target);
    if ((card && open('card', card, card)) || (draft && open('draft-role', draft, draft))) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('contextmenu', onContextMenu, true);
  doc.addEventListener('pointerdown', onPointerDown, true);
  doc.addEventListener('pointermove', onPointerMove, true);
  doc.addEventListener('pointerup', onPointerEnd, true);
  doc.addEventListener('pointercancel', clearPress, true);
  doc.addEventListener('touchend', onPointerEnd, true);
  return { close, open, stop() {
    close(); clearPress(); suppressedSubject = null; ignoreClickUntil = 0; overlay.remove();
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('contextmenu', onContextMenu, true);
    doc.removeEventListener('pointerdown', onPointerDown, true);
    doc.removeEventListener('pointermove', onPointerMove, true);
    doc.removeEventListener('pointerup', onPointerEnd, true);
    doc.removeEventListener('pointercancel', clearPress, true);
    doc.removeEventListener('touchend', onPointerEnd, true);
  } };
}

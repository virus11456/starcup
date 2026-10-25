import test from 'node:test';
import assert from 'node:assert/strict';
import { cardElement, createHandSkin } from '../vendor/noname/overrides/grail-card-skin.js';
import { updateResponseCancelLabel } from '../vendor/noname/overrides/grail-response-labels.js';

const card = xiBie => ({ xiBie, dataset: { existing: 'native' }, classList: { contains: () => false } });
test('hand skin uses only local hand attributes without changing native card identity or rules', () => {
  const cards = ['an', 'shui', 'huo', 'feng', 'lei', 'di', 'guang'].map(card);
  const native = cards.map(c => ({ ...c }));
  const me = { getCards(area) { assert.equal(area, 'h'); return cards; } };
  const skin = createHandSkin(); skin.update(me); skin.update(me);
  cards.forEach((c, i) => {
    assert.deepEqual(c.dataset, { existing: 'native', grailElement: c.xiBie });
    assert.equal(c.xiBie, native[i].xiBie); assert.equal(c.classList, native[i].classList);
    assert.deepEqual(Object.keys(c), Object.keys(native[i]));
  });
  skin.stop(); cards.forEach(c => assert.deepEqual(c.dataset, { existing: 'native' }));
});

test('hidden, moved and unsupported cards lose color tags, including leaving the local player', () => {
  const c = card('shui'), unsupported = card('unknown');
  let hand = [c, unsupported];
  const skin = createHandSkin(), me = { getCards: () => hand };
  skin.update(me); assert.equal(c.dataset.grailElement, 'shui');
  assert.equal(cardElement(unsupported), ''); assert.equal(cardElement(null), '');
  assert.equal(unsupported.dataset.grailElement, undefined);
  c.classList.contains = name => name === 'infohidden'; skin.update(me);
  assert.equal(c.dataset.grailElement, undefined);
  c.classList.contains = () => false; skin.update(me);
  hand = []; skin.update(me); assert.equal(c.dataset.grailElement, undefined);
  hand = [c]; skin.update(me); skin.update(null);
  assert.equal(c.dataset.grailElement, undefined);
});

function controls() {
  const callback = () => {};
  return { callback, childNodes: ['ok', 'cancel', 'native-extra'].map(link => ({ link, textContent: link, dataset: {}, onclick: callback })) };
}
test('reused native confirm controls switch from damage back to cancel without changing actions', () => {
  const control = controls(), [ok, cancel, extra] = control.childNodes;
  updateResponseCancelLabel(control, { name: 'yingZhan' }, '取消');
  assert.equal(ok.dataset.grailAction, 'confirm'); assert.equal(cancel.dataset.grailAction, 'damage');
  assert.equal(cancel.textContent, '承受傷害'); assert.equal(extra.dataset.grailAction, undefined);
  updateResponseCancelLabel(control, { name: 'chooseCard' }, '取消');
  assert.equal(cancel.textContent, '取消'); assert.equal(cancel.dataset.grailAction, 'cancel');
  assert.deepEqual(control.childNodes.map(c => c.link), ['ok', 'cancel', 'native-extra']);
  assert.ok(control.childNodes.every(c => c.onclick === control.callback));
  cancel.link = 'native-extra'; updateResponseCancelLabel(control, {}, '取消');
  assert.equal(cancel.dataset.grailAction, undefined);
});

test('skill restore and custom confirmation are not styled as accepting damage', () => {
  const control = controls(), cancel = control.childNodes[1];
  for (const event of [{ name: 'moDan', skill: 'selected-skill' }, { name: 'yingZhan', custom: { replace: { confirm() {} } } }]) {
    updateResponseCancelLabel(control, event, '返回');
    assert.equal(cancel.textContent, '返回'); assert.equal(cancel.dataset.grailAction, 'cancel');
  }
  updateResponseCancelLabel(control, { name: 'moDan', skill: 'selected-skill', norestore: true }, '取消');
  assert.equal(cancel.dataset.grailAction, 'damage');
});

test('Magic Burst only marks the optional damage-or-discard choice as taking damage', () => {
  const control = controls(), cancel = control.childNodes[1];
  const event = { name: 'chooseToDiscard', prompt: '棄置1張法術牌，否則施法者對你造成2點法術傷害' };
  updateResponseCancelLabel(control, event, '取消');
  assert.equal(cancel.dataset.grailAction, 'damage'); assert.equal(cancel.textContent, '承受傷害');
  updateResponseCancelLabel(control, { ...event, forced: true }, '取消');
  assert.equal(cancel.dataset.grailAction, 'cancel'); assert.equal(cancel.textContent, '取消');
});

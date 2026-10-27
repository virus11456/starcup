import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateResponseCancelLabel } from '../vendor/noname/overrides/grail-response-labels.js';

function control() {
  const button = (link, textContent) => ({
    link, textContent, dataset: {},
    get offsetWidth() { return 22 + [...this.textContent].length * 16; },
  });
  const controls = [button('ok', '確定'), button('cancel', '取消')];
  return { style: { width: '60px' }, childNodes: controls };
}
function lastAction(other = {}) {
  return { name: 'gongJiOrFaShu', action: true, player: { storage: {
    gongJiOrFaShu: 1, gongJi: 0, faShu: 0, extraXingDong: [],
  } }, ...other };
}
function apply(event) {
  const node = control();
  let recentered = 0;
  updateResponseCancelLabel(node, event, '取消', () => { recentered++; });
  return { node, cancel: node.childNodes[1], recentered };
}

test('damage response uses actual cancel handler but displays full text and re-centers', () => {
  const { node, cancel, recentered } = apply({ name: 'yingZhan' });
  assert.equal(cancel.textContent, '承受傷害');
  assert.equal(cancel.link, 'cancel', 'do not replace native action or event handler');
  assert.equal(cancel.dataset.grailAction, 'damage');
  assert.equal(Number.parseInt(node.style.width), node.childNodes[0].offsetWidth + cancel.offsetWidth);
  assert.equal(recentered, 1);
});

test('last optional normal action is correctly labelled 結束回合', () => {
  const { cancel } = apply(lastAction());
  assert.equal(cancel.textContent, '結束回合');
  assert.equal(cancel.dataset.grailAction, 'end-turn');
});

test('normal actions remain: skip current action, do not claim to end the turn', () => {
  const { cancel } = apply(lastAction({ player: {
    storage: { gongJiOrFaShu: 2, gongJi: 0, faShu: 0, extraXingDong: [] },
  } }));
  assert.equal(cancel.textContent, '略過本次行動');
  assert.equal(cancel.dataset.grailAction, 'cancel');
});

test('queued extra action is not the last action; do not claim to end the turn', () => {
  const { cancel } = apply(lastAction({ player: {
    storage: { gongJiOrFaShu: 1, gongJi: 0, faShu: 0, extraXingDong: [{}] },
  } }));
  assert.equal(cancel.textContent, '略過本次行動');
});

test('skill picker retains cancel semantics instead of ending the turn', () => {
  const { cancel } = apply(lastAction({ skill: 'someSkill' }));
  assert.equal(cancel.textContent, '取消');
  assert.equal(cancel.dataset.grailAction, 'cancel');
});

test('forced discard and non-turn choices are unaffected', () => {
  for (const event of [{ name: 'chooseToDiscard', forced: true }, { name: 'chooseTarget' }]) {
    const { cancel } = apply(event);
    assert.equal(cancel.textContent, '取消');
  }
});

test('second label update does not repeatedly resize the native control', () => {
  const node = control();
  let count = 0;
  for (let i = 0; i < 2; i++) updateResponseCancelLabel(node, { name: 'moDan' }, '取消', () => { count++; });
  assert.equal(count, 1);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandVisibilityRecovery } from '../vendor/noname/overrides/grail-hand-visibility.js';

function card(classes = [], style = {}) {
  const set = new Set(classes);
  return {
    classList: {
      contains: name => set.has(name),
      remove: name => set.delete(name),
    },
    computed: { display: 'block', visibility: 'visible', opacity: '1', ...style },
  };
}
function fixture(cards, hand = cards) {
  let time = 0, calls = 0;
  const game = {
    me: { getCards: zone => {
      assert.equal(zone, 'h');
      return hand;
    } },
  };
  const ui = {
    handcards1: { children: cards },
    handcards2: { children: [] },
    handcards1Container: {},
    handcards2Container: {},
    arena: { classList: { contains: () => false } },
    updatehl: () => {
      calls++;
      for (const item of cards) item.classList.remove('drawinghidden');
    },
  };
  const recovery = createHandVisibilityRecovery({
    game, ui, now: () => time, styleOf: item => item.computed,
  });
  return { recovery, ui, calls: () => calls, advance: ms => { time += ms; } };
}

test('stale invisible fifth card is recovered by one native layout refresh', () => {
  const cards = Array.from({ length: 5 }, (_, i) => card(i === 2 ? ['drawinghidden'] : []));
  const f = fixture(cards);
  assert.equal(f.recovery.update(), false);
  f.advance(500);
  assert.equal(f.recovery.update(), false, 'normal draw animation is untouched');
  f.advance(701);
  assert.equal(f.recovery.update(), true);
  assert.equal(f.calls(), 1);
  assert.equal(cards[2].classList.contains('drawinghidden'), false);
  assert.equal(f.recovery.update(), false);
  assert.equal(f.calls(), 1);
});
test('intentionally hidden, leaving, and unowned ghost nodes remain untouched', () => {
  const ghost = card(['drawinghidden']);
  const intended = card(['infohidden', 'drawinghidden']);
  const removing = card(['removing', 'drawinghidden']);
  const ordinary = card();
  const f = fixture([ordinary, intended, removing, ghost], [ordinary, intended, removing]);
  f.recovery.update();
  f.advance(1500);
  f.recovery.update();
  assert.equal(f.calls(), 0);
});
test('zero-opacity native node gets at most one refresh until visible again', () => {
  const hidden = card([], { opacity: '0' });
  const f = fixture([hidden]);
  f.recovery.update();
  f.advance(1300);
  assert.equal(f.recovery.update(), true);
  assert.equal(f.recovery.update(), false);
  assert.equal(f.calls(), 1);
  hidden.computed.opacity = '1';
  f.recovery.update();
  hidden.computed.opacity = '0';
  f.recovery.update();
  f.advance(1300);
  assert.equal(f.recovery.update(), true);
  assert.equal(f.calls(), 2);
});
test('normal 1-10 card hands leave identity, selection and count unchanged', () => {
  for (const count of [1, 2, 4, 5, 6, 10]) {
    const cards = Array.from({ length: count }, () => card());
    const f = fixture(cards);
    f.recovery.update();
    f.advance(2000);
    f.recovery.update();
    assert.equal(f.calls(), 0);
    assert.equal(f.ui.handcards1.children.length, count);
  }
});
test('do not interfere with the renderer until both native containers exist', () => {
  const f = fixture([card(['drawinghidden'])]);
  f.ui.handcards2Container = null;
  f.recovery.update();
  f.advance(1300);
  assert.equal(f.recovery.update(), false);
  assert.equal(f.calls(), 0);
});

test('recovery checks the engine second-hand container without moving cards', () => {
  const hidden = card(['drawinghidden']);
  const f = fixture([], [hidden]);
  f.ui.handcards2.children = [hidden];
  f.recovery.update();
  f.advance(1300);
  assert.equal(f.recovery.update(), true);
  assert.equal(f.calls(), 1);
  assert.equal(f.ui.handcards2.children[0], hidden, 'native node and zone remain unchanged');
});
test('character draft and intentionally hidden hands are excluded', () => {
  for (const blockedClass of ['choose-character', 'hidden_handcard']) {
    const f = fixture([card(['drawinghidden'])]);
    f.ui.arena.classList.contains = x => x === blockedClass;
    f.recovery.update();
    f.advance(1500);
    assert.equal(f.recovery.update(), false);
    assert.equal(f.calls(), 0);
  }
});

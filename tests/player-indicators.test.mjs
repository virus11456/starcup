import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicPlayerIndicators, publicHandCountBadge, placeIndicatorStrip, chooseIndicatorVariant, createPlayerIndicators } from '../vendor/noname/overrides/grail-player-indicators.js';

const classes = (...names) => ({ contains: name => names.includes(name) });
const mark = (skill, name, count, options = {}) => ({
  skill, info: { name }, classList: classes('mark', ...(options.hidden ? ['hidden'] : [])),
  markcount: count === undefined ? undefined : { textContent: String(count) },
});
function fixture() {
  const me = { name: 'fengZhiJianSheng', side: true, zhiLiao: 2, getSkills: () => [],
    node: { marks: { children: [mark('_shengDun', '聖盾', 1), mark('lingHun', '靈魂', 4)] },
      marks2: { children: [mark('_tiLian_shuiJing', '水晶', 3), mark('poison', '中毒', 1)] } } };
  const other = { name: 'shengNv', side: false, zhiLiao: 0, getSkills: () => [],
    getCards() { throw new Error('Never read an opponent hand or hidden expansion'); },
    get storage() { throw new Error('Never read an opponent private storage'); },
    node: { marks: { children: [mark('_shengDun', '聖盾', 1, { hidden: true })] } } };
  const context = { game: { me, players: [me, other] },
    get: { translation: id => id }, lib: { translate: {}, skill: {} } };
  return { me, other, context };
}

test('each named visible effect, healing cross, crystal and custom token is shown at its actual count', () => {
  const { me, context } = fixture();
  const data = publicPlayerIndicators(me, context);
  assert.deepEqual(data.map(({ label, count }) => [label, count]), [
    ['治療十字', '2'], ['聖盾', '1'], ['靈魂', '4'], ['水晶', '3'], ['中毒', '1'],
  ]);
  assert.equal(data.find(x => x.label === '聖盾').kind, 'shield');
  assert.equal(data.find(x => x.label === '水晶').kind, 'crystal');
});

test('hidden or removed public marks do not appear; no private opponent data is read', () => {
  const { other, context } = fixture();
  assert.deepEqual(publicPlayerIndicators(other, context), []);
  other.node.marks.children = [mark('shield', '聖盾', 1)];
  assert.deepEqual(publicPlayerIndicators(other, context).map(x => x.label), ['聖盾']);
  context.game.players = [context.game.me];
  assert.deepEqual(publicPlayerIndicators(other, context), []);
});

test('healing is not duplicated when the native mark already names it', () => {
  const { me, context } = fixture();
  me.node.marks.children = [mark('heal', '治療', 2)];
  me.node.marks2.children = [];
  assert.deepEqual(publicPlayerIndicators(me, context).map(x => x.label), ['治療']);
});

test('shield, crystal and gem counts remain visible if the native theme omits their marks', () => {
  const { me, context } = fixture();
  me.node.marks.children = [];
  me.node.marks2.children = [];
  me.countGaiPai = id => id === '_shengDun' ? 2 : 0;
  me.countNengLiang = id => id === 'shuiJing' ? 3 : id === 'baoShi' ? 1 : 0;
  const badges = publicPlayerIndicators(me, context);
  assert.deepEqual(new Map(badges.map(entry => [entry.label, entry.count])), new Map([
    ['寶石', '1'], ['水晶', '3'], ['聖盾', '2'], ['治療十字', '2'],
  ]));
  me.node.marks.children = [mark('_shengDun', '聖盾', 2)];
  assert.equal(publicPlayerIndicators(me, context).filter(entry => entry.kind === 'shield').length, 1);
});

test('right-seat badges never clip beyond portrait or landscape viewport', () => {
  for (const viewport of [{ width: 390, height: 780 }, { width: 844, height: 390 }, { width: 1024, height: 768 }]) {
    const rect = { left: viewport.width - 86, right: viewport.width - 4, top: 155, bottom: 266, width: 82, height: 111 };
    const pos = placeIndicatorStrip(rect, viewport, { width: 175, height: 92 });
    assert.ok(pos.left >= 8, 'left inside viewport');
    assert.ok(pos.left + pos.width <= viewport.width - 8, 'right stays visible');
    assert.ok(pos.top >= 8 && pos.top + pos.height <= viewport.height - 8);
    assert.equal(pos.placement, 'below');
  }
});
test('top/bottom marker positioning avoids an occupied strip without moving a role', () => {
  const viewport = { width: 390, height: 780 }, rect = { left: 318, right: 380, top: 200, bottom: 320, width: 62, height: 120 };
  const occupied = [{ left: 210, top: 328, width: 162, height: 90 }];
  const pos = placeIndicatorStrip(rect, viewport, { width: 162, height: 90 }, occupied);
  assert.equal(pos.placement, 'above');
  assert.ok(pos.top + pos.height <= rect.top);
});

test('native public hand count is mirrored without accessing private card identities', () => {
  const { other } = fixture();
  other.node.count = { textContent: '2/4', classList: classes() };
  assert.deepEqual(publicHandCountBadge(other), {
    id:'public-hand-count', label:'手牌', count:'2/4', kind:'hand', icon:'▣'
  });
  other.node.count.textContent = ' 8 / 6 ';
  assert.equal(publicHandCountBadge(other)?.count, '8/6');
  other.node.count.textContent = '3/∞';
  assert.equal(publicHandCountBadge(other)?.count, '3/∞');
  other.node.count.textContent = '<script>private</script>';
  assert.equal(publicHandCountBadge(other), null);
  other.node.count.classList = classes('hidden');
  assert.equal(publicHandCountBadge(other), null);
});

test('unrotated hand-count HUD is legible and hides its native duplicate', async () => {
  const fs = await import('node:fs/promises');
  const markerCss = await fs.readFile(new URL('../vendor/noname/overrides/grail-player-indicators.css', import.meta.url), 'utf8');
  const globalCss = await fs.readFile(new URL('../vendor/noname/overrides/grail.css', import.meta.url), 'utf8');
  assert.match(markerCss, /\.grail-indicator-hand[\s\S]*?writing-mode:\s*horizontal-tb !important/);
  assert.match(markerCss, /\.grail-indicator-hand b\s*\{[\s\S]*?font:\s*800 17px/);
  assert.match(globalCss, /data-grail-hand-count-mirror="true"\] > \.count\s*\{[\s\S]*?visibility:\s*hidden !important/);
});


test('public marker groups avoid enlarged neighboring portraits and the scoreboard', () => {
  const viewport = { width: 390, height: 780 };
  const own = { left: 154, right: 235, top: 300, bottom: 420, width: 81, height: 120 };
  const score = { left: 6, top: 160, width: 378, height: 134 };
  const enemy = { left: 85, top: 430, width: 220, height: 90 };
  const place = placeIndicatorStrip(own, viewport,
    { width: 142, height: 58 }, [], [score, enemy]);
  assert.ok(place, 'should find a free region to the side of this player');
  assert.ok(place.left >= 8 && place.left + place.width <= viewport.width - 8);
  const hits = (a,b) => a.left < b.left + b.width + 4 &&
    a.left + a.width + 4 > b.left && a.top < b.top + b.height + 4 &&
    a.top + a.height + 4 > b.top;
  assert.equal(hits(place, own), false);
  assert.equal(hits(place, score), false);
  assert.equal(hits(place, enemy), false);
});

test('crowded battle layout refuses any overlapping public chip instead of covering an action', () => {
  const viewport = { width: 390, height: 670 };
  const seat = { left: 155, right: 235, top: 285, bottom: 395, width: 80, height: 110 };
  const blocker = { left: 0, top: 0, width: 390, height: 670 };
  assert.equal(placeIndicatorStrip(seat, viewport, { width: 145, height: 60 },
    [], [blocker]), null);
  assert.equal(placeIndicatorStrip(null, viewport, { width: 120, height: 40 }), null);
});

test('hand-number mirror is only switched on when an external badge is safely positioned', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(
    new URL('../vendor/noname/overrides/grail-player-indicators.js', import.meta.url), 'utf8');
  const active = source.indexOf('active.add(player);');
  const safe = source.indexOf('if (!candidate) {');
  const mirror = source.indexOf("player.dataset.grailHandCountMirror = String(");
  assert.ok(source.includes('Boolean(handCount) && candidate.badges.includes(handCount)'),
    'only a genuinely visible hand badge may hide the original native count');
  assert.ok(safe !== -1 && safe < active && active < mirror,
    'do not hide original hand count before a collision-free external strip exists');
  assert.match(source, /stop\(\)[\s\S]*?grailHandCountMirror = 'false'/);
});


test('phone role art is larger than before, while public hand digits stay high contrast and compact', async () => {
  const fs = await import('node:fs/promises');
  const cards = await fs.readFile(new URL('../vendor/noname/overrides/grail.css', import.meta.url), 'utf8');
  const badges = await fs.readFile(new URL('../vendor/noname/overrides/grail-player-indicators.css', import.meta.url), 'utf8');
  assert.match(cards, /@media \(max-width: 600px\) and \(orientation: portrait\)[\s\S]*?scale:\s*1\.38/);
  assert.match(badges, /\.grail-indicator-hand \.grail-indicator-icon\s*\{\s*display:\s*none !important/);
  assert.match(badges, /\.grail-indicator-hand \{\s*max-width:\s*108px/);
  assert.match(badges, /\.grail-indicator-hand b\s*\{\s*font-size:\s*17px/);
});


test('if all four nominal anchors are blocked, slide a chip along the free lower lane', () => {
  const screen = { width: 390, height: 760 };
  const seat = { left:155, right:235, top:290, bottom:390, width:80, height:100 };
  const obstacles = [
    { left:0, top:180, width:390, height:102 }, // above
    { left:135, top:398, width:135, height:56 }, // below centre
    { left:240, top:290, width:150, height:100 }, // right
    { left:0, top:286, width:152, height:104 }, // left
  ];
  const result = placeIndicatorStrip(seat, screen, { width:122, height:44 }, [], obstacles);
  assert.ok(result, 'lower-left area should remain free');
  assert.equal(result.placement, 'below');
  assert.ok(result.left + result.width <= 131, 'slides left of below-centre obstacle');
  assert.equal(result.top, 398);
  const collides = (a,b) => a.left < b.left + b.width + 4
    && a.left + a.width + 4 > b.left && a.top < b.top + b.height + 4
    && a.top + a.height + 4 > b.top;
  assert.equal(collides(result, seat), false);
  for (const obstacle of obstacles) assert.equal(collides(result, obstacle), false);
});

test('sliding does not move a status with an already safe normal placement', () => {
  const screen = { width:390, height:760 };
  const seat = { left:318,right:380,top:200,bottom:320,width:62,height:120 };
  const p = placeIndicatorStrip(seat, screen, {width:162,height:90});
  assert.equal(p.placement,'below');
  assert.equal(p.top,328);
  assert.equal(p.left,218);
});


test('crowded status fallback keeps public hand number visible when complete markers do not fit', () => {
  const hand = { id:'public-hand-count', label:'手牌', count:'4/6', kind:'hand' };
  const shield = { id:'shield', label:'聖盾', count:'1', kind:'shield' };
  const poison = { id:'poison', label:'中毒', count:'2', kind:'danger' };
  const variants = [];
  const result = chooseIndicatorVariant([hand, shield, poison], hand, shown => {
    variants.push(shown.map(x => x.id));
    return shown.length === 1 ? { left:22, top:330, width:104, height:32 } : null;
  });
  assert.equal(result.compact, true);
  assert.deepEqual(result.badges, [hand]);
  assert.deepEqual(variants.map(v => v.length), [3, 1]);
  assert.equal(result.position.left, 22);
});

test('full status set returns when sufficient space exists and compact prefers stable DOM', () => {
  const hand = { id:'public-hand-count' }, crystal = { id:'crystal' };
  const all = [hand, crystal];
  const result = chooseIndicatorVariant(all, hand,
    shown => shown.length === 2 ? {left:10,top:110} : null);
  assert.equal(result.compact, false);
  assert.deepEqual(result.badges, all);
  const tried = [];
  const compact = chooseIndicatorVariant(all, hand, shown => {
    tried.push(shown.length);
    return { left:10, top:230 };
  }, true);
  assert.equal(compact.compact, true);
  assert.deepEqual(tried, [1], 'compact mode may persist briefly without 400ms full-DOM churn');
});

test('when no safe strip exists the native hand count is never hidden', () => {
  const hand = { id:'public-hand-count' }, marks = { id:'shield' };
  const result = chooseIndicatorVariant([hand, marks], hand, () => null);
  assert.equal(result, null);
  const noHand = chooseIndicatorVariant([marks], null, () => null);
  assert.equal(noHand, null);
  assert.deepEqual(chooseIndicatorVariant([hand], hand, () => ({left:8,top:8})).badges,
    [hand], 'a lone hand badge needs no duplicate compact variant');
});


test('first battle update after draft measures public badges with an unhidden HUD layer', () => {
  const seenHiddenDuringMeasurement = [];
  let choosing = true;
  const mk = tag => {
    const node = {
      tag, dataset: {}, style: {}, children: [], hidden: false, className: '',
      setAttribute() {},
      append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } },
      replaceChildren() { for (const item of this.children) item.parent = null; this.children = []; },
      remove() {
        if (this.parent) this.parent.children = this.parent.children.filter(item => item !== this);
        this.parent = null;
      },
    };
    Object.defineProperty(node, 'offsetWidth', { get() {
      if (node.className === 'grail-player-indicator-strip') {
        seenHiddenDuringMeasurement.push(node.parent?.hidden);
        return node.parent?.hidden ? 0 : 98;
      }
      return 40;
    } });
    Object.defineProperty(node, 'offsetHeight', { get() {
      if (node.className === 'grail-player-indicator-strip') {
        seenHiddenDuringMeasurement.push(node.parent?.hidden);
        return node.parent?.hidden ? 0 : 35;
      }
      return 25;
    } });
    return node;
  };
  const doc = {
    defaultView: { innerWidth: 390, innerHeight: 844 },
    createElement: mk,
    getElementById: () => null,
  };
  const player = {
    name: 'shengNv', side: false, zhiLiao: 0, dataset: {},
    node: { count: { textContent: '4/6', classList: classes() },
      marks: { children: [] }, marks2: { children: [] } },
    getBoundingClientRect: () => ({
      left: 155, right: 235, top: 305, bottom: 420, width: 80, height: 115,
    }),
  };
  const context = {
    game: { me: player, players: [player] },
    ui: { arena: { classList: { contains: () => choosing } } },
    get: { translation: x => x },
    lib: { translate: {}, skill: {} },
  };
  const parent = mk('div');
  const controller = createPlayerIndicators(parent, context, doc);
  const layer = parent.children[0];
  controller.update();
  assert.equal(layer.hidden, true, 'draft has no in-battle public badges');
  choosing = false;
  controller.update();
  assert.ok(seenHiddenDuringMeasurement.length >= 2);
  assert.ok(seenHiddenDuringMeasurement.every(hidden => hidden === false),
    'no badge may be measured under display:none after a draft transition');
  assert.equal(layer.hidden, false);
  assert.equal(player.dataset.grailHandCountMirror, 'true');
  controller.stop();
  assert.equal(player.dataset.grailHandCountMirror, 'false');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { cardElement, createHandSkin, isOwnSpecialAttack } from '../vendor/noname/overrides/grail-card-skin.js';
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

test('only the current character gets a gold border on its own unique attack stamps', () => {
  const context = {
    lib: {
      natureSeparator: '|',
      character: {
        fengZhiJianSheng: ['風之劍聖', 'jiGroup', 3, ['fengNuZhuiJi', 'lieFengJi', 'jiFengJi']],
        shenJianShou: ['神箭手', 'jiGroup', 3, ['jingZhunSheJi']],
        shengNv: ['聖女', 'shengGroup', 3, ['zhiLiaoShu']],
      },
      skill: {
        lieFengJi: { duYou: 'lieFengJi' },
        jiFengJi: { duYou: 'jiFengJi' },
        jingZhunSheJi: { duYou: 'jingZhunSheJi' },
      },
    },
    get: { type: c => c.type },
  };
  const quake = { ...card('di'), type: 'gongJi', duYou: 'lieFengJi|jingZhunSheJi' };
  const wave = { ...card('shui'), type: 'gongJi', duYou: 'jiFengJi|shanGuangXianJing' };
  const screenshotThunder = { ...card('lei'), type: 'gongJi', name: 'leiGuangZhan', duYou: 'jiFengJi|jingZhunSheJi' };
  const other = { ...card('lei'), type: 'gongJi', duYou: 'jingZhunSheJi' };
  const spell = { ...card('di'), type: 'faShu', duYou: 'lieFengJi' };
  const hand = [quake, wave, screenshotThunder, other, spell];
  const player = { name1: 'fengZhiJianSheng', getCards: () => hand };
  const skin = createHandSkin(context);
  skin.update(player);
  assert.equal(quake.dataset.grailOwnSpecial, 'true');
  assert.equal(wave.dataset.grailOwnSpecial, 'true');
  assert.equal(screenshotThunder.dataset.grailOwnSpecial, 'true', 'Swordmaster thunder attack printed with 疾風技 must be highlighted');
  assert.equal(other.dataset.grailOwnSpecial, undefined);
  assert.equal(spell.dataset.grailOwnSpecial, undefined);
  assert.equal(isOwnSpecialAttack(quake, { name1: 'shenJianShou' }, context), true);
  player.name1 = 'shenJianShou';
  skin.update(player);
  assert.equal(quake.dataset.grailOwnSpecial, 'true', 'same physical card matches the new character for a different skill');
  assert.equal(wave.dataset.grailOwnSpecial, undefined);
  assert.equal(screenshotThunder.dataset.grailOwnSpecial, 'true', 'a shooter independently owns the second printed 精準射擊 skill');
  assert.equal(other.dataset.grailOwnSpecial, 'true');
  player.name1 = 'shengNv';
  skin.update(player);
  assert.equal(screenshotThunder.dataset.grailOwnSpecial, undefined, 'a character owning neither printed skill sees the ordinary border');
  player.name1 = 'fengZhiJianSheng';
  wave.classList.contains = name => name === 'infohidden';
  skin.update(player);
  assert.equal(wave.dataset.grailOwnSpecial, undefined);
  skin.stop();
  assert.ok(hand.every(c => c.dataset.grailOwnSpecial === undefined));
});

test('another character drawing the pictured swordmaster cards sees regular borders', () => {
  const c = { ...card('di'), type: 'gongJi', duYou: 'lieFengJi|jingZhunSheJi' };
  const context = {
    lib: { natureSeparator: '|', character: { shengNv: ['聖女', 'shengGroup', 3, ['zhiLiaoShu']] },
      skill: { lieFengJi: { duYou: 'lieFengJi' }, jingZhunSheJi: { duYou: 'jingZhunSheJi' } } },
    get: { type: item => item.type },
  };
  const skin = createHandSkin(context);
  skin.update({ name1: 'shengNv', getCards: () => [c] });
  assert.equal(c.dataset.grailElement, 'di', 'ordinary element styling remains');
  assert.equal(c.dataset.grailOwnSpecial, undefined, 'opponent role cannot borrow a gold border');
});

test('printed 疾風技 stays gold for Swordmaster before skill wrappers are registered', () => {
  const c = { ...card('lei'), name: 'leiGuangZhan', type: 'gongJi', duYou: 'jiFengJi|jingZhunSheJi' };
  const context = { lib: { natureSeparator: '|', character: {
    fengZhiJianSheng: ['風之劍聖', 'jiGroup', 3, ['jiFengJi']],
    shengNv: ['聖女', 'shengGroup', 3, ['zhiLiaoShu']],
  }, skill: {} }, get: { type: item => item.type } };
  const skin = createHandSkin(context);
  skin.update({ name1: 'fengZhiJianSheng', getCards: () => [c] });
  assert.equal(c.dataset.grailOwnSpecial, 'true', 'printed unique abilities do not depend on runtime skill metadata');
  skin.update({ name1: 'shengNv', getCards: () => [c] });
  assert.equal(c.dataset.grailOwnSpecial, undefined, 'a different character still cannot claim the same stamp');
});

test('ordinary playable cards use neutral borders, reserving gold for owned special attacks', async () => {
  const css = await readFile(new URL('../vendor/noname/overrides/grail-polish.css', import.meta.url), 'utf8');
  const regularPlayable = css.match(/#window #arena \.handcards > \.card\[data-grail-element\]\.selectable\s*\{([^}]*)\}/)?.[1];
  const ownedSpecial = css.match(/#window #arena \.handcards > \.card\[data-grail-own-special="true"\]\s*\{([^}]*)\}/)?.[1];
  assert.ok(regularPlayable, 'regular playable rule exists');
  assert.match(regularPlayable, /outline:\s*2px solid #9abecb/);
  assert.doesNotMatch(regularPlayable, /#e5c782|#ffda76|#f6d189|#f4b744/i);
  assert.ok(ownedSpecial, 'innate unique attack rule exists');
  assert.match(ownedSpecial, /outline:\s*4px solid #ffd454/);
  assert.match(ownedSpecial, /inset 0 0 0 3px #fff1a3/, 'gold ring remains visible when the mobile hand clips outer glows');
  assert.match(css, /\.card\[data-grail-own-special="true"\] > \.info\s*\{[^}]*background:\s*#573811ef/s,
    'own special attack skill text has a distinct gold-backed marker');
  assert.ok(css.indexOf('[data-grail-own-special="true"] {') > css.indexOf('[data-grail-element].selectable {'), 'gold rule wins when both are playable');
});

test('the actual pinned Swordmaster pack recognizes exactly its pictured attack stamps', async () => {
  const source = (await readFile(new URL('../public/engine/character/shiZhouNian.js', import.meta.url), 'utf8'))
    .replace(/^import .*?;\s*$/gm, '');
  let pack;
  const game = { import: (_type, factory) => { pack = factory({}, game, {}, {}, {}, {}); } };
  vm.runInNewContext(source, { game, lib: {}, get: {}, ui: {}, ai: {}, _status: {} });
  const context = { lib: { natureSeparator: '|', character: pack.character, skill: pack.skill },
    get: { type: c => c.type } };
  const swordmaster = { name1: 'fengZhiJianSheng' };
  const cleric = { name1: 'shenGuan' };
  assert.equal(isOwnSpecialAttack({ type: 'gongJi', duYou: 'lieFengJi|jingZhunSheJi' }, swordmaster, context), true);
  assert.equal(isOwnSpecialAttack({ type: 'gongJi', duYou: 'jiFengJi|shanGuangXianJing' }, swordmaster, context), true);
  assert.equal(isOwnSpecialAttack({ type: 'gongJi', duYou: 'jiFengJi|jingZhunSheJi' }, swordmaster, context), true);
  assert.equal(isOwnSpecialAttack({ type: 'gongJi', duYou: 'jingZhunSheJi' }, swordmaster, context), false);
  assert.equal(isOwnSpecialAttack({ type: 'gongJi', duYou: 'lieFengJi' }, cleric, context), false);
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

test('the last optional character action offers 回合結束 without changing the engine cancel link', () => {
  const control = controls(), cancel = control.childNodes[1];
  const player = { storage: { gongJiOrFaShu: 1, faShu: 0, gongJi: 0, extraXingDong: [] } };
  const event = { name: 'gongJiOrFaShu', action: true, player };
  updateResponseCancelLabel(control, event, '取消');
  assert.equal(cancel.textContent, '回合結束');
  assert.equal(cancel.dataset.grailAction, 'end-turn');
  assert.equal(cancel.link, 'cancel', 'only the label changes; the native action is untouched');
  assert.ok(control.childNodes.every(button => button.onclick === control.callback));
  for (const name of ['gongJi', 'faShu']) {
    player.storage = { gongJiOrFaShu: 0, faShu: 0, gongJi: 0, extraXingDong: [], [name]: 1 };
    updateResponseCancelLabel(control, { ...event, name }, '取消');
    assert.equal(cancel.textContent, '回合結束');
  }
  player.storage = { gongJiOrFaShu: 0, faShu: 0, gongJi: 0, extraXingDong: [] };
  updateResponseCancelLabel(control, { ...event, name: 'faShu' }, '取消');
  assert.equal(cancel.textContent, '回合結束', 'the last already-dequeued extra action can also finish the turn');
});

test('remaining actions and nested skill selection retain their original cancel or back meaning', () => {
  const control = controls(), cancel = control.childNodes[1];
  const player = { storage: { gongJiOrFaShu: 1, faShu: 1, gongJi: 0, extraXingDong: [] } };
  const event = { name: 'gongJiOrFaShu', action: true, player };
  for (const storage of [
    { ...player.storage },
    { ...player.storage, faShu: 0, extraXingDong: [{ xingDong: 'faShu' }] },
  ]) {
    player.storage = storage;
    updateResponseCancelLabel(control, event, '取消');
    assert.equal(cancel.textContent, '取消');
    assert.equal(cancel.dataset.grailAction, 'cancel');
  }
  player.storage = { gongJiOrFaShu: 1, faShu: 0, gongJi: 0, extraXingDong: [] };
  for (const blocked of [
    { ...event, skill: 'some-skill' },
    { ...event, _backup: { name: 'skill-picker' } },
    { ...event, forced: true },
    { ...event, custom: { replace: { confirm() {} } } },
    { ...event, action: false },
    { ...event, name: 'chooseToUse' },
    { ...event, player: { storage: {} } },
  ]) {
    updateResponseCancelLabel(control, blocked, '返回');
    assert.equal(cancel.textContent, '返回');
    assert.equal(cancel.dataset.grailAction, 'cancel');
  }
});

test('special-attack gold ring paints over actual local hand artwork even without selection', async () => {
  const css = await readFile(new URL('../vendor/noname/overrides/grail-polish.css', import.meta.url), 'utf8');
  const overlay = css.match(/#window #arena #handcards1 \.handcards > \.card\[data-grail-own-special="true"\]::after\s*\{([^}]*)\}/)?.[1];
  assert.ok(overlay, 'own special hand-card overlay must NOT depend on selected/selectable');
  assert.match(overlay, /border:\s*3px solid #ffe177 !important/);
  assert.match(overlay, /z-index:\s*9 !important/);
  assert.match(overlay, /pointer-events:\s*none !important/);
  const base = css.match(/#window #arena #handcards1 \.handcards > \.card\[data-grail-own-special="true"\]\s*\{([^}]*)\}/)?.[1];
  assert.match(base, /border:\s*3px solid #ffd454 !important/);
  assert.ok(css.indexOf('#window #arena #handcards1 .handcards > .card[data-grail-own-special="true"]')
    > css.indexOf('[data-grail-own-special="true"].selected'));
});
test('printed special attack is marked before native dynamic type resolves', () => {
  const unique = { ...card('lei'), name: 'leiGuangZhan', duYou: 'jiFengJi' };
  const context = {
    lib: { natureSeparator: '|', character: { fengZhiJianSheng: [null, null, null, ['jiFengJi']] },
      card: { leiGuangZhan: { type: 'gongJi' } } },
    get: { type: () => undefined },
  };
  const skin = createHandSkin(context);
  skin.update({ name1: 'fengZhiJianSheng', getCards: () => [unique] });
  assert.equal(unique.dataset.grailOwnSpecial, 'true');
  skin.stop(); assert.equal(unique.dataset.grailOwnSpecial, undefined);
});

test('gold unique attacks have a gentle always-visible animation and a reduced-motion fallback', async () => {
  const css = await readFile(new URL('../vendor/noname/overrides/grail-polish.css', import.meta.url), 'utf8');
  assert.match(css, /@keyframes grail-special-gold-breathe/);
  assert.match(css, /grail-special-gold-breathe 2\.6s ease-in-out infinite !important/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?grail-special-gold-breathe[\s\S]*?animation: none !important/);
  assert.match(css, /#window #arena #handcards1 \.handcards > \.card\[data-grail-own-special="true"\]::after/);
  const overlay = css.match(/#window #arena #handcards1 \.handcards > \.card\[data-grail-own-special="true"\]::after\s*\{([^}]*)\}/)?.[1];
  assert.ok(overlay);
  assert.doesNotMatch(overlay, /opacity:\s*[^;!]+!important/, 'important opacity silently overrides CSS animations');
  const keyframes = css.match(/@keyframes grail-special-gold-breathe\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(keyframes);
  assert.match(keyframes, /0%, 100%\s*\{\s*opacity:\s*\.58/);
  assert.match(keyframes, /50%\s*\{\s*opacity:\s*1/);
  assert.doesNotMatch(keyframes, /box-shadow|transform/, 'compositor-friendly glow does not repaint shadows or move hit targets each frame');
});

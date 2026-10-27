import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { updateActionHints } from '../vendor/noname/overrides/grail-action-hints.js';

function classes() {
  const set = new Set();
  return { contains: x => set.has(x), toggle(name, force) { if (force) set.add(name); else set.delete(name); } };
}
function dialog(texts, hasChoices = false) {
  const d = { classList: classes(),
    querySelectorAll(selector) {
      assert.equal(selector, '.caption, .prompt, .content > .text');
      return texts.map(textContent => ({ textContent }));
    },
    querySelector(selector) {
      assert.match(selector, /\.buttons/);
      return hasChoices ? {} : null;
    } };
  return d;
}
function arena(dialogs, choosing = false) {
  const root = { classList: classes(),
    querySelectorAll(selector) {
      assert.equal(selector, ':scope > .dialog:not(.popped)');
      return dialogs;
    } };
  if (choosing) root.classList.toggle('choose-character', true);
  return root;
}
test('empty native action prompts do not leave a blank bar while text comes back when populated', () => {
  const labels = ['  ', '\u00a0']; const d = dialog(labels);
  const a = arena([d]);
  updateActionHints(a);
  assert.equal(d.classList.contains('grail-action-hint'), true);
  assert.equal(d.classList.contains('grail-empty-action-hint'), true);
  labels[0] = '攻擊行動或者法術行動';
  updateActionHints(a);
  assert.equal(d.classList.contains('grail-empty-action-hint'), false);
});
test('noname Dialog.addText native .content > .text is treated as a visible or empty hint', () => {
  const d = dialog(['\u00a0']);
  const a = arena([d]);
  updateActionHints(a);
  assert.equal(d.classList.contains('grail-action-hint'), true);
  assert.equal(d.classList.contains('grail-empty-action-hint'), true);
  // In the real noname dialog this changes when the next phase sets a new .text.
  d.querySelectorAll = selector => {
    assert.equal(selector, '.caption, .prompt, .content > .text');
    return [{ textContent: '攻擊行動或者法術行動' }];
  };
  updateActionHints(a);
  assert.equal(d.classList.contains('grail-empty-action-hint'), false);
});
test('native interactive dialogs and character draft cannot be changed by action hint styling', () => {
  const choice = dialog(['選擇技能'], true), hint = dialog(['承受傷害']);
  const a = arena([choice, hint]);
  updateActionHints(a);
  assert.equal(choice.classList.contains('grail-action-hint'), false);
  assert.equal(hint.classList.contains('grail-action-hint'), true);
  updateActionHints(arena([hint], true));
  assert.equal(hint.classList.contains('grail-action-hint'), true, 'choose-character pass does not alter native dialog');
});
test('native div-based skill controls cannot be mistaken for decorative action hints', async () => {
  const source = await readFile(new URL('../vendor/noname/overrides/grail-action-hints.js', import.meta.url), 'utf8');
  for (const cls of ['.buttons', '.button', '.card', '.pointerdiv', '.pointerspan', '.clickable', '.popup']) {
    assert.ok(source.includes("'" + cls + "'"), cls + ' must block passive-hint classification');
  }
  for (const control of ['[role="button"]', 'a[href]', 'input', 'select', 'textarea', '[contenteditable="true"]']) {
    assert.ok(source.includes("'" + control + "'"), control + ' must preserve native UI interaction');
  }
  const labels = ['攻擊行動或者法術行動'];
  let nativeChoiceAppeared = false;
  const choice = dialog(labels);
  choice.querySelector = () => nativeChoiceAppeared ? {} : null;
  const table = arena([choice]);
  updateActionHints(table);
  assert.equal(choice.classList.contains('grail-action-hint'), true);
  nativeChoiceAppeared = true; // native skill dialog reused its existing container
  updateActionHints(table);
  assert.equal(choice.classList.contains('grail-action-hint'), false,
    'an actionable choice must immediately restore its native dialog geometry');
  assert.equal(choice.classList.contains('grail-empty-action-hint'), false);
});

test('iOS fallback color and in-card faction label are explicitly provided', async () => {
  const css = await readFile(new URL('../vendor/noname/overrides/grail.css', import.meta.url), 'utf8');
  const role = await readFile(new URL('../vendor/noname/overrides/grail-role-tags.css', import.meta.url), 'utf8');
  assert.match(css, /grail-empty-action-hint\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /grail-action-hint :is\(\.caption, \.prompt, \.content > \.text\)[\s\S]*?-webkit-text-fill-color:\s*#fff4d5/);
  assert.doesNotMatch(css, /:has\(\.caption, \.prompt\):not\(:has/);
  assert.match(role, /\.button\.character > \.identity[\s\S]*?inset:\s*5px 5px auto auto !important/);
  assert.match(role, /\.button\.character > \.identity > div[\s\S]*?writing-mode:\s*horizontal-tb !important/);
});

test('iPhone passive action tip uses left lane rather than covering centre portrait', async () => {
  const css = await readFile(new URL('../vendor/noname/overrides/grail.css', import.meta.url), 'utf8');
  assert.match(css, /grail-action-hint:not\(\.popped\)[\s\S]*?max-width:\s*37% !important/);
  assert.match(css, /grail-action-hint:not\(\.popped\)[\s\S]*?max-width:\s*36% !important/);
});
test('top system/history/help/deck buttons have consistent 44px touch dimensions', async () => {
  const css = await readFile(new URL('../vendor/noname/overrides/grail.css', import.meta.url), 'utf8');
  const phone = await readFile(new URL('../vendor/noname/overrides/grail-phone-controls.css', import.meta.url), 'utf8');
  assert.match(phone, /#window #system > div > div:not\(\.hidden\)[\s\S]*?height:\s*calc\(44px \* var\(--grail-touch-scale, 1\)\) !important/);
  assert.match(css, /#grail-history-toggle,[\s\S]*?#grail-help:has\(#grail-help-toggle\[aria-expanded="false"\]\)[\s\S]*?height:\s*44px !important/);
  assert.match(css, /#window \.grail-top-pile-tool[\s\S]*?min-height:\s*calc\(44px \* var\(--grail-touch-scale, 1\)\) !important/);
});

test('passive native action text moves into visible scoreboard heading but never moves interactive choice', () => {
  const label = { hidden: true, textContent: '' };
  const textOnly = dialog(['[攻擊行動]或者[法術行動]']);
  const interactive = dialog(['請選擇目標'], true);
  const root = arena([textOnly, interactive]);
  updateActionHints(root, label, true);
  assert.equal(label.hidden, false);
  assert.match(label.textContent, /攻擊行動/);
  assert.equal(textOnly.classList.contains('grail-inline-action-hint'), true);
  assert.equal(interactive.classList.contains('grail-inline-action-hint'), false);
  const blank = dialog([' ']);
  updateActionHints(arena([blank]), label, true);
  assert.equal(label.hidden, true);
  assert.equal(blank.classList.contains('grail-inline-action-hint'), false);
  updateActionHints(root, label, false);
  assert.equal(label.hidden, true);
  assert.equal(textOnly.classList.contains('grail-inline-action-hint'), false);
});
test('portrait and landscape use scoreboard hint instead of floating overlay', async () => {
  const css = await readFile(new URL('../vendor/noname/overrides/grail.css', import.meta.url), 'utf8');
  assert.match(css, /#grail-phase-hint\[hidden\]\s*\{\s*display:\s*none !important/);
  assert.match(css, /\.dialog\.grail-inline-action-hint:not\(\.popped\)\s*\{\s*display:\s*none !important/);
  assert.match(css, /orientation:\s*portrait/);
  assert.match(css, /orientation:\s*landscape/);
});

test('dedicated action status chooses lower-middle safe space away from score, portraits, buttons and hand', async () => {
  const { chooseActionHintTop } = await import('../vendor/noname/overrides/grail-action-hints.js');
  const viewport = { width: 390, height: 850,
    scoreboard: { left: 0, right: 390, top: 160, bottom: 230 },
    players: [{ left: 155, right: 232, top: 260, bottom: 370 }],
    controls: { left: 160, right: 275, top: 630, bottom: 680 },
    hand: { left: 90, right: 390, top: 710, bottom: 830 } };
  const top = chooseActionHintTop(viewport, { width: 350, height: 68 });
  assert.ok(top >= 242 && top + 68 <= 618, 'hint avoids score and native buttons');
  assert.ok(top >= 376 || top + 68 <= 254, 'hint avoids central opponent portrait');
  const landscape = chooseActionHintTop({ width: 844, height: 390,
    scoreboard: { bottom: 120 },
    players: [{ left: 370, right: 450, top: 130, bottom: 215 }],
    controls: { left: 390, right: 540, top: 330, bottom: 370 },
    hand: { left: 30, right: 630, top: 345, bottom: 390 } }, { width: 400, height: 52 });
  assert.ok(landscape >= 132 && landscape + 52 <= 318);
});

test('permanent top options replace floating hamburger while draft filters remain scrollable', async () => {
  const css = await readFile(new URL('../vendor/noname/overrides/grail.css', import.meta.url), 'utf8');
  assert.match(css, /#window #arena > #roundmenu\s*\{\s*display:\s*none !important/);
  const phoneCss = await readFile(new URL('../vendor/noname/overrides/grail-phone-controls.css', import.meta.url), 'utf8');
  assert.match(phoneCss, /#window #system > div > div:not\(\.hidden\)/, 'native settings button is in the top toolbar');
  assert.match(css, /\.dialog \.caption\.pointerspan > div[\s\S]*?flex-wrap:\s*nowrap !important/);
  assert.match(css, /\.dialog \.caption\.pointerspan > div[\s\S]*?overflow-x:\s*auto !important/);
  assert.match(css, /\.dialog \.caption\.pointerspan > div > \.tdnode[\s\S]*?white-space:\s*nowrap !important/);
  assert.match(css, /#grail-scoreboard \.grail-score-heading > #grail-phase-hint[\s\S]*?pointer-events:\s*none/);
  const bridge = await readFile(new URL('../vendor/noname/overrides/grail-bridge.js', import.meta.url), 'utf8');
  assert.match(bridge, /scoreboardHeading\.insertBefore\(phaseHint,/);
  assert.doesNotMatch(bridge, /positionActionHint\(phaseHint,/);
});

test('native tutorial and settings menu must stack over the battle HUD while open', async () => {
  const css = await readFile(new URL('../vendor/noname/overrides/grail.css', import.meta.url), 'utf8');
  assert.match(css, /#window > \.menu-container:not\(\.hidden\)\s*\{\s*z-index:\s*70 !important/);
  assert.match(css, /#grail-hud\s*\{\s*z-index:\s*20;/);
});

test('native hidden secondary draft filter remains hidden until user taps 篩選', async () => {
  const css = await readFile(new URL('../vendor/noname/overrides/grail.css', import.meta.url), 'utf8');
  assert.match(css, /caption\.pointerspan > div\[style\*="display: none"\][\s\S]*?display:\s*none !important/);
  assert.match(css, /body:has\(#window > \.menu-container:not\(\.hidden\)\) #grail-hud/);
  assert.doesNotMatch(css, /#grail-hud > #grail-phase-hint\s*\{/, 'no free-floating prompt above battle');
});

test('responsive hint uses a clear LEFT/RIGHT lane when centre is occupied', async () => {
  const { chooseActionHintPlacement } = await import('../vendor/noname/overrides/grail-action-hints.js');
  const area = { width: 844, height: 390, scoreboard: { bottom: 98 },
    players: [{ left: 375, right: 470, top: 114, bottom: 248 }],
    controls: { left: 370, right: 550, top: 294, bottom: 338 },
    hand: { left: 10, right: 620, top: 350, bottom: 390 },
    extras: [{ left: 760, right: 840, top: 245, bottom: 300 }] };
  const hint = { width: 260, height: 48 };
  const placed = chooseActionHintPlacement(area, hint);
  assert.ok(placed, 'a side lane should remain available');
  assert.ok(placed.left + hint.width < area.players[0].left - 4 ||
    placed.left > area.players[0].right + 4 ||
    placed.top + hint.height < area.players[0].top - 4 ||
    placed.top > area.players[0].bottom + 4, 'must not cover the centre role');
  assert.ok(placed.top + hint.height <= 294 - 4 || placed.left + hint.width <= 370 - 4 ||
    placed.left >= 550 + 4, 'must not cover confirm/cancel');
});
test('impossible hint placement gracefully rejects overlap, preserving engine prompt fallback', async () => {
  const { chooseActionHintPlacement, positionActionHint } =
    await import('../vendor/noname/overrides/grail-action-hints.js');
  const area = { width: 390, height: 590, scoreboard: { bottom: 200 },
    players: [{ left: 0, right: 390, top: 210, bottom: 570 }],
    controls: { left: 50, right: 310, top: 480, bottom: 550 } };
  assert.equal(chooseActionHintPlacement(area, { width: 350, height: 58 }), null);
  const variables = [];
  const hint = { hidden: false, offsetWidth: 350, offsetHeight: 58,
    style: { setProperty: (...args) => variables.push(args) } };
  assert.equal(positionActionHint(hint, area), false, 'do not draw across actual native choices');
  assert.deepEqual(variables, [], 'no stale anchor should be set if there is no safe placement');
});
test('portrait HUD placement avoids the selected portrait and native hand while keeping text visible', async () => {
  const { chooseActionHintPlacement } = await import('../vendor/noname/overrides/grail-action-hints.js');
  const area = { width: 390, height: 850, scoreboard: { bottom: 230 },
    players: [{ left: 155, right: 235, top: 264, bottom: 376 }],
    controls: { left: 145, right: 290, top: 618, bottom: 680 },
    hand: { left: 90, right: 390, top: 710, bottom: 835 } };
  const box = { width: 300, height: 64 };
  const placed = chooseActionHintPlacement(area, box);
  assert.ok(placed && placed.top >= 388 && placed.top + box.height <= 610);
  const css = await readFile(new URL('../vendor/noname/overrides/grail.css', import.meta.url), 'utf8');
  assert.match(css, /#grail-scoreboard \.grail-score-heading > #grail-phase-hint/);
  const bridge = await readFile(new URL('../vendor/noname/overrides/grail-bridge.js', import.meta.url), 'utf8');
  assert.match(bridge, /scoreboardHeading\.insertBefore\(phaseHint,/);
  assert.doesNotMatch(bridge, /hintHasSafeSlot/);
});

test('hidden or unfocused old noname dialogs never replace the active HUD text', async () => {
  const { isActionDialogVisible } = await import('../vendor/noname/overrides/grail-action-hints.js');
  const label = { textContent: '', hidden: true };
  const old = dialog(['前一階段的舊提示']);
  const active = dialog(['請選擇攻擊或法術']);
  const a = arena([old, active]);
  for (const nativeState of ['hidden', 'removing', 'unfocus']) {
    old.classList.toggle(nativeState, true);
    updateActionHints(a, label, true);
    assert.equal(isActionDialogVisible(old), false, nativeState);
    assert.equal(label.textContent, '請選擇攻擊或法術');
    assert.equal(old.classList.contains('grail-inline-action-hint'), false,
      'hidden source cannot keep stale visual-hide state');
    old.classList.toggle(nativeState, false);
  }
  old.style = { display: 'none' };
  updateActionHints(a, label, true);
  assert.equal(label.textContent, '請選擇攻擊或法術');
  assert.equal(isActionDialogVisible(old), false);
  old.style.display = '';
  old.hidden = true;
  updateActionHints(a, label, true);
  assert.equal(label.textContent, '請選擇攻擊或法術');
  old.hidden = false;
  old.getAttribute = key => key === 'aria-hidden' ? 'true' : null;
  updateActionHints(a, label, true);
  assert.equal(label.textContent, '請選擇攻擊或法術');
});

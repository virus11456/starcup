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
      assert.equal(selector, '.caption, .prompt');
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
  assert.match(css, /grail-action-hint :is\(\.caption, \.prompt\)[\s\S]*?-webkit-text-fill-color:\s*#fff4d5/);
  assert.doesNotMatch(css, /:has\(\.caption, \.prompt\):not\(:has/);
  assert.match(role, /\.button\.character > \.identity[\s\S]*?inset:\s*5px 5px auto auto !important/);
  assert.match(role, /\.button\.character > \.identity > div[\s\S]*?writing-mode:\s*horizontal-tb !important/);
});

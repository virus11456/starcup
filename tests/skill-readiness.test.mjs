import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionalSkillReadinessNotes } from '../vendor/noname/overrides/grail-skill-readiness.js';

const get = { xiBie: card => card.element, type: card => card.kind };
const hand = cards => ({ getCards(zone) {
  assert.equal(zone, 'h');
  return cards;
} });

test('wind pursuit shows an advisory when trigger is legal but no wind attack is held', () => {
  const notes = optionalSkillReadinessNotes(['fengNuZhuiJi'], hand([
    { element: 'huo', kind: 'gongJi' }, { element: 'feng', kind: 'faShu' },
  ]), get);
  assert.equal(notes.length, 1);
  assert.match(notes[0], /沒有風系攻擊牌/);
  assert.match(notes[0], /仍可發動/);
});
test('does not warn when wind attack is held', () => {
  assert.deepEqual(optionalSkillReadinessNotes(['fengNuZhuiJi'], hand([
    { element: 'feng', kind: 'gongJi' },
  ]), get), []);
});
test('never suppresses another legal skill when warning about wind pursuit', () => {
  assert.equal(optionalSkillReadinessNotes(['jianYing', 'fengNuZhuiJi'], hand([]), get).length, 1);
  assert.deepEqual(optionalSkillReadinessNotes(['jianYing'], hand([]), get), []);
});
test('without local hand context it avoids speculative readiness claims', () => {
  assert.deepEqual(optionalSkillReadinessNotes(['fengNuZhuiJi'], null, get), []);
  assert.deepEqual(optionalSkillReadinessNotes(['fengNuZhuiJi'], hand([]), {}), []);
});
test('bridge renders note in informational guide; never touches skill filter', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../vendor/noname/overrides/grail-bridge.js', import.meta.url), 'utf8');
  assert.match(source, /availableNodes\.map\(x => x\.link\)/);
  assert.match(source, /optionalSkillReadinessNotes\(/);
  assert.match(source, /符合發動時機的技能/);
  assert.match(source, /help\.append\(note\)/);
});

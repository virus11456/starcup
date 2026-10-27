import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('engine preparation never adds hand, target or remaining-action conditions to optional responses', () => {
  const source = readFileSync(new URL('../scripts/prepare-engine.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /requireOptionalSkillCards|canOfferExtraAttackForCrystal/);
  assert.match(source, /Do not narrow optional skill `filter`s/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { roomFailure } from '../cloudflare/service-errors.js';

test('actual Durable Object free-tier quota errors give a clear non-retrying response', () => {
  for (const kind of ['written', 'read']) {
    const result = roomFailure(new Error(`remote: Exceeded allowed rows ${kind} in Durable Objects free tier.`));
    assert.equal(result.status, 429);
    assert.match(result.error, /台灣時間早上 8 點/);
    assert.match(result.error, /單人模式仍可遊玩/);
  }
});

test('other infrastructure details stay private and room rule errors keep their status', () => {
  assert.deepEqual(roomFailure(new Error('private connection detail')), { status: 500, error: '房間服務暫時無法連線，請稍後重試。' });
  assert.deepEqual(roomFailure({ status: 410, message: '房間已結束。' }), { status: 410, error: '房間已結束。' });
});

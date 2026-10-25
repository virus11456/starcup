import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomRequests } from '../lib/room-request.ts';

function harness() {
  let nextId = 0;
  const timers = new Map<number, () => void>();
  const requests = createRoomRequests({
    setTimer: ((callback: () => void) => { const id = ++nextId; timers.set(id, callback); return id; }) as unknown as typeof setTimeout,
    clearTimer: ((id: number) => { timers.delete(id); }) as unknown as typeof clearTimeout,
  });
  return { requests, timers };
}
test('duplicate room submissions share a synchronous lock and completion permits the next action', () => {
  const { requests, timers } = harness();
  const first = requests.begin()!;
  assert.equal(requests.begin(), null);
  assert.equal(timers.size, 1);
  assert.ok(first.finish()); assert.equal(timers.size, 0);
  assert.equal(first.current(), false);
  const next = requests.begin()!;
  assert.ok(next.current()); requests.cancel();
});
test('leaving cancels the old request and its late completion cannot reopen the room or unlock a newer request', async () => {
  const { requests, timers } = harness();
  const old = requests.begin()!;
  let resolve!: () => void, reopened = false;
  const delayed = new Promise<void>(done => { resolve = done; }).then(() => {
    if (old.current()) reopened = true;
    old.finish();
  });
  requests.cancel(); assert.equal(old.signal.aborted, true);
  const replacement = requests.begin()!;
  resolve(); await delayed;
  assert.equal(reopened, false);
  assert.ok(replacement.current()); assert.equal(replacement.signal.aborted, false);
  assert.equal(requests.begin(), null); assert.equal(timers.size, 1);
  replacement.finish(); assert.equal(timers.size, 0);
});
test('timeout aborts with a readable error and releases the lock when error handling completes', () => {
  const { requests, timers } = harness();
  const operation = requests.begin()!;
  timers.values().next().value!();
  assert.equal(operation.signal.aborted, true);
  assert.match(operation.signal.reason.message, /連線逾時/);
  assert.ok(operation.current(), 'current page must still display the timeout error');
  assert.throws(() => operation.signal.throwIfAborted(), /連線逾時/);
  operation.finish();
  assert.equal(timers.size, 0);
  assert.ok(requests.begin()); requests.cancel();
});

// One active room operation per mounted page. Late responses must never
// reopen an iframe or rewrite the URL after that page has been left.
export function createRoomRequests({
  setTimer = setTimeout, clearTimer = clearTimeout, timeout = 15_000,
}: { setTimer?: typeof setTimeout; clearTimer?: typeof clearTimeout; timeout?: number } = {}) {
  type Operation = {
    signal: AbortSignal;
    current(): boolean;
    finish(): boolean;
    cancel(): void;
  };
  let active: Operation | null = null;
  return {
    begin(): Operation | null {
      if (active) return null;
      const controller = new AbortController();
      const timer = setTimer(() => controller.abort(new Error('房間連線逾時，請稍後再試。')), timeout);
      let finished = false;
      const operation: Operation = {
        signal: controller.signal,
        current: () => active === operation,
        finish() {
          if (finished) return false;
          finished = true;
          clearTimer(timer);
          if (active !== operation) return false;
          active = null;
          return true;
        },
        cancel() {
          operation.finish();
          controller.abort();
        },
      };
      active = operation;
      return operation;
    },
    cancel() { active?.cancel(); },
  };
}

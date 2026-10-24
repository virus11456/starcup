/** A polling cursor: hydrate silently, skip stale snapshots, play each event once. */
export class MotionCursor {
  private room = "";
  private last = 0;
  take<T extends { id: number; at: number }>(room: string, events: T[], now = Date.now()) {
    const freshRoom = room !== this.room;
    this.room = room;
    const latest = Math.max(this.last, ...events.map(e => e.id));
    const fresh = freshRoom ? [] : events.filter(e => e.id > this.last && now - e.at < 12000);
    this.last = freshRoom ? Math.max(0, ...events.map(e => e.id)) : latest;
    return fresh;
  }
}

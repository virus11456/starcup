import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorToViewport, hudViewportGeometry } from '../vendor/noname/overrides/grail-viewport.js';

test('viewport HUD inverse-scales and offsets correctly for the native rotated/scaled table', () => {
  const g = hudViewportGeometry({ left: 14, top: 22, width: 270 }, 390, 390, 844);
  assert.equal(g.scale, 270 / 390);
  assert.equal(g.width, 390);
  assert.equal(g.height, 844);
  assert.equal(g.transform, `scale(${390/270})`);
  assert.equal(g.left, `${-14*(390/270)}px`);
  assert.equal(g.top, `${-22*(390/270)}px`);
  const fallback = hudViewportGeometry({ left: 0, top: 0, width: 0 }, 0, 390, 844);
  assert.equal(fallback.scale, 1, 'loading before the engine body is measurable never yields Infinity or NaN');
  assert.equal(fallback.transform, 'scale(1)');
});

test('iPhone visualViewport scrolling and orientation coalesce into one HUD realignment', () => {
  const makeEvents = () => {
    const listeners = new Map();
    return {
      listeners,
      addEventListener(name, cb) { listeners.set(name, cb); },
      removeEventListener(name, cb) {
        if (listeners.get(name) === cb) listeners.delete(name);
      },
      fire(name) { listeners.get(name)?.(); },
    };
  };
  const windows = makeEvents(), viewports = makeEvents(), documents = makeEvents();
  let bodyRect = {left:0, top:0, width:390};
  const body = { offsetWidth:390, getBoundingClientRect: () => bodyRect };
  const doc = {...documents, body};
  const frames = new Map();
  let nextFrame = 1, observer;
  const win = {...windows, visualViewport:viewports,
    innerWidth:390, innerHeight:844,
    requestAnimationFrame(cb) { const id=nextFrame++; frames.set(id,cb); return id; },
    cancelAnimationFrame(id) { frames.delete(id); }
  };
  class FakeObserver {
    constructor(cb) { this.cb = cb; observer = this; }
    observe(target, cfg) { assert.equal(target, body); assert.deepEqual(cfg.attributeFilter,['style']); }
    disconnect() { this.stopped=true; }
  }
  const style = {};
  const element = {style};
  const scales = [];
  const stop = anchorToViewport(element, value=>scales.push(value), {
    win, doc, Observer:FakeObserver
  });
  assert.equal(style.width,'390px');
  assert.equal(style.height,'844px');
  assert.deepEqual(scales,[1]);
  assert.equal(style.left,'0px');

  bodyRect={left:7,top:15,width:320};
  win.innerWidth=844; win.innerHeight=390;
  viewports.fire('scroll');
  windows.fire('orientationchange');
  windows.fire('resize');
  observer.cb();
  assert.equal(frames.size,1,'rapid Safari viewport changes must share a single animation frame');
  frames.values().next().value();
  frames.clear();
  assert.equal(style.width,'844px');
  assert.equal(style.height,'390px');
  assert.equal(style.transform,'scale(1.21875)');
  assert.equal(style.left,'-8.53125px');
  assert.equal(style.top,'-18.28125px');
  assert.deepEqual(scales,[1,320/390]);

  windows.fire('pageshow');
  documents.fire('fullscreenchange');
  assert.equal(frames.size,1,'bfcache page return and fullscreen reuse the coalesced refresh');
  frames.values().next().value();
  frames.clear();
  assert.deepEqual(scales,[1,320/390],'unchanged scaling does not rewrite the native HUD scale');

  viewports.fire('resize');
  assert.equal(frames.size,1);
  stop();
  assert.equal(frames.size,0,'scheduled old-iframe writes are cancelled');
  assert.equal(observer.stopped,true);
  assert.equal(windows.listeners.size,0);
  assert.equal(viewports.listeners.size,0);
  assert.equal(documents.listeners.size,0);
  stop();
});

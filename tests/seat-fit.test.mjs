import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  physicalSeatGeometry,
  fitPortraitSeatScale,
  updatePortraitSeatFit,
} from '../vendor/noname/overrides/grail-seat-fit.js';

const seats = (count, distance, { width = 64, height = 106, y = 150 } = {}) =>
  Array.from({ length: count }, (_, i) => ({
    x: 42 + distance * i, y, width, height,
  }));

test('uncrowded four-player phone layout keeps readable portrait zoom', () => {
  assert.equal(fitPortraitSeatScale(seats(3, 98)), 1.38);
});

test('six-player iPhone row shrinks only enough for a visible gap', () => {
  const group = seats(5, 78);
  const scale = fitPortraitSeatScale(group);
  assert.ok(scale < 1.38 && scale > 1.02, String(scale));
  assert.ok(78 - 64 * scale >= 7.95, 'visible adjacent card gap');
});

test('eight-player phone scales further rather than allowing overlaps', () => {
  const group = seats(7, 54);
  const scale = fitPortraitSeatScale(group);
  assert.ok(scale < fitPortraitSeatScale(seats(5,78)));
  assert.ok(54 - 64 * scale >= 7.95);
});

test('different upper/lower seat bands do not trigger horizontal shrink', () => {
  const group = [
    { x: 80, y: 160, width:64, height:95 },
    { x: 91, y: 405, width:64, height:95 },
    { x: 230, y: 160, width:64, height:95 },
  ];
  assert.equal(fitPortraitSeatScale(group), 1.38);
});

test('staggered seats use a vertical gap rather than shrinking unnecessarily on x-axis', () => {
  const seatA = { x:60, y:150, width:64, height:106 };
  const seatB = { x:100, y:255, width:64, height:106 };
  const fitted = fitPortraitSeatScale([seatA,seatB]);
  assert.ok(fitted > 0.9 && fitted < 1.1, String(fitted));
  assert.ok(255-150 - 106*fitted >= 7.95);
});

test('original left/right zoom origins recover the unscaled seat center', () => {
  assert.deepEqual(physicalSeatGeometry({
    left: 8, right: 96, top: 10, bottom: 164,
    width: 88, height:154,
  }, 1.375, 'left center'), { x:40, y:87, width:64, height:112 });
  assert.deepEqual(physicalSeatGeometry({
    left: 250, right: 338, top: 10, bottom: 164,
    width:88, height:154,
  }, 1.375, 'right center'), { x:306, y:87, width:64, height:112 });
});

function mockPlayer(x, y, {scale = 1, origin = 'center center', seat=1} = {}) {
  const vars = new Map();
  return {
    dataset: { position: String(seat), grailRoleOrigin: origin },
    classList: { contains: () => false },
    style: {
      setProperty: (k,v) => vars.set(k,v),
      removeProperty: k => vars.delete(k),
      getPropertyValue: k => vars.get(k) || '',
    },
    getBoundingClientRect() {
      const zoom = Number(vars.get('--grail-portrait-seat-scale') || scale);
      const physicalW = 64 * zoom, physicalH = 106 * zoom;
      const anchorX = origin.startsWith('left') ? x - 32
        : origin.startsWith('right') ? x + 32 : x;
      const left = origin.startsWith('left') ? anchorX
        : origin.startsWith('right') ? anchorX - physicalW : x - physicalW/2;
      return {left,right:left+physicalW,top:y-physicalH/2,bottom:y+physicalH/2,
        width:physicalW,height:physicalH};
    },
    get zoom() { return Number(vars.get('--grail-portrait-seat-scale') || scale); },
  };
}
const styleOf = player => ({ scale: String(player.zoom) });
test('iPhone runtime changes only CSS variables and settles without an oscillation', () => {
  const roles = seats(5,78).map(({x,y},i)=>mockPlayer(x,y,{seat:i+1}));
  const before = roles.map(role=>role.dataset.position);
  const result = updatePortraitSeatFit(roles,{width:390,height:844},{styleOf});
  assert.ok(result > 1 && result < 1.38);
  assert.ok(roles.every(role=>Math.abs(role.zoom-result)<0.001));
  assert.deepEqual(roles.map(role=>role.dataset.position),before);
  const second = updatePortraitSeatFit(roles,{width:390,height:844},{styleOf});
  assert.equal(second,result,'repeated HUD updates should use the same scale');
  updatePortraitSeatFit(roles,{width:844,height:390},{styleOf});
  assert.ok(roles.every(role=>!role.style.getPropertyValue('--grail-portrait-seat-scale')),
    'rotate to landscape clears the iPhone-only scale');
});
test('CSS fallback is safe without JS and keeps native hit targets', async () => {
  const css = await readFile(new URL('../vendor/noname/overrides/grail.css',import.meta.url),'utf8');
  const bridge = await readFile(new URL('../vendor/noname/overrides/grail-bridge.js',import.meta.url),'utf8');
  assert.match(css,/scale:\s*var\(--grail-portrait-seat-scale,\s*1\)/);
  assert.doesNotMatch(css, /scale:\s*1\.38\s*;/);
  assert.match(bridge,/updatePortraitSeatFit\(game\.players/);
  const code = await readFile(new URL('../vendor/noname/overrides/grail-seat-fit.js',import.meta.url),'utf8');
  assert.doesNotMatch(code,/\.style\.transform\s*=|\.style\.left\s*=|\.style\.top\s*=|removeChild|appendChild|\.remove\(\)/);
});

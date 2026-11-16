'use strict';

const canvas = document.querySelector('#room');
const button = document.querySelector('#fullscreen');
const status = document.querySelector('#status');
const root = document.documentElement;
const screenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
let notice;

button.addEventListener('click', async () => {
  if (screenElement()) return;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  clearTimeout(notice);
  status.textContent = '';
  try {
    if (!request) throw new Error();
    await request.call(root);
  } catch {
    status.textContent = 'Не удалось включить полноэкранный режим.';
    notice = setTimeout(() => { status.textContent = ''; }, 3000);
  }
});

function syncFullscreen() {
  root.toggleAttribute('data-fullscreen', Boolean(screenElement()));
  button.setAttribute('aria-label', screenElement()
    ? 'Полноэкранный режим включён'
    : 'Включить полноэкранный режим');
}
document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('webkitfullscreenchange', syncFullscreen);

const display = canvas.getContext('2d', { alpha: false });
const backdrop = document.createElement('canvas');
const foreground = document.createElement('canvas');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const TAU = Math.PI * 2;
const mod = (n, d) => ((n % d) + d) % d;
const mix = (a, b, p) => a + (b - a) * p;
const snap = Math.round;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pick = (list, n) => list[mod(n, list.length)];
let ctx, scene, seed, frame;

function random() {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  return seed / 4294967296;
}

function box(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(snap(x), snap(y), w, h);
}

function shape(color, ...points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
  ctx.fill();
}

// A one-pixel stair-step line, including at diagonal angles.
function line(x, y, x2, y2, color, size = 1) {
  x = snap(x); y = snap(y); x2 = snap(x2); y2 = snap(y2);
  const dx = Math.abs(x2 - x), dy = -Math.abs(y2 - y);
  const sx = x < x2 ? 1 : -1, sy = y < y2 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    box(x, y, size, size, color);
    if (x === x2 && y === y2) break;
    const next = 2 * err;
    if (next >= dy) { err += dy; x += sx; }
    if (next <= dx) { err += dx; y += sy; }
  }
}

function glow(x, y, rx, ry, rgb, opacity) {
  ctx.save();
  ctx.translate(snap(x), snap(y));
  ctx.scale(rx, ry);
  const light = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  light.addColorStop(0, `rgba(${rgb},${opacity})`);
  light.addColorStop(.42, `rgba(${rgb},${opacity * .57})`);
  light.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = light;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function spark(x, y, color, size = 1) {
  box(x - size, y, size * 2 + 1, 1, color);
  box(x, y - size, 1, size * 2 + 1, color);
}

function layout() {
  const ratio = innerWidth / Math.max(1, innerHeight);
  const narrow = ratio < 1.24;
  const h = narrow ? clamp(snap(222 / ratio), 310, 550) : 270;
  const w = clamp(snap(h * ratio), 198, 740);
  const center = snap(w / 2);
  const floor = narrow ? h - clamp(snap(h * .23), 70, 114) : 202;
  const tree = narrow ? snap(center - Math.min(85, w * .24)) : center - Math.min(137, snap(w * .285));
  const hearth = narrow ? snap(center + Math.min(84, w * .245)) : center + Math.min(142, snap(w * .292));
  const winW = narrow ? Math.min(171, w - 39) : clamp(snap(w * .36), 124, 178);
  const winH = narrow ? clamp(snap(h * .42), 125, 204) : 115;
  const winX = center - snap(winW / 2);
  const winY = narrow ? floor - winH - clamp(snap(h * .19), 59, 106) : 40;

  return {
    w, h, center, floor, tree, hearth, narrow,
    win: { x: winX, y: winY, w: winW, h: winH },
    treeBase: narrow ? floor + 19 : 218,
    hearthBase: narrow ? floor + 8 : 212,
    catX: narrow ? center + 10 : center + 28,
    catY: floor + (narrow ? 33 : 34),
    bulbs: [], candles: [], wallLights: [], snow: [], outdoorLights: []
  };
}

function roomShell() {
  const { w, h, center, floor, tree, hearth, win } = scene;
  const wall = ctx.createLinearGradient(0, 15, 0, floor);
  wall.addColorStop(0, '#262238');
  wall.addColorStop(.56, '#363046');
  wall.addColorStop(1, '#322233');
  box(0, 0, w, h, '#251822');
  box(0, 0, w, floor, wall);
  glow(win.x + win.w / 2, win.y + win.h / 2, win.w * 1.08, win.h * .96, '77,106,151', .35);
  glow(hearth, floor - 45, 115, 130, '214,106,67', .27);
  glow(tree, floor - 63, 98, 103, '156,115,74', .18);

  // Faded wallpaper, with tiny staggered star motifs.
  for (let x = 21; x < w; x += 13) {
    box(x, 18, 1, floor - 53, '#140f1e22');
    for (let y = 31 + (x % 2) * 10; y < floor - 36; y += 20) {
      spark(x + 5, y, '#db97a31a');
      box(x + 5, y + 2, 1, 1, '#20192b78');
    }
  }
  const rail = floor - 35;
  box(0, rail, w, 35, '#35212b');
  for (let x = 9; x < w; x += 34) {
    box(x, rail + 8, 27, 17, '#482c34');
    box(x + 2, rail + 9, 23, 13, '#3e2732');
    box(x + 2, rail + 22, 24, 1, '#643a3b');
    box(x + 25, rail + 9, 1, 13, '#613638');
    box(x + 3, rail + 9, 22, 1, '#30202b');
  }
  box(0, rail, w, 2, '#744640');
  box(0, rail + 2, w, 4, '#4d3036');
  box(0, rail + 6, w, 1, '#281b27');
  box(0, floor - 7, w, 2, '#5c3839');
  box(0, floor - 5, w, 5, '#2d1e28');
  box(0, floor, w, 2, '#211823');

  // Floorboards widen toward the viewer, with knocks and irregular grain.
  const wood = ['#563237', '#69403b', '#60383a', '#744540', '#4b2d35', '#633c40'];
  for (let i = -17; i <= 17; i++) {
    const x = center + i * 23;
    const far = center + i * 46;
    shape(pick(wood, i), x, floor + 2, x + 23, floor + 2, far + 46, h, far, h);
    line(x, floor + 2, far, h, '#38232d');
    line(x + 2, floor + 2, far + 2, h, '#95574a5e');
  }
  for (let i = 0; i < w * 1.4; i++) {
    const x = random() * w, y = floor + 3 + random() * (h - floor - 3);
    const age = (y - floor) / (h - floor);
    line(x, y, x + (x - center) * .026, y + 1 + random() * age * 6,
      random() < .55 ? '#301f292e' : '#d1836028');
  }

  for (const x of [0, w - 11]) {
    box(x, 11, 11, floor - 11, '#211925');
    box(x + 2, 15, 7, rail - 15, '#372631');
    box(x + 3, 16, 1, rail - 16, '#63403c');
    box(x + 7, 16, 1, rail - 16, '#1c1723');
    box(x, rail - 2, 11, 6, '#58353a');
  }
  box(0, 0, w, 13, '#211824');
  box(0, 3, w, 5, '#38252e');
  box(0, 8, w, 2, '#563739');
  box(0, 10, w, 3, '#2b1c29');
  box(0, 13, w, 1, '#181621');
  for (let x = 10; x < w - 6; x += 17) {
    box(x, 5 - (x % 3), 4 + (x % 6), 1, '#4e3035');
  }
  glow(hearth, floor + 10, 98, 40, '247,126,53', .22);
  glow(center, floor + 4, 78, 49, '132,161,227', .12);
}

function garland() {
  const { w, narrow, center, win } = scene;
  const half = w / 2;
  const drop = narrow ? 16 : 20;
  const curve = x => 10 + drop * Math.sin(Math.PI * x / w);
  for (let x = 8; x < w - 8; x += 2) {
    const y = curve(x);
    box(x, y, 3, 4, '#152023');
    box(x, y + 1, 2, 3, '#23342d');
  }
  for (let x = 8; x < w - 8; x += 3) {
    const y = curve(x) + random() * 5 - 2;
    const dir = x < half ? 1 : -1;
    line(x, y, x + dir * 4, y - 2 - random() * 3, pick(['#3c4d3a', '#586048', '#233b34'], x));
    line(x, y + 1, x + dir * 3, y + 3 + random() * 2, '#34483a');
    if (random() < .19) {
      box(x + 1, y + 1, 2, 2, '#863e46');
      box(x + 1, y + 1, 1, 1, '#cd6861');
    }
  }
  for (let x = 18, i = 0; x < w - 14; x += 16, i++) {
    const y = snap(curve(x)) + 5 + i % 3;
    line(x, y - 4, x, y - 1, '#695041');
    box(x - 1, y, 3, 3, '#735338');
    scene.wallLights.push({ x, y, phase: i * .52 });
  }
  if (narrow && win.y > 62) {
    const y = snap(mix(curve(center), win.y - 7, .57));
    line(center, curve(center) + 1, center, y - 8, '#a5806b');
    const paper = '#c8a08f';
    spark(center, y, paper, 8);
    for (const dx of [-1, 1]) {
      for (const dy of [-1, 1]) {
        line(center, y, center + dx * 5, y + dy * 5, paper);
        box(center + dx * 2, y + dy * 6, 1, 1, paper);
        box(center + dx * 6, y + dy * 2, 1, 1, paper);
      }
    }
    box(center, y, 1, 1, '#f2ca9f');
  }
}

function archPath(x, y, w, h) {
  const cut = snap(w * .13);
  ctx.beginPath();
  ctx.moveTo(x, y + cut);
  ctx.lineTo(x + 3, y + cut);
  ctx.lineTo(x + 3, y + 10);
  ctx.lineTo(x + 8, y + 10);
  ctx.lineTo(x + 8, y + 5);
  ctx.lineTo(x + cut, y + 5);
  ctx.lineTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w - cut, y + 5);
  ctx.lineTo(x + w - 8, y + 5);
  ctx.lineTo(x + w - 8, y + 10);
  ctx.lineTo(x + w - 3, y + 10);
  ctx.lineTo(x + w - 3, y + cut);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function arch(x, y, w, h, color) {
  archPath(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fill();
}

function pine(x, y, scale, dark, snow) {
  const tall = snap(25 * scale);
  const top = y - tall;
  box(x - 1, y - 5, 2, 6, dark);
  for (let i = 0; i < tall - 2; i++) {
    const tier = Math.floor(i / (tall / 3));
    const half = Math.floor(i * .35 + mod(i, Math.ceil(tall / 3)) * .25);
    box(x - half, top + i + tier, half * 2 + 1, 1, dark);
    if (half > 1 && mod(i, 5) < 2) box(x - half + 1, top + i + tier, Math.ceil(half * .9), 1, snow);
  }
}

function cottage(x, y, size, tint) {
  const w = size, h = snap(size * .52);
  box(x, y - h, w, h, tint);
  box(x + w - 4, y - h, 4, h, '#33354d');
  box(x + w - 6, y - h - 9, 2, 8, '#534857');
  for (let i = 0; i < h + 2; i++) {
    const half = snap(i * ((w + 4) / (h + 1)) / 2);
    box(x + w / 2 - half, y - h * 2 + i, half * 2 + 1, 1, i < h - 1 ? '#b0b6db' : '#626995');
  }
  box(x + 3, y - h + 2, 3, 3, '#e7a972');
  if (w >= 13) box(x + 8, y - h + 2, 3, 3, '#fac68a');
  box(x, y - 1, w + 2, 2, '#9ba8ce');
  scene.outdoorLights.push({ x: x + 4, y: y - h + 3 });
}

function outdoors() {
  const { x, y, w, h } = scene.win;
  arch(x - 8, y - 7, w + 16, h + 15, '#252031');
  arch(x - 6, y - 6, w + 12, h + 12, '#684744');
  arch(x - 4, y - 5, w + 8, h + 9, '#8b6561');
  arch(x - 2, y - 2, w + 4, h + 4, '#493549');
  ctx.save();
  archPath(x, y, w, h);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#202748');
  sky.addColorStop(.57, '#515885');
  sky.addColorStop(1, '#b08fae');
  box(x, y, w, h, sky);
  const moonX = x + w * .72, moonY = y + h * .25;
  glow(moonX, moonY, 33, 30, '185,175,230', .43);
  const disc = [7, 11, 13, 15, 15, 17, 17, 17, 17, 17, 17, 17, 15, 15, 13, 11, 7];
  disc.forEach((width, i) => box(moonX - (width >> 1), moonY + i - 8, width, 1, i < 11 ? '#f4e1c8' : '#e3cbd1'));
  box(moonX - 5, moonY - 3, 3, 2, '#dec5c9');
  box(moonX - 6, moonY - 2, 3, 2, '#dec5c9');
  box(moonX + 2, moonY + 3, 4, 2, '#dec5c9');

  for (let i = 0; i < 94; i++) {
    const px = x + random() * w, py = y + random() * h * .62;
    box(px, py, 1, 1, pick(['#7477a3', '#a0a1c9', '#c9c6df', '#626a94'], i));
    if (i % 23 === 0) spark(snap(px), snap(py), '#c1b8d3');
  }
  for (let i = 0; i < 23; i++) {
    box(x + random() * w, y + h * (.37 + random() * .21), 5 + snap(random() * 20), 1, '#af93bb28');
  }

  const ridge = y + h * .76;
  shape('#42496e', x, ridge - 4, x + w * .18, ridge - 29, x + w * .24, ridge - 34,
    x + w * .36, ridge - 22, x + w * .46, ridge - 9, x + w * .67, ridge - 25,
    x + w * .76, ridge - 18, x + w, ridge - 29, x + w, y + h, x, y + h);
  shape('#8485a9', x + w * .10, ridge - 17, x + w * .24, ridge - 34,
    x + w * .36, ridge - 22, x + w * .29, ridge - 25, x + w * .24, ridge - 24,
    x + w * .22, ridge - 28, x + w * .18, ridge - 22);
  shape('#777ca5', x, ridge + 3, x + w * .16, ridge - 5, x + w * .48, ridge + 2,
    x + w * .68, ridge - 5, x + w, ridge - 9, x + w, y + h, x, y + h);
  for (let px = x + 3; px < x + w + 4; px += 3 + snap(random() * 4)) {
    const py = ridge + snap(Math.sin(px / 21) * 3 + random() * 3);
    pine(px, py + 3, .28 + random() * .30, '#555d8a', '#848cb7');
  }

  shape('#a1a6cf', x, ridge + 3, x + w * .22, ridge, x + w * .48, ridge + 7,
    x + w * .75, ridge - 1, x + w, ridge + 4, x + w, y + h, x, y + h);
  shape('#7a8cbb', x + w * .77, ridge + 7, x + w * .54, ridge + 9, x + w * .45, ridge + 12,
    x + w * .53, ridge + 15, x + w * .74, ridge + 16, x + w * .86, ridge + 18,
    x + w * .72, y + h, x + w * .43, y + h, x + w * .64, ridge + 19,
    x + w * .45, ridge + 18, x + w * .34, ridge + 14, x + w * .41, ridge + 10);
  cottage(x + snap(w * .16), ridge + 11, 14, '#635365');
  cottage(x + snap(w * .30), ridge + 8, 10, '#625875');
  cottage(x + snap(w * .81), ridge + 15, 17, '#654f65');
  for (let i = 0; i < 110; i++) {
    box(x + random() * w, ridge + 3 + random() * (h * .24 - 3),
      1 + snap(random() * 5), 1, random() < .5 ? '#d1c9e33c' : '#485e9735');
  }
  pine(x + 8, y + h - 1, 1.13, '#354569', '#a7b2d4');
  pine(x + 21, y + h + 1, .66, '#47577e', '#aebadd');
  pine(x + w - 10, y + h, 1.46, '#364366', '#a7b4d5');
  pine(x + w - 22, y + h + 1, .72, '#425579', '#b7bfdb');
  ctx.restore();

  for (let i = 0; i < w * .76; i++) {
    scene.snow.push({ x: random() * w, y: random() * h, phase: random() * TAU, layer: i % 3 });
  }
}

function windowFrame() {
  const { win: { x, y, w, h }, center, narrow } = scene;
  const mullion = y + snap(h * .53);
  ctx.save();
  archPath(x, y, w, h);
  ctx.clip();
  box(center - 2, y, 5, h, '#4a394c');
  box(center - 2, y, 1, h, '#9d7c7c');
  box(center + 1, y, 1, h, '#745568');
  box(x, mullion, w, 5, '#4c394b');
  box(x, mullion, w, 1, '#ac8580');
  box(x, mullion + 4, w, 1, '#2d293d');
  for (const offset of [11, w - 22]) {
    for (let i = 0; i < 5; i++) {
      line(x + offset + i, y + 40, x + offset + i + 16, y + 24, '#e1ccdf0d');
    }
  }
  box(center - 6, y + h - 10, 4, 2, '#bd8b6a');
  box(center + 3, y + h - 10, 4, 2, '#bd8b6a');
  ctx.restore();

  box(x - 10, y + h - 1, w + 20, 3, '#a07870');
  box(x - 11, y + h + 2, w + 22, 3, '#684849');
  box(x - 7, y + h + 5, w + 14, 3, '#362634');
  box(x - 7, y + h + 5, w + 14, 1, '#4e353d');
  candle(x + 13, y + h - 1, 9, '#ecca9d');
  candle(x + 20, y + h - 1, 6, '#dba881');
  if (!narrow) {
    box(x + w - 24, y + h - 5, 12, 4, '#674251');
    box(x + w - 24, y + h - 5, 12, 1, '#dba08b');
    box(x + w - 22, y + h - 9, 13, 4, '#395653');
    box(x + w - 21, y + h - 8, 11, 1, '#a4a486');
  }
}

function candle(x, bottom, h, color) {
  box(x - 3, bottom - 1, 7, 2, '#69494a');
  box(x - 2, bottom - h, 5, h - 1, color);
  box(x - 2, bottom - h + 1, 1, h - 2, '#fff0c098');
  box(x + 2, bottom - h + 2, 1, h - 3, '#9e65618a');
  box(x, bottom - h - 1, 1, 2, '#513336');
  scene.candles.push({ x, y: bottom - h - 3, phase: random() * TAU });
}

function rug() {
  const { center: x, floor, h, w, narrow } = scene;
  const y = floor + (narrow ? 20 : 18), depth = h - y - (narrow ? 18 : 6);
  const rear = Math.min(snap(w * .38), 137), front = Math.min(snap(w * .47), 190);
  shape('#2b1c27b5', x - rear, y + 2, x + rear, y + 2, x + front + 6, y + depth + 4, x - front - 6, y + depth + 4);
  for (let row = 0; row < depth; row++) {
    const spread = snap(mix(rear, front, row / depth));
    const edge = Math.min(row, depth - row - 1);
    box(x - spread, y + row, spread * 2 + 1, 1, pick(['#713b4d', '#763d4c', '#71394b'], row));
    if (edge < 7) {
      box(x - spread, y + row, spread * 2 + 1, 1,
        pick(['#3d2838', '#bf8068', '#9b615b', '#593143', '#593143', '#b17463', '#3f2c3b'], edge));
    } else {
      for (const side of [x - spread, x + spread - 6]) {
        box(side, y + row, 7, 1, '#573043');
        box(side + 1, y + row, 1, 1, '#a76c60');
        box(side + 5, y + row, 1, 1, '#bc7c66');
        if (row % 4 === 0) box(side + 3, y + row, 1, 1, '#c98c74');
      }
    }
  }
  const middle = y + snap(depth / 2);
  for (let i = -4; i <= 4; i++) {
    const px = x + i * snap(front * .2);
    const big = i === 0 ? 9 : 5;
    for (let j = -big; j <= big; j++) {
      const extent = (big - Math.abs(j)) * 2;
      box(px - extent, middle + j, 1, 1, '#c48b75');
      box(px + extent, middle + j, 1, 1, '#c48b75');
      if (Math.abs(j) < big - 2) box(px - extent + 5, middle + j, extent * 2 - 9, 1, '#543244');
    }
    spark(px, middle, '#d49b7e', i === 0 ? 3 : 1);
    if (i < 4) spark(px + snap(front * .1), middle, '#a66a66');
  }
  for (let i = 0; i < 260; i++) {
    const row = 7 + random() * (depth - 14);
    const spread = mix(rear, front, row / depth) - 10;
    box(x + random() * spread * 2 - spread, y + row, 1, 1, '#f1ba9b21');
  }
  for (let i = -front + 7; i < front - 6; i += 3) {
    box(x + i, y + depth, 1, 1 + (i % 3 === 0 ? 2 : 1), '#a97469');
  }
}

function bookshelf() {
  const { tree, floor, w, narrow } = scene;
  if (narrow || tree < 77) return;
  const x = Math.max(15, tree - 87), y = floor - 117;
  const books = ['#8e5561', '#a37659', '#6c7771', '#584e6e', '#78575a', '#526568'];
  box(x + 3, y + 3, 49, 118, '#211a27');
  box(x, y, 46, 116, '#523339');
  box(x + 4, y + 5, 37, 96, '#2b202c');
  for (let row = 0; row < 3; row++) {
    const base = y + 33 + row * 33;
    box(x + 3, base, 40, 3, '#805044');
    box(x + 3, base + 2, 40, 2, '#402834');
    let px = x + 6;
    for (let i = 0; i < 7 && px < x + 37; i++) {
      const width = 2 + snap(random() * 3);
      const height = 10 + snap(random() * 13);
      box(px, base - height, width, height, pick(books, i + row * 3));
      box(px, base - height + 2, width, 1, '#d1a08178');
      box(px, base - 4, width, 1, '#d1a08178');
      box(px + width - 1, base - height, 1, height, '#261b2c59');
      px += width + 1;
    }
  }
  box(x - 2, y - 3, 50, 3, '#966357');
  box(x - 2, y, 50, 2, '#69434a');
  box(x + 1, y + 2, 2, 111, '#74504b');
  box(x + 42, y + 3, 2, 109, '#362630');
  box(x + 4, y + 113, 6, 6, '#33232d');
  box(x + 36, y + 113, 7, 6, '#33232d');

  if (w >= 447) {
    box(x + 11, y - 28, 19, 20, '#302331');
    box(x + 9, y - 30, 19, 20, '#997060');
    box(x + 11, y - 28, 15, 16, '#443d57');
    box(x + 21, y - 26, 2, 2, '#e7bf92');
    pine(x + 16, y - 13, .31, '#666781', '#b39ba6');
    pine(x + 21, y - 12, .24, '#52536e', '#a28fa0');
  }
}

function wreath(x, y) {
  for (let i = 0; i < 114; i++) {
    const a = i / 114 * TAU, r = 9 + random() * 7;
    const px = x + Math.sin(a) * r, py = y + Math.cos(a) * r;
    line(px, py, px + Math.sin(a + .9) * 4, py + Math.cos(a + .9) * 4,
      pick(['#263130', '#35433a', '#4a5341', '#687052', '#324238'], i), 2);
    if (i % 13 === 0) {
      box(px, py, 2, 2, '#bd5a57');
      box(px, py, 1, 1, '#ec956c');
    }
  }
  shape('#a64350', x, y + 13, x - 7, y + 9, x - 7, y + 16, x, y + 15, x + 7, y + 17, x + 7, y + 9);
  shape('#bd5558', x - 2, y + 14, x + 3, y + 14, x + 1, y + 19, x - 4, y + 22, x - 3, y + 18);
  shape('#a44854', x, y + 14, x + 4, y + 15, x + 6, y + 21, x + 3, y + 20);
  box(x - 1, y + 12, 3, 3, '#e37a65');
}

function stocking(x, y, color, accent) {
  box(x, y, 1, 4, '#c69876');
  box(x - 3, y + 4, 10, 4, '#edd3a9');
  box(x - 3, y + 7, 9, 10, color);
  box(x + 1, y + 14, 9, 5, color);
  box(x + 4, y + 19, 6, 1, color);
  box(x + 6, y + 15, 4, 4, accent);
  box(x - 2, y + 9, 6, 1, accent);
  spark(x + 1, y + 12, '#f0c499');
}

function fireplace() {
  const { hearth: x, hearthBase: y, narrow } = scene;
  const top = y - 72;
  const hw = narrow ? 39 : 48;
  const opening = narrow ? 40 : 45;
  const brick = ['#77454a', '#754348', '#8a514d', '#965b51', '#834c4c', '#87504b', '#6c4146'];

  shape('#2d202b', x - hw, top + 3, x + hw + 2, top + 3, x + hw + 6, y + 2, x - hw - 1, y + 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - hw, top, hw * 2, 68);
  ctx.clip();
  box(x - hw, top, hw * 2, 69, '#4a303a');
  for (let j = 0; j < 9; j++) {
    const py = top + j * 8;
    for (let i = -1; i < (hw * 2) / 14; i++) {
      const px = x - hw + i * 14 + (j % 2) * 7;
      box(px + 1, py + 1, 13, 7, pick(brick, snap(random() * 30)));
      box(px + 2, py + 1, 9, 1, '#c37e6559');
      box(px + 2, py + 6, 9, 1, '#633b4359');
      if (random() < .5) box(px + 3, py + 4, 2, 1, '#d4957352');
    }
  }
  ctx.restore();

  const fireX = x - (opening >> 1), fireY = top + 19;
  arch(fireX - 5, fireY - 5, opening + 10, 48, '#583742');
  arch(fireX - 3, fireY - 4, opening + 6, 47, '#b27660');
  arch(fireX - 1, fireY - 2, opening + 2, 45, '#72464a');
  arch(fireX, fireY, opening, 43, '#241c27');
  ctx.save();
  archPath(fireX, fireY, opening, 43);
  ctx.clip();
  glow(x, y - 14, 31, 32, '218,94,51', .34);
  for (let i = 0; i < 37; i++) {
    box(fireX + random() * opening, fireY + random() * 43, 1 + snap(random()), 1, '#ef9b632d');
  }
  ctx.restore();
  scene.fire = { x: fireX, y: fireY, w: opening, h: 43 };

  box(x - hw - 6, top - 3, hw * 2 + 12, 4, '#cf9470');
  box(x - hw - 6, top + 1, hw * 2 + 12, 4, '#925d50');
  box(x - hw - 4, top + 5, hw * 2 + 8, 3, '#5b3840');
  box(x - hw - 3, top - 3, hw * 2 + 6, 1, '#ecb184');
  box(x - hw - 5, y - 10, hw * 2 + 10, 4, '#a16e5c');
  box(x - hw - 8, y - 6, hw * 2 + 16, 6, '#603c45');
  box(x - hw - 8, y - 6, hw * 2 + 16, 1, '#c28a6e');
  box(x - hw - 5, y, hw * 2 + 10, 2, '#362732');
  for (let i = -hw + 9; i < hw; i += 13) box(x + i, y - 5, 1, 4, '#462f3c');
  stocking(x - hw + 10, top + 5, '#a84653', '#c46565');
  stocking(x + hw - 17, top + 5, '#527670', '#7a9780');
  candle(x - hw + 11, top - 3, 10, '#db9a80');
  candle(x + hw - 19, top - 3, 11, '#f2d1a1');
  candle(x + hw - 11, top - 3, 7, '#e2b381');

  const { win } = scene;
  if (!narrow || top - 24 > win.y + win.h + 14) wreath(x, top - 29);
}

function fire(t) {
  const { fire: { x, y, w, h }, hearth, hearthBase } = scene;
  const baseline = y + h - 4;
  ctx.save();
  archPath(x, y, w, h);
  ctx.clip();
  glow(hearth, baseline - 7, 32, 33, '255,106,53', .42 + Math.sin(t * 4.1) * .05);
  box(x + 3, baseline + 1, w - 6, 2, '#77383c');
  for (let i = 0; i < 12; i++) {
    const px = x + 4 + i * (w - 9) / 11;
    box(px, baseline + mod(i, 3), 2, 1,
      Math.sin(i + t * 4) > -.1 ? '#eb794e' : '#99444a');
  }
  // Draw each tongue of flame as a stack of horizontal pixels that curls toward the tip.
  const layers = [
    [0, 29, 10, '#d45449'], [-7, 21, 6, '#ed704b'], [8, 22, 7, '#e36749'],
    [1, 24, 8, '#ff9e56'], [-7, 14, 4, '#ffb365'], [5, 17, 5, '#ffc16b'],
    [-1, 14, 5, '#ffe29b'], [3, 8, 3, '#fff1ba']
  ];
  layers.forEach(([offset, height, width, color], i) => {
    const top = height + snap(Math.sin(t * (4 + i * .35) + i * 1.8) * (i < 4 ? 4 : 2));
    for (let row = 0; row < top; row++) {
      const f = row / top;
      const cx = hearth + offset + snap(Math.sin(t * 3 + i + f * 4) * f * 4 + f * offset * .2);
      const radius = Math.max(0, snap(width * (1 - f) + Math.sin(f * 10 + i) * f * 1.6));
      box(cx - radius, baseline - row, radius * 2 + 1, 1, color);
    }
  });
  for (let i = 0; i < 9; i++) {
    const f = mod(t * (.25 + i % 3 * .05) + i * .137, 1);
    const px = hearth + Math.sin(i * 2.8 + f * 3) * (4 + f * 13);
    box(px, baseline - 6 - f * 34, 1, 1, f < .62 ? '#ffb063' : '#b65354');
  }
  line(hearth - 13, baseline, hearth - 2, baseline + 2, '#522d32', 2);
  line(hearth + 2, baseline + 2, hearth + 14, baseline - 1, '#643338', 2);
  box(hearth + 11, baseline - 1, 2, 2, '#bd5b45');
  box(hearth - 12, baseline, 2, 2, '#b75544');
  ctx.restore();
  glow(hearth, hearthBase + 3, 63, 29, '255,123,62', .17 + Math.sin(t * 4.1) * .028);
}

function gift(x, bottom, w, h, wrap, shade, ribbon) {
  const y = bottom - h;
  box(x - 2, bottom, w + 7, 2, '#3a2734');
  box(x, y, w, h, wrap);
  shape(shade, x + w, y, x + w + 4, y - 3, x + w + 4, bottom - 3, x + w, bottom);
  shape(shade, x, y, x + 4, y - 3, x + w + 4, y - 3, x + w, y);
  box(x - 1, y, w + 2, 1, '#efc4a966');
  box(x + 2, bottom - 2, w - 3, 1, '#492c4256');
  for (let i = 4; i < w - 2; i += 6) {
    for (let j = 4; j < h - 1; j += 6) box(x + i + j % 3, y + j, 1, 1, '#ffdeb072');
  }
  const m = x + snap(w * .52);
  box(m - 1, y - 2, 3, h + 2, ribbon);
  box(m - 1, y + 2, 1, h - 3, '#ffdd986f');
  line(m, y - 2, m - 5, y - 6, ribbon);
  line(m - 5, y - 6, m - 6, y - 3, ribbon);
  line(m - 6, y - 3, m, y - 2, ribbon);
  line(m, y - 2, m + 4, y - 6, ribbon);
  line(m + 4, y - 6, m + 6, y - 4, ribbon);
  line(m + 6, y - 4, m, y - 2, ribbon);
  box(m - 1, y - 3, 3, 2, '#f5c389');
}

function treeArt() {
  const { tree: x, treeBase: y, narrow } = scene;
  const tall = narrow ? 110 : 145, width = narrow ? 49 : 61;
  const top = y - tall;
  shape('#332633', x - 54, y - 4, x + 45, y - 4, x + 53, y + 2, x + 28, y + 6,
    x - 37, y + 5, x - 51, y + 2);
  box(x - 4, y - 27, 9, 24, '#72493d');
  box(x - 3, y - 17, 2, 13, '#aa7252');
  box(x - 15, y - 5, 32, 4, '#4a3138');

  const deep = ['#152b2d', '#1a3434', '#203b38', '#233d38'];
  const green = ['#325548', '#3e6552', '#426950', '#294c42', '#426350', '#54765a', '#37594b'];
  const tiers = [[.59, 1, 1], [.45, .83, .89], [.31, .67, .74], [.20, .54, .58], [.10, .41, .43], [0, .30, .31]];

  for (const [start, end, scale] of tiers) {
    const cy = top + snap(tall * start), size = snap(tall * (end - start)), span = snap(width * scale);
    const edges = [];
    for (let row = 0; row <= size; row++) {
      const f = row / size;
      const half = snap(span * (f * .76 + f ** 3 * .24));
      const irregular = half < 5 ? 0 : snap(random() * 4) - 1;
      const lx = x - half - irregular, rx = x + half + (row % 5 > 1 ? irregular : -1);
      edges.push([lx, rx]);
      box(lx, cy + row, rx - lx + 1, 1, pick(deep, row % 9 === 0 ? 1 : row > size - 4 ? 0 : 2));
      if (half > 2) {
        box(lx + 2, cy + row, half - 1, 1, pick(['#2b4941', '#2e4c42', '#304e42'], row));
        if (row % 4 === 0 && half > 5) box(lx + 2, cy + row, 4, 1, '#4a6451');
      }
    }
    for (let i = 0; i < size * (2 + scale * 3); i++) {
      const row = 4 + snap(random() * (size - 6));
      const [l, r] = edges[row];
      const px = l + 2 + random() * Math.max(0, r - l - 4);
      const extent = Math.min(r - px, 2 + random() * (2 + scale * 3));
      if (extent < 1) continue;
      const tint = pick(green, snap(random() * 30));
      line(px, cy + row, px + extent, cy + row + (px < x ? -2 : 2), tint);
      if (i % 11 === 0) box(px, cy + row + 1, 3, 1, '#82957559');
    }
    for (let i = -span + 4; i < span - 2; i += 3 + snap(random() * 5)) {
      const endY = cy + size + snap(random() * 4);
      line(x + i + (i < 0 ? 4 : -4), endY - 6, x + i, endY, pick(deep, i), 2);
    }
  }

  for (const [level, span, skew] of [[.32, .26, 2], [.49, .45, -4], [.66, .62, 5], [.85, .81, -5]]) {
    const base = top + level * tall;
    for (let px = -snap(width * span); px <= width * span; px++) {
      const f = px / (span * width);
      const py = base + 7 * (1 - f * f) + skew * f;
      box(x + px, py, 1, 1, '#947254');
      if (px % 3 === 0) box(x + px, py - 1, 1, 1, '#cba26d');
      if (mod(px, 11) === 0) scene.bulbs.push({
        x: x + px, y: snap(py) + 2, color: pick(['gold', 'rose', 'mint'], px + skew), phase: random() * TAU
      });
    }
  }

  const baubles = [
    [-.14, .35, 2], [.12, .28, 0], [-.25, .45, 0], [.31, .50, 1],
    [.05, .54, 2], [-.37, .60, 2], [.43, .62, 0], [-.13, .65, 1],
    [.26, .73, 2], [-.48, .76, 0], [.55, .77, 1], [-.26, .82, 2],
    [.09, .82, 0], [-.62, .89, 1], [.67, .91, 2], [.38, .91, 0], [-.09, .92, 1]
  ];
  const ornaments = [
    ['#b04450', '#e47972', '#f8a58b'], ['#ab774a', '#dea064', '#ffd397'], ['#417c75', '#6aaca0', '#aae0ba']
  ];
  baubles.forEach(([px, py, i], n) => {
    const bx = x + snap(px * width), by = top + snap(py * tall), r = n % 3 === 1 ? 3 : 2;
    const [shadow, paint, shine] = ornaments[i];
    box(bx, by - r - 2, 1, 2, '#d4ab79');
    box(bx - r + 1, by - r, r * 2 - 1, r * 2 + 1, shadow);
    box(bx - r, by - r + 1, r * 2 + 1, r * 2 - 1, shadow);
    box(bx - r, by - r + 1, r * 2 - 1, r * 2 - 2, paint);
    box(bx - 1, by - r + 1, 1, 1, shine);
  });

  scene.star = { x, y: top - 3 };
  gift(x - (narrow ? 43 : 52), y + 2, 21, 13, '#8f4f60', '#ad6670', '#e3af73');
  gift(x + (narrow ? 15 : 23), y + 4, 22, 19, '#58746e', '#779486', '#e1b075');
  gift(x + (narrow ? 27 : 39), y + 8, 15, 10, '#af665f', '#d28c76', '#f3c48d');
  gift(x - 16, y + 7, 17, 11, '#826078', '#a97687', '#d6a56f');
}

function table() {
  const { center: x, floor, narrow, win } = scene;
  if (narrow) return;
  const y = Math.max(win.y + win.h + 25, floor - 30);
  box(x - 32, y + 33, 64, 3, '#2b202c');
  box(x - 30, y + 3, 60, 20, '#51343d');
  box(x - 28, y + 8, 56, 10, '#745052');
  box(x - 26, y + 9, 52, 7, '#633d46');
  box(x - 3, y + 11, 7, 2, '#bf9168');
  box(x - 2, y + 13, 5, 1, '#392832');
  for (const side of [x - 27, x + 22]) {
    box(side, y + 22, 5, 12, '#50343e');
    box(side, y + 22, 1, 11, '#ad746066');
  }
  box(x - 34, y, 68, 3, '#b0806d');
  box(x - 34, y + 3, 68, 3, '#744c50');
  box(x - 32, y + 6, 64, 1, '#3e2936');

  box(x - 23, y - 1, 19, 2, '#926d69');
  box(x - 21, y - 5, 17, 4, '#746b7d');
  box(x - 19, y - 4, 15, 2, '#c7a396');
  box(x - 17, y - 8, 17, 3, '#47666a');
  box(x - 16, y - 8, 15, 1, '#8b9090');
  box(x + 11, y - 8, 8, 7, '#a45d61');
  box(x + 11, y - 8, 8, 1, '#e9b187');
  box(x + 11, y - 7, 2, 5, '#c7776d');
  box(x + 19, y - 7, 3, 4, '#bc7069');
  box(x + 19, y - 6, 2, 2, '#5b3d4b');
  box(x + 9, y - 1, 13, 1, '#d29780');
  scene.mug = { x: x + 15, y: y - 8 };
}

function firewood() {
  const { w, hearth, floor, narrow } = scene;
  if (narrow || w - hearth < 92) return;
  const x = Math.min(w - 27, hearth + 71), y = floor + 13;
  box(x - 15, y + 2, 32, 3, '#36252e');
  for (let i = 0; i < 7; i++) {
    const logX = x - 12 + i % 3 * 9 + snap(random() * 3), logY = y - 9 - Math.floor(i / 3) * 5;
    line(logX - 3, logY - 10, logX, logY, '#634043', 5);
    box(logX, logY, 6, 4, '#b37c5e');
    box(logX + 2, logY + 1, 2, 2, '#775046');
  }
  shape('#855748', x - 15, y - 10, x + 16, y - 10, x + 12, y + 3, x - 11, y + 3);
  box(x - 16, y - 10, 33, 2, '#bc805b');
  box(x - 13, y - 5, 27, 1, '#a76f50');
  box(x - 12, y - 1, 25, 1, '#a36b52');
  for (let i = -10; i <= 12; i += 3) {
    line(x + i, y - 8, x + i * .8, y + 1, '#a47453');
  }
}

function cat(t) {
  const { catX: x, catY: y } = scene;
  const breathe = Math.sin(t * 1.75) > .04 ? 1 : 0;
  shape('#3c2739a0', x - 29, y + 6, x + 24, y + 6, x + 26, y + 10,
    x + 12, y + 12, x - 27, y + 12, x - 32, y + 10);
  shape('#593c57', x - 27, y + 3, x + 20, y + 3, x + 24, y + 7,
    x + 20, y + 10, x - 24, y + 10, x - 30, y + 7);
  box(x - 24, y + 4, 44, 3, '#856079');
  box(x - 23, y + 8, 43, 1, '#ae7a83');
  for (let i = -20; i < 20; i += 5) box(x + i, y + 6, 2, 1, '#b0808e');
  box(x - 23, y + 1, 42, 4, '#4a303a');
  box(x - 17, y - 8 - breathe, 28, 13 + breathe, '#ba775b');
  box(x - 20, y - 5, 35, 8, '#c48764');
  box(x - 13, y - 10 - breathe, 20, 3, '#db9b70');
  box(x - 11, y - 11 - breathe, 14, 2, '#e4a578');
  box(x - 17, y - 1, 34, 5, '#a26757');
  box(x - 11, y - 7 - breathe, 3, 4, '#ad6b56');
  box(x - 5, y - 9 - breathe, 2, 5, '#ba7655');
  box(x + 1, y - 9 - breathe, 3, 4, '#bb7857');
  box(x - 24, y + 1, 32, 3, '#c18465');
  box(x - 24, y, 4, 2, '#dda375');
  box(x - 19, y + 2, 3, 2, '#a86a59');
  box(x - 11, y + 2, 2, 2, '#ae715b');
  box(x + 7, y - 7, 12, 10, '#db9c72');
  box(x + 8, y + 1, 11, 3, '#e9b98a');
  box(x + 19, y - 3, 2, 4, '#c38464');
  shape('#bc795f', x + 8, y - 5, x + 8, y - 11, x + 10, y - 11, x + 14, y - 6);
  shape('#d3966c', x + 14, y - 6, x + 17, y - 10, x + 19, y - 10, x + 19, y - 5);
  box(x + 9, y - 9, 1, 2, '#d4998b');
  box(x + 11, y - 2, 3, 1, '#68414a');
  box(x + 17, y - 2, 2, 1, '#68414a');
  box(x + 15, y, 2, 1, '#a1595a');
}

function snowfall(t) {
  const { win: { x, y, w, h }, snow, outdoorLights } = scene;
  ctx.save();
  archPath(x, y, w, h);
  ctx.clip();
  for (const lamp of outdoorLights) {
    const f = .25 + .07 * Math.sin(t * 1.8 + lamp.x);
    glow(lamp.x, lamp.y, 6, 5, '255,174,103', f);
  }
  for (const flake of snow) {
    const layer = flake.layer;
    const px = x + mod(flake.x + t * (2 + layer * 2) + Math.sin(flake.phase + t * .67) * (2 + layer), w);
    const py = y + mod(flake.y + t * (5 + layer * 4), h);
    box(px, py, 1, layer === 2 && flake.phase > 4 ? 2 : 1, pick(['#e4dafa52', '#d1dafa8c', '#e3e4fac9'], layer));
    if (layer === 2 && flake.phase > 5.85) box(px - 1, py, 3, 1, '#d6d6f6a6');
  }
  ctx.restore();
}

function lights(t) {
  for (const { x, y, phase } of scene.wallLights) {
    const f = .68 + .29 * Math.sin(t * 1.25 + phase);
    glow(x, y + 1, 11, 9, '255,161,92', f * .33);
    box(x, y, 1, 2, f > .51 ? '#f9c481' : '#c68d5e');
    if (f > .83) box(x - 1, y + 1, 3, 1, '#ffd39a');
  }
  const palette = {
    gold: ['255,166,86', '#f3a654', '#ffe3a0'],
    rose: ['252,104,106', '#d77675', '#ffc1a1'],
    mint: ['127,222,175', '#64a68a', '#acf0bf']
  };
  for (const { x, y, color, phase } of scene.bulbs) {
    const [rgb, dim, bright] = palette[color];
    const f = .55 + .42 * Math.sin(t * 1.67 + phase);
    glow(x, y, 8, 7, rgb, f * .42);
    box(x, y, 2, 2, f > .51 ? bright : dim);
    if (f > .87) spark(x, y, bright);
  }
  const { x, y } = scene.star;
  const pulse = .7 + Math.sin(t * 1.7) * .25;
  glow(x, y, 23, 23, '255,174,85', pulse * .68);
  shape('#dd9c55', x, y - 8, x + 2, y - 3, x + 8, y - 2, x + 4, y + 2, x + 5, y + 7,
    x, y + 4, x - 5, y + 7, x - 4, y + 2, x - 8, y - 2, x - 2, y - 3);
  spark(x, y, '#ffe19b', 4);
  box(x - 1, y - 2, 3, 4, '#fff0c3');
  if (pulse > .83) {
    spark(x - 11, y - 5, '#e6b274');
    box(x + 10, y + 6, 1, 1, '#f8d68d');
  }
  for (const { x, y, phase } of scene.candles) {
    const f = .75 + .2 * Math.sin(t * 7 + phase);
    glow(x, y + 1, 15, 15, '255,151,78', f * .42);
    box(x - 1, y, 3, 3, '#e48956');
    box(x, y - (f > .7 ? 2 : 1), 1, 5, '#ffda8f');
    box(x, y + 1, 1, 2, '#fff1c2');
  }
  if (scene.mug) {
    const { x, y } = scene.mug;
    for (let i = 0; i < 15; i++) {
      const f = mod(t * .52 + i / 15, 1);
      const px = x + Math.sin(f * 6.8 + t * 1.7) * (1 + f * 4);
      box(px, y - 2 - f * 17, 1, 1, `rgba(238,193,174,${(1 - f) * .37})`);
    }
  }
}

function paint(t) {
  ctx = display;
  ctx.drawImage(backdrop, 0, 0);
  snowfall(t);
  ctx.drawImage(foreground, 0, 0);
  fire(t);
  cat(t);
  lights(t);

  const { w, h } = scene;
  const shade = ctx.createRadialGradient(w / 2, h * .49, h * .23, w / 2, h * .46, Math.hypot(w, h) * .55);
  shade.addColorStop(0, '#100c1b00');
  shade.addColorStop(.66, '#100c1b21');
  shade.addColorStop(1, '#100c1b98');
  box(0, 0, w, h, shade);
}

function rebuild() {
  scene = layout();
  seed = 140219;
  for (const layer of [canvas, backdrop, foreground]) {
    layer.width = scene.w;
    layer.height = scene.h;
  }
  ctx = backdrop.getContext('2d', { alpha: false });
  roomShell();
  garland();
  outdoors();
  ctx = foreground.getContext('2d');
  windowFrame();
  bookshelf();
  rug();
  table();
  fireplace();
  firewood();
  treeArt();
  paint(reducedMotion.matches ? 0 : performance.now() / 1000);
}

let lastPaint = -Infinity;
function animate(now) {
  if (now - lastPaint >= 1000 / 30 - 2) {
    paint(now / 1000);
    lastPaint = now;
  }
  frame = requestAnimationFrame(animate);
}

function syncMotion() {
  cancelAnimationFrame(frame);
  if (document.hidden) return;
  if (reducedMotion.matches) paint(0);
  else frame = requestAnimationFrame(animate);
}

let resizeFrame;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(rebuild);
});
reducedMotion.addEventListener('change', syncMotion);
document.addEventListener('visibilitychange', syncMotion);
rebuild();
syncMotion();

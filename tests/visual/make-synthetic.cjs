#!/usr/bin/env node
'use strict';
/**
 * Deterministic synthetic skin-tone fixtures (Gauntlet 1b, Phase 8).
 * No dependencies (pure Node + zlib), no rights issues, reproducible via seed.
 *
 * Each fixture: 320x320 skin patch with fine noise (texture), sparse pores,
 * a freckle cluster, one mole (must-survive features), plus one occlusion
 * variant (glasses bar + hair wedge) for refinement tests.
 * Tones span light → dark; warm/cool-lit variants included.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT = path.resolve(__dirname, 'synthetic');
const W = 320, H = 320;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TONES = [
  { name: 'light', base: [233, 186, 154], freckle: [150, 90, 55] },
  { name: 'tan', base: [199, 143, 104], freckle: [130, 72, 40] },
  { name: 'brown', base: [143, 88, 54], freckle: [80, 42, 22] },
  { name: 'dark', base: [94, 60, 38], freckle: [48, 28, 16] },
  { name: 'warm-lit', base: [226, 170, 128], freckle: [150, 85, 45], temp: [14, -4, -18] },
  { name: 'cool-lit', base: [198, 172, 158], freckle: [120, 82, 60], temp: [-16, 2, 14] }
];

function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }

function makePatch(tone, seed, occlusion) {
  const rnd = mulberry32(seed);
  const buf = Buffer.alloc(W * H * 3);
  const [br, bg, bb] = tone.base;
  const tmp = tone.temp || [0, 0, 0];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Large-scale blotchiness (low-freq unevenness the retouch should even).
      const blotch = Math.sin(x * 0.021 + seed) * Math.cos(y * 0.017 + seed * 2) * 9
        + Math.sin((x + y) * 0.008) * 6;
      // Fine texture noise (must be preserved).
      const n = (rnd() - 0.5) * 13;
      const i = (y * W + x) * 3;
      buf[i] = clamp255(br + tmp[0] + blotch + n);
      buf[i + 1] = clamp255(bg + tmp[1] + blotch * 0.9 + n);
      buf[i + 2] = clamp255(bb + tmp[2] + blotch * 0.8 + n);
    }
  }
  const dot = (cx, cy, r, col) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        const i = (y * W + x) * 3;
        buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2];
      }
    }
  };
  // Pores: sparse 1px darker dots (~1.5%).
  for (let k = 0; k < 1500; k++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    const i = (y * W + x) * 3;
    buf[i] = clamp255(buf[i] - 26); buf[i + 1] = clamp255(buf[i + 1] - 24); buf[i + 2] = clamp255(buf[i + 2] - 22);
  }
  // Freckle cluster (central band — must survive smoothing).
  for (let k = 0; k < 46; k++) {
    const cx = 90 + rnd() * 140, cy = 130 + rnd() * 70, r = 1 + rnd() * 1.6;
    dot(cx, cy, r, tone.freckle);
  }
  // One mole (must survive).
  dot(228, 208, 3.2, [38, 22, 16]);
  if (occlusion) {
    // Glasses bar (dark, low-sat) across the upper third.
    for (let y = 84; y < 108; y++) {
      for (let x = 20; x < 300; x++) {
        const i = (y * W + x) * 3;
        buf[i] = 22; buf[i + 1] = 22; buf[i + 2] = 26;
      }
    }
    // Hair wedge (dark, slightly warm) on the left.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < 52 - y * 0.06; x++) {
        const i = (y * W + x) * 3;
        buf[i] = 30; buf[i + 1] = 20; buf[i + 2] = 16;
      }
    }
  }
  return buf;
}

// Minimal PNG writer (RGB8, filter 0).
function crc32(buf) {
  let table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, rgb) {
  const raw = Buffer.alloc(H * (W * 3 + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
}

fs.mkdirSync(OUT, { recursive: true });
for (const tone of TONES) {
  writePNG(path.join(OUT, `skin-${tone.name}.png`), makePatch(tone, 1234, false));
  console.log('ok skin-' + tone.name + '.png');
}
writePNG(path.join(OUT, 'skin-occlusion.png'), makePatch(TONES[1], 777, true));
console.log('ok skin-occlusion.png');

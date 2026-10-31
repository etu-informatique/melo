// Génère les icônes PNG (sans dépendance) à partir de la même forme que icons/icon.svg.
// Usage : node tools/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// Distance d'un point à un segment.
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

function render(size, { rounded = true, pad = 0 } = {}) {
  const S = 4; // suréchantillonnage
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        // coordonnées dans l'espace 512 de l'icône
        const u = ((x + (sx + .5) / S) / size) * 512, v = ((y + (sy + .5) / S) / size) * 512;
        // fond arrondi
        const rad = rounded ? 112 : 0;
        const qx = Math.max(Math.abs(u - 256) - (256 - rad), 0), qy = Math.max(Math.abs(v - 256) - (256 - rad), 0);
        if (Math.hypot(qx, qy) > rad) continue;
        const tt = v / 512;
        let cr = 255 + (176 - 255) * tt, cg = 122 + (43 - 122) * tt, cb = 69 + (255 - 69) * tt;
        // note de musique (contenu réduit si marge « maskable »)
        const k = 1 + pad, cu = 256 + (u - 256) * k, cv = 256 + (v - 256) * k;
        const stroke = Math.min(segDist(cu, cv, 206, 150, 366, 118), segDist(cu, cv, 366, 118, 366, 334), segDist(cu, cv, 206, 150, 206, 366)) <= 15;
        const e1 = ((cu - 166) / 52) ** 2 + ((cv - 368) / 44) ** 2 <= 1;
        const e2 = ((cu - 326) / 52) ** 2 + ((cv - 336) / 44) ** 2 <= 1;
        if (stroke || e1 || e2) { cr = 255; cg = 255; cb = 255; }
        r += cr; g += cg; b += cb; a += 255;
      }
      const n = S * S, o = y * (size * 4 + 1) + 1 + x * 4;
      const cov = a / n;
      raw[o] = cov ? Math.round(r / (a / 255)) : 0;
      raw[o + 1] = cov ? Math.round(g / (a / 255)) : 0;
      raw[o + 2] = cov ? Math.round(b / (a / 255)) : 0;
      raw[o + 3] = Math.round(cov);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = new URL('../icons/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), render(192));
writeFileSync(new URL('icon-512.png', out), render(512));
writeFileSync(new URL('maskable-512.png', out), render(512, { rounded: false, pad: 0.35 }));
writeFileSync(new URL('apple-touch-icon.png', out), render(180, { rounded: false }));
console.log('Icônes générées.');

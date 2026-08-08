/**
 * Rasterises the Sadaqa+ mark into the PNG sizes a PWA needs.
 *
 *   node scripts/generate-icons.mjs
 *
 * Run this only when the logo changes; the output is committed so neither the
 * build nor the deployment depends on an image toolchain.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');

/** The mark, matching src/components/brand/logo.tsx. */
function markSvg({ size, background, padding }) {
  const inner = size - padding * 2;
  const scale = inner / 48;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#16A34A"/>
      <stop offset="1" stop-color="#2563EB"/>
    </linearGradient>
  </defs>
  ${background ? `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${background}"/>` : ''}
  <g transform="translate(${padding},${padding}) scale(${scale})" fill="none"
     stroke="url(#g)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M24 41.2 9.6 27.6a8.9 8.9 0 0 1-.5-12.3 8.4 8.4 0 0 1 12.2-.3L24 17.5"/>
    <path d="M24 41.2l14.4-13.6a8.9 8.9 0 0 0 .5-12.3 8.4 8.4 0 0 0-12.2-.3L24 17.5"/>
    <path d="M28.4 24.3a5.9 5.9 0 1 1-5.2-8.2 4.8 4.8 0 1 0 5.2 8.2Z" fill="url(#g)" stroke="none"/>
  </g>
</svg>`;
}

const TARGETS = [
  // Standard icons: transparent-friendly white plate so they read on any
  // launcher background.
  { name: 'icon-192.png', size: 192, background: '#ffffff', padding: 24 },
  { name: 'icon-512.png', size: 512, background: '#ffffff', padding: 64 },
  // Maskable icons need ~20% safe-area padding or Android crops the mark.
  { name: 'maskable-192.png', size: 192, background: '#ffffff', padding: 40 },
  { name: 'maskable-512.png', size: 512, background: '#ffffff', padding: 106 },
  { name: 'apple-touch-icon.png', size: 180, background: '#ffffff', padding: 22 },
  { name: 'icon-96.png', size: 96, background: '#ffffff', padding: 12 },
];

await mkdir(outDir, { recursive: true });

for (const target of TARGETS) {
  const svg = markSvg(target);
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(resolve(outDir, target.name), png);
  console.log(`  ${target.name} (${target.size}x${target.size}, ${png.length} bytes)`);
}

// Favicon: a 32px PNG named .ico is accepted by every current browser, and
// Next serves src/app/favicon.ico directly.
const favicon = await sharp(Buffer.from(markSvg({ size: 64, background: '#ffffff', padding: 6 })))
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(resolve(root, 'src/app/favicon.ico'), favicon);
console.log('  favicon.ico (64x64)');

console.log('\nIcons written to public/icons.');

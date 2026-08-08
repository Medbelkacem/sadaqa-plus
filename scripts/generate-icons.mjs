/**
 * Rasterises the Sadaqa+ symbol into the PNG sizes a PWA needs.
 *
 *   node scripts/generate-icons.mjs
 *
 * Run this only when the mark changes; the output is committed so neither the
 * build nor the deployment depends on an image toolchain.
 *
 * The tile is Vert Sadaqa, the vertical bar is white, the horizontal bar is
 * Ambre, and the intersection is Vert profond — matching the identity spec.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');

const BRAND = {
  deep: '#05372A',
  green: '#00795A',
  amber: '#E8A33D',
  white: '#FFFFFF',
};

/**
 * @param size    output edge length in px
 * @param padding safe-area inset; maskable icons need ~20% or Android crops
 * @param tile    draw the brand tile behind the mark
 */
function markSvg({ size, padding, tile = true, radius = 0.22 }) {
  const inner = size - padding * 2;
  const scale = inner / 48;

  // Bar geometry matches src/components/brand/logo.tsx exactly.
  const bars = `
    <rect x="7" y="18.5" width="34" height="11" rx="5.5" fill="${BRAND.amber}"/>
    <rect x="18.5" y="7" width="11" height="34" rx="5.5" fill="${tile ? BRAND.white : BRAND.green}"/>
    <rect x="18.5" y="18.5" width="11" height="11" fill="${BRAND.deep}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${
    tile
      ? `<rect width="${size}" height="${size}" rx="${size * radius}" fill="${BRAND.green}"/>`
      : `<rect width="${size}" height="${size}" fill="none"/>`
  }
  <g transform="translate(${padding},${padding}) scale(${scale})">${bars}
  </g>
</svg>`;
}

const TARGETS = [
  { name: 'icon-192.png', size: 192, padding: 34 },
  { name: 'icon-512.png', size: 512, padding: 92 },
  // Maskable needs a larger safe area — Android crops to a circle on some
  // launchers, and the bars must survive that crop.
  { name: 'maskable-192.png', size: 192, padding: 46 },
  { name: 'maskable-512.png', size: 512, padding: 122 },
  { name: 'apple-touch-icon.png', size: 180, padding: 32 },
  { name: 'icon-96.png', size: 96, padding: 17 },
];

await mkdir(outDir, { recursive: true });

for (const target of TARGETS) {
  const png = await sharp(Buffer.from(markSvg(target)))
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(outDir, target.name), png);
  console.log(`  ${target.name} (${target.size}×${target.size}, ${png.length} bytes)`);
}

// Favicon: the tile reads better than a bare mark at 32–64px.
const favicon = await sharp(
  Buffer.from(markSvg({ size: 64, padding: 10, radius: 0.2 })),
)
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(resolve(root, 'src/app/favicon.ico'), favicon);
console.log('  favicon.ico (64×64)');

// Untiled mark on transparency, for e-mail and documents.
const flat = await sharp(Buffer.from(markSvg({ size: 512, padding: 24, tile: false })))
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(resolve(outDir, 'mark-512.png'), flat);
console.log('  mark-512.png (transparent)');

console.log('\nIcons written to public/icons.');

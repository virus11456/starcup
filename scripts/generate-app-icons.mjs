import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';

// Reuse Next's existing image dependency and the site's own vector emblem.
// Generated PNGs are committed; production builds never regenerate them.
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/favicon.svg', root), 'utf8');
const directory = new URL('public/app-icons/', root);
await mkdir(directory, { recursive: true });
for (const [file, size, maskable] of [
  ['icon-192.png', 192, false], ['icon-512.png', 512, false],
  ['apple-touch-icon.png', 180, false], ['maskable-512.png', 512, true],
]) {
  // Leave all important strokes inside the maskable central 80% circle.
  const emblem = maskable ? source.replace('<path', '<g transform="translate(8.96 8.96) scale(.72)"><path').replace('</svg>', '</g></svg>') : source;
  await sharp(Buffer.from(emblem)).resize(size, size).flatten({ background: '#10151f' }).png().toFile(new URL(file, directory).pathname);
}

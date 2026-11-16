import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/statoz-next-website';
if (basePath && !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(basePath)) {
  throw new Error('NEXT_PUBLIC_BASE_PATH must be empty or a slash-prefixed path without a trailing slash.');
}
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://pai45.github.io${basePath}`;
const env = { ...process.env, GITHUB_PAGES: 'true', NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_SITE_URL: siteUrl, NEXT_TELEMETRY_DISABLED: '1' };
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { stdio: 'inherit', env });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
await mkdir('out', { recursive: true });
// Next 16's Windows exporter preserves backslashes inside segment filenames.
// Browsers request the dot-separated names emitted on Linux. Normalize only
// generated __next segment payloads, keeping the export identical on both OSes.
const root = path.resolve('out');
async function normalizeSegments(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await normalizeSegments(file); continue; }
    const parts = path.relative(root, file).split(path.sep);
    const start = parts.findIndex(part => part.startsWith('__next'));
    if (start < 0 || start === parts.length - 1 || !entry.name.endsWith('.txt')) continue;
    const target = path.resolve(root, ...parts.slice(0, start), parts.slice(start).join('.'));
    if (!target.startsWith(root + path.sep)) throw new Error('Segment target escaped export directory');
    await rename(file, target);
  }
}
await normalizeSegments(root);
await writeFile('out/.nojekyll', '');
await writeFile('out/version.json', JSON.stringify({
  repository: 'pai45/statoz-next-website',
  commit: process.env.GITHUB_SHA || process.env.STATOZ_BUILD_COMMIT || null,
  version: JSON.parse(await readFile('package.json', 'utf8')).version,
  basePath, siteUrl, builtAt: new Date().toISOString(),
}, null, 2) + '\n');
console.log(`GitHub Pages export ready: ${siteUrl}/`);

// Copies a pinned, small selection from the Games workspace; no source game is changed.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const games = path.resolve(root, '../statoz-games');
const out = path.join(root, 'public/assets/city/refinement');
await mkdir(out, { recursive: true });
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const records = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [name, relative, creator, license, ratio] of [
  ['contest-props', 'src/features/games/vibe-basketball/source/public/models/contest/vibe-contest-props.glb', 'StatOz Vibe Basketball', 'Original StatOz geometry', 1],
]) {
  const source = path.join(games, relative), bytes = await readFile(source), doc = await io.read(source);
  if (name === 'contest-props') for (const node of [...doc.getRoot().listNodes()]) if (node.getName().endsWith('_LOD0')) node.dispose();
  await doc.transform(weld(), ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: .002 })] : []), dedup(), prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const result = await io.writeBinary(doc);
  await writeFile(path.join(out, `${name}.glb`), result);
  records.push({ id: name, creator, license, sourceFile: `statoz-games/${relative}`, sourceSha256: hash(bytes), output: `/assets/city/refinement/${name}.glb`, outputSha256: hash(result), bytes: result.length, modifications: 'City LOD; deduplicated, pruned, welded, Meshopt compressed. Contest keeps LOD1 only.' });
}
// Genuine catalogue artwork, shared by all fifteen in-world game displays.
const config = await readFile(path.join(root, 'src/features/home/city-journey-config.ts'), 'utf8');
const covers = [...config.matchAll(/\{ name: '([^']+)', slug: '[^']+', sport: '[^']+', image: '([^']+)' \}/g)];
const tiles = [];
for (let i = 0; i < covers.length; i++) {
  const [, name, image] = covers[i], left = i % 5 * 512, top = Math.floor(i / 5) * 320;
  tiles.push({ input: await sharp(path.join(root, 'public', image)).resize(512, 320, { fit: 'cover' }).png().toBuffer(), left, top });
  const safe = name.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  tiles.push({ input: Buffer.from(`<svg width="512" height="320"><rect y="252" width="512" height="68" fill="#07111f" fill-opacity=".93"/><rect y="252" width="512" height="3" fill="#42e8f5"/><text x="22" y="292" font-family="sans-serif" font-size="24" font-weight="700" fill="white">${safe}</text></svg>`), left, top });
}
await sharp({ create: { width: 2560, height: 960, channels: 3, background: '#07111f' } }).composite(tiles).webp({ quality: 84 }).toFile(path.join(out, 'games-atlas.webp'));
records.push({ id: 'game-catalogue', creator: 'StatOz Games', license: 'Existing StatOz catalogue artwork', sourceFile: 'src/features/home/city-journey-config.ts (all 15 local cover images)', output: '/assets/city/refinement/games-atlas.webp', modifications: 'Fifteen covers with original game names in one 5 × 3 atlas' });
// Official Poly Haven API metadata is cached, with downloads verified and pinned on first acquisition.
const metadataPath = path.join(root, '.cache/polyhaven-asphalt.json');
let meta;
try { meta = JSON.parse(await readFile(metadataPath, 'utf8')); }
catch { const response = await fetch('https://api.polyhaven.com/files/asphalt_02'); if (!response.ok) throw new Error('Poly Haven metadata request failed'); meta = await response.json(); await mkdir(path.dirname(metadataPath), { recursive: true }); await writeFile(metadataPath, JSON.stringify(meta)); }
for (const [channel, output] of [['Diffuse', 'asphalt-color'], ['nor_gl', 'asphalt-normal'], ['Rough', 'asphalt-roughness']]) {
  const info = meta[channel]['1k'].jpg;
  const cached = path.join(root, '.cache', `${output}-source.jpg`);
  let bytes;
  try { bytes = await readFile(cached); }
  catch { const response = await fetch(info.url); if (!response.ok) throw new Error(`${info.url}: ${response.status}`); bytes = Buffer.from(await response.arrayBuffer()); await writeFile(cached, bytes); }
  if (createHash('md5').update(bytes).digest('hex') !== info.md5) throw new Error(`Poly Haven checksum mismatch: ${channel}`);
  await sharp(bytes).resize(512, 512).webp({ quality: channel === 'nor_gl' ? 94 : 86 }).toFile(path.join(out, `${output}.webp`));
  records.push({ id: output, creator: 'Rob Tuytel / Poly Haven', source: 'https://polyhaven.com/a/asphalt_02', download: info.url, license: 'CC0-1.0', sourceSha256: hash(bytes), output: `/assets/city/refinement/${output}.webp`, modifications: '512px WebP, repeat at real street scale; normal map kept linear' });
}
for (const record of records) { const bytes = await readFile(path.join(root, 'public', record.output)); record.bytes = bytes.length; record.outputSha256 = hash(bytes); }
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ version: 1, licenseSources: ['https://polyhaven.com/license'], assets: records }, null, 2));
await writeFile(path.join(out, 'Poly-Haven-CC0.txt'), 'Asphalt 02 by Rob Tuytel / Poly Haven\nhttps://polyhaven.com/a/asphalt_02\nCC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/\nhttps://polyhaven.com/license\n');
console.log(JSON.stringify(records.map(({ id, bytes }) => ({ id, bytes })), null, 2));

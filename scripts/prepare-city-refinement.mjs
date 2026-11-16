// Copies a pinned, small selection from the Games workspace; no source game is changed.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
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
  ['athlete-male', 'public/games/vibe-basketball/art/athlete-male.glb', 'Quaternius; StatOz Vibe Basketball', 'CC0-1.0', .42],
  ['athlete-female', 'public/games/vibe-basketball/art/athlete-female.glb', 'Quaternius; StatOz Vibe Basketball', 'CC0-1.0', .42],
  ['contest-props', 'src/features/games/vibe-basketball/source/public/models/contest/vibe-contest-props.glb', 'StatOz Vibe Basketball', 'Original StatOz geometry', 1],
  ['formula-car', 'src/features/games/portfolio-formula/art/car/original/asset.glb', 'StatOz Formula', 'Original StatOz geometry', .32],
]) {
  const source = path.join(games, relative), bytes = await readFile(source), doc = await io.read(source);
  // A normalized UV encodes the original bind coordinates. Skin quantization bakes its
  // position decode into inverse bind matrices, so raw POSITION is not outfit space.
  if (name.startsWith('athlete-')) for (const mesh of doc.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION'), coords = new Float32Array(position.getCount() * 2), point = [];
    for (let v = 0; v < position.getCount(); v++) { position.getElement(v, point); coords[v * 2] = point[0] + .5; coords[v * 2 + 1] = point[1] / 2; }
    primitive.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(coords).setBuffer(position.getBuffer()));
  }
  if (name === 'contest-props') for (const node of [...doc.getRoot().listNodes()]) if (node.getName().endsWith('_LOD0')) node.dispose();
  await doc.transform(weld(), ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: .002 })] : []), dedup(), prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const result = await io.writeBinary(doc);
  await writeFile(path.join(out, `${name}.glb`), result);
  records.push({ id: name, creator, license, sourceFile: `statoz-games/${relative}`, sourceSha256: hash(bytes), output: `/assets/city/refinement/${name}.glb`, outputSha256: hash(result), bytes: result.length, modifications: 'City LOD; deduplicated, pruned, welded, Meshopt compressed. Contest keeps LOD1 only. Athlete outfits and poses authored at runtime.' });
}
await copyFile(path.join(games, 'public/games/vibe-basketball/art/QUATERNIUS-LICENSE.txt'), path.join(out, 'Quaternius-characters.txt'));
// Authored surface detail from the refined Penalty Shootout athlete materials.
const fabric = await readFile(path.join(games, 'public/assets/games/penalty-shootout/fabric-normal.png'));
await sharp(fabric).resize(256, 256).webp({ quality: 90 }).toFile(path.join(out, 'fabric-normal.webp'));
records.push({ id: 'athlete-fabric', creator: 'StatOz Penalty Shootout', license: 'Original StatOz material', sourceFile: 'statoz-games/public/assets/games/penalty-shootout/fabric-normal.png', sourceSha256: hash(fabric), output: '/assets/city/refinement/fabric-normal.webp', modifications: 'Resized to a 256px local normal map' });
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
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ version: 1, licenseSources: ['https://polyhaven.com/license', '/assets/city/refinement/Quaternius-characters.txt'], assets: records }, null, 2));
await writeFile(path.join(out, 'Poly-Haven-CC0.txt'), 'Asphalt 02 by Rob Tuytel / Poly Haven\nhttps://polyhaven.com/a/asphalt_02\nCC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/\nhttps://polyhaven.com/license\n');
console.log(JSON.stringify(records.map(({ id, bytes }) => ({ id, bytes })), null, 2));

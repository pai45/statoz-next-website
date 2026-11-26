import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, unweld, weld, tangents, meshopt, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import * as MikkTSpace from 'three/addons/libs/mikktspace.module.js';
import sharp from 'sharp';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

await Promise.all([MeshoptEncoder.ready, MikkTSpace.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const output = new Document(), scene = output.createScene('statoz-cockpit'); output.getRoot().setDefaultScene(scene);

function islands(primitive) {
  const position = primitive.getAttribute('POSITION'), indices = primitive.getIndices().getArray();
  const points = Array.from({ length: position.getCount() }, (_, i) => position.getElement(i, []));
  const parent = points.map((_, i) => i), seen = new Map();
  function root(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
  function join(a, b) { parent[root(a)] = root(b); }
  points.forEach((point, i) => { const key = point.map(value => value.toFixed(5)).join(','); if (seen.has(key)) join(i, seen.get(key)); else seen.set(key, i); });
  for (let i = 0; i < indices.length; i += 3) { join(indices[i], indices[i + 1]); join(indices[i], indices[i + 2]); }
  const boxes = new Map();
  points.forEach((point, i) => {
    const id = root(i);
    if (!boxes.has(id)) boxes.set(id, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
    const box = boxes.get(id);
    point.forEach((value, axis) => { box.min[axis] = Math.min(box.min[axis], value); box.max[axis] = Math.max(box.max[axis], value); });
  });
  return { indices, box: i => boxes.get(root(i)) };
}
function select(document, primitive, predicate) {
  const { indices, box } = islands(primitive), selected = [];
  for (let i = 0; i < indices.length; i += 3) if (predicate(box(indices[i]))) selected.push(indices[i], indices[i + 1], indices[i + 2]);
  primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(selected)).setBuffer(document.getRoot().listBuffers()[0]));
}
function transformMesh(mesh, scale, offset) {
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION'), normal = primitive.getAttribute('NORMAL');
    for (let i = 0; i < position.getCount(); i++) position.setElement(i, position.getElement(i, []).map((v, k) => v * scale[k] + offset[k]));
    if (normal) for (let i = 0; i < normal.getCount(); i++) { const n = normal.getElement(i, []).map((v, k) => v / scale[k]), length = Math.hypot(...n); normal.setElement(i, n.map(v => v / length)); }
    if (scale[0] * scale[1] * scale[2] < 0) { const indices = primitive.getIndices().getArray(); for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]; }
  }
}
function mergeRoot(document) {
  const mapping = mergeDocuments(output, document);
  for (const sourceScene of document.getRoot().listScenes()) { const mapped = mapping.get(sourceScene); for (const child of [...mapped.listChildren()]) { mapped.removeChild(child); scene.addChild(child); } mapped.dispose(); }
}

const dashboard = await io.read('.cache/interior-source/car-dashboard.glb');
for (const node of [...dashboard.getRoot().listNodes()]) {
  if (/cluster_glow|screen_glow/.test(node.getName())) { node.dispose(); continue; }
  if (!node.getMesh()) continue;
  if (node.getName().endsWith('_body')) select(dashboard, node.getMesh().listPrimitives()[0], b => !(b.min[1] > .48 && b.min[0] > -.21 && b.max[0] < .21));
  // Reflect the left-hand-drive module in X; preserve the steering wheel's hub pivot.
  transformMesh(node.getMesh(), [-1, 1, 1], [0, 0, 0]);
  const t = node.getTranslation(); node.setTranslation([-t[0], t[1] + .5, t[2] - .48]);
  node.setName(node.getName().replace('car-dashboard_', 'cockpit-'));
}
mergeRoot(dashboard);

const cabin = await io.read('.cache/interior-source/modern-car-interior.glb');
for (const node of [...cabin.getRoot().listNodes()]) {
  if (!node.getMesh()) continue;
  if (!node.getName().endsWith('_body')) { node.dispose(); continue; }
  select(cabin, node.getMesh().listPrimitives()[0], b => {
    const seats = b.min[2] > -.9 && b.max[2] < .08 && b.min[0] > -.69 && b.max[0] < .69 && b.min[1] > .055;
    const console = b.min[0] > -.16 && b.max[0] < .16 && b.min[2] > -.2 && b.max[2] < .58 && b.max[1] < .56;
    const door = (b.min[0] > .67 || b.max[0] < -.67) && b.min[2] > -.32 && b.max[2] < .84 && b.max[1] < .76;
    return seats || console || door;
  });
  transformMesh(node.getMesh(), [.91, .82, -.85], [0, .2, .02]);
  node.setTranslation([0, 0, 0]).setName('cockpit-seats-doors-console');
}
mergeRoot(cabin);

for (const texture of output.getRoot().listTextures()) {
  const name = texture.getName(), size = 1024;
  if (name.includes('basecolor')) {
    const { data, info } = await sharp(texture.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], luma = r * .3 + g * .5 + b * .2;
      if (r > g * 1.25 && g > b * 1.12 && r > 65) { data[i] = luma * .28; data[i + 1] = luma * .34; data[i + 2] = luma * .42; }
      else if (g > r * 1.15 && b > r * 1.12) { data[i] = luma * .34; data[i + 1] = luma * .4; data[i + 2] = luma * .46; }
      else if (b > g * 1.12 && r > g * 1.05) { data[i] = luma * .22; data[i + 1] = luma * .29; data[i + 2] = luma * .35; }
      else if (r > 150 && r > g * 1.03 && g > b * 1.08) { data[i] = luma * .28; data[i + 1] = luma * .33; data[i + 2] = luma * .39; }
    }
    texture.setImage(await sharp(data, { raw: info }).resize(size, size).jpeg({ quality: 93 }).toBuffer()).setMimeType('image/jpeg');
  } else texture.setImage(await sharp(texture.getImage()).resize(size, size).jpeg({ quality: 96 }).toBuffer()).setMimeType('image/jpeg');
}
for (const material of output.getRoot().listMaterials()) {
  if (material.getName().includes('ambient_glow')) material.setBaseColorFactor([.12, .38, .46, 1]).setEmissiveFactor([.08, .22, .28]);
  else material.setMetallicFactor(.55).setRoughnessFactor(.95);
}
await output.transform(prune(), dedup(), unweld(), tangents({ generateTangents: MikkTSpace.generateTangents }));
// Tiny source bevels with collapsed UVs need a stable, unit-length tangent basis.
for (const mesh of output.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
  const tangent = primitive.getAttribute('TANGENT'), normal = primitive.getAttribute('NORMAL');
  if (!tangent) continue;
  for (let i = 0; i < tangent.getCount(); i++) {
    const t = tangent.getElement(i, []), length = Math.hypot(t[0], t[1], t[2]);
    if (length > 1e-6) { tangent.setElement(i, [t[0] / length, t[1] / length, t[2] / length, t[3] < 0 ? -1 : 1]); continue; }
    const n = normal.getElement(i, []), a = Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    const v = [a[1] * n[2] - a[2] * n[1], a[2] * n[0] - a[0] * n[2], a[0] * n[1] - a[1] * n[0]], scale = Math.hypot(...v);
    tangent.setElement(i, [...v.map(value => value / scale), 1]);
  }
}
await output.transform(weld(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }), unpartition());
// Quantization can collapse sub-millimetre bevel triangles. Drop those zero-area indices.
for (const mesh of output.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
  const accessor = primitive.getIndices(), indices = accessor.getArray(), kept = [];
  for (let i = 0; i < indices.length; i += 3) if (indices[i] !== indices[i + 1] && indices[i] !== indices[i + 2] && indices[i + 1] !== indices[i + 2]) kept.push(indices[i], indices[i + 1], indices[i + 2]);
  accessor.setArray(new indices.constructor(kept));
}
const bytes = await io.writeBinary(output);
await writeFile('public/assets/city/statoz-cockpit.glb', bytes);
await copyFile('.cache/interior-source/LICENSE.txt', 'public/assets/city/licenses/Grab3D-Interior.txt');
const path = 'public/assets/city/manifest.json', manifest = JSON.parse(await readFile(path, 'utf8'));
manifest.licenses = [...new Set([...manifest.licenses, '/assets/city/licenses/Grab3D-Interior.txt'])];
manifest.assets = manifest.assets.filter(asset => !['statoz-cockpit-dashboard', 'statoz-cockpit-trim'].includes(asset.id));
for (const [id, source] of [['statoz-cockpit-dashboard', 'car-dashboard'], ['statoz-cockpit-trim', 'modern-car-interior']]) manifest.assets.push({ id, creator: 'Grab3D', source: `https://grab3d.com/models/vehicles/${source}/`, sourceFile: `https://grab3d.com/dl/${source}/${source}.glb`, license: 'CC0-1.0', sourceSha256: createHash('sha256').update(await readFile(`.cache/interior-source/${source}.glb`)).digest('hex'), output: '/assets/city/statoz-cockpit.glb', bytes: bytes.byteLength, modifications: 'Selected dashboard, textured steering wheel, front seats, door panels and console. Adapted to right-hand drive and fastback cabin; charcoal upholstery and gunmetal trim; removed placeholder screen content for live city navigation; resized PBR maps, generated tangents, deduplicated and Meshopt compressed. Source created procedurally in Blender with AI-assisted generator scripts, per creator disclosure.' });
await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ bytes: bytes.byteLength, textures: output.getRoot().listTextures().length, meshes: output.getRoot().listMeshes().length }));
